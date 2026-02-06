import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Edit2, Check, CheckCircle, Clock, AlertCircle, Filter, X, XCircle, DollarSign, ChevronLeft, ChevronRight, ChevronDown, ImageIcon, FileText, Calendar, CalendarRange } from 'lucide-react';
import { supabase, SaleTicket } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { TicketEditor } from '../components/TicketEditor';
import { TicketsDetailView } from '../components/TicketsDetailView';
import { TicketsPeriodView } from '../components/TicketsPeriodView';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { formatTimeEST, getCurrentDateEST } from '../lib/timezone';

interface TicketsPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  highlightedTicketId?: string | null;
  onHighlightComplete?: () => void;
}

export function TicketsPage({ selectedDate, onDateChange, highlightedTicketId, onHighlightComplete }: TicketsPageProps) {
  const [viewMode, setViewMode] = useState<'tickets' | 'daily' | 'period'>('tickets');
  const [tickets, setTickets] = useState<SaleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quickFilter, setQuickFilter] = useState<'all' | 'unclosed'>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTicketForApproval, setSelectedTicketForApproval] = useState<SaleTicket | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const { showToast } = useToast();
  const { session, selectedStoreId, t } = useAuth();

  // Receptionist/Cashier: local date state to bypass global date lock (only for Tickets page)
  const isLocalDateRole = session?.role_permission === 'Receptionist' || session?.role_permission === 'Cashier';
  const [localDate, setLocalDate] = useState(getCurrentDateEST());
  const activeDate = isLocalDateRole ? localDate : selectedDate;
  const activeDateChange = isLocalDateRole ? setLocalDate : onDateChange;

  // Ref for highlighted ticket row (for scroll-into-view)
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const highlightedCardRef = useRef<HTMLDivElement>(null);

  // State for responsive view mode dropdown
  const [isViewModeDropdownOpen, setIsViewModeDropdownOpen] = useState(false);
  const viewModeDropdownRef = useRef<HTMLDivElement>(null);

  // Check if user is a commission employee
  const [isCommissionEmployee, setIsCommissionEmployee] = useState(false);

  useEffect(() => {
    async function checkPayType() {
      if (session?.employee_id) {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('pay_type')
          .eq('id', session.employee_id)
          .maybeSingle();
        setIsCommissionEmployee(employeeData?.pay_type === 'commission');
      }
    }
    checkPayType();
  }, [session?.employee_id]);

  // Management roles can always see tips regardless of pay type
  const MANAGEMENT_ROLES = ['Admin', 'Manager', 'Owner', 'Supervisor'] as const;
  const isManagement = session?.role ?
    MANAGEMENT_ROLES.some(r => session.role?.includes(r)) : false;

  // Determine if tips should be hidden (commission employees without management role)
  const shouldHideTips = isCommissionEmployee && !isManagement;

  // Daily tab: Admin, Owner, Manager, Supervisor, Receptionist, Cashier, or commission employees
  // Non-commission Technician cannot access this tab
  const canViewDailyReport = session?.role ? (Permissions.tipReport.canViewAll(session.role) || isCommissionEmployee) : false;
  // Period tab: Only Admin, Owner, and commission employees can see it
  // Manager, Supervisor, Receptionist, and Cashier cannot access this tab
  const canViewPeriodReport = session?.role ? (
    session.role.some(r => ['Admin', 'Owner'].includes(r)) || isCommissionEmployee
  ) : false;

  // View mode tab configuration for responsive dropdown
  const viewModeConfig: Array<{ key: 'tickets' | 'daily' | 'period'; label: string; icon: typeof FileText }> = [
    { key: 'tickets', label: t('tickets.viewModeTickets'), icon: FileText },
    { key: 'daily', label: t('tickets.viewModeDaily'), icon: Calendar },
    { key: 'period', label: t('tickets.viewModePeriod'), icon: CalendarRange },
  ];
  const visibleViewModes = viewModeConfig.filter(mode =>
    mode.key === 'tickets' || (mode.key === 'daily' && canViewDailyReport) || (mode.key === 'period' && canViewPeriodReport)
  );
  const currentViewMode = viewModeConfig.find(mode => mode.key === viewMode);

  // Click-outside handler for view mode dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (viewModeDropdownRef.current && !viewModeDropdownRef.current.contains(event.target as Node)) {
        setIsViewModeDropdownOpen(false);
      }
    }
    if (isViewModeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isViewModeDropdownOpen]);

  useEffect(() => {
    fetchTickets();
  }, [activeDate, selectedStoreId]);

  useEffect(() => {
    if (!canViewDailyReport && viewMode === 'daily') {
      setViewMode('tickets');
      showToast(t('tickets.noPermissionDailyReports'), 'error');
    }
    if (!canViewPeriodReport && viewMode === 'period') {
      setViewMode('tickets');
      showToast(t('tickets.noPermissionPeriodReports'), 'error');
    }
  }, [viewMode, canViewDailyReport, canViewPeriodReport]);

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
  }, [activeDate, selectedStoreId]);

  // Effect to handle ticket highlighting from navigation
  useEffect(() => {
    if (highlightedTicketId && !loading) {
      // Check if the highlighted ticket exists in the current ticket list
      const ticketExists = tickets.some(t => t.id === highlightedTicketId);

      if (ticketExists) {
        // Scroll to the highlighted ticket after a brief delay
        setTimeout(() => {
          const rowRef = highlightedRowRef.current;
          const cardRef = highlightedCardRef.current;
          const targetRef = rowRef || cardRef;

          if (targetRef) {
            targetRef.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }

          // Auto-open the TicketEditor
          openEditor(highlightedTicketId);
        }, 100);

        // Clear the highlight after 5 seconds
        const timer = setTimeout(() => {
          onHighlightComplete?.();
        }, 5000);

        return () => clearTimeout(timer);
      }
    }
  }, [highlightedTicketId, loading, tickets]);

  async function fetchTickets(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      }

      const isRestrictedRole = session?.role_permission === 'Technician';

      // Check if user is a commission employee
      let isCommissionEmployee = false;
      if (session?.employee_id) {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('pay_type')
          .eq('id', session.employee_id)
          .maybeSingle();

        isCommissionEmployee = employeeData?.pay_type === 'commission';
      }

      let query = supabase
        .from('sale_tickets')
        .select(`
          *,
          ticket_items (
            id,
            employee_id,
            price_each,
            addon_price,
            payment_cash,
            payment_card,
            payment_gift_card,
            discount_amount,
            discount_amount_cash,
            tip_customer_cash,
            tip_customer_card,
            tip_receptionist,
            custom_service_name,
            started_at,
            completed_at,
            service:store_services!ticket_items_store_service_id_fkey(code, name, duration_min),
            employee:employees!ticket_items_employee_id_fkey(display_name)
          ),
          ticket_photos (id)
        `)
        .eq('ticket_date', activeDate);

      if (selectedStoreId) {
        query = query.eq('store_id', selectedStoreId);
      }

      query = query
        .order('opened_at', { ascending: false })
        .order('id', { ascending: true, referencedTable: 'ticket_items' });

      const { data, error } = await query;

      // DEBUG: Log query results to diagnose empty tickets issue
      console.log('fetchTickets DEBUG:', {
        selectedStoreId,
        activeDate,
        role_permission: session?.role_permission,
        role: session?.role,
        employee_id: session?.employee_id,
        error,
        dataCount: data?.length,
        firstTicket: data?.[0]
      });

      if (error) throw error;

      let filteredData = data || [];

      // Check if user has permission to view all tickets
      const canViewAllTickets = session?.role_permission && Permissions.tickets.canViewAll(session.role_permission);

      // DEBUG: Log filter conditions
      console.log('fetchTickets FILTER DEBUG:', {
        canViewAllTickets,
        isRestrictedRole,
        isCommissionEmployee,
        willFilter: !canViewAllTickets && (isRestrictedRole || isCommissionEmployee) && session?.employee_id,
        beforeFilterCount: filteredData.length
      });

      // Filter tickets for technicians, spa experts, and commission employees to show only their work
      // But allow roles with canViewAll permission (Receptionist, Admin, etc.) to see everything
      if (!canViewAllTickets && (isRestrictedRole || isCommissionEmployee) && session?.employee_id) {
        filteredData = filteredData.filter(ticket =>
          ticket.ticket_items && ticket.ticket_items.some((item: any) => item.employee_id === session.employee_id)
        );
      }

      console.log('fetchTickets FINAL:', { afterFilterCount: filteredData.length });

      setTickets(filteredData);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      showToast(t('tickets.failedToLoad'), 'error');
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
    const serviceNames = ticket.ticket_items
      .map((item: any) => {
        if (item?.custom_service_name) return item.custom_service_name;
        return item?.service?.code || null;
      })
      .filter((name: string | null) => name !== null);
    return serviceNames.length > 0 ? serviceNames.join(' | ') : '-';
  }

  function getTechnicianName(ticket: any): string {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return '-';
    const employee = ticket.ticket_items[0]?.employee;
    return employee ? employee.display_name : '-';
  }

  function getCustomerType(ticket: any): string {
    return ticket.customer_type || '-';
  }

  function getSubtotal(ticket: any): number {
    // Calculate from ticket_items: price_each + addon_price for all items
    return ticket.ticket_items?.reduce(
      (sum: number, item: any) => {
        const price = parseFloat(item.price_each) || 0;
        const addonPrice = parseFloat(item.addon_price) || 0;
        return sum + price + addonPrice;
      },
      0
    ) || 0;
  }

  function canViewTotalColumn(): boolean {
    if (!session?.role) return false;
    return session.role.includes('Receptionist') ||
           session.role.includes('Admin') ||
           session.role.includes('Manager') ||
           session.role.includes('Owner') ||
           session.role.includes('Supervisor') ||
           session.role.includes('Cashier');
  }

  function getGrandTotalCollected(ticket: any): number {
    const firstItem = ticket.ticket_items?.[0];
    if (!firstItem) return 0;

    // Payment values are the same on all items, so take from first item
    const totalPayments =
      (firstItem.payment_cash || 0) +
      (firstItem.payment_card || 0) +
      (firstItem.payment_gift_card || 0);

    // Discount based on payment method (from first item)
    let totalDiscount = 0;
    if (ticket.payment_method === 'Cash') {
      totalDiscount = firstItem.discount_amount_cash || 0;
    } else if (ticket.payment_method === 'Card' || ticket.payment_method === 'Mixed') {
      totalDiscount = firstItem.discount_amount || 0;
    }

    // Card tips from first item
    const tipCustomerCard = firstItem.tip_customer_card || 0;

    return totalPayments - totalDiscount + tipCustomerCard;
  }

  function getApprovalStatusBadge(ticket: SaleTicket) {
    if (!ticket.approval_status) {
      if (ticket.closed_at) {
        return <Badge variant="success">{t('tickets.closed')}</Badge>;
      }
      return null;
    }

    switch (ticket.approval_status) {
      case 'pending_approval':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Clock className="w-3 h-3 mr-1" />
            {t('tickets.pending')}
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {ticket.approved_by ? t('tickets.approved') : t('tickets.auto')}
          </span>
        );
      case 'auto_approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            {t('tickets.auto')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t('tickets.rejected')}
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

    // Apply quick filter first
    if (quickFilter === 'unclosed') {
      filtered = filtered.filter(ticket => !ticket.closed_at);
    }

    // Apply approval status filter
    if (approvalFilter !== 'all') {
      filtered = filtered.filter(ticket => {
        if (approvalFilter === 'self_service_pending') {
          return ticket.opened_by_role &&
            ['Technician', 'Trainee', 'Supervisor'].includes(ticket.opened_by_role) &&
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
  }, [tickets, quickFilter, approvalFilter, paymentMethodFilter, technicianFilter]);

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

  function navigateDay(direction: 'prev' | 'next'): void {
    const currentDate = new Date(activeDate + 'T00:00:00');
    if (direction === 'prev') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    activeDateChange(`${year}-${month}-${day}`);
  }

  function canNavigatePrev(): boolean {
    return activeDate > getMinDate();
  }

  function canNavigateNext(): boolean {
    return activeDate < getMaxDate();
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
    if (quickFilter !== 'all') count++;
    if (approvalFilter !== 'all') count++;
    if (paymentMethodFilter !== 'all') count++;
    if (technicianFilter !== 'all') count++;
    return count;
  }

  function clearAllFilters(): void {
    setQuickFilter('all');
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

  // Check if the same person opened, performed, and closed the ticket
  function isSamePersonOpenedPerformedClosed(ticket: SaleTicket): boolean {
    // Check if closed
    if (!ticket.closed_at || !ticket.created_by || !ticket.closed_by) return false;

    // Check if same person opened and closed
    if (ticket.created_by !== ticket.closed_by) return false;

    // Check if same person performed (single performer, same as closer)
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return false;

    const performerIds = new Set(ticket.ticket_items.map((item: any) => item.employee_id));

    // Single performer and same as closer
    return performerIds.size === 1 && performerIds.has(ticket.closed_by);
  }

  // Check if the current user can approve based on role hierarchy for self-service tickets
  function canApproveBasedOnRole(ticket: SaleTicket): boolean {
    if (!session?.role_permission) return false;

    // Only applies to self-service tickets (same person opened, performed, closed)
    if (!isSamePersonOpenedPerformedClosed(ticket)) return false;

    const openerRole = ticket.opened_by_role;
    const currentUserRole = session.role_permission;

    // Supervisor tickets require Manager, Owner, or Admin approval
    if (openerRole === 'Supervisor') {
      return ['Manager', 'Owner', 'Admin'].includes(currentUserRole);
    }

    // Manager tickets require Owner or Admin approval
    if (openerRole === 'Manager') {
      return ['Owner', 'Admin'].includes(currentUserRole);
    }

    return false;
  }

  function canApproveTicket(ticket: SaleTicket): boolean {
    if (!session?.employee_id || !session?.role) return false;
    if (!Permissions.tickets.canApprove(session.role)) return false;

    // Must be closed and not in a final approval status
    if (!ticket.closed_at) return false;
    const finalStatuses = ['approved', 'auto_approved', 'rejected'];
    if (ticket.approval_status && finalStatuses.includes(ticket.approval_status)) return false;

    // Receptionist can only approve technician-level tickets they worked on
    if (session.role_permission === 'Receptionist' &&
        ticket.approval_required_level &&
        ticket.approval_required_level !== 'technician') {
      return false;
    }

    // ALL users can only approve tickets where they personally performed the service
    if (ticket.ticket_items) {
      return ticket.ticket_items.some((item: any) => item.employee_id === session.employee_id);
    }

    return false;
  }

  async function handleApproveTicket(ticket: SaleTicket, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent opening the editor

    if (!session?.employee_id) {
      showToast(t('tickets.sessionExpired'), 'error');
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

      showToast(t('tickets.approvedSuccess'), 'success');
      fetchTickets();
    } catch (error: any) {
      console.error('Error approving ticket:', error);
      showToast(error.message || t('tickets.failedToApprove'), 'error');
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
      showToast(t('tickets.provideRejectionReason'), 'error');
      return;
    }

    if (!session?.employee_id) {
      showToast(t('tickets.sessionExpired'), 'error');
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

      showToast(t('tickets.rejectedSentForReview'), 'success');
      setShowRejectModal(false);
      setSelectedTicketForApproval(null);
      setRejectionReason('');
      fetchTickets();
    } catch (error: any) {
      console.error('Error rejecting ticket:', error);
      showToast(error.message || t('tickets.failedToReject'), 'error');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* Mobile dropdown - visible on screens < md */}
          {visibleViewModes.length > 1 && (
            <div className="md:hidden" ref={viewModeDropdownRef}>
              <div className="relative">
                <button
                  onClick={() => setIsViewModeDropdownOpen(!isViewModeDropdownOpen)}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 min-w-[120px]"
                >
                  <div className="flex items-center gap-2">
                    {currentViewMode && (
                      <>
                        <currentViewMode.icon className="w-4 h-4" />
                        <span>{currentViewMode.label}</span>
                      </>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isViewModeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isViewModeDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    {visibleViewModes.map((mode) => {
                      const Icon = mode.icon;
                      const isActive = viewMode === mode.key;
                      return (
                        <button
                          key={mode.key}
                          onClick={() => { setViewMode(mode.key); setIsViewModeDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{mode.label}</span>
                          </div>
                          {isActive && <CheckCircle className="w-4 h-4 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Desktop tabs - visible on screens >= md */}
          <div className={`hidden ${visibleViewModes.length > 1 ? 'md:inline-flex' : 'inline-flex'} rounded-lg border border-gray-300 bg-white`}>
            {visibleViewModes.map((mode, index) => {
              const isFirst = index === 0;
              const isLast = index === visibleViewModes.length - 1;
              return (
                <button
                  key={mode.key}
                  onClick={() => setViewMode(mode.key)}
                  className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium ${
                    isFirst ? 'rounded-l-lg' : ''
                  } ${isLast ? 'rounded-r-lg' : ''} ${
                    !isFirst ? 'border-l border-gray-300' : ''
                  } transition-colors ${
                    viewMode === mode.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
          {viewMode === 'tickets' && (
            <>
              <div className="inline-flex rounded-lg border border-gray-300 bg-white min-h-[44px] md:min-h-0">
                <button
                  onClick={() => setQuickFilter('all')}
                  className={`px-3 py-2 text-sm font-medium rounded-l-lg transition-colors min-h-[44px] md:min-h-0 ${
                    quickFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('tickets.all')}
                </button>
                <button
                  onClick={() => setQuickFilter('unclosed')}
                  className={`px-3 py-2 text-sm font-medium rounded-r-lg border-l border-gray-300 transition-colors min-h-[44px] md:min-h-0 ${
                    quickFilter === 'unclosed'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('tickets.unclosed')}
                </button>
              </div>
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
                  <span>{t('tickets.filters')}</span>
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
                      <h3 className="text-sm font-semibold text-gray-900">{t('tickets.filters')}</h3>
                      <button
                        onClick={() => setIsFilterPanelOpen(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('tickets.approvalStatus')}
                      </label>
                      <select
                        value={approvalFilter}
                        onChange={(e) => setApprovalFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">{t('tickets.allTickets')}</option>
                        <option value="self_service_pending">{t('tickets.selfServiceNeedsReview')}</option>
                        <option value="open">{t('tickets.open')}</option>
                        <option value="closed">{t('tickets.closedNoStatus')}</option>
                        <option value="pending_approval">{t('tickets.pendingApproval')}</option>
                        <option value="approved">{t('tickets.approved')}</option>
                        <option value="auto_approved">{t('tickets.autoApproved')}</option>
                        <option value="rejected">{t('tickets.rejected')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('tickets.paymentMethod')}
                      </label>
                      <select
                        value={paymentMethodFilter}
                        onChange={(e) => setPaymentMethodFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">{t('tickets.allPaymentMethods')}</option>
                        <option value="Cash">{t('tickets.cash')}</option>
                        <option value="Card">{t('tickets.card')}</option>
                        <option value="Mixed">{t('tickets.mixed')}</option>
                        <option value="Other">{t('tickets.other')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('tickets.technician')}
                      </label>
                      <select
                        value={technicianFilter}
                        onChange={(e) => setTechnicianFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">{t('tickets.allTechnicians')}</option>
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
                        {t('tickets.clearAllFilters')}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
              </div>
            </>
          )}
          {viewMode !== 'period' && (
            <div className="flex items-center gap-2 flex-1 md:flex-initial">
              <button
                onClick={() => navigateDay('prev')}
                disabled={!canNavigatePrev()}
                className="p-2 md:p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors min-h-[44px] md:min-h-[32px] min-w-[44px] md:min-w-[32px] flex items-center justify-center"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <div className="flex items-center gap-2 flex-1 md:flex-initial">
                <input
                  type="date"
                  value={activeDate}
                  onChange={(e) => activeDateChange(e.target.value)}
                  min={getMinDate()}
                  max={getMaxDate()}
                  className="px-2 py-1.5 md:py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:flex-initial min-h-[44px] md:min-h-0"
                />
              </div>
              <button
                onClick={() => navigateDay('next')}
                disabled={!canNavigateNext()}
                className="p-2 md:p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors min-h-[44px] md:min-h-[32px] min-w-[44px] md:min-w-[32px] flex items-center justify-center"
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5 md:w-4 md:h-4" />
              </button>
            </div>
          )}
          {viewMode === 'tickets' && session && session.role_permission && Permissions.tickets.canCreate(session.role_permission) && (
            <Button
              size="sm"
              onClick={() => {
                if (session.role_permission === 'Cashier') {
                  showToast(t('tickets.cashierCannotCreate'), 'error');
                  return;
                }
                openEditor();
              }}
              className={`min-h-[44px] md:min-h-0${session.role_permission === 'Cashier' ? ' opacity-50 cursor-not-allowed' : ''}`}
            >
              <Plus className="w-4 h-4 md:w-3 md:h-3 mr-1" />
              <span className="hidden xs:inline">{t('tickets.newTicket')}</span>
              <span className="xs:hidden">{t('common.new')}</span>
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'daily' ? (
        <div className="bg-white rounded-lg shadow">
          <TicketsDetailView selectedDate={activeDate} onRefresh={fetchTickets} isCommissionEmployee={isCommissionEmployee} />
        </div>
      ) : viewMode === 'period' ? (
        <div className="bg-white rounded-lg shadow">
          <TicketsPeriodView selectedDate={activeDate} onDateChange={activeDateChange} isCommissionEmployee={isCommissionEmployee} />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.time')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.customer')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.service')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.tech')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.subtotal')}
                </th>
                {canViewTotalColumn() && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('tickets.total')}
                  </th>
                )}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.status')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.approval')}
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
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
                  ['Technician', 'Trainee', 'Supervisor'].includes(ticket.opened_by_role) &&
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

                const isHighlighted = ticket.id === highlightedTicketId;

                return (
                  <tr
                    key={ticket.id}
                    ref={isHighlighted ? highlightedRowRef : null}
                    className={`
                      ${rowBackgroundClass}
                      ${canView ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
                      ${isHighlighted ? 'animate-highlight-pulse ring-4 ring-yellow-400' : ''}
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
                      ${getSubtotal(ticket).toFixed(2)}
                    </td>
                    {canViewTotalColumn() && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        ${getGrandTotalCollected(ticket).toFixed(2)}
                      </td>
                    )}
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
                                {status === 'unknown' ? t('tickets.closedUnknown') : t('tickets.closed')}
                              </div>
                            );
                          })()
                        ) : ticket.completed_at ? (
                          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {t('tickets.completed')}
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
                      <div className="flex items-center gap-2">
                        {isSamePersonOpenedPerformedClosed(ticket) &&
                         ['Supervisor', 'Manager'].includes(ticket.opened_by_role || '') &&
                         !ticket.approval_status && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {t('tickets.required')}
                          </span>
                        )}
                        {getApprovalStatusBadge(ticket)}
                        {canApproveTicket(ticket) && (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => handleApproveTicket(ticket, e)}
                              disabled={processing}
                              className="w-7 h-7 flex items-center justify-center rounded bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              title={t('common.approve')}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleRejectTicketClick(ticket, e)}
                              disabled={processing}
                              className="w-7 h-7 flex items-center justify-center rounded bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              title={t('common.reject')}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {ticket.ticket_photos && ticket.ticket_photos.length > 0 && (
                        <ImageIcon className="w-4 h-4 text-blue-500 inline-block" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTickets.length === 0 && tickets.length > 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">{t('tickets.noTicketsMatchFilter')}</p>
          </div>
        )}
        {tickets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">{t('tickets.noTicketsForDate')}</p>
            {session && session.role_permission && Permissions.tickets.canCreate(session.role_permission) && (
              <Button
                size="sm"
                onClick={() => {
                  if (session.role_permission === 'Cashier') {
                    showToast(t('tickets.cashierCannotCreate'), 'error');
                    return;
                  }
                  openEditor();
                }}
                className={session.role_permission === 'Cashier' ? 'opacity-50 cursor-not-allowed' : ''}
              >{t('tickets.createFirstTicket')}</Button>
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
            ['Technician', 'Trainee', 'Supervisor'].includes(ticket.opened_by_role) &&
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

          const isHighlighted = ticket.id === highlightedTicketId;

          return (
            <div
              key={ticket.id}
              ref={isHighlighted ? highlightedCardRef : null}
              className={`${cardBackgroundClass} rounded-lg shadow p-3 ${isHighlighted ? 'animate-highlight-pulse ring-4 ring-yellow-400' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className={`flex-1 ${canView ? 'cursor-pointer' : ''}`}
                  onClick={(e) => {
                    if (canView) {
                      e.stopPropagation();
                      openEditor(ticket.id);
                    }
                  }}
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
                          {status === 'unknown' ? t('tickets.closedUnknown') : t('tickets.closed')}
                        </div>
                      );
                    })()
                  ) : ticket.completed_at ? (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      {t('tickets.completed')}
                    </div>
                  ) : (
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      isTimeDeviationHigh(ticket) ? 'flash-red' : 'bg-orange-100 text-red-600'
                    }`}>
                      {formatDuration(ticket.opened_at)}
                    </div>
                  )}
                  {isSamePersonOpenedPerformedClosed(ticket) &&
                   ['Supervisor', 'Manager'].includes(ticket.opened_by_role || '') &&
                   !ticket.approval_status && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {t('tickets.required')}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    {getApprovalStatusBadge(ticket)}
                    {ticket.ticket_photos && ticket.ticket_photos.length > 0 && (
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <div className="text-xs text-gray-500">{t('tickets.subtotal')}</div>
                    <div className="text-sm font-semibold text-gray-900">${getSubtotal(ticket).toFixed(2)}</div>
                  </div>
                  {canViewTotalColumn() && (
                    <div>
                      <div className="text-xs text-gray-500">{t('tickets.total')}</div>
                      <div className="text-sm font-semibold text-gray-900">${getGrandTotalCollected(ticket).toFixed(2)}</div>
                    </div>
                  )}
                  {isClosedTicket && !shouldHideTips && (
                    <div className={isHighTip ? 'bg-orange-50 rounded px-2 -mx-2' : ''}>
                      <div className={`text-xs font-medium ${isHighTip ? 'text-orange-700' : 'text-gray-500'}`}>
                        {t('tickets.totalTips')}
                      </div>
                      <div className={`text-sm font-semibold ${isHighTip ? 'text-orange-700' : 'text-green-600'}`}>
                        ${totalTips.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                {showApprovalButtons && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => handleApproveTicket(ticket, e)}
                      disabled={processing}
                      className="flex-1 min-h-[44px] flex items-center justify-center rounded bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => handleRejectTicketClick(ticket, e)}
                      disabled={processing}
                      className="flex-1 min-h-[44px] flex items-center justify-center rounded bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredTickets.length === 0 && tickets.length > 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-sm text-gray-500">{t('tickets.noTicketsMatchFilter')}</p>
          </div>
        )}
        {tickets.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">{t('tickets.noTicketsForDate')}</p>
            {session && session.role_permission && Permissions.tickets.canCreate(session.role_permission) && (
              <Button
                size="sm"
                onClick={() => {
                  if (session.role_permission === 'Cashier') {
                    showToast(t('tickets.cashierCannotCreate'), 'error');
                    return;
                  }
                  openEditor();
                }}
                className={session.role_permission === 'Cashier' ? 'opacity-50 cursor-not-allowed' : ''}
              >{t('tickets.createFirstTicket')}</Button>
            )}
          </div>
        )}
      </div>
        </>
      )}

      <Modal
        isOpen={showRejectModal}
        onClose={() => !processing && setShowRejectModal(false)}
        title={t('tickets.rejectTicket')}
        onConfirm={handleRejectTicket}
        confirmText={processing ? t('tickets.rejecting') : t('tickets.rejectTicket')}
        confirmVariant="danger"
        cancelText={t('common.cancel')}
      >
        {selectedTicketForApproval && (
          <div>
            <p className="text-gray-700 mb-3">
              {t('tickets.rejectingTicketWillSend').replace('{ticketNo}', selectedTicketForApproval.ticket_no || '')}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('tickets.reasonForRejection')} <span className="text-red-600">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('tickets.explainRejection')}
                disabled={processing}
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                {t('tickets.ticketLockedWarning')}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {isEditorOpen && (
        <TicketEditor
          ticketId={editingTicketId}
          onClose={closeEditor}
          selectedDate={activeDate}
          hideTips={shouldHideTips}
        />
      )}
    </div>
  );
}
