import React, { useState, useEffect } from 'react';
import { Check, X, Circle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { TicketEditor } from '../components/TicketEditor';
import { formatTimeEST } from '../lib/timezone';
import {
  calculateServiceDuration,
  formatTimerDisplay,
  hasActiveTimer,
  getTimerStatus,
  TimerServiceItem
} from '../lib/timerUtils';
import { getStoreClosingTimeForDate } from '../lib/workingHours';

interface TechnicianSummary {
  technician_id: string;
  technician_name: string;
  services_count: number;
  revenue: number;
  service_revenue: number;
  addon_revenue: number;
  total_revenue: number;
  approved_revenue: number;
  items: ServiceItemDetail[];
}

interface ServiceItemDetail {
  ticket_id: string;
  service_code: string;
  service_name: string;
  price: number;
  service_revenue: number;
  addon_revenue: number;
  payment_method: string;
  opened_at: string;
  closed_at: string | null;
  ticket_completed_at: string | null;
  duration_min: number;
  started_at: string | null;
  timer_stopped_at: string | null;
  completed_at: string | null;
  store_code: string;
  store_name: string;
  approval_status: string | null;
}

interface TicketGroup {
  ticket_id: string;
  opened_at: string;
  store_code: string;
  totalDuration: number;
  totalRevenue: number;
  services: ServiceItemDetail[];
  hasActiveTimer: boolean;
  approval_status: string | null;
}

interface TicketsDetailViewProps {
  selectedDate: string;
  onRefresh?: () => void;
  isCommissionEmployee?: boolean;
}

export function TicketsDetailView({ selectedDate, onRefresh, isCommissionEmployee = false }: TicketsDetailViewProps) {
  const [summaries, setSummaries] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [multiStoreEmployeeIds, setMultiStoreEmployeeIds] = useState<Set<string>>(new Set());
  const [storeClosingTime, setStoreClosingTime] = useState<string | null>(null);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  useEffect(() => {
    fetchTipData();
  }, [selectedDate, selectedStoreId]);

  // Timer refresh effect - update every 30 seconds if there are active timers
  useEffect(() => {
    const hasAnyActiveTimer = summaries.some(s =>
      s.items.some(item => item.started_at && !item.timer_stopped_at && !item.completed_at)
    );
    if (!hasAnyActiveTimer) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, [summaries]);

  // Fetch store closing time for "Last Ticket" detection (based on selectedDate)
  useEffect(() => {
    async function fetchClosingTime() {
      if (!selectedStoreId || !selectedDate) return;
      const closingTime = await getStoreClosingTimeForDate(selectedStoreId, selectedDate);
      setStoreClosingTime(closingTime);
    }
    fetchClosingTime();
  }, [selectedStoreId, selectedDate]);

  // Check if a ticket was opened within 45 minutes before store closing time
  function isLastTicket(openedAt: string): boolean {
    if (!storeClosingTime) return false;
    // Convert to EST timezone to match store hours
    const openedDate = new Date(openedAt);
    const estTime = new Date(openedDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const openedHour = estTime.getHours();
    const openedMin = estTime.getMinutes();
    const openedMinutes = openedHour * 60 + openedMin;
    const [closeHour, closeMin] = storeClosingTime.split(':').map(Number);
    const closingMinutes = closeHour * 60 + closeMin;
    const LAST_TICKET_THRESHOLD = 45;
    const thresholdMinutes = closingMinutes - LAST_TICKET_THRESHOLD;
    return openedMinutes >= thresholdMinutes && openedMinutes < closingMinutes;
  }

  // Group items by ticket for multi-service display
  function groupItemsByTicket(items: ServiceItemDetail[]): TicketGroup[] {
    const ticketMap = new Map<string, TicketGroup>();
    for (const item of items) {
      if (!ticketMap.has(item.ticket_id)) {
        ticketMap.set(item.ticket_id, {
          ticket_id: item.ticket_id,
          opened_at: item.opened_at,
          store_code: item.store_code,
          totalDuration: 0,
          totalRevenue: 0,
          services: [],
          hasActiveTimer: false,
          approval_status: item.approval_status,
        });
      }
      const group = ticketMap.get(item.ticket_id)!;
      group.services.push(item);
      group.totalRevenue += item.service_revenue + item.addon_revenue;
      const timerItem: TimerServiceItem = {
        started_at: item.started_at,
        timer_stopped_at: item.timer_stopped_at,
        completed_at: item.completed_at,
        ticket_completed_at: item.ticket_completed_at,
        ticket_closed_at: item.closed_at,
      };
      group.totalDuration += calculateServiceDuration(timerItem, currentTime);
      if (hasActiveTimer(timerItem)) group.hasActiveTimer = true;
    }
    return Array.from(ticketMap.values()).sort((a, b) =>
      new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
    );
  }

  function abbreviateStoreName(storeCode: string): string {
    const codeMap: Record<string, string> = {
      'OM': 'M',
      'OC': 'C',
      'OR': 'R',
    };
    return codeMap[storeCode.toUpperCase()] || storeCode;
  }

  function getStoreColor(storeCode: string): string {
    const abbrev = abbreviateStoreName(storeCode);
    switch (abbrev) {
      case 'M': return 'text-pink-600';
      case 'C': return 'text-green-600';
      case 'R': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  }

  function getApprovalIcon(status: string | null) {
    switch (status) {
      case 'approved':
      case 'auto_approved':
        return <Check className="w-3 h-3 text-green-600" />;
      case 'rejected':
        return <X className="w-3 h-3 text-red-600" />;
      case 'pending_approval':
        return <Circle className="w-3 h-3 text-yellow-500 fill-yellow-500" />;
      default:
        return null;
    }
  }

  async function fetchDailyTipData(dateToFetch: string): Promise<{ technicianMap: Map<string, TechnicianSummary>; multiStoreEmployees: Set<string> }> {
    const canViewAll = session?.role ? Permissions.tipReport.canViewAll(session.role) : false;
    // Commission employees should only see their own tickets, regardless of their role
    const isTechnician = !canViewAll || isCommissionEmployee;

    const { data: allEmployeeStores, error: allEmployeeStoresError } = await supabase
      .from('employee_stores')
      .select('employee_id, store_id');

    if (allEmployeeStoresError) {
      throw allEmployeeStoresError;
    }

    const employeeStoreMap = new Map<string, string[]>();
    for (const es of allEmployeeStores || []) {
      if (!employeeStoreMap.has(es.employee_id)) {
        employeeStoreMap.set(es.employee_id, []);
      }
      employeeStoreMap.get(es.employee_id)!.push(es.store_id);
    }

    const multiStoreEmployees = new Set<string>();
    for (const [empId, stores] of employeeStoreMap.entries()) {
      if (stores.length > 1) {
        multiStoreEmployees.add(empId);
      }
    }

    let storeIds: string[] = [];

    if (isTechnician && session?.employee_id) {
      storeIds = employeeStoreMap.get(session.employee_id) || [];
    } else if (canViewAll && selectedStoreId) {
      const relevantStores = new Set<string>([selectedStoreId]);

      for (const empId of multiStoreEmployees) {
        const empStores = employeeStoreMap.get(empId) || [];
        if (empStores.includes(selectedStoreId)) {
          for (const storeId of empStores) {
            relevantStores.add(storeId);
          }
        }
      }

      storeIds = Array.from(relevantStores);
    }

    let query = supabase
      .from('sale_tickets')
      .select(
        `
        id,
        total,
        payment_method,
        opened_at,
        closed_at,
        completed_at,
        store_id,
        approval_status,
        store:stores!sale_tickets_store_id_fkey(id, name, code),
        ticket_items${isTechnician ? '!inner' : ''} (
          id,
          store_service_id,
          custom_service_name,
          employee_id,
          qty,
          price_each,
          addon_price,
          tip_customer_cash,
          tip_customer_card,
          tip_receptionist,
          started_at,
          timer_stopped_at,
          completed_at,
          service:store_services!ticket_items_store_service_id_fkey(code, name, duration_min),
          employee:employees!ticket_items_employee_id_fkey(
            id,
            display_name
          )
        )
      `
      )
      .eq('ticket_date', dateToFetch);

    if (storeIds.length > 0) {
      query = query.in('store_id', storeIds);
    } else if (selectedStoreId) {
      query = query.eq('store_id', selectedStoreId);
    }

    if (isTechnician && session?.employee_id) {
      query = query.eq('ticket_items.employee_id', session.employee_id);
    }

    const { data: tickets, error: ticketsError } = await query;

    if (ticketsError) throw ticketsError;

    const technicianMap = new Map<string, TechnicianSummary>();

    for (const ticket of tickets || []) {
      const ticketStoreId = (ticket as any).store_id;

      for (const item of (ticket as any).ticket_items || []) {
        const itemRevenue = (parseFloat(item.qty) || 0) * (parseFloat(item.price_each) || 0) + (parseFloat(item.addon_price) || 0);
        const techId = item.employee_id;
        const technician = item.employee;

        if (!technician) continue;

        if (isTechnician && session?.employee_id && techId !== session.employee_id) {
          continue;
        }

        if (canViewAll && selectedStoreId) {
          const empStores = employeeStoreMap.get(techId) || [];
          if (!empStores.includes(selectedStoreId)) {
            continue;
          }

          if (ticketStoreId !== selectedStoreId && !multiStoreEmployees.has(techId)) {
            continue;
          }
        }

        if (!technicianMap.has(techId)) {
          technicianMap.set(techId, {
            technician_id: techId,
            technician_name: technician.display_name,
            services_count: 0,
            revenue: 0,
            service_revenue: 0,
            addon_revenue: 0,
            total_revenue: 0,
            approved_revenue: 0,
            items: [],
          });
        }

        const summary = technicianMap.get(techId)!;
        const serviceRevenue = (parseFloat(item.qty) || 0) * (parseFloat(item.price_each) || 0);
        const addonRevenue = parseFloat(item.addon_price) || 0;

        // Check if ticket is approved (same pattern as TipReportPage)
        const approvalStatus = (ticket as any).approval_status;
        const isApprovedTicket = approvalStatus === 'approved' ||
                                 approvalStatus === 'auto_approved' ||
                                 !approvalStatus; // null = legacy tickets

        summary.services_count += 1;
        summary.revenue += itemRevenue;
        summary.service_revenue += serviceRevenue;
        summary.addon_revenue += addonRevenue;
        summary.total_revenue += itemRevenue;

        // Only add to approved_revenue if ticket is approved
        if (isApprovedTicket) {
          summary.approved_revenue += itemRevenue;
        }

        summary.items.push({
          ticket_id: ticket.id,
          service_code: item.service?.code || '',
          service_name: item.service?.name || '',
          price: itemRevenue,
          service_revenue: serviceRevenue,
          addon_revenue: addonRevenue,
          payment_method: (ticket as any).payment_method || '',
          opened_at: (ticket as any).opened_at,
          closed_at: ticket.closed_at,
          ticket_completed_at: (ticket as any).completed_at || null,
          duration_min: item.service?.duration_min || 0,
          started_at: item.started_at || null,
          timer_stopped_at: item.timer_stopped_at || null,
          completed_at: item.completed_at || null,
          store_code: (ticket as any).store?.code || '',
          store_name: (ticket as any).store?.name || '',
          approval_status: (ticket as any).approval_status || null,
        });
      }
    }

    return { technicianMap, multiStoreEmployees };
  }

  async function fetchTipData() {
    try {
      setLoading(true);

      const canViewAll = session?.role ? Permissions.tipReport.canViewAll(session.role) : false;
      // Commission employees should only see their own tickets, regardless of their role
      const isTechnician = !canViewAll || isCommissionEmployee;

      if (isTechnician && session?.employee_id) {
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('tip_report_show_details')
          .eq('id', session.employee_id)
          .maybeSingle();

        if (!employeeError && employeeData) {
          setShowDetails(employeeData.tip_report_show_details ?? true);
        } else {
          setShowDetails(true);
        }
      } else {
        setShowDetails(true);
      }

      const { technicianMap, multiStoreEmployees } = await fetchDailyTipData(selectedDate);
      setMultiStoreEmployeeIds(multiStoreEmployees);

      let filteredSummaries = Array.from(technicianMap.values());

      filteredSummaries.forEach(summary => {
        summary.items.sort((a, b) => {
          return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
        });
      });

      if (session?.role_permission === 'Technician') {
        filteredSummaries = filteredSummaries.filter(
          summary => summary.technician_id === session.employee_id
        );
      }

      setSummaries(filteredSummaries);
    } catch (error) {
      showToast('Failed to load tip data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function calculateItemCompletionDuration(item: ServiceItemDetail): number {
    if (item.started_at && item.completed_at) {
      const started = new Date(item.started_at);
      const completed = new Date(item.completed_at);
      const durationMinutes = Math.floor((completed.getTime() - started.getTime()) / (1000 * 60));
      return Math.max(0, durationMinutes);
    }

    if (item.opened_at && item.ticket_completed_at) {
      const opened = new Date(item.opened_at);
      const ticketCompleted = new Date(item.ticket_completed_at);
      const durationMinutes = Math.floor((ticketCompleted.getTime() - opened.getTime()) / (1000 * 60));
      return Math.max(0, durationMinutes);
    }

    if (item.opened_at && item.closed_at) {
      const opened = new Date(item.opened_at);
      const closed = new Date(item.closed_at);
      const durationMinutes = Math.floor((closed.getTime() - opened.getTime()) / (1000 * 60));
      return Math.max(0, durationMinutes);
    }

    return 0;
  }

  function getItemCompletionStatus(item: ServiceItemDetail): 'on_time' | 'moderate_deviation' | 'extreme_deviation' | 'unknown' {
    const expectedDuration = item.duration_min;
    const hasCompletionData = item.completed_at || item.ticket_completed_at || item.closed_at;

    if (expectedDuration === 0 || !hasCompletionData) return 'unknown';

    const actualDuration = calculateItemCompletionDuration(item);
    if (actualDuration === 0) return 'unknown';

    const percentage = (actualDuration / expectedDuration) * 100;

    if (percentage < 70) return 'extreme_deviation';
    if (percentage < 90) return 'moderate_deviation';
    if (percentage <= 110) return 'on_time';
    if (percentage <= 130) return 'moderate_deviation';
    return 'extreme_deviation';
  }

  function openTicketEditor(ticketId: string) {
    setEditingTicketId(ticketId);
    setIsEditorOpen(true);
  }

  function closeTicketEditor() {
    setIsEditorOpen(false);
    setEditingTicketId(null);
    fetchTipData();
    if (onRefresh) {
      onRefresh();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-gray-500">Loading tip data...</div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">No tips for this date</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-1 md:p-2 overflow-x-auto">
        <div className="flex gap-1 md:gap-1.5 min-w-max">
          {summaries.map((summary) => (
            <div
              key={summary.technician_id}
              className="flex-shrink-0 w-[140px] md:w-[10%] md:min-w-[110px] border border-gray-200 rounded-md bg-white shadow-sm"
            >
              <div className="bg-gray-50 border-b border-gray-200 px-1.5 py-1 rounded-t-md">
                <h4 className="text-[10px] font-semibold text-gray-900 leading-tight truncate">
                  {summary.technician_name}
                </h4>
                <p className="text-[9px] text-gray-500">
                  {summary.services_count} service{summary.services_count !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="p-1">
                <div className="mb-1 pb-1 border-b border-gray-200 space-y-0.5">
                  <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">
                    Daily Total
                  </p>
                  <div className="space-y-0.5">
                    {showDetails ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-gray-600">Sub-total</span>
                          <span className="text-[9px] font-semibold text-gray-900">
                            ${summary.approved_revenue.toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-0.5 border-t border-gray-200">
                          <span className="text-[9px] font-medium text-gray-900">Total</span>
                          <span className="text-[10px] font-bold text-gray-900">
                            ${summary.approved_revenue.toFixed(0)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-medium text-gray-900">Total Revenue</span>
                        <span className="text-[10px] font-bold text-gray-900">
                          ${summary.approved_revenue.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                    Sale Tickets
                  </p>
                  <div className="space-y-1 max-h-[1500px] overflow-y-auto">
                    {groupItemsByTicket(summary.items).map((group) => {
                      const openTime = formatTimeEST(group.opened_at);
                      const isMultiService = group.services.length > 1;

                      if (isMultiService) {
                        // Multi-service ticket - grouped box with blue border (or purple for last ticket)
                        const isLast = isLastTicket(group.opened_at);
                        const cardClasses = isLast
                          ? "border-2 border-purple-300 bg-purple-50/30 rounded p-1 cursor-pointer hover:bg-purple-100/50 hover:border-purple-400 transition-colors"
                          : "border-2 border-blue-300 bg-blue-50/30 rounded p-1 cursor-pointer hover:bg-blue-100/50 hover:border-blue-400 transition-colors";
                        const borderColor = isLast ? "border-purple-200" : "border-blue-200";
                        const leftBorderColor = isLast ? "border-purple-400" : "border-blue-400";
                        return (
                          <div
                            key={group.ticket_id}
                            onClick={() => openTicketEditor(group.ticket_id)}
                            className={cardClasses}
                          >
                            {/* Header with opening time and total duration */}
                            <div className={`flex justify-between items-center text-[8px] text-gray-500 mb-1 pb-0.5 border-b ${borderColor}`}>
                              <div className="flex items-center gap-0.5 truncate">
                                <span className="truncate">
                                  {openTime.replace(/\s/g, '')}
                                </span>
                                {getApprovalIcon(group.approval_status)}
                                {multiStoreEmployeeIds.has(summary.technician_id) && group.store_code && (
                                  <span className={`text-[7px] font-medium ${getStoreColor(group.store_code)}`}>
                                    [{abbreviateStoreName(group.store_code)}]
                                  </span>
                                )}
                              </div>
                              <span className={`ml-1 flex-shrink-0 font-semibold ${group.hasActiveTimer ? 'text-blue-700' : 'text-gray-600'}`}>
                                {formatTimerDisplay(group.totalDuration)}
                                {group.hasActiveTimer && '*'}
                              </span>
                            </div>
                            {/* Service list with individual timers */}
                            <div className={`border-l-2 ${leftBorderColor} pl-1 space-y-0.5`}>
                              {group.services.map((item, svcIndex) => {
                                const timerItem: TimerServiceItem = {
                                  started_at: item.started_at,
                                  timer_stopped_at: item.timer_stopped_at,
                                  completed_at: item.completed_at,
                                  ticket_completed_at: item.ticket_completed_at,
                                  ticket_closed_at: item.closed_at,
                                };
                                const svcDuration = calculateServiceDuration(timerItem, currentTime);
                                const timerStatus = getTimerStatus(timerItem);
                                const completionStatus = getItemCompletionStatus(item);
                                const timerColor = timerStatus === 'active'
                                  ? 'bg-blue-100 text-blue-800'
                                  : completionStatus === 'on_time'
                                    ? 'bg-green-100 text-green-800'
                                    : completionStatus === 'moderate_deviation'
                                      ? 'bg-amber-100 text-amber-800'
                                      : completionStatus === 'extreme_deviation'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800';
                                return (
                                  <div key={svcIndex} className="flex justify-between items-center">
                                    <span className="text-[9px] font-semibold text-gray-900">
                                      {item.service_code}
                                    </span>
                                    <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${timerColor}`}>
                                      {formatTimerDisplay(svcDuration)}{timerStatus === 'active' && '*'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Revenue */}
                            {showDetails ? (
                              <div className={`flex justify-between items-center mt-1 pt-0.5 border-t ${borderColor}`}>
                                <span className="text-[8px] text-gray-600">Sub-total</span>
                                <span className="text-[8px] font-semibold text-gray-900">
                                  ${group.totalRevenue.toFixed(0)}
                                </span>
                              </div>
                            ) : (
                              <div className={`flex justify-between items-center mt-1 pt-0.5 border-t ${borderColor}`}>
                                <span className="text-[8px] text-gray-600">Total</span>
                                <span className="text-[8px] font-semibold text-gray-900">
                                  ${group.totalRevenue.toFixed(0)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Single-service ticket (or purple for last ticket)
                      const item = group.services[0];
                      const timerItem: TimerServiceItem = {
                        started_at: item.started_at,
                        timer_stopped_at: item.timer_stopped_at,
                        completed_at: item.completed_at,
                        ticket_completed_at: item.ticket_completed_at,
                        ticket_closed_at: item.closed_at,
                      };
                      const svcDuration = calculateServiceDuration(timerItem, currentTime);
                      const timerStatus = getTimerStatus(timerItem);
                      const completionStatus = getItemCompletionStatus(item);
                      const isLast = isLastTicket(group.opened_at);
                      const timerColor = timerStatus === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : completionStatus === 'on_time'
                          ? 'bg-green-100 text-green-800'
                          : completionStatus === 'moderate_deviation'
                            ? 'bg-amber-100 text-amber-800'
                            : completionStatus === 'extreme_deviation'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800';
                      const cardClasses = isLast
                        ? "border border-purple-300 bg-purple-50 rounded p-1 cursor-pointer hover:bg-purple-100 hover:border-purple-400 transition-colors"
                        : "border border-gray-200 bg-gray-50 rounded p-1 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors";
                      const totalRevenue = item.service_revenue + item.addon_revenue;

                      return (
                        <div
                          key={group.ticket_id}
                          onClick={() => openTicketEditor(item.ticket_id)}
                          className={cardClasses}
                        >
                          <div className="mb-0.5">
                            <div className="flex justify-between items-center text-[8px] text-gray-500 mb-0.5">
                              <div className="flex items-center gap-0.5 truncate">
                                <span className="truncate">
                                  {openTime.replace(/\s/g, '')}
                                </span>
                                {getApprovalIcon(group.approval_status)}
                                {multiStoreEmployeeIds.has(summary.technician_id) && item.store_code && (
                                  <span className={`text-[7px] font-medium ${getStoreColor(item.store_code)}`}>
                                    [{abbreviateStoreName(item.store_code)}]
                                  </span>
                                )}
                              </div>
                              <span className={`ml-1 flex-shrink-0 text-[8px] font-semibold px-1 py-0.5 rounded ${timerColor}`}>
                                {formatTimerDisplay(svcDuration)}{timerStatus === 'active' && '*'}
                              </span>
                            </div>
                            <div className="text-[9px] font-semibold text-gray-900">
                              {item.service_code}
                            </div>
                          </div>
                          {showDetails ? (
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] text-gray-600">Sub-total</span>
                              <span className="text-[8px] font-semibold text-gray-900">
                                ${totalRevenue.toFixed(0)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] text-gray-600">Total</span>
                              <span className="text-[8px] font-semibold text-gray-900">
                                ${totalRevenue.toFixed(0)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isEditorOpen && (
        <TicketEditor
          ticketId={editingTicketId}
          onClose={closeTicketEditor}
          selectedDate={selectedDate}
        />
      )}
    </>
  );
}
