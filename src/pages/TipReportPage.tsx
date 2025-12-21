import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { WeeklyCalendarView } from '../components/WeeklyCalendarView';
import { TicketEditor } from '../components/TicketEditor';
import { formatTimeEST, getCurrentDateEST } from '../lib/timezone';

interface TechnicianSummary {
  technician_id: string;
  technician_name: string;
  services_count: number;
  revenue: number;
  tips_customer: number;
  tips_receptionist: number;
  tips_total: number;
  tips_cash: number;
  tips_card: number;
  items: ServiceItemDetail[];
}

interface ServiceItemDetail {
  ticket_id: string;
  service_code: string;
  service_name: string;
  price: number;
  tip_customer: number;
  tip_receptionist: number;
  tip_cash: number;
  tip_card: number;
  payment_method: string;
  opened_at: string;
  closed_at: string | null;
  ticket_completed_at: string | null;
  duration_min: number;
  started_at: string | null;
  completed_at: string | null;
  store_code: string;
  store_name: string;
}

interface TipReportPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function TipReportPage({ selectedDate, onDateChange }: TipReportPageProps) {
  const [summaries, setSummaries] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'detail' | 'weekly'>('detail');
  const [weeklyData, setWeeklyData] = useState<Map<string, Map<string, Array<{ store_id: string; store_code: string; tips_cash: number; tips_card: number; tips_total: number }>>>>(new Map());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const { showToast } = useToast();
  const { session, selectedStoreId, t } = useAuth();

  const [totals, setTotals] = useState({
    tips: 0,
    tips_cash: 0,
    tips_card: 0,
  });

  function abbreviateStoreName(storeCode: string): string {
    const codeMap: Record<string, string> = {
      'OM': 'M',
      'OC': 'C',
      'OR': 'R',
    };
    return codeMap[storeCode.toUpperCase()] || storeCode;
  }

  useEffect(() => {
    if (viewMode === 'weekly') {
      fetchWeeklyData();
    } else {
      fetchTipData();
    }
  }, [selectedDate, selectedStoreId, viewMode]);

