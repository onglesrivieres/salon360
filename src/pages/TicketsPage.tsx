import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Calendar, CheckCircle, Clock, AlertCircle, Filter, X, XCircle, DollarSign } from 'lucide-react';
import { supabase, SaleTicket } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { TicketEditor } from '../components/TicketEditor';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { formatTimeEST, getCurrentDateEST } from '../lib/timezone';

interface TicketsPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function TicketsPage({ selectedDate, onDateChange }: TicketsPageProps) {
  const [tickets, setTickets] = useState<SaleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTicketForApproval, setSelectedTicketForApproval] = useState<SaleTicket | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  useEffect(() => {
    fetchTickets();
  }, [selectedDate, selectedStoreId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const refreshTimer = setInterval(() => {
      fetchTickets(true); // silent refresh, don't show loading state
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
    };
  }, [selectedDate, selectedStoreId]);

  async function fetchTickets(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      }

      const isTechnician = session?.role_permission === 'Technician';
      const isCashier = session?.role_permission === 'Cashier';

      // Safety check: Cashiers can only view today's date
      if (isCashier) {
        const today = getCurrentDateEST();
        if (selectedDate !== today) {
          onDateChange(today);
          showToast('Cashiers can only view today\'s tickets', 'info');
          return;
        }
      }

      let query = supabase
        .from('sale_tickets')
        .select(`
          *,
          ticket_items (
            id,
            employee_id,
            tip_customer_cash,
            tip_customer_card,
            tip_receptionist,
            custom_service_name,
            started_at,
            completed_at,
            service:store_services!ticket_items_store_service_id_fkey(code, name, duration_min),
            employee:employees!ticket_items_employee_id_fkey(display_name)
          )
        `)
        .eq('ticket_date', selectedDate);

      if (selectedStoreId) {
        query = query.eq('store_id', selectedStoreId);
      }

      // Cashiers can only see open tickets
      if (isCashier) {
        query = query.is('closed_at', null);
      }

      query = query.order('opened_at', { ascending: false});

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];

      if (isTechnician && session?.employee_id) {
        filteredData = filteredData.filter(ticket =>
          ticket.ticket_items && ticket.ticket_items.some((item: any) => item.employee_id === session.employee_id)
        );
      }

      setTickets(filteredData);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      showToast('Failed to load tickets', 'error');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  function openEditor(ticketId?: string) {
    setEditingTicketId(ticketId || null);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setEditingTicketId(null);
    fetchTickets();
  }

  function getTipCustomer(ticket: any): number {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return 0;
    const item = ticket.ticket_items[0];
    return (item?.tip_customer_cash || 0) + (item?.tip_customer_card || 0);
  }

  function getTipReceptionist(ticket: any): number {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return 0;
    return ticket.ticket_items[0]?.tip_receptionist || 0;
  }

  function getServiceName(ticket: any): string {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return '-';
    const firstItem = ticket.ticket_items[0];
    if (firstItem?.custom_service_name) return firstItem.custom_service_name;
    const service = firstItem?.service;
    return service ? service.code : '-';
  }

  function getTechnicianName(ticket: any): string {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return '-';
    const employee = ticket.ticket_items[0]?.employee;
    return employee ? employee.display_name : '-';
  }

  function getCustomerType(ticket: any): string {
    return ticket.customer_type || '-';
  }

  function getApprovalStatusBadge(ticket: SaleTicket) {
    if (!ticket.approval_status) {
      if (ticket.closed_at) {
        return <Badge variant="success">Closed</Badge>;
      }
      return null;
    }

    switch (ticket.approval_status) {
      case 'pending_approval':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {ticket.approved_by ? 'Approved' : 'Auto'}
          </span>
        );
      case 'auto_approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Auto
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  }

  // Get unique technicians from tickets
  const technicians = useMemo(() => {
    const techSet = new Map<string, string>();
    tickets.forEach(ticket => {
      if (ticket.ticket_items && ticket.ticket_items.length > 0) {
        ticket.ticket_items.forEach((item: any) => {
          if (item.employee_id && item.employee?.display_name) {
            techSet.set(item.employee_id, item.employee.display_name);
          }
        });
      }
    });
    return Array.from(techSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    let filtered = tickets;

    // Apply approval status filter
    if (approvalFilter !== 'all') {
      filtered = filtered.filter(ticket => {
        if (approvalFilter === 'self_service_pending') {
          return ticket.opened_by_role &&
            ['Technician', 'Spa Expert', 'Supervisor'].includes(ticket.opened_by_role) &&
            !ticket.reviewed_by_receptionist;
        }
        if (approvalFilter === 'open') return !ticket.closed_at;
        if (approvalFilter === 'closed') return ticket.closed_at && !ticket.approval_status;
        if (approvalFilter === 'pending_approval') return ticket.approval_status === 'pending_approval';
        if (approvalFilter === 'approved') return ticket.approval_status === 'approved';
        if (approvalFilter === 'auto_approved') return ticket.approval_status === 'auto_approved';
        if (approvalFilter === 'rejected') return ticket.approval_status === 'rejected';
        return true;
      });
    }

    // Apply payment method filter
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.payment_method === paymentMethodFilter);
    }

    // Apply technician filter
    if (technicianFilter !== 'all') {
      filtered = filtered.filter(ticket => {
        if (!ticket.ticket_items || ticket.ticket_items.length === 0) return false;
        return ticket.ticket_items.some((item: any) => item.employee_id === technicianFilter);
      });
    }

    return filtered;
  }, [tickets, approvalFilter, paymentMethodFilter, technicianFilter]);

  function getMinDate(): string {
    const canViewUnlimitedHistory = session?.role ? Permissions.tickets.canViewAll(session.role) : false;

    if (canViewUnlimitedHistory) {
      return '2000-01-01';
    }

    const today = getCurrentDateEST();
    const date = new Date(today);
    date.setDate(date.getDate() - 14);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getMaxDate(): string {
    return getCurrentDateEST();
  }

  function getServiceDuration(ticket: any): number {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return 0;
    const service = ticket.ticket_items[0]?.service;
    return service?.duration_min || 0;
  }

  function getElapsedMinutes(openedAt: string, closedAt?: string, completedAt?: string): number {
    const opened = new Date(openedAt);
    // Timer stops at whichever comes first: completed_at or closed_at
    const end = closedAt ? new Date(closedAt) : (completedAt ? new Date(completedAt) : currentTime);
    const diff = Math.floor((end.getTime() - opened.getTime()) / 1000 / 60);
    return Math.max(0, diff);
  }

  function isTimeDeviationHigh(ticket: any): boolean {
    const serviceDuration = getServiceDuration(ticket);
    if (serviceDuration === 0) return false;

    const elapsedMinutes = getElapsedMinutes(ticket.opened_at, ticket.closed_at, ticket.completed_at);

    // For open tickets (not closed AND not completed): check if running 30% longer
    if (!ticket.closed_at && !ticket.completed_at) {
      return elapsedMinutes >= serviceDuration * 1.3;
    }

    // For completed/closed tickets: check if 30% shorter OR 30% longer
    const tooFast = elapsedMinutes <= serviceDuration * 0.7;
    const tooSlow = elapsedMinutes >= serviceDuration * 1.3;

    return tooFast || tooSlow;
  }

  function getCompletionStatus(ticket: any): 'on_time' | 'moderate_deviation' | 'extreme_deviation' | 'unknown' {
    // Only check status for closed tickets with completed_at timestamp
    if (!ticket.closed_at || !ticket.completed_at) return 'unknown';

    // Get the first ticket item to determine expected service duration
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return 'unknown';
    const firstItem = ticket.ticket_items[0];

    // Get expected duration from service
    const service = firstItem.service;
    const expectedDuration = service?.duration_min;

    // If no expected duration (custom service or missing data), return unknown
    if (!expectedDuration || expectedDuration === 0) return 'unknown';

    // Calculate actual duration from ticket open to completion (matches TicketEditor logic)
    const startTime = new Date(ticket.opened_at);
    const endTime = new Date(ticket.completed_at);
    const actualDurationMs = endTime.getTime() - startTime.getTime();
    const actualDurationMin = Math.floor(actualDurationMs / 1000 / 60);

    const percentage = (actualDurationMin / expectedDuration) * 100;

    if (percentage < 70) return 'extreme_deviation';
    if (percentage < 90) return 'moderate_deviation';
    if (percentage <= 110) return 'on_time';
    if (percentage <= 130) return 'moderate_deviation';
    return 'extreme_deviation';
  }

  function formatDuration(openedAt: string): string {
    const opened = new Date(openedAt);
    const diff = Math.floor((currentTime.getTime() - opened.getTime()) / 1000);

    if (diff < 0) return '0s';

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function getActiveFilterCount(): number {
    let count = 0;
    if (approvalFilter !== 'all') count++;
    if (paymentMethodFilter !== 'all') count++;
    if (technicianFilter !== 'all') count++;
    return count;
  }

  function clearAllFilters(): void {
    setApprovalFilter('all');
    setPaymentMethodFilter('all');
    setTechnicianFilter('all');
  }

  function getTotalTips(ticket: any): number {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return 0;
    return ticket.ticket_items.reduce((total: number, item: any) => {
      return total + (item?.tip_customer_cash || 0) + (item?.tip_customer_card || 0) + (item?.tip_receptionist || 0);
    }, 0);
  }

  function canApproveTicket(ticket: SaleTicket): boolean {
    if (!session?.employee_id || !session?.role) return false;
    if (!Permissions.tickets.canApprove(session.role)) return false;
    if (ticket.approval_status !== 'pending_approval') return false;

    // Check if the current employee worked on this ticket
    const isTechnician = session.role.some((role: string) => ['Technician', 'Spa Expert'].includes(role));
    if (isTechnician && ticket.ticket_items) {
      return ticket.ticket_items.some((item: any) => item.employee_id === session.employee_id);
    }

    return true;
  }

  async function handleApproveTicket(ticket: SaleTicket, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent opening the editor

    if (!session?.employee_id) {
      showToast('Session expired. Please log in again.', 'error');
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('approve_ticket', {
        p_ticket_id: ticket.id,
        p_employee_id: session.employee_id,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        showToast(result.message, 'error');
        return;
      }

      await supabase.from('ticket_activity_log').insert([{
        ticket_id: ticket.id,
        employee_id: session.employee_id,
        action: 'approved',
        description: `${session.display_name} approved ticket`,
        changes: {
          approval_status: 'approved',
          ticket_no: ticket.ticket_no,
        },
      }]);

      showToast('Ticket approved successfully', 'success');
      fetchTickets();
    } catch (error: any) {
      console.error('Error approving ticket:', error);
      showToast(error.message || 'Failed to approve ticket', 'error');
    } finally {
      setProcessing(false);
    }
  }

  function handleRejectTicketClick(ticket: SaleTicket, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent opening the editor
    setSelectedTicketForApproval(ticket);
    setRejectionReason('');
    setShowRejectModal(true);
  }

  async function handleRejectTicket() {
    if (!selectedTicketForApproval || !rejectionReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    if (!session?.employee_id) {
      showToast('Session expired. Please log in again.', 'error');
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('reject_ticket', {
        p_ticket_id: selectedTicketForApproval.id,
        p_employee_id: session.employee_id,
        p_rejection_reason: rejectionReason,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        showToast(result.message, 'error');
        return;
      }

      await supabase.from('ticket_activity_log').insert([{
        ticket_id: selectedTicketForApproval.id,
        employee_id: session.employee_id,
        action: 'rejected',
        description: `${session.display_name} rejected ticket: ${rejectionReason}`,
        changes: {
          approval_status: 'rejected',
          rejection_reason: rejectionReason,
          ticket_no: selectedTicketForApproval.ticket_no,
        },
      }]);

      showToast('Ticket rejected and sent for admin review', 'success');
      setShowRejectModal(false);
      setSelectedTicketForApproval(null);
      setRejectionReason('');
      fetchTickets();
    } catch (error: any) {
      console.error('Error rejecting ticket:', error);
      showToast(error.message || 'Failed to reject ticket', 'error');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading tickets...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-bold text-gray-900">Sale Tickets</h2>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
          <div className="relative">
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] md:min-h-0 flex items-center gap-2 ${
                getActiveFilterCount() > 0
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {getActiveFilterCount() > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                  {getActiveFilterCount()}
                </span>
              )}
            </button>

            {isFilterPanelOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsFilterPanelOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                      <button
                        onClick={() => setIsFilterPanelOpen(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Approval Status
                      </label>
                      <select
                        value={approvalFilter}
                        onChange={(e) => setApprovalFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Tickets</option>
                        <option value="self_service_pending">Self-Service (Needs Review)</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed (No Status)</option>
                        <option value="pending_approval">Pending Approval</option>
                        <option value="approved">Approved</option>
                        <option value="auto_approved">Auto-Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethodFilter}
                        onChange={(e) => setPaymentMethodFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Payment Methods</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Mixed">Mixed</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Technician
                      </label>
                      <select
                        value={technicianFilter}
                        onChange={(e) => setTechnicianFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Technicians</option>
                        {technicians.map(tech => (
                          <option key={tech.id} value={tech.id}>{tech.name}</option>
                        ))}
                      </select>
                    </div>

                    {getActiveFilterCount() > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {session?.role_permission !== 'Cashier' && (
            <div className="flex items-center gap-2 flex-1 md:flex-initial">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="px-2 py-1.5 md:py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:flex-initial min-h-[44px] md:min-h-0"
              />
            </div>
          )}
          {session && session.role_permission && Permissions.tickets.canCreate(session.role_permission) && (
            <Button size="sm" onClick={() => openEditor()} className="min-h-[44px] md:min-h-0">
              <Plus className="w-4 h-4 md:w-3 md:h-3 mr-1" />
              <span className="hidden xs:inline">New Ticket</span>
              <span className="xs:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tech
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approval
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTickets.map((ticket) => {
                const tipCustomer = getTipCustomer(ticket);
                const tipReceptionist = getTipReceptionist(ticket);
                const serviceName = getServiceName(ticket);
                const technicianName = getTechnicianName(ticket);
                const customerType = getCustomerType(ticket);
                const time = formatTimeEST(ticket.opened_at);

                const isApproved = ticket.approval_status === 'approved' || ticket.approval_status === 'auto_approved';
                const canEdit = session && session.role_permission && Permissions.tickets.canEdit(
                  session.role_permission,
                  !!ticket.closed_at,
                  isApproved
                );
                const canView = session && session.role_permission && Permissions.tickets.canView(session.role_permission);

                const isSelfServiceTicket =
                  ticket.opened_by_role &&
                  ['Technician', 'Spa Expert', 'Supervisor'].includes(ticket.opened_by_role) &&
                  !ticket.reviewed_by_receptionist &&
                  !ticket.closed_at;

                const isUnclosedTicket = !ticket.closed_at;
                const isClosedTicket = !!ticket.closed_at;

                let rowBackgroundClass = 'bg-gray-100 hover:bg-gray-200';
                if (isSelfServiceTicket) {
                  rowBackgroundClass = 'bg-green-50 hover:bg-green-100';
                } else if (isUnclosedTicket) {
                  rowBackgroundClass = 'bg-yellow-50 hover:bg-yellow-100 animate-pulse';
                } else if (isClosedTicket) {
                  rowBackgroundClass = 'bg-gray-100 hover:bg-gray-200';
                }

                return (
                  <tr
                    key={ticket.id}
                    className={`
                      ${rowBackgroundClass}
                      ${canView ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
                      transition-colors duration-200
                    `}
                    onClick={() => canView && openEditor(ticket.id)}
                    title={!canView ? 'You do not have permission to view this ticket' : ''}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {time}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {customerType}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {serviceName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {technicianName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      ${ticket.total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {ticket.closed_at ? (
                          (() => {
                            const status = getCompletionStatus(ticket);
                            return (
                              <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                status === 'on_time'
                                  ? 'bg-green-100 text-green-800'
                                  : status === 'moderate_deviation'
                                  ? 'bg-amber-100 text-amber-800'
                                  : status === 'extreme_deviation'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                Closed
                              </div>
                            );
                          })()
                        ) : ticket.completed_at ? (
                          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Completed
                          </div>
                        ) : (
                          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isTimeDeviationHigh(ticket) ? 'flash-red' : 'bg-orange-100 text-red-600'
                          }`}>
                            {formatDuration(ticket.opened_at)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {getApprovalStatusBadge(ticket)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTickets.length === 0 && tickets.length > 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No tickets match the selected filter</p>
          </div>
        )}
        {tickets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">No tickets found for this date</p>
            {session && session.role_permission && Permissions.tickets.canCreate(session.role_permission) && (
              <Button size="sm" onClick={() => openEditor()}>Create First Ticket</Button>
            )}
          </div>
        )}
      </div>

      <div className="md:hidden space-y-2">
        {filteredTickets.map((ticket) => {
          const tipCustomer = getTipCustomer(ticket);
          const tipReceptionist = getTipReceptionist(ticket);
          const totalTips = getTotalTips(ticket);
          const serviceName = getServiceName(ticket);
          const technicianName = getTechnicianName(ticket);
          const customerType = getCustomerType(ticket);
          const time = formatTimeEST(ticket.opened_at);

          const isApproved = ticket.approval_status === 'approved' || ticket.approval_status === 'auto_approved';
          const canEdit = session && Permissions.tickets.canEdit(
            session.role_permission,
            !!ticket.closed_at,
            isApproved
          );
          const canView = session && Permissions.tickets.canView(session.role_permission);
          const showApprovalButtons = canApproveTicket(ticket);

          const isSelfServiceTicket =
            ticket.opened_by_role &&
            ['Technician', 'Spa Expert', 'Supervisor'].includes(ticket.opened_by_role) &&
            !ticket.reviewed_by_receptionist &&
            !ticket.closed_at;

          const isUnclosedTicket = !ticket.closed_at;
          const isClosedTicket = !!ticket.closed_at;
          const isHighTip = totalTips > 20;

          let cardBackgroundClass = 'bg-gray-100';
          let cardHoverClass = 'active:bg-gray-200';

          if (isSelfServiceTicket) {
            cardBackgroundClass = 'bg-green-50';
            cardHoverClass = 'active:bg-green-100';
          } else if (isUnclosedTicket) {
            cardBackgroundClass = 'bg-yellow-50 animate-pulse';
            cardHoverClass = 'active:bg-yellow-100';
          } else if (isClosedTicket) {
            cardBackgroundClass = 'bg-gray-100';
            cardHoverClass = 'active:bg-gray-200';
          }

          return (
            <div
              key={ticket.id}
              onClick={() => canView && !showApprovalButtons && openEditor(ticket.id)}
              className={`${cardBackgroundClass} rounded-lg shadow p-3 ${
                canView && !showApprovalButtons ? `cursor-pointer ${cardHoverClass}` : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className={`flex-1 ${canView && showApprovalButtons ? 'cursor-pointer' : ''}`}
                  onClick={() => canView && showApprovalButtons && openEditor(ticket.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{customerType}</span>
                    <span className="text-xs text-gray-500">{time}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {serviceName} • {technicianName}
                  </div>
                </div>
                <div className="text-right flex flex-col gap-1 items-end">
                  {ticket.closed_at ? (
                    (() => {
                      const status = getCompletionStatus(ticket);
                      return (
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          status === 'on_time'
                            ? 'bg-green-100 text-green-800'
                            : status === 'moderate_deviation'
                            ? 'bg-amber-100 text-amber-800'
                            : status === 'extreme_deviation'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          Closed
                        </div>
                      );
                    })()
                  ) : ticket.completed_at ? (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      Completed
                    </div>
                  ) : (
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      isTimeDeviationHigh(ticket) ? 'flash-red' : 'bg-orange-100 text-red-600'
                    }`}>
                      {formatDuration(ticket.opened_at)}
                    </div>
                  )}
                  {getApprovalStatusBadge(ticket)}
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="text-sm font-semibold text-gray-900">${ticket.total.toFixed(2)}</div>
                  </div>
                  {isClosedTicket && (
                    <div className={isHighTip ? 'bg-orange-50 rounded px-2 -mx-2' : ''}>
                      <div className={`text-xs font-medium ${isHighTip ? 'text-orange-700' : 'text-gray-500'}`}>
                        Total Tips
                      </div>
                      <div className={`text-sm font-semibold ${isHighTip ? 'text-orange-700' : 'text-green-600'}`}>
                        ${totalTips.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                {showApprovalButtons && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={(e) => handleApproveTicket(ticket, e)}
                      disabled={processing}
                      className="flex-1 min-h-[44px]"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => handleRejectTicketClick(ticket, e)}
                      disabled={processing}
                      className="flex-1 min-h-[44px] text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredTickets.length === 0 && tickets.length > 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-sm text-gray-500">No tickets match the selected filter</p>
          </div>
        )}
        {tickets.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">No tickets found for this date</p>
            {session && session.role_permission && Permissions.tickets.canCreate(session.role_permission) && (
              <Button size="sm" onClick={() => openEditor()}>Create First Ticket</Button>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showRejectModal}
        onClose={() => !processing && setShowRejectModal(false)}
        title="Reject Ticket"
        onConfirm={handleRejectTicket}
        confirmText={processing ? 'Rejecting...' : 'Reject Ticket'}
        confirmVariant="danger"
        cancelText="Cancel"
      >
        {selectedTicketForApproval && (
          <div>
            <p className="text-gray-700 mb-3">
              Rejecting ticket <strong>{selectedTicketForApproval.ticket_no}</strong> will send it for admin review.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection <span className="text-red-600">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Please explain why you are rejecting this ticket..."
                disabled={processing}
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                The ticket will be locked and require admin review before any further action can be taken.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {isEditorOpen && (
        <TicketEditor
          ticketId={editingTicketId}
          onClose={closeEditor}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