  function getWeekStartDate(date: string): string {
    const d = new Date(date + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  function getWeekDates(startDate: string): string[] {
    const dates: string[] = [];
    const d = new Date(startDate + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
      dates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  async function fetchWeeklyData() {
    try {
      setLoading(true);

      const weekStart = getWeekStartDate(selectedDate);
      const weekDates = getWeekDates(weekStart);
      const weekEnd = weekDates[weekDates.length - 1];

      const canViewAll = session?.role_permission ? Permissions.endOfDay.canViewAll(session.role_permission) : false;
      const isTechnician = !canViewAll;

      // Get all employee-store relationships
      const { data: allEmployeeStores, error: allEmployeeStoresError } = await supabase
        .from('employee_stores')
        .select('employee_id, store_id');

      if (allEmployeeStoresError) {
        throw allEmployeeStoresError;
      }

      // Build a map of employee to their assigned stores
      const employeeStoreMap = new Map<string, string[]>();
      for (const es of allEmployeeStores || []) {
        if (!employeeStoreMap.has(es.employee_id)) {
          employeeStoreMap.set(es.employee_id, []);
        }
        employeeStoreMap.get(es.employee_id)!.push(es.store_id);
      }

      // Identify multi-store employees
      const multiStoreEmployees = new Set<string>();
      for (const [empId, stores] of employeeStoreMap.entries()) {
        if (stores.length > 1) {
          multiStoreEmployees.add(empId);
        }
      }

      let storeIds: string[] = [];

      if (isTechnician && session?.employee_id) {
        // Technician: get their own stores
        storeIds = employeeStoreMap.get(session.employee_id) || [];
      } else if (canViewAll && selectedStoreId) {
        // Admin/Manager: for multi-store employees assigned to selected store, include all their stores
        // For single-store employees, only include the selected store
        const relevantStores = new Set<string>([selectedStoreId]);

        // Add all stores for multi-store employees who are assigned to the selected store
        for (const empId of multiStoreEmployees) {
          const empStores = employeeStoreMap.get(empId) || [];
          // Only include this multi-store employee if they're assigned to the selected store
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
          ticket_date,
          store_id,
          store:stores!sale_tickets_store_id_fkey(id, name, code),
          ticket_items${isTechnician ? '!inner' : ''} (
            id,
            employee_id,
            tip_customer_cash,
            tip_customer_card,
            tip_receptionist,
            employee:employees!ticket_items_employee_id_fkey(
              id,
              display_name
            )
          )
        `
        )
        .gte('ticket_date', weekStart)
        .lte('ticket_date', weekEnd);

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

      // Build intermediate data structure: employee -> date -> store -> tips
      const dataMap = new Map<string, Map<string, Map<string, { store_id: string; store_code: string; tips_cash: number; tips_card: number; tips_total: number }>>>();

      for (const ticket of tickets || []) {
        const ticketDate = (ticket as any).ticket_date;
        const ticketStoreId = (ticket as any).store_id;
        const storeCode = (ticket as any).store?.code || '';

        for (const item of (ticket as any).ticket_items || []) {
          const techId = item.employee_id;
          const technician = item.employee;

          if (!technician) continue;

          if (isTechnician && session?.employee_id && techId !== session.employee_id) {
            continue;
          }

          // For admin/manager viewing a specific store:
          // Only show employees who are assigned to the selected store
          if (canViewAll && selectedStoreId) {
            const empStores = employeeStoreMap.get(techId) || [];
            // Skip this employee if they're not assigned to the selected store
            if (!empStores.includes(selectedStoreId)) {
              continue;
            }

            // If this ticket is from a different store, only include if employee is multi-store
            if (ticketStoreId !== selectedStoreId && !multiStoreEmployees.has(techId)) {
              continue;
            }
          }

          if (!dataMap.has(techId)) {
            dataMap.set(techId, new Map());
          }

          const techMap = dataMap.get(techId)!;
          if (!techMap.has(ticketDate)) {
            techMap.set(ticketDate, new Map());
          }

          const dateMap = techMap.get(ticketDate)!;
          if (!dateMap.has(ticketStoreId)) {
            dateMap.set(ticketStoreId, {
              store_id: ticketStoreId,
              store_code: storeCode,
              tips_cash: 0,
              tips_card: 0,
              tips_total: 0,
            });
          }

          const storeData = dateMap.get(ticketStoreId)!;
          const tipCustomerCash = item.tip_customer_cash || 0;
          const tipCustomerCard = item.tip_customer_card || 0;
          const tipReceptionist = item.tip_receptionist || 0;
          const tipCash = tipCustomerCash;
          const tipCard = tipCustomerCard + tipReceptionist;
          const tipTotal = tipCash + tipCard;

          storeData.tips_cash += tipCash;
          storeData.tips_card += tipCard;
          storeData.tips_total += tipTotal;
        }
      }

      const techNames = new Map<string, string>();
      for (const ticket of tickets || []) {
        for (const item of (ticket as any).ticket_items || []) {
          if (item.employee) {
            techNames.set(item.employee_id, item.employee.display_name);
          }
        }
      }

      // Convert intermediate structure to final structure with arrays
      const finalData = new Map<string, Map<string, Array<{ store_id: string; store_code: string; tips_cash: number; tips_card: number; tips_total: number }>>>();

      for (const [techId, dateMap] of dataMap.entries()) {
        const techDateMap = new Map<string, Array<{ store_id: string; store_code: string; tips_cash: number; tips_card: number; tips_total: number }>>();

        for (const [date, storeMap] of dateMap.entries()) {
          const storesArray = Array.from(storeMap.values());
          techDateMap.set(date, storesArray);
        }

        finalData.set(techId, techDateMap);
      }

      // Debug logging to identify data discrepancies
      if (process.env.NODE_ENV === 'development') {
        console.log('=== Weekly Data Debug Info ===');
        console.log('Selected Store ID:', selectedStoreId);
        console.log('Week Range:', weekStart, 'to', weekEnd);
        console.log('Multi-store employees:', Array.from(multiStoreEmployees));
        console.log('Total tickets processed:', tickets?.length || 0);

        for (const [techId, dateMap] of finalData.entries()) {
          const techName = techNames.get(techId) || 'Unknown';
          const storeIds = new Set<string>();
          let totalTips = 0;
          const dailyBreakdown: any = {};

          for (const [date, storesArray] of dateMap.entries()) {
            const dayData: any = {};
            for (const store of storesArray) {
              storeIds.add(store.store_id);
              totalTips += store.tips_total;
              dayData[store.store_code || store.store_id] = {
                cash: store.tips_cash.toFixed(2),
                card: store.tips_card.toFixed(2),
                total: store.tips_total.toFixed(2)
              };
            }
            dailyBreakdown[date] = dayData;
          }

          console.log(`${techName} (${techId}):`, {
            isMultiStore: multiStoreEmployees.has(techId),
            assignedStores: employeeStoreMap.get(techId) || [],
            uniqueStoresInData: Array.from(storeIds),
            weeklyTotal: totalTips.toFixed(2),
            dailyBreakdown
          });
        }
        console.log('=== End Weekly Debug Info ===');
      }

      const sortedData = new Map(
        Array.from(finalData.entries()).sort((a, b) => {
          const nameA = techNames.get(a[0]) || '';
          const nameB = techNames.get(b[0]) || '';
          return nameA.localeCompare(nameB);
        })
      );

      setWeeklyData(sortedData);

      const technicianMap = new Map<string, TechnicianSummary>();
      for (const [techId, dayMap] of sortedData.entries()) {
        const techName = techNames.get(techId) || 'Unknown';
        let totalCash = 0;
        let totalCard = 0;
        let totalTips = 0;

        for (const storesArray of dayMap.values()) {
          for (const storeData of storesArray) {
            totalCash += storeData.tips_cash;
            totalCard += storeData.tips_card;
            totalTips += storeData.tips_total;
          }
        }

        technicianMap.set(techId, {
          technician_id: techId,
          technician_name: techName,
          services_count: 0,
          revenue: 0,
          tips_customer: 0,
          tips_receptionist: 0,
          tips_total: totalTips,
          tips_cash: totalCash,
          tips_card: totalCard,
          items: [],
        });
      }

      const sortedSummaries = Array.from(technicianMap.values());
      setSummaries(sortedSummaries);
    } catch (error) {
      showToast('Failed to load weekly data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTipData() {
    try {
      setLoading(true);

      const canViewAll = session?.role_permission ? Permissions.endOfDay.canViewAll(session.role_permission) : false;
      const isTechnician = !canViewAll;

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

      // Get all employee-store relationships
      const { data: allEmployeeStores, error: allEmployeeStoresError } = await supabase
        .from('employee_stores')
        .select('employee_id, store_id');

      if (allEmployeeStoresError) {
        throw allEmployeeStoresError;
      }

      // Build a map of employee to their assigned stores
      const employeeStoreMap = new Map<string, string[]>();
      for (const es of allEmployeeStores || []) {
        if (!employeeStoreMap.has(es.employee_id)) {
          employeeStoreMap.set(es.employee_id, []);
        }
        employeeStoreMap.get(es.employee_id)!.push(es.store_id);
      }

      // Identify multi-store employees
      const multiStoreEmployees = new Set<string>();
      for (const [empId, stores] of employeeStoreMap.entries()) {
        if (stores.length > 1) {
          multiStoreEmployees.add(empId);
        }
      }

      let storeIds: string[] = [];

      if (isTechnician && session?.employee_id) {
        // Technician: get their own stores
        storeIds = employeeStoreMap.get(session.employee_id) || [];
      } else if (canViewAll && selectedStoreId) {
        // Admin/Manager: for multi-store employees assigned to selected store, include all their stores
        // For single-store employees, only include the selected store
        const relevantStores = new Set<string>([selectedStoreId]);

        // Add all stores for multi-store employees who are assigned to the selected store
        for (const empId of multiStoreEmployees) {
          const empStores = employeeStoreMap.get(empId) || [];
          // Only include this multi-store employee if they're assigned to the selected store
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
            completed_at,
            service:store_services!ticket_items_store_service_id_fkey(code, name, duration_min),
            employee:employees!ticket_items_employee_id_fkey(
              id,
              display_name
            )
          )
        `
        )
        .eq('ticket_date', selectedDate);

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
      let totalTips = 0;
      let totalTipsCash = 0;
      let totalTipsCard = 0;

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

          // For admin/manager viewing a specific store:
          // Only show employees who are assigned to the selected store
          if (canViewAll && selectedStoreId) {
            const empStores = employeeStoreMap.get(techId) || [];
            // Skip this employee if they're not assigned to the selected store
            if (!empStores.includes(selectedStoreId)) {
              continue;
            }

            // If this ticket is from a different store, only include if employee is multi-store
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
              tips_customer: 0,
              tips_receptionist: 0,
              tips_total: 0,
              tips_cash: 0,
              tips_card: 0,
              items: [],
            });
          }

          const summary = technicianMap.get(techId)!;
          const tipCustomerCash = item.tip_customer_cash || 0;
          const tipCustomerCard = item.tip_customer_card || 0;
          const tipCustomer = tipCustomerCash + tipCustomerCard;
          const tipReceptionist = item.tip_receptionist || 0;
          const tipCash = tipCustomerCash;
          const tipCard = tipCustomerCard + tipReceptionist;

          summary.services_count += 1;
          summary.revenue += itemRevenue;
          summary.tips_customer += tipCustomer;
          summary.tips_receptionist += tipReceptionist;
          summary.tips_total += tipCustomer + tipReceptionist;
          summary.tips_cash += tipCash;
          summary.tips_card += tipCard;

          totalTips += tipCustomer + tipReceptionist;
          totalTipsCash += tipCash;
          totalTipsCard += tipCard;

          summary.items.push({
            ticket_id: ticket.id,
            service_code: item.service?.code || '',
            service_name: item.service?.name || '',
            price: itemRevenue,
            tip_customer: tipCustomer,
            tip_receptionist: tipReceptionist,
            tip_cash: tipCash,
            tip_card: tipCard,
            payment_method: (ticket as any).payment_method || '',
            opened_at: (ticket as any).opened_at,
            closed_at: ticket.closed_at,
            ticket_completed_at: (ticket as any).completed_at || null,
            duration_min: item.service?.duration_min || 0,
            started_at: item.started_at || null,
            completed_at: item.completed_at || null,
            store_code: (ticket as any).store?.code || '',
            store_name: (ticket as any).store?.name || '',
          });
        }
      }

      // Debug logging for Detail Grid data
      if (process.env.NODE_ENV === 'development') {
        console.log('=== Detail Grid Debug Info ===');
        console.log('Selected Date:', selectedDate);
        console.log('Selected Store ID:', selectedStoreId);
        console.log('Multi-store employees:', Array.from(multiStoreEmployees));
        console.log('Total tickets processed:', tickets?.length || 0);

        for (const [techId, summary] of technicianMap.entries()) {
          const storeBreakdown = new Map<string, { cash: number; card: number; total: number }>();

          for (const item of summary.items) {
            const storeCode = item.store_code || 'Unknown';
            if (!storeBreakdown.has(storeCode)) {
              storeBreakdown.set(storeCode, { cash: 0, card: 0, total: 0 });
            }
            const storeData = storeBreakdown.get(storeCode)!;
            storeData.cash += item.tip_cash;
            storeData.card += item.tip_card;
            storeData.total += item.tip_customer + item.tip_receptionist;
          }

          const storeBreakdownObj: any = {};
          for (const [storeCode, data] of storeBreakdown.entries()) {
            storeBreakdownObj[storeCode] = {
              cash: data.cash.toFixed(2),
              card: data.card.toFixed(2),
              total: data.total.toFixed(2)
            };
          }

          console.log(`${summary.technician_name} (${techId}):`, {
            isMultiStore: multiStoreEmployees.has(techId),
            assignedStores: employeeStoreMap.get(techId) || [],
            uniqueStoresInData: Array.from(storeBreakdown.keys()),
            dailyTotal: summary.tips_total.toFixed(2),
            tipsCash: summary.tips_cash.toFixed(2),
            tipsCard: summary.tips_card.toFixed(2),
            itemCount: summary.items.length,
            storeBreakdown: storeBreakdownObj
          });
        }
        console.log('=== End Detail Grid Debug Info ===');
      }

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

        const technicianTotals = filteredSummaries[0];
        if (technicianTotals) {
          totalTips = technicianTotals.tips_total;
          totalTipsCash = technicianTotals.tips_cash;
          totalTipsCard = technicianTotals.tips_card;
        } else {
          totalTips = 0;
          totalTipsCash = 0;
          totalTipsCard = 0;
        }
      }

      setSummaries(filteredSummaries);
      setTotals({
        tips: totalTips,
        tips_cash: totalTipsCash,
        tips_card: totalTipsCard,
      });
    } catch (error) {
      showToast('Failed to load tip data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = [
      'Technician',
      'Services Done',
      'Tips (Customer)',
      'Tips (Receptionist)',
      'T. (Cash)',
      'T. (Card)',
      'Tips Total',
    ];

    const rows = summaries.map((s) => [
      s.technician_name,
      s.services_count.toString(),
      s.tips_customer.toFixed(2),
      s.tips_receptionist.toFixed(2),
      s.tips_cash.toFixed(2),
      s.tips_card.toFixed(2),
      s.tips_total.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tip-report-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('Tip Report exported successfully', 'success');
  }

  function handlePrint() {
    window.print();
    showToast('Opening print dialog', 'success');
  }

  function navigateWeek(direction: 'prev' | 'next') {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (direction === 'prev' ? -7 : 7));
    onDateChange(d.toISOString().split('T')[0]);
  }

  function getCurrentWeekLabel(): string {
    const weekStart = getWeekStartDate(selectedDate);
    const weekDates = getWeekDates(weekStart);
    const startDate = new Date(weekDates[0] + 'T00:00:00');
    const endDate = new Date(weekDates[6] + 'T00:00:00');

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    if (startYear !== endYear) {
      const formatDateWithYear = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      return `${formatDateWithYear(startDate)} - ${formatDateWithYear(endDate)}`;
    } else {
      const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
  }

  function getMinDate(): string {
    const canViewUnlimitedHistory = session?.role ? Permissions.tipReport.canViewUnlimitedHistory(session.role) : false;

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
    if (viewMode === 'weekly') {
      fetchWeeklyData();
    } else {
      fetchTipData();
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-bold text-gray-900">Tip Report</h2>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2 flex-1 md:flex-initial">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              min={getMinDate()}
              max={getMaxDate()}
              className="px-2 py-2 md:py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:flex-initial min-h-[44px] md:min-h-0"
            />
          </div>
          {session && session.role && Permissions.endOfDay.canExport(session.role) && (
            <>
              <Button variant="secondary" size="sm" onClick={exportCSV} className="hidden md:flex">
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePrint} className="hidden md:flex">
                <Printer className="w-3 h-3 mr-1" />
                Print
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-3">
        <div className="p-2 border-b border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="flex items-center justify-between w-full md:w-auto">
            <h3 className="text-base font-semibold text-gray-900">Technician Tips</h3>
            {viewMode === 'weekly' && (
              <div className="flex items-center gap-2 md:hidden">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigateWeek('prev')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
                  {getCurrentWeekLabel()}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigateWeek('next')}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center w-full md:w-auto justify-between">
            {viewMode === 'weekly' && (
              <div className="hidden md:flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigateWeek('prev')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                  {getCurrentWeekLabel()}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigateWeek('next')}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'detail' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('detail')}
            >
              Detail Grid
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'weekly' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('weekly')}
            >
              Weekly
            </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        ) : summaries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No tips for this date</p>
          </div>
        ) : viewMode === 'weekly' ? (
          <div className="p-2 overflow-x-auto">
            <WeeklyCalendarView
              selectedDate={selectedDate}
              weeklyData={weeklyData}
              summaries={summaries}
            />
          </div>
        ) : (
          <div className="p-1 md:p-2 overflow-x-auto">
            <div className="flex gap-1 md:gap-1.5 min-w-max">
              {summaries.map((summary) => (
                <div
                  key={summary.technician_id}
                  className="flex-shrink-0 w-[130px] md:w-[9.5%] md:min-w-[90px] border border-gray-200 rounded-md bg-white shadow-sm"
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
                              <span className="text-[9px] text-gray-600">T. (Cash)</span>
                              <span className={`text-[9px] ${summary.tips_cash === 0 ? 'text-gray-900' : 'font-semibold text-green-600'}`}>
                                ${summary.tips_cash.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] text-gray-600">T. (Card)</span>
                              <span className={`text-[9px] ${summary.tips_card === 0 ? 'text-gray-900' : 'font-semibold text-blue-600'}`}>
                                ${summary.tips_card.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-0.5 border-t border-gray-200">
                              <span className="text-[9px] font-medium text-gray-900">Total</span>
                              <span className="text-[10px] font-bold text-gray-900">
                                ${summary.tips_total.toFixed(2)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-medium text-gray-900">Total Tips</span>
                            <span className="text-[10px] font-bold text-gray-900">
                              ${summary.tips_total.toFixed(2)}
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
                        {summary.items.map((item, index) => {
                          const openTime = formatTimeEST(item.opened_at);
                          const totalTip = item.tip_customer + item.tip_receptionist;
                          const completionDuration = calculateItemCompletionDuration(item);
                          const completionStatus = getItemCompletionStatus(item);

                          return (
                            <div
                              key={index}
                              onClick={() => openTicketEditor(item.ticket_id)}
                              className="border border-gray-200 bg-gray-50 rounded p-1 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                              <div className="mb-0.5">
                                <div className="flex justify-between items-center text-[8px] text-gray-500 mb-0.5">
                                  <div className="flex items-center gap-0.5 truncate">
                                    <span className="truncate">
                                      {openTime.replace(/\s/g, '')}
                                    </span>
                                    {item.store_code && (
                                      <span className="text-[7px] text-gray-400">
                                        [{abbreviateStoreName(item.store_code)}]
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`ml-1 flex-shrink-0 font-semibold ${
                                      completionStatus === 'on_time'
                                        ? 'text-green-800'
                                        : completionStatus === 'moderate_deviation'
                                        ? 'text-amber-800'
                                        : completionStatus === 'extreme_deviation'
                                        ? 'text-red-800'
                                        : 'text-gray-500'
                                    }`}
                                  >
                                    {completionDuration > 0 ? `${completionDuration}min` : `${item.duration_min}min`}
                                  </span>
                                </div>
                                <div className="text-[9px] font-semibold text-gray-900">
                                  {item.service_code}
                                </div>
                              </div>
                              {showDetails ? (
                                <div className="space-y-0">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[8px] text-gray-600">T. (given)</span>
                                    <span className={`text-[8px] ${item.tip_customer === 0 ? 'text-gray-900' : 'font-semibold text-gray-900'}`}>
                                      ${item.tip_customer.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[8px] text-gray-600">T. (paired)</span>
                                    <span className={`text-[8px] ${item.tip_receptionist === 0 ? 'text-gray-900' : 'font-semibold text-orange-600'}`}>
                                      ${item.tip_receptionist.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] text-gray-600">Total Tip</span>
                                  <span className={`text-[8px] ${totalTip === 0 ? 'text-gray-900' : 'font-semibold text-gray-900'}`}>
                                    ${totalTip.toFixed(2)}
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
        )}
      </div>

      {isEditorOpen && (
        <TicketEditor
          ticketId={editingTicketId}
          onClose={closeTicketEditor}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
