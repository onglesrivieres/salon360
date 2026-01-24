import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, AlertCircle, Package, PackagePlus, PackageMinus, ArrowDownLeft, ArrowUpRight, DollarSign, Flag, ThumbsUp, ThumbsDown, AlertOctagon, UserX, FileText, Ban, Timer, ChevronLeft, ChevronRight, Bell, User, Calendar, History, Download, Eye, RotateCcw } from 'lucide-react';
import { supabase, PendingApprovalTicket, ApprovalStatistics, PendingInventoryApproval, PendingCashTransactionApproval, PendingCashTransactionChangeProposal, ViolationReportForApproval, ViolationDecision, ViolationActionType, HistoricalApprovalTicket, AttendanceChangeProposalWithDetails, PendingTicketReopenRequest } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/Modal';
import { getCurrentDateEST, formatDateOnly, formatDateTimeEST, formatTimeEST, formatDateEST, formatDateISOEST } from '../lib/timezone';
import { Permissions } from '../lib/permissions';

interface ViolationHistoryReport {
  report_id: string;
  reported_employee_id: string;
  reported_employee_name: string;
  reporter_employee_id: string;
  reporter_employee_name: string;
  violation_description: string;
  violation_date: string;
  queue_position: number | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  reviewed_by_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  decision: string | null;
  action_type: string | null;
  action_details: string | null;
  manager_notes: string | null;
  total_required_responders: number;
  total_responses: number;
  votes_violation: number;
  votes_no_violation: number;
  responses: any;
  info_requested_at: string | null;
  info_requested_by: string | null;
  info_requested_by_name: string | null;
  info_request_message: string | null;
  additional_info: string | null;
  additional_info_submitted_at: string | null;
}

interface ProposalWithAttendance extends AttendanceChangeProposalWithDetails {
  work_date?: string;
}

type TabType = 'tickets' | 'inventory' | 'cash' | 'transaction-changes' | 'attendance' | 'violations' | 'queue-history' | 'ticket-changes';

interface QueueRemovalRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  removed_by_employee_id: string;
  removed_by_name: string;
  reason: string;
  notes: string | null;
  removed_at: string;
  cooldown_expires_at: string;
  is_active: boolean;
  minutes_remaining: number | null;
  has_cooldown: boolean;
}

export function PendingApprovalsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('tickets');
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDateEST());
  const [tickets, setTickets] = useState<PendingApprovalTicket[]>([]);
  const [historicalManagerTickets, setHistoricalManagerTickets] = useState<HistoricalApprovalTicket[]>([]);
  const [historicalSupervisorTickets, setHistoricalSupervisorTickets] = useState<HistoricalApprovalTicket[]>([]);
  const [inventoryApprovals, setInventoryApprovals] = useState<PendingInventoryApproval[]>([]);
  const [cashTransactionApprovals, setCashTransactionApprovals] = useState<PendingCashTransactionApproval[]>([]);
  const [violationReports, setViolationReports] = useState<ViolationReportForApproval[]>([]);
  const [violationHistory, setViolationHistory] = useState<ViolationHistoryReport[]>([]);
  const [attendanceProposals, setAttendanceProposals] = useState<ProposalWithAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<PendingApprovalTicket | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<PendingInventoryApproval | null>(null);
  const [selectedCashTransaction, setSelectedCashTransaction] = useState<PendingCashTransactionApproval | null>(null);
  const [selectedViolationReport, setSelectedViolationReport] = useState<ViolationReportForApproval | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showInventoryRejectModal, setShowInventoryRejectModal] = useState(false);
  const [showCashTransactionRejectModal, setShowCashTransactionRejectModal] = useState(false);
  const [showViolationDecisionModal, setShowViolationDecisionModal] = useState(false);
  const [violationDecision, setViolationDecision] = useState<ViolationDecision>('violation_confirmed');
  const [violationNotes, setViolationNotes] = useState('');
  const [violationAction, setViolationAction] = useState<ViolationActionType>('none');
  const [violationActionDetails, setViolationActionDetails] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithAttendance | null>(null);
  const [processing, setProcessing] = useState(false);
  const [approvalStats, setApprovalStats] = useState<ApprovalStatistics | null>(null);
  const [violationStatusFilter, setViolationStatusFilter] = useState<string>('all');
  const [violationSearchTerm, setViolationSearchTerm] = useState('');
  const [queueRemovalRecords, setQueueRemovalRecords] = useState<QueueRemovalRecord[]>([]);
  const [queueHistoryStartDate, setQueueHistoryStartDate] = useState<string>(getCurrentDateEST());
  const [queueHistoryEndDate, setQueueHistoryEndDate] = useState<string>(getCurrentDateEST());
  const [queueHistoryLoading, setQueueHistoryLoading] = useState(false);
  const [transactionChangeProposals, setTransactionChangeProposals] = useState<PendingCashTransactionChangeProposal[]>([]);
  const [selectedTransactionChangeProposal, setSelectedTransactionChangeProposal] = useState<PendingCashTransactionChangeProposal | null>(null);
  const [transactionChangeReviewComment, setTransactionChangeReviewComment] = useState('');
  const [ticketReopenRequests, setTicketReopenRequests] = useState<PendingTicketReopenRequest[]>([]);
  const [selectedTicketReopenRequest, setSelectedTicketReopenRequest] = useState<PendingTicketReopenRequest | null>(null);
  const [ticketReopenReviewComment, setTicketReopenReviewComment] = useState('');
  const [viewingRequest, setViewingRequest] = useState<PendingTicketReopenRequest | null>(null);
  const [rejectedTickets, setRejectedTickets] = useState<any[]>([]);
  // Additional info request state
  const [additionalInfoText, setAdditionalInfoText] = useState('');
  const [infoRequestMessage, setInfoRequestMessage] = useState('');
  const [showInfoRequestModal, setShowInfoRequestModal] = useState(false);
  const [selectedReportForInfoRequest, setSelectedReportForInfoRequest] = useState<ViolationReportForApproval | null>(null);
  const [tabCounts, setTabCounts] = useState<{
    tickets: number;
    inventory: number;
    cash: number;
    transactionChanges: number;
    attendance: number;
    violations: number;
    ticketChanges: number;
  }>({ tickets: 0, inventory: 0, cash: 0, transactionChanges: 0, attendance: 0, violations: 0, ticketChanges: 0 });
  const [initialTabSet, setInitialTabSet] = useState(false);
  const { showToast } = useToast();
  const { session, selectedStoreId, effectiveRole } = useAuth();

  const userRoles = session?.role || [];
  const isManagement = userRoles.some(role => ['Admin', 'Owner', 'Manager', 'Supervisor'].includes(role));
  const isSupervisor = session?.role_permission === 'Supervisor';
  const isTechnician = session?.role_permission === 'Technician';
  const isReceptionist = session?.role_permission === 'Receptionist';
  const isCashier = session?.role_permission === 'Cashier';

  // Access levels
  const canViewAllRecords = isManagement || isReceptionist;
  const canViewOwnRecordsOnly = isTechnician && !isManagement;
  const hasPageAccess = isManagement || isReceptionist || isTechnician;
  const canTakeActions = isManagement; // Only management can approve/reject

  const canViewQueueHistory = effectiveRole && Permissions.queue.canViewRemovalHistory(effectiveRole);
  const canReviewTransactionChanges = effectiveRole && Permissions.cashTransactions.canReviewChangeProposal(effectiveRole);
  const canReviewReopenRequests = effectiveRole && Permissions.tickets.canReviewReopenRequests(effectiveRole);

  // Helper function to determine which tabs each role can see
  function canViewTab(tabKey: TabType): boolean {
    // Cashiers blocked from all tabs
    if (isCashier) return false;

    // Supervisor: only Cash tab (existing behavior)
    if (isSupervisor) return tabKey === 'cash';

    // Management and Receptionist: all tabs (with existing permission checks)
    if (canViewAllRecords) {
      if (tabKey === 'transaction-changes') return !!canReviewTransactionChanges;
      if (tabKey === 'ticket-changes') return !!canReviewReopenRequests;
      if (tabKey === 'queue-history') return !!canViewQueueHistory;
      return true;
    }

    // Technician: only specific tabs with own records
    if (isTechnician) {
      const allowedTabs: TabType[] = [
        'tickets', 'inventory', 'attendance',
        'violations', 'ticket-changes', 'queue-history'
      ];
      return allowedTabs.includes(tabKey);
    }

    return false;
  }

  // Determine if Reporter info should be visible for a violation report
  function canSeeReporterInfo(report: { reporter_employee_id: string; reported_employee_id: string }): boolean {
    // Only Owner, Admin, Manager can see reporter info
    const canSeeAsManagement = userRoles.some(role =>
      ['Owner', 'Admin', 'Manager'].includes(role)
    );
    // If current user is the reported employee, always hide reporter
    const isReportedEmployee = session?.employee_id === report.reported_employee_id;
    return canSeeAsManagement && !isReportedEmployee;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['tickets', 'inventory', 'cash', 'transaction-changes', 'attendance', 'violations', 'queue-history', 'ticket-changes'].includes(tab)) {
      setActiveTab(tab as TabType);
      setInitialTabSet(true);
    }
  }, []);

  // Fetch all tab counts and auto-navigate to first tab with pending items
  useEffect(() => {
    if (!hasPageAccess || !session?.employee_id || !selectedStoreId || initialTabSet) return;

    // Supervisors can only see cash tab, so navigate there directly
    if (isSupervisor) {
      handleTabChange('cash');
      setInitialTabSet(true);
      return;
    }

    // Technicians: navigate to first allowed tab (tickets by default)
    if (canViewOwnRecordsOnly) {
      handleTabChange('tickets');
      setInitialTabSet(true);
      return;
    }

    fetchAllTabCounts().then(counts => {
      if (!counts) {
        setInitialTabSet(true);
        return;
      }

      // Priority order for auto-navigation
      const tabPriority: { tab: TabType; key: keyof typeof counts }[] = [
        { tab: 'tickets', key: 'tickets' },
        { tab: 'violations', key: 'violations' },
        { tab: 'cash', key: 'cash' },
        { tab: 'inventory', key: 'inventory' },
        { tab: 'transaction-changes', key: 'transactionChanges' },
        { tab: 'attendance', key: 'attendance' },
      ];

      for (const { tab, key } of tabPriority) {
        if (counts[key] > 0) {
          handleTabChange(tab);
          break;
        }
      }
      setInitialTabSet(true);
    });
  }, [hasPageAccess, session?.employee_id, selectedStoreId, initialTabSet, isSupervisor, canViewOwnRecordsOnly]);

  useEffect(() => {
    if (!hasPageAccess) return;

    if (session?.employee_id) {
      if (activeTab === 'tickets' && canViewTab('tickets')) {
        fetchPendingApprovals();
        fetchApprovalStats();
        fetchHistoricalApprovals();
        fetchRejectedTickets();
      } else if (activeTab === 'inventory' && canViewTab('inventory')) {
        fetchInventoryApprovals();
      } else if (activeTab === 'cash' && canViewTab('cash')) {
        fetchCashTransactionApprovals();
      } else if (activeTab === 'attendance' && canViewTab('attendance')) {
        fetchAttendanceProposals();
      } else if (activeTab === 'violations' && canViewTab('violations')) {
        fetchViolationReports();
        fetchViolationHistory();
      } else if (activeTab === 'transaction-changes' && canViewTab('transaction-changes')) {
        fetchTransactionChangeProposals();
      } else if (activeTab === 'ticket-changes' && canViewTab('ticket-changes')) {
        fetchTicketReopenRequests();
      } else if (activeTab === 'queue-history' && canViewTab('queue-history')) {
        fetchQueueRemovalHistory();
      }
    }
  }, [session?.employee_id, selectedStoreId, selectedDate, activeTab, hasPageAccess, canViewQueueHistory, canReviewTransactionChanges, canReviewReopenRequests]);

  useEffect(() => {
    if (!hasPageAccess) return;

    const interval = setInterval(() => {
      if (session?.employee_id) {
        // Refresh all tab counts
        fetchAllTabCounts();

        if (activeTab === 'tickets' && canViewTab('tickets')) {
          fetchPendingApprovals();
          fetchApprovalStats();
          fetchRejectedTickets();
        } else if (activeTab === 'inventory' && canViewTab('inventory')) {
          fetchInventoryApprovals();
        } else if (activeTab === 'cash' && canViewTab('cash')) {
          fetchCashTransactionApprovals();
        } else if (activeTab === 'attendance' && canViewTab('attendance')) {
          fetchAttendanceProposals();
        } else if (activeTab === 'violations' && canViewTab('violations')) {
          fetchViolationReports();
          fetchViolationHistory();
        } else if (activeTab === 'transaction-changes' && canViewTab('transaction-changes')) {
          fetchTransactionChangeProposals();
        } else if (activeTab === 'ticket-changes' && canViewTab('ticket-changes')) {
          fetchTicketReopenRequests();
        } else if (activeTab === 'queue-history' && canViewTab('queue-history')) {
          fetchQueueRemovalHistory();
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [session?.employee_id, selectedStoreId, activeTab, hasPageAccess, canViewQueueHistory, canReviewTransactionChanges, canReviewReopenRequests]);

  function handleTabChange(tab: TabType) {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }

  async function fetchApprovalStats() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase.rpc('get_approval_statistics', {
        p_store_id: selectedStoreId,
        p_start_date: selectedDate,
        p_end_date: selectedDate,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setApprovalStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching approval stats:', error);
    }
  }

  async function fetchAllTabCounts() {
    if (!selectedStoreId || !session?.employee_id) return;

    try {
      const [ticketsRes, inventoryRes, cashRes, transactionChangesRes, attendanceRes, violationsRes, ticketChangesRes] = await Promise.all([
        supabase.rpc('get_pending_approvals_for_management', { p_store_id: selectedStoreId }),
        supabase.rpc('get_pending_inventory_approvals', { p_employee_id: session.employee_id, p_store_id: selectedStoreId }),
        supabase.rpc('get_pending_cash_transaction_approvals', { p_store_id: selectedStoreId }),
        canReviewTransactionChanges ? supabase.rpc('get_pending_cash_transaction_change_proposals', { p_store_id: selectedStoreId }) : Promise.resolve({ data: [] }),
        supabase.from('attendance_change_proposals').select('id').eq('store_id', selectedStoreId).eq('status', 'pending'),
        supabase.rpc('get_violation_reports_for_approval', { p_store_id: selectedStoreId }),
        canReviewReopenRequests ? supabase.rpc('get_pending_ticket_reopen_requests', { p_store_id: selectedStoreId }) : Promise.resolve({ data: [] }),
      ]);

      const counts = {
        tickets: ticketsRes.data?.length || 0,
        inventory: inventoryRes.data?.length || 0,
        cash: cashRes.data?.length || 0,
        transactionChanges: transactionChangesRes.data?.length || 0,
        attendance: attendanceRes.data?.length || 0,
        violations: violationsRes.data?.length || 0,
        ticketChanges: ticketChangesRes.data?.length || 0,
      };

      setTabCounts(counts);
      return counts;
    } catch (error) {
      console.error('Error fetching tab counts:', error);
    }
  }

  async function fetchPendingApprovals() {
    try {
      setLoading(true);

      if (!selectedStoreId) {
        setTickets([]);
        return;
      }

      const { data, error } = await supabase.rpc('get_pending_approvals_for_management', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;

      // Filter for Technician: only show tickets where they performed a service
      let filteredData = data || [];
      if (canViewOwnRecordsOnly && session?.employee_id) {
        filteredData = filteredData.filter((ticket: { technician_ids?: string[] }) =>
          ticket.technician_ids?.includes(session.employee_id)
        );
      }

      setTickets(filteredData);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      showToast('Failed to load pending approvals', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRejectedTickets() {
    if (!selectedStoreId) return;
    try {
      const { data, error } = await supabase.rpc('get_rejected_tickets_for_admin', {
        p_store_id: selectedStoreId,
      });
      if (error) throw error;

      // Filter for Technician: only show their own rejected tickets
      let filteredData = data || [];
      if (canViewOwnRecordsOnly && session?.employee_id) {
        filteredData = filteredData.filter((ticket: { technician_ids?: string[] }) =>
          ticket.technician_ids?.includes(session.employee_id)
        );
      }

      setRejectedTickets(filteredData);
    } catch (error) {
      console.error('Error fetching rejected tickets:', error);
    }
  }

  async function handleClearAdminReview(ticketId: string) {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('sale_tickets')
        .update({ requires_admin_review: false })
        .eq('id', ticketId);
      if (error) throw error;
      showToast('Ticket marked as reviewed', 'success');
      fetchRejectedTickets();
      fetchApprovalStats();
    } catch (error) {
      console.error('Error clearing admin review:', error);
      showToast('Failed to update ticket', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function fetchInventoryApprovals() {
    if (!selectedStoreId || !session?.employee_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_pending_inventory_approvals', {
        p_employee_id: session.employee_id,
        p_store_id: selectedStoreId,
      });

      if (error) throw error;

      // Filter for Technician: only show where they are the recipient
      let filteredData = data || [];
      if (canViewOwnRecordsOnly && session?.employee_id) {
        filteredData = filteredData.filter((approval: { recipient_id?: string }) =>
          approval.recipient_id === session.employee_id
        );
      }

      setInventoryApprovals(filteredData);
    } catch (error) {
      console.error('Error fetching inventory approvals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCashTransactionApprovals() {
    if (!selectedStoreId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_pending_cash_transaction_approvals', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;

      // Filter for Supervisors: only show Receptionist-created transactions
      let filteredData = data || [];
      if (isSupervisor) {
        filteredData = filteredData.filter(approval => approval.created_by_role === 'Receptionist');
      }

      setCashTransactionApprovals(filteredData);
    } catch (error) {
      console.error('Error fetching cash transaction approvals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchViolationReports() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase.rpc('get_violation_reports_for_approval', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;

      // Filter for Technician: only show reports where they are the reported employee
      let filteredData = data || [];
      if (canViewOwnRecordsOnly && session?.employee_id) {
        filteredData = filteredData.filter((report: { reported_employee_id?: string }) =>
          report.reported_employee_id === session.employee_id
        );
      }

      setViolationReports(filteredData);
    } catch (error) {
      console.error('Error fetching violation reports:', error);
    }
  }

  async function fetchViolationHistory() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase.rpc('get_all_violation_reports_for_management', {
        p_store_id: selectedStoreId,
        p_status: violationStatusFilter === 'all' ? null : violationStatusFilter,
        p_search_employee: violationSearchTerm.trim() || null
      });

      if (error) throw error;

      // Filter for Technician: only show their own violation history
      let filteredData = data || [];
      if (canViewOwnRecordsOnly && session?.employee_id) {
        filteredData = filteredData.filter((report: { reported_employee_id?: string }) =>
          report.reported_employee_id === session.employee_id
        );
      }

      setViolationHistory(filteredData);
    } catch (error) {
      console.error('Error fetching violation history:', error);
    }
  }

  async function fetchAttendanceProposals() {
    if (!selectedStoreId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_change_proposals')
        .select(`
          *,
          employee:employees!attendance_change_proposals_employee_id_fkey(id, display_name, legal_name),
          attendance_records!inner(work_date, store_id)
        `)
        .eq('attendance_records.store_id', selectedStoreId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let transformedData = (data || []).map((item: any) => ({
        ...item,
        work_date: item.attendance_records?.work_date,
      }));

      // Filter for Technician: only show their own attendance proposals
      if (canViewOwnRecordsOnly && session?.employee_id) {
        transformedData = transformedData.filter((proposal: any) =>
          proposal.employee_id === session.employee_id
        );
      }

      setAttendanceProposals(transformedData);
    } catch (error: any) {
      console.error('Error fetching attendance proposals:', error);
      showToast('Failed to load attendance proposals', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistoricalApprovals() {
    if (!selectedStoreId) return;

    try {
      const [managerData, supervisorData] = await Promise.all([
        supabase.rpc('get_historical_approvals_for_manager', {
          p_store_id: selectedStoreId,
        }),
        supabase.rpc('get_historical_approvals_for_supervisor', {
          p_store_id: selectedStoreId,
        }),
      ]);

      if (managerData.error) throw managerData.error;
      if (supervisorData.error) throw supervisorData.error;

      // Filter for Technician: only show their own historical tickets
      let managerTickets = managerData.data || [];
      let supervisorTickets = supervisorData.data || [];

      if (canViewOwnRecordsOnly && session?.employee_id) {
        managerTickets = managerTickets.filter((ticket: { technician_ids?: string[] }) =>
          ticket.technician_ids?.includes(session.employee_id)
        );
        supervisorTickets = supervisorTickets.filter((ticket: { technician_ids?: string[] }) =>
          ticket.technician_ids?.includes(session.employee_id)
        );
      }

      setHistoricalManagerTickets(managerTickets);
      setHistoricalSupervisorTickets(supervisorTickets);
    } catch (error) {
      console.error('Error fetching historical approvals:', error);
    }
  }

  async function fetchQueueRemovalHistory() {
    if (!selectedStoreId || !session?.employee_id) return;

    setQueueHistoryLoading(true);
    try {
      const { data, error: fetchError } = await supabase.rpc('get_queue_removal_history', {
        p_employee_id: session.employee_id,
        p_store_id: selectedStoreId,
        p_start_date: queueHistoryStartDate || null,
        p_end_date: queueHistoryEndDate || null
      });

      if (fetchError) throw fetchError;

      // Filter for Technician: only show their own queue removals
      let filteredData = data || [];
      if (canViewOwnRecordsOnly && session?.employee_id) {
        filteredData = filteredData.filter((record: { employee_id?: string }) =>
          record.employee_id === session.employee_id
        );
      }

      setQueueRemovalRecords(filteredData);
    } catch (err: any) {
      console.error('Error fetching queue removal history:', err);
      showToast(err.message || 'Failed to load queue removal history', 'error');
    } finally {
      setQueueHistoryLoading(false);
    }
  }

  async function fetchTransactionChangeProposals() {
    if (!selectedStoreId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_pending_cash_transaction_change_proposals', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;
      setTransactionChangeProposals(data || []);
    } catch (error) {
      console.error('Error fetching transaction change proposals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTicketReopenRequests() {
    if (!selectedStoreId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_pending_ticket_reopen_requests', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;

      // Filter for Technician: only show requests they created or tickets they worked on
      let filteredData = data || [];
      if (canViewOwnRecordsOnly && session?.employee_id) {
        filteredData = filteredData.filter((request: { created_by_id?: string; technician_ids?: string[] }) =>
          request.created_by_id === session.employee_id ||
          request.technician_ids?.includes(session.employee_id)
        );
      }

      setTicketReopenRequests(filteredData);
    } catch (error) {
      console.error('Error fetching ticket reopen requests:', error);
    } finally {
      setLoading(false);
    }
  }

  // Navigate to ticket without approval (just view)
  function handleViewTicket(request: PendingTicketReopenRequest) {
    const navState = {
      ticketId: request.ticket_id,
      ticketDate: request.ticket_date,
      timestamp: Date.now()
    };
    sessionStorage.setItem('ticket_navigation_state', JSON.stringify(navState));
    window.dispatchEvent(new CustomEvent('navigateToTicket', { detail: navState }));
  }

  // Approve and reopen the ticket, then navigate to it
  async function handleApproveAndReopen(request: PendingTicketReopenRequest) {
    if (!session?.employee_id) return;

    try {
      setProcessing(true);

      // Step 1: Approve the request
      const { data, error } = await supabase.rpc('approve_ticket_reopen_request', {
        p_request_id: request.request_id,
        p_reviewer_employee_id: session.employee_id,
        p_review_comment: 'Approved and reopened',
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string; ticket_id?: string };
      if (!result.success) {
        showToast(result.error || 'Failed to approve request', 'error');
        return;
      }

      // Step 2: Reopen the ticket by clearing closed_at and completed_at
      const { error: reopenError } = await supabase
        .from('sale_tickets')
        .update({ closed_at: null, completed_at: null })
        .eq('id', request.ticket_id);

      if (reopenError) {
        console.error('Error reopening ticket:', reopenError);
        showToast('Request approved but failed to reopen ticket', 'error');
        return;
      }

      showToast('Request approved and ticket reopened', 'success');
      fetchTicketReopenRequests();

      // Step 3: Navigate to the ticket with highlight
      const navState = {
        ticketId: request.ticket_id,
        ticketDate: request.ticket_date,
        timestamp: Date.now()
      };
      sessionStorage.setItem('ticket_navigation_state', JSON.stringify(navState));
      window.dispatchEvent(new CustomEvent('navigateToTicket', { detail: navState }));
    } catch (error: any) {
      console.error('Error approving ticket reopen request:', error);
      showToast(error.message || 'Failed to approve request', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRejectTicketReopenRequest() {
    if (!selectedTicketReopenRequest || !session?.employee_id) return;

    if (!ticketReopenReviewComment.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('reject_ticket_reopen_request', {
        p_request_id: selectedTicketReopenRequest.request_id,
        p_reviewer_employee_id: session.employee_id,
        p_review_comment: ticketReopenReviewComment.trim(),
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        showToast(result.error || 'Failed to reject request', 'error');
        return;
      }

      showToast(result.message || 'Request rejected', 'success');
      setSelectedTicketReopenRequest(null);
      setTicketReopenReviewComment('');
      fetchTicketReopenRequests();
    } catch (error: any) {
      console.error('Error rejecting ticket reopen request:', error);
      showToast(error.message || 'Failed to reject request', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveTransactionChangeProposal(proposal: PendingCashTransactionChangeProposal) {
    if (!session?.employee_id) return;

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('approve_cash_transaction_change_proposal', {
        p_proposal_id: proposal.proposal_id,
        p_reviewer_employee_id: session.employee_id,
        p_review_comment: transactionChangeReviewComment || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        showToast(result.error || 'Failed to approve proposal', 'error');
        return;
      }

      showToast(result.message || 'Transaction change approved', 'success');
      setSelectedTransactionChangeProposal(null);
      setTransactionChangeReviewComment('');
      fetchTransactionChangeProposals();
    } catch (error: any) {
      console.error('Error approving transaction change proposal:', error);
      showToast(error.message || 'Failed to approve proposal', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRejectTransactionChangeProposal(proposal: PendingCashTransactionChangeProposal) {
    if (!session?.employee_id) return;

    if (!transactionChangeReviewComment.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('reject_cash_transaction_change_proposal', {
        p_proposal_id: proposal.proposal_id,
        p_reviewer_employee_id: session.employee_id,
        p_review_comment: transactionChangeReviewComment.trim(),
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        showToast(result.error || 'Failed to reject proposal', 'error');
        return;
      }

      showToast(result.message || 'Transaction change request rejected', 'success');
      setSelectedTransactionChangeProposal(null);
      setTransactionChangeReviewComment('');
      fetchTransactionChangeProposals();
    } catch (error: any) {
      console.error('Error rejecting transaction change proposal:', error);
      showToast(error.message || 'Failed to reject proposal', 'error');
    } finally {
      setProcessing(false);
    }
  }

  function formatQueueRemovalDateTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function exportQueueHistoryToCSV() {
    if (queueRemovalRecords.length === 0) return;

    const headers = [
      'Date/Time',
      'Technician',
      'Removed By',
      'Reason',
      'Notes',
      'Has Cooldown',
      'Cooldown Status',
      'Minutes Remaining'
    ];

    const rows = queueRemovalRecords.map(record => [
      formatDateTimeEST(record.removed_at),
      record.employee_name,
      record.removed_by_name,
      record.reason,
      record.notes || '',
      record.has_cooldown ? 'Yes' : 'No',
      record.has_cooldown ? (record.is_active ? 'Active' : 'Expired') : 'N/A',
      record.has_cooldown ? (record.minutes_remaining?.toString() || 'N/A') : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-removals-${queueHistoryStartDate}-${queueHistoryEndDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async function handleApproveInventory(approval: PendingInventoryApproval) {
    if (!session?.employee_id) return;

    if (approval.requested_by_id === session.employee_id) {
      showToast('You cannot approve transactions you created', 'error');
      return;
    }

    try {
      setProcessing(true);

      const updates: any = { updated_at: new Date().toISOString() };
      updates.manager_approved = true;
      updates.manager_approved_at = new Date().toISOString();
      updates.manager_approved_by_id = session.employee_id;

      const { error } = await supabase
        .from('inventory_transactions')
        .update(updates)
        .eq('id', approval.id);

      if (error) throw error;

      showToast('Inventory transaction approved', 'success');
      fetchInventoryApprovals();
    } catch (error: any) {
      showToast(error.message || 'Failed to approve transaction', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRejectInventoryClick(approval: PendingInventoryApproval) {
    if (!session?.employee_id) return;

    if (approval.requested_by_id === session.employee_id) {
      showToast('You cannot reject transactions you created', 'error');
      return;
    }

    setSelectedInventory(approval);
    setRejectionReason('');
    setShowInventoryRejectModal(true);
  }

  async function handleRejectInventory() {
    if (!selectedInventory || !rejectionReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('inventory_transactions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedInventory.id);

      if (error) throw error;

      showToast('Inventory transaction rejected', 'success');
      setShowInventoryRejectModal(false);
      setSelectedInventory(null);
      fetchInventoryApprovals();
    } catch (error) {
      console.error('Error rejecting inventory:', error);
      showToast('Failed to reject transaction', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveCashTransaction(approval: PendingCashTransactionApproval) {
    if (!session?.employee_id) {
      showToast('Session expired. Please log in again.', 'error');
      return;
    }

    if (approval.created_by_id === session.employee_id) {
      showToast('You cannot approve transactions you created', 'error');
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('cash_transactions')
        .update({
          status: 'approved',
          manager_approved: true,
          manager_approved_by_id: session.employee_id,
          manager_approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', approval.transaction_id);

      if (error) throw error;

      showToast('Cash transaction approved', 'success');
      fetchCashTransactionApprovals();
    } catch (error: any) {
      showToast(error.message || 'Failed to approve transaction', 'error');
    } finally {
      setProcessing(false);
    }
  }

  function handleRejectCashTransactionClick(approval: PendingCashTransactionApproval) {
    if (!session?.employee_id) return;

    if (approval.created_by_id === session.employee_id) {
      showToast('You cannot reject transactions you created', 'error');
      return;
    }

    setSelectedCashTransaction(approval);
    setRejectionReason('');
    setShowCashTransactionRejectModal(true);
  }

  async function handleRejectCashTransaction() {
    if (!selectedCashTransaction || !rejectionReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('cash_transactions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedCashTransaction.transaction_id);

      if (error) throw error;

      showToast('Cash transaction rejected', 'success');
      setShowCashTransactionRejectModal(false);
      setSelectedCashTransaction(null);
      fetchCashTransactionApprovals();
    } catch (error) {
      console.error('Error rejecting cash transaction:', error);
      showToast('Failed to reject transaction', 'error');
    } finally {
      setProcessing(false);
    }
  }

  function handleViolationDecisionClick(report: ViolationReportForApproval) {
    setSelectedViolationReport(report);
    setShowViolationDecisionModal(true);
    setViolationDecision('violation_confirmed');
    setViolationNotes('');
    setViolationAction('none');
    setViolationActionDetails('');
  }

  async function handleSubmitViolationDecision() {
    if (!selectedViolationReport || !session?.employee_id) return;

    if (!violationNotes.trim()) {
      showToast('Please provide manager notes', 'error');
      return;
    }

    try {
      setProcessing(true);

      const { data, error } = await supabase.rpc('approve_violation_report', {
        p_violation_report_id: selectedViolationReport.report_id,
        p_reviewer_employee_id: session.employee_id,
        p_decision: violationDecision,
        p_manager_notes: violationNotes.trim(),
        p_action_type: violationDecision === 'violation_confirmed' ? violationAction : 'none',
        p_action_details: violationActionDetails.trim() || null
      });

      if (error) throw error;

      showToast(
        violationDecision === 'violation_confirmed'
          ? 'Violation confirmed and recorded'
          : 'Violation report rejected',
        'success'
      );

      await fetchViolationReports();
      await fetchViolationHistory();
      setShowViolationDecisionModal(false);
      setSelectedViolationReport(null);
    } catch (error: any) {
      console.error('Error processing violation decision:', error);
      showToast(error.message || 'Failed to process decision', 'error');
    } finally {
      setProcessing(false);
    }
  }

  // Handler for management to request more info from reporter
  async function handleRequestMoreInfo() {
    if (!selectedReportForInfoRequest || !session?.employee_id) return;

    try {
      setProcessing(true);
      const { error } = await supabase.rpc('request_violation_additional_info', {
        p_violation_report_id: selectedReportForInfoRequest.report_id,
        p_requested_by: session.employee_id,
        p_message: infoRequestMessage.trim() || null
      });

      if (error) throw error;

      showToast('Information request sent to reporter', 'success');
      setShowInfoRequestModal(false);
      setInfoRequestMessage('');
      setSelectedReportForInfoRequest(null);
      await fetchViolationReports();
      await fetchViolationHistory();
    } catch (error: any) {
      console.error('Error requesting more info:', error);
      showToast(error.message || 'Failed to send request', 'error');
    } finally {
      setProcessing(false);
    }
  }

  // Handler for reporter to submit additional info
  async function handleSubmitAdditionalInfo(report: ViolationReportForApproval | ViolationHistoryReport) {
    if (!session?.employee_id || !additionalInfoText.trim()) return;

    try {
      setProcessing(true);
      const { error } = await supabase.rpc('submit_violation_additional_info', {
        p_violation_report_id: report.report_id,
        p_reporter_id: session.employee_id,
        p_additional_info: additionalInfoText.trim()
      });

      if (error) throw error;

      showToast('Additional information submitted', 'success');
      setAdditionalInfoText('');
      await fetchViolationReports();
      await fetchViolationHistory();
    } catch (error: any) {
      console.error('Error submitting additional info:', error);
      showToast(error.message || 'Failed to submit information', 'error');
    } finally {
      setProcessing(false);
    }
  }

  // Helper to check if current user is the reporter
  function isReporter(report: { reporter_employee_id: string }): boolean {
    return session?.employee_id === report.reporter_employee_id;
  }

  async function handleReviewAttendanceProposal(proposalId: string, action: 'approve' | 'reject') {
    if (!session?.employee_id) return;

    try {
      setProcessing(true);

      const proposal = attendanceProposals.find(p => p.id === proposalId);
      if (!proposal) return;

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      const { error: updateError } = await supabase
        .from('attendance_change_proposals')
        .update({
          status: newStatus,
          reviewed_by_employee_id: session.employee_id,
          reviewed_at: new Date().toISOString(),
          review_comment: reviewComment || null,
        })
        .eq('id', proposalId);

      if (updateError) throw updateError;

      if (action === 'approve') {
        const updates: any = {};

        if (proposal.proposed_check_in_time) {
          updates.check_in_time = proposal.proposed_check_in_time;
        }

        if (proposal.proposed_check_out_time) {
          updates.check_out_time = proposal.proposed_check_out_time;
        }

        const finalCheckInTime = proposal.proposed_check_in_time || proposal.current_check_in_time;
        const finalCheckOutTime = proposal.proposed_check_out_time || proposal.current_check_out_time;

        if (finalCheckInTime && finalCheckOutTime) {
          const checkIn = new Date(finalCheckInTime);
          const checkOut = new Date(finalCheckOutTime);
          const diffMs = checkOut.getTime() - checkIn.getTime();
          const totalHours = diffMs / (1000 * 60 * 60);
          updates.total_hours = totalHours;
        }

        if (Object.keys(updates).length > 0) {
          const { error: attendanceError } = await supabase
            .from('attendance_records')
            .update(updates)
            .eq('id', proposal.attendance_record_id);

          if (attendanceError) throw attendanceError;
        }
      }

      showToast(
        action === 'approve'
          ? 'Proposal approved successfully'
          : 'Proposal rejected successfully',
        'success'
      );

      setReviewComment('');
      setSelectedProposal(null);
      await fetchAttendanceProposals();
    } catch (error: any) {
      console.error('Error reviewing proposal:', error);
      showToast(error.message || 'Failed to review proposal', 'error');
    } finally {
      setProcessing(false);
    }
  }

  function getUrgencyLevel(hoursRemaining: number): 'urgent' | 'warning' | 'normal' {
    if (hoursRemaining < 6) return 'urgent';
    if (hoursRemaining < 24) return 'warning';
    return 'normal';
  }

  function formatTimeRemaining(hoursRemaining: number): string {
    if (hoursRemaining < 0) return 'Expired';
    if (hoursRemaining < 1) {
      const minutes = Math.floor(hoursRemaining * 60);
      return `${minutes} min`;
    }
    const hours = Math.floor(hoursRemaining);
    const minutes = Math.floor((hoursRemaining - hours) * 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  async function handleApproveClick(ticket: PendingApprovalTicket) {
    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('approve_ticket', {
        p_ticket_id: ticket.ticket_id,
        p_employee_id: session?.employee_id,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        showToast(result.message, 'error');
        return;
      }

      showToast('Ticket approved successfully', 'success');
      fetchPendingApprovals();
      fetchHistoricalApprovals();
    } catch (error: any) {
      showToast(error.message || 'Failed to approve ticket', 'error');
    } finally {
      setProcessing(false);
    }
  }

  function handleRejectClick(ticket: PendingApprovalTicket) {
    setSelectedTicket(ticket);
    setRejectionReason('');
    setShowRejectModal(true);
  }

  async function handleReject() {
    if (!selectedTicket || !rejectionReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('reject_ticket', {
        p_ticket_id: selectedTicket.ticket_id,
        p_employee_id: session?.employee_id,
        p_rejection_reason: rejectionReason,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        showToast(result.message, 'error');
        return;
      }

      showToast('Ticket rejected and sent for admin review', 'success');
      setShowRejectModal(false);
      setSelectedTicket(null);
      setRejectionReason('');
      fetchPendingApprovals();
      fetchHistoricalApprovals();
    } catch (error: any) {
      showToast(error.message || 'Failed to reject ticket', 'error');
    } finally {
      setProcessing(false);
    }
  }

  const getViolationStatusCounts = () => {
    return {
      all: violationHistory.length,
      collecting_responses: violationHistory.filter(v => v.status === 'collecting_responses').length,
      pending_approval: violationHistory.filter(v => v.status === 'pending_approval').length,
      approved: violationHistory.filter(v => v.status === 'approved').length,
      rejected: violationHistory.filter(v => v.status === 'rejected').length,
      expired: violationHistory.filter(v => v.status === 'expired').length,
    };
  };

  const filteredViolationHistory = violationHistory.filter(report => {
    if (violationStatusFilter !== 'all' && report.status !== violationStatusFilter) {
      return false;
    }
    return true;
  });

  function navigateDay(direction: 'prev' | 'next') {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + (direction === 'prev' ? -1 : 1));
    setSelectedDate(formatDateISOEST(d));
  }

  function canNavigatePrev(): boolean {
    return selectedDate > getMinDate();
  }

  function canNavigateNext(): boolean {
    return selectedDate < getMaxDate();
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

  // Block Cashiers explicitly
  if (isCashier) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-700 mb-4">
            This page is not available to your role.
          </p>
          <p className="text-sm text-gray-600">
            If you believe you should have access, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!hasPageAccess) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-700 mb-4">
            This page is restricted to management personnel only.
          </p>
          <p className="text-sm text-gray-600">
            If you believe you should have access, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const statusCounts = getViolationStatusCounts();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {canTakeActions ? 'Management Approvals' : 'My Pending Items'}
            </h2>
            <p className="text-sm text-gray-600">
              {canTakeActions
                ? 'Review and approve pending requests across all categories'
                : 'View status of your pending requests and records'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigateDay('prev')}
              disabled={!canNavigatePrev()}
              className="p-1 h-[44px] md:h-8 w-10 flex items-center justify-center"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={getMinDate()}
              max={getMaxDate()}
              className="px-2 py-2 md:py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] md:min-h-0"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigateDay('next')}
              disabled={!canNavigateNext()}
              className="p-1 h-[44px] md:h-8 w-10 flex items-center justify-center"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <div className="flex flex-wrap gap-1 p-1">
            {canViewTab('tickets') && (
              <button
                onClick={() => handleTabChange('tickets')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'tickets'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Tickets
                {(activeTab === 'tickets' ? tickets.length : tabCounts.tickets) > 0 && (
                  <Badge variant="error" className="ml-1">
                    {activeTab === 'tickets' ? tickets.length : tabCounts.tickets}
                  </Badge>
                )}
              </button>
            )}
            {canViewTab('inventory') && (
              <button
                onClick={() => handleTabChange('inventory')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'inventory'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Package className="w-4 h-4" />
                Inventory
                {(activeTab === 'inventory' ? inventoryApprovals.length : tabCounts.inventory) > 0 && (
                  <Badge variant="warning" className="ml-1">
                    {activeTab === 'inventory' ? inventoryApprovals.length : tabCounts.inventory}
                  </Badge>
                )}
              </button>
            )}
            {canViewTab('cash') && (
              <button
                onClick={() => handleTabChange('cash')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'cash'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Cash Management
                {(activeTab === 'cash' ? cashTransactionApprovals.length : tabCounts.cash) > 0 && (
                  <Badge variant="warning" className="ml-1">
                    {activeTab === 'cash' ? cashTransactionApprovals.length : tabCounts.cash}
                  </Badge>
                )}
              </button>
            )}
            {canViewTab('transaction-changes') && (
              <button
                onClick={() => handleTabChange('transaction-changes')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'transaction-changes'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Transaction Changes
                {(activeTab === 'transaction-changes' ? transactionChangeProposals.length : tabCounts.transactionChanges) > 0 && (
                  <Badge variant="warning" className="ml-1">
                    {activeTab === 'transaction-changes' ? transactionChangeProposals.length : tabCounts.transactionChanges}
                  </Badge>
                )}
              </button>
            )}
            {canViewTab('attendance') && (
              <button
                onClick={() => handleTabChange('attendance')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'attendance'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Bell className="w-4 h-4" />
                Shift Request
                {(activeTab === 'attendance' ? attendanceProposals.filter(p => p.status === 'pending').length : tabCounts.attendance) > 0 && (
                  <Badge variant="warning" className="ml-1">
                    {activeTab === 'attendance' ? attendanceProposals.filter(p => p.status === 'pending').length : tabCounts.attendance}
                  </Badge>
                )}
              </button>
            )}
            {canViewTab('violations') && (
              <button
                onClick={() => handleTabChange('violations')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'violations'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Flag className="w-4 h-4" />
                Turn Violation
                {(activeTab === 'violations' ? violationReports.length : tabCounts.violations) > 0 && (
                  <Badge variant="error" className="ml-1">
                    {activeTab === 'violations' ? violationReports.length : tabCounts.violations}
                  </Badge>
                )}
              </button>
            )}
            {canViewTab('ticket-changes') && (
              <button
                onClick={() => handleTabChange('ticket-changes')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'ticket-changes'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Ticket Changes
                {(activeTab === 'ticket-changes' ? ticketReopenRequests.length : tabCounts.ticketChanges) > 0 && (
                  <Badge variant="warning" className="ml-1">
                    {activeTab === 'ticket-changes' ? ticketReopenRequests.length : tabCounts.ticketChanges}
                  </Badge>
                )}
              </button>
            )}
            {canViewTab('queue-history') && (
              <button
                onClick={() => handleTabChange('queue-history')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'queue-history'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <History className="w-4 h-4" />
                Queue History
                {queueRemovalRecords.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {queueRemovalRecords.length}
                  </Badge>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'tickets' && (
            <div>
              {approvalStats && approvalStats.total_closed > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    {selectedDate === getCurrentDateEST() ? "Today's" : formatDateEST(selectedDate)} Approval Status
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Total Closed</p>
                      <p className="text-xl font-bold text-gray-900">{approvalStats.total_closed}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3 h-3 text-orange-600" />
                        <p className="text-xs text-orange-700 font-medium">Pending</p>
                      </div>
                      <p className="text-xl font-bold text-orange-900">{approvalStats.pending_approval}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <p className="text-xs text-green-700 font-medium">Approved</p>
                      </div>
                      <p className="text-xl font-bold text-green-900">{approvalStats.approved}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <p className="text-xs text-blue-700 font-medium">Auto-Approved</p>
                      </div>
                      <p className="text-xl font-bold text-blue-900">{approvalStats.auto_approved}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        <p className="text-xs text-red-700 font-medium">Rejected</p>
                      </div>
                      <p className="text-xl font-bold text-red-900">{approvalStats.rejected}</p>
                    </div>
                    {approvalStats.requires_review > 0 && (
                      <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-3 h-3 text-yellow-600" />
                          <p className="text-xs text-yellow-700 font-medium">Needs Review</p>
                        </div>
                        <p className="text-xl font-bold text-yellow-900">{approvalStats.requires_review}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tickets.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-900 mb-1">All caught up!</p>
                  <p className="text-sm text-gray-500">No tickets requiring management approval</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => {
                    const urgency = getUrgencyLevel(ticket.hours_remaining);
                    const timeRemaining = formatTimeRemaining(ticket.hours_remaining);
                    const totalTips = ticket.tip_customer + ticket.tip_receptionist;
                    const isHighTip = totalTips > 20;

                    return (
                      <div
                        key={ticket.ticket_id}
                        className={`bg-white rounded-lg border-2 p-4 ${
                          urgency === 'urgent'
                            ? 'border-red-500'
                            : urgency === 'warning'
                            ? 'border-yellow-500'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant={urgency === 'urgent' ? 'error' : urgency === 'warning' ? 'warning' : 'default'}>
                                {urgency === 'urgent' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                {urgency === 'warning' && <Clock className="w-3 h-3 mr-1" />}
                                {timeRemaining}
                              </Badge>
                              {ticket.requires_higher_approval && (
                                <Badge variant="warning">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Requires Management
                                </Badge>
                              )}
                              {isHighTip && (
                                <Badge variant="error" className="bg-orange-100 text-orange-800 border-orange-300">
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  High Tips: ${totalTips.toFixed(2)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              Ticket: <span className="font-medium">{ticket.ticket_no}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              Completed by: <span className="font-medium">{ticket.completed_by_name || 'N/A'}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              Closed by: <span className="font-medium">{ticket.closed_by_name}</span>
                            </p>
                            {ticket.reason && (
                              <p className={`text-xs mt-1 flex items-center gap-1 ${
                                isHighTip ? 'text-orange-600 font-medium' : 'text-blue-600'
                              }`}>
                                <AlertCircle className="w-3 h-3" />
                                {ticket.reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-3 bg-gray-50 rounded-lg mb-3">
                          <div>
                            <p className="text-xs text-gray-500">Service</p>
                            <p className="text-sm font-semibold text-gray-900">{ticket.service_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Bill Total</p>
                            <p className="text-sm font-semibold text-gray-900">${ticket.total.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Tip (Customer) Card</p>
                            <p className="text-sm font-semibold text-blue-600">
                              ${(ticket.payment_method === 'Card' ? ticket.tip_customer : 0).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Tip (Customer) Cash</p>
                            <p className="text-sm font-semibold text-green-600">
                              ${(ticket.payment_method === 'Cash' ? ticket.tip_customer : 0).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Tip (Receptionist)</p>
                            <p className="text-sm font-semibold text-green-600">
                              ${ticket.tip_receptionist.toFixed(2)}
                            </p>
                          </div>
                          <div className={isHighTip ? 'bg-orange-50 rounded px-2 -mx-2' : ''}>
                            <p className={`text-xs font-medium ${isHighTip ? 'text-orange-700' : 'text-gray-500'}`}>
                              Total Tips
                            </p>
                            <p className={`text-sm font-bold ${isHighTip ? 'text-orange-700' : 'text-gray-900'}`}>
                              ${totalTips.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {canTakeActions ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleApproveClick(ticket)}
                              className="flex-1"
                              disabled={processing}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRejectClick(ticket)}
                              className="flex-1 text-red-600 hover:bg-red-50"
                              disabled={processing}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">View only</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(historicalManagerTickets.length > 0 || historicalSupervisorTickets.length > 0) && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Historical Approvals</h3>

                  {historicalManagerTickets.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Manager Approvals ({historicalManagerTickets.length})
                      </h4>
                      <div className="space-y-2">
                        {historicalManagerTickets.slice(0, 10).map((ticket) => (
                          <div
                            key={ticket.ticket_id}
                            className={`bg-gray-50 rounded-lg border p-3 ${
                              ticket.approval_status === 'approved' ? 'border-green-200' : 'border-red-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">
                                    Ticket #{ticket.ticket_number}
                                  </span>
                                  <Badge variant={ticket.approval_status === 'approved' ? 'success' : 'error'}>
                                    {ticket.approval_status.toUpperCase()}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-600">
                                  Customer: {ticket.customer_name} • Total: ${ticket.total_amount.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-600">
                                  Services: {ticket.service_names}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Approved by: {ticket.approved_by_name} on {formatDateTimeEST(ticket.approved_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {historicalManagerTickets.length > 10 && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          Showing 10 of {historicalManagerTickets.length} records
                        </p>
                      )}
                    </div>
                  )}

                  {historicalSupervisorTickets.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        Supervisor Approvals ({historicalSupervisorTickets.length})
                      </h4>
                      <div className="space-y-2">
                        {historicalSupervisorTickets.slice(0, 10).map((ticket) => (
                          <div
                            key={ticket.ticket_id}
                            className={`bg-gray-50 rounded-lg border p-3 ${
                              ticket.approval_status === 'approved' ? 'border-green-200' : 'border-red-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">
                                    Ticket #{ticket.ticket_number}
                                  </span>
                                  <Badge variant={ticket.approval_status === 'approved' ? 'success' : 'error'}>
                                    {ticket.approval_status.toUpperCase()}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-600">
                                  Customer: {ticket.customer_name} • Total: ${ticket.total_amount.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-600">
                                  Services: {ticket.service_names}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Approved by: {ticket.approved_by_name} on {formatDateTimeEST(ticket.approved_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {historicalSupervisorTickets.length > 10 && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          Showing 10 of {historicalSupervisorTickets.length} records
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {rejectedTickets.length > 0 && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    Rejected Tickets Requiring Admin Review ({rejectedTickets.length})
                  </h3>
                  <div className="space-y-3">
                    {rejectedTickets.map((ticket) => (
                      <div
                        key={ticket.ticket_id}
                        className="bg-red-50 rounded-lg border-2 border-red-300 p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-gray-900">
                                #{ticket.ticket_no}
                              </span>
                              <Badge variant="error">REJECTED</Badge>
                              <span className="text-sm text-gray-600">
                                {ticket.customer_type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">
                              {ticket.service_name} {ticket.technician_name && `• ${ticket.technician_name}`}
                            </p>
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              Total: ${Number(ticket.total).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="bg-red-100 rounded-lg p-3 mb-3">
                          <p className="text-xs font-semibold text-red-800 mb-1">REJECTION REASON:</p>
                          <p className="text-sm text-red-900">"{ticket.rejection_reason || 'No reason provided'}"</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-600">
                            {ticket.rejected_by_name && `Rejected by: ${ticket.rejected_by_name}`}
                            {ticket.rejected_at && ` • ${formatDateTimeEST(ticket.rejected_at)}`}
                          </p>
                          <button
                            onClick={() => handleClearAdminReview(ticket.ticket_id)}
                            disabled={processing}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50"
                          >
                            Mark as Reviewed
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

{activeTab === 'inventory' && (
            <div>
              {inventoryApprovals.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-900 mb-1">No pending inventory transactions</p>
                  <p className="text-sm text-gray-500">All inventory transactions have been processed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inventoryApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="bg-white rounded-lg border-2 border-blue-200 p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {approval.transaction_type === 'in' ? (
                              <PackagePlus className="w-5 h-5 text-green-600" />
                            ) : (
                              <PackageMinus className="w-5 h-5 text-orange-600" />
                            )}
                            <span className="font-semibold text-gray-900">
                              {approval.transaction_number}
                            </span>
                            <Badge variant={approval.transaction_type === 'in' ? 'success' : 'default'}>
                              {approval.transaction_type.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            Requested by: <span className="font-medium">{approval.requested_by_name}</span>
                            {approval.recipient_name && (
                              <span> → Recipient: <span className="font-medium">{approval.recipient_name}</span></span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">
                            {approval.item_count} item{approval.item_count !== 1 ? 's' : ''} • Total value: ${approval.total_value?.toFixed(2) || '0.00'}
                          </p>
                          {approval.notes && (
                            <p className="text-sm text-gray-600 mt-1 italic">{approval.notes}</p>
                          )}
                        </div>
                        {canTakeActions ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveInventory(approval)}
                              disabled={processing}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRejectInventoryClick(approval)}
                              disabled={processing}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">View only</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'cash' && (
            <div>
              {cashTransactionApprovals.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-900 mb-1">No pending cash transactions</p>
                  <p className="text-sm text-gray-500">All cash transactions have been processed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cashTransactionApprovals.map((approval) => (
                    <div
                      key={approval.transaction_id}
                      className={`bg-white rounded-lg border-2 p-4 ${
                        approval.transaction_type === 'cash_in' ? 'border-green-200' : 'border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {approval.transaction_type === 'cash_in' ? (
                              <ArrowDownLeft className="w-5 h-5 text-green-600" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 text-red-600" />
                            )}
                            <span className="font-semibold text-gray-900">
                              ${approval.amount.toFixed(2)}
                            </span>
                            <Badge variant={approval.transaction_type === 'cash_in' ? 'success' : 'error'}>
                              {approval.transaction_type === 'cash_in' ? 'CASH IN' : 'CASH OUT'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            Created by: <span className="font-medium">{approval.created_by_name}</span>
                          </p>
                          <p className="text-sm text-gray-900 mb-1">
                            <span className="font-medium">Description:</span> {approval.description}
                          </p>
                          {approval.category && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Category:</span> {approval.category}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Date: {formatDateEST(approval.date)}
                          </p>
                        </div>
                        {canTakeActions ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveCashTransaction(approval)}
                              disabled={processing}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRejectCashTransactionClick(approval)}
                              disabled={processing}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">View only</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'transaction-changes' && canReviewTransactionChanges && (
            <div>
              {transactionChangeProposals.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-900 mb-1">No pending transaction changes</p>
                  <p className="text-sm text-gray-500">All change requests have been processed</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactionChangeProposals.map((proposal) => (
                    <div
                      key={proposal.proposal_id}
                      className={`bg-white rounded-lg border-2 p-4 ${
                        proposal.is_deletion_request ? 'border-red-400' : 'border-yellow-400'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {proposal.is_deletion_request ? (
                            <AlertOctagon className="w-5 h-5 text-red-600" />
                          ) : (
                            <FileText className="w-5 h-5 text-yellow-600" />
                          )}
                          <span className="font-semibold text-gray-900">
                            {proposal.is_deletion_request ? 'Deletion Request' : 'Change Request'}
                          </span>
                          <Badge variant={proposal.transaction_type === 'cash_in' ? 'success' : 'danger'}>
                            {proposal.transaction_type === 'cash_in' ? 'DEPOSIT' : 'WITHDRAWAL'}
                          </Badge>
                          {proposal.is_deletion_request && (
                            <Badge variant="danger">DELETE</Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(proposal.created_at).toLocaleDateString('en-US', {
                            timeZone: 'America/New_York',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        Requested by: <span className="font-medium">{proposal.created_by_name}</span>
                      </p>

                      {proposal.is_deletion_request ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-red-800">
                              This request will permanently delete the transaction
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Amount:</span>{' '}
                              <span className="font-medium">${proposal.current_amount.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Category:</span>{' '}
                              <span className="font-medium">{proposal.current_category || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Date:</span>{' '}
                              <span className="font-medium">{proposal.current_date}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Description:</span>{' '}
                              <span className="font-medium">{proposal.current_description}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Current Values</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Amount:</span>
                                <span className={`font-medium ${proposal.proposed_amount !== null ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  ${proposal.current_amount.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Category:</span>
                                <span className={`font-medium ${proposal.proposed_category !== null ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {proposal.current_category || '-'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Date:</span>
                                <span className={`font-medium ${proposal.proposed_date !== null ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {proposal.current_date}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Description:</span>
                                <span className={`font-medium ${proposal.proposed_description !== null ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {proposal.current_description}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-green-700 uppercase mb-2">Proposed Changes</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Amount:</span>
                                <span className={`font-semibold ${proposal.proposed_amount !== null ? 'text-green-700' : 'text-gray-400'}`}>
                                  {proposal.proposed_amount !== null ? `$${proposal.proposed_amount.toFixed(2)}` : 'No change'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Category:</span>
                                <span className={`font-semibold ${proposal.proposed_category !== null ? 'text-green-700' : 'text-gray-400'}`}>
                                  {proposal.proposed_category !== null ? proposal.proposed_category : 'No change'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Date:</span>
                                <span className={`font-semibold ${proposal.proposed_date !== null ? 'text-green-700' : 'text-gray-400'}`}>
                                  {proposal.proposed_date !== null ? proposal.proposed_date : 'No change'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Description:</span>
                                <span className={`font-semibold ${proposal.proposed_description !== null ? 'text-green-700' : 'text-gray-400'}`}>
                                  {proposal.proposed_description !== null ? proposal.proposed_description : 'No change'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <label className="text-xs font-semibold text-yellow-700 uppercase mb-1 block">
                          Reason for Request
                        </label>
                        <p className="text-sm text-gray-700">{proposal.reason_comment}</p>
                      </div>

                      {selectedTransactionChangeProposal?.proposal_id === proposal.proposal_id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Review Comment {proposal.is_deletion_request || 'rejection' ? '' : '(Optional)'}
                            </label>
                            <textarea
                              value={transactionChangeReviewComment}
                              onChange={(e) => setTransactionChangeReviewComment(e.target.value)}
                              placeholder="Add a comment about this decision..."
                              rows={2}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={processing}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedTransactionChangeProposal(null);
                                setTransactionChangeReviewComment('');
                              }}
                              disabled={processing}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRejectTransactionChangeProposal(proposal)}
                              disabled={processing}
                              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveTransactionChangeProposal(proposal)}
                              disabled={processing}
                              className={proposal.is_deletion_request ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {processing ? 'Processing...' : proposal.is_deletion_request ? 'Approve Deletion' : 'Approve Changes'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => setSelectedTransactionChangeProposal(proposal)}
                            disabled={processing}
                          >
                            Review
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              {attendanceProposals.filter(p => p.status === 'pending').length === 0 && attendanceProposals.filter(p => p.status !== 'pending').length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-900 mb-1">No attendance change requests</p>
                  <p className="text-sm text-gray-500">All requests have been processed</p>
                </div>
              ) : (
                <>
                  {attendanceProposals.filter(p => p.status === 'pending').length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        Pending Requests ({attendanceProposals.filter(p => p.status === 'pending').length})
                      </h3>
                      <div className="space-y-3">
                        {attendanceProposals.filter(p => p.status === 'pending').map((proposal) => (
                          <div
                            key={proposal.id}
                            className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="w-4 h-4 text-gray-600" />
                                  <span className="font-semibold text-gray-900">
                                    {proposal.employee?.display_name || 'Unknown'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>{proposal.work_date ? formatDateEST(new Date(proposal.work_date), {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  }) : 'N/A'}</span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(proposal.created_at).toLocaleDateString('en-US', {
                                  timeZone: 'America/New_York',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-white rounded p-3">
                              <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">
                                  Check In
                                </label>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    <span className="text-sm text-gray-600 line-through">
                                      {formatTimeEST(new Date(proposal.current_check_in_time), {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                      })}
                                    </span>
                                  </div>
                                  {proposal.proposed_check_in_time && (
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-3 h-3 text-green-600" />
                                      <span className="text-sm font-semibold text-green-700">
                                        {formatTimeEST(new Date(proposal.proposed_check_in_time), {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true,
                                        })}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">
                                  Check Out
                                </label>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    <span className="text-sm text-gray-600 line-through">
                                      {proposal.current_check_out_time
                                        ? formatTimeEST(new Date(proposal.current_check_out_time), {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true,
                                          })
                                        : 'Not checked out'}
                                    </span>
                                  </div>
                                  {proposal.proposed_check_out_time && (
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-3 h-3 text-green-600" />
                                      <span className="text-sm font-semibold text-green-700">
                                        {formatTimeEST(new Date(proposal.proposed_check_out_time), {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true,
                                        })}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded p-3">
                              <label className="text-xs font-medium text-gray-500 mb-1 block">
                                Reason
                              </label>
                              <p className="text-sm text-gray-700">{proposal.reason_comment}</p>
                            </div>

                            {selectedProposal?.id === proposal.id && (
                              <div className="bg-white rounded p-3">
                                <label className="text-xs font-medium text-gray-700 mb-1 block">
                                  Review Comment (Optional)
                                </label>
                                <textarea
                                  value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                  placeholder="Add a comment about this decision..."
                                  rows={2}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  disabled={processing}
                                />
                              </div>
                            )}

                            <div className="flex justify-end gap-2">
                              {canTakeActions ? (
                                selectedProposal?.id === proposal.id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => {
                                        setSelectedProposal(null);
                                        setReviewComment('');
                                      }}
                                      disabled={processing}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleReviewAttendanceProposal(proposal.id, 'reject')}
                                      disabled={processing}
                                      className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                    >
                                      <XCircle className="w-4 h-4 mr-1" />
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleReviewAttendanceProposal(proposal.id, 'approve')}
                                      disabled={processing}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      {processing ? 'Processing...' : 'Approve'}
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedProposal(proposal)}
                                    disabled={processing}
                                  >
                                    Review
                                  </Button>
                                )
                              ) : (
                                <span className="text-sm text-gray-500 italic">View only</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attendanceProposals.filter(p => p.status !== 'pending').length > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        Previously Reviewed ({attendanceProposals.filter(p => p.status !== 'pending').length})
                      </h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {attendanceProposals.filter(p => p.status !== 'pending').map((proposal) => (
                          <div
                            key={proposal.id}
                            className={`rounded-lg p-3 border ${
                              proposal.status === 'approved'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {proposal.status === 'approved' ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900">
                                  {proposal.employee?.display_name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {proposal.work_date ? formatDateEST(new Date(proposal.work_date), {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  }) : 'N/A'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {proposal.reviewed_at
                                  ? new Date(proposal.reviewed_at).toLocaleDateString('en-US', {
                                      timeZone: 'America/New_York',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                              </span>
                            </div>
                            {proposal.review_comment && (
                              <p className="text-xs text-gray-600 mt-2 ml-6">
                                {proposal.review_comment}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'violations' && (
            <div>
              {violationReports.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Flag className="w-5 h-5 text-red-600" />
                      Pending Turn Violation Reports ({violationReports.length})
                    </h3>
                    <p className="text-sm text-gray-600">
                      Review employee votes and make final decision on reported violations
                    </p>
                  </div>
                  <div className="space-y-3 mb-6">
                    {violationReports.map((report) => {
                      const votesFor = report.votes_for_violation || 0;
                      const votesAgainst = report.votes_against_violation || 0;
                      const totalVotes = votesFor + votesAgainst;
                      const percentageFor = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0;
                      const isExpired = report.status === 'expired';

                      return (
                        <div
                          key={report.report_id}
                          className={`bg-white rounded-lg border-2 p-4 ${
                            isExpired ? 'border-gray-500' : 'border-red-500'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Flag className={`w-5 h-5 ${isExpired ? 'text-gray-600' : 'text-red-600'}`} />
                                <span className="font-semibold text-gray-900">
                                  Turn Violation Report
                                </span>
                                {isExpired ? (
                                  <Badge variant="warning">EXPIRED</Badge>
                                ) : (
                                  <Badge variant="error">PENDING REVIEW</Badge>
                                )}
                                {report.threshold_met ? (
                                  <Badge className="bg-green-100 text-green-700">Threshold Met</Badge>
                                ) : (
                                  <Badge className="bg-yellow-100 text-yellow-700">Threshold Not Met</Badge>
                                )}
                                {report.insufficient_responders && (
                                  <Badge className="bg-orange-100 text-orange-700">Insufficient Responders</Badge>
                                )}
                              </div>
                              {canSeeReporterInfo(report) && (
                                <p className="text-sm text-gray-900 mb-2">
                                  <span className="font-medium">Reporter:</span> {report.reporter_employee_name}
                                </p>
                              )}
                              <p className="text-sm text-gray-900 mb-2">
                                <span className="font-medium">Reported Employee:</span> {report.reported_employee_name}
                              </p>
                              <p className="text-sm text-gray-900 mb-2">
                                <span className="font-medium">Description:</span> {report.violation_description}
                              </p>
                              <p className="text-xs text-gray-500">
                                Date: {formatDateOnly(report.violation_date)}
                              </p>

                              {/* Info Request Display */}
                              {report.info_requested_at && (
                                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                                    <span className="text-sm font-medium text-yellow-800">
                                      Additional Information Requested
                                    </span>
                                  </div>
                                  {report.info_request_message && (
                                    <p className="text-sm text-yellow-700 mb-2 italic">
                                      &ldquo;{report.info_request_message}&rdquo;
                                    </p>
                                  )}
                                  <p className="text-xs text-yellow-600 mb-2">
                                    Requested on {formatDateTimeEST(report.info_requested_at)}
                                  </p>

                                  {/* Input for reporter to respond */}
                                  {isReporter(report) && !report.additional_info_submitted_at && (
                                    <div className="mt-3">
                                      <textarea
                                        value={additionalInfoText}
                                        onChange={(e) => setAdditionalInfoText(e.target.value)}
                                        placeholder="Provide additional details..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                                        rows={3}
                                        disabled={processing}
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleSubmitAdditionalInfo(report)}
                                        disabled={processing || !additionalInfoText.trim()}
                                        className="mt-2"
                                      >
                                        {processing ? 'Submitting...' : 'Submit Additional Info'}
                                      </Button>
                                    </div>
                                  )}

                                  {/* Show submitted info */}
                                  {report.additional_info && (
                                    <div className="mt-2 p-2 bg-white rounded border border-yellow-200">
                                      <p className="text-xs font-medium text-gray-700 mb-1">Additional Info Provided:</p>
                                      <p className="text-sm text-gray-800">{report.additional_info}</p>
                                      {report.additional_info_submitted_at && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          Submitted {formatDateTimeEST(report.additional_info_submitted_at)}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-900 mb-2">
                                  Employee Votes
                                </p>
                                <div className="space-y-2 mb-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ThumbsUp className="w-4 h-4 text-green-600" />
                                      <span className="text-sm font-medium text-gray-900">
                                        {report.votes_violation_confirmed} of {report.min_votes_required} "YES" votes needed
                                      </span>
                                    </div>
                                    {report.threshold_met && (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Total responses: {totalVotes} ({votesFor} Yes, {votesAgainst} No)
                                  </div>
                                  {isExpired && (
                                    <div className="text-xs text-orange-600 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      Report expired after 60 minutes
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {canTakeActions ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleViolationDecisionClick(report)}
                                    disabled={processing}
                                  >
                                    Review & Decide
                                  </Button>
                                  {!report.info_requested_at && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => {
                                        setSelectedReportForInfoRequest(report);
                                        setShowInfoRequestModal(true);
                                      }}
                                      disabled={processing}
                                    >
                                      Request More Info
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <span className="text-sm text-gray-500 italic">View only</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Turn Violation</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setViolationStatusFilter('all')}
                    className={`px-3 py-1 text-sm rounded-full ${
                      violationStatusFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({statusCounts.all})
                  </button>
                  <button
                    onClick={() => setViolationStatusFilter('collecting_responses')}
                    className={`px-3 py-1 text-sm rounded-full ${
                      violationStatusFilter === 'collecting_responses'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Collecting Votes ({statusCounts.collecting_responses})
                  </button>
                  <button
                    onClick={() => setViolationStatusFilter('pending_approval')}
                    className={`px-3 py-1 text-sm rounded-full ${
                      violationStatusFilter === 'pending_approval'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Pending Review ({statusCounts.pending_approval})
                  </button>
                  <button
                    onClick={() => setViolationStatusFilter('approved')}
                    className={`px-3 py-1 text-sm rounded-full ${
                      violationStatusFilter === 'approved'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Approved ({statusCounts.approved})
                  </button>
                  <button
                    onClick={() => setViolationStatusFilter('rejected')}
                    className={`px-3 py-1 text-sm rounded-full ${
                      violationStatusFilter === 'rejected'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Rejected ({statusCounts.rejected})
                  </button>
                  <button
                    onClick={() => setViolationStatusFilter('expired')}
                    className={`px-3 py-1 text-sm rounded-full ${
                      violationStatusFilter === 'expired'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Expired ({statusCounts.expired})
                  </button>
                </div>
              </div>

              {filteredViolationHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Flag className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-900 mb-1">No violation reports found</p>
                  <p className="text-sm text-gray-500">
                    {violationStatusFilter !== 'all'
                      ? 'No reports match the selected filter'
                      : 'No violation reports have been submitted yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredViolationHistory.map((report) => {
                    const totalVotes = report.votes_violation + report.votes_no_violation;
                    const percentageFor = totalVotes > 0 ? Math.round((report.votes_violation / totalVotes) * 100) : 0;

                    let borderColor = 'border-gray-200';
                    let statusBadge = null;

                    if (report.status === 'collecting_responses') {
                      borderColor = 'border-gray-400';
                      statusBadge = <Badge variant="secondary">Collecting Votes</Badge>;
                    } else if (report.status === 'pending_approval') {
                      borderColor = 'border-red-500';
                      statusBadge = <Badge variant="error">Needs Decision</Badge>;
                    } else if (report.status === 'approved') {
                      borderColor = 'border-green-500';
                      statusBadge = <Badge variant="success">APPROVED</Badge>;
                    } else if (report.status === 'rejected') {
                      borderColor = 'border-gray-400';
                      statusBadge = <Badge variant="secondary">NO VIOLATION</Badge>;
                    } else if (report.status === 'expired') {
                      borderColor = 'border-orange-400';
                      statusBadge = <Badge className="bg-orange-100 text-orange-800 border-orange-300">EXPIRED</Badge>;
                    }

                    return (
                      <div
                        key={report.report_id}
                        className={`bg-white rounded-lg border-2 ${borderColor} p-4`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Flag className="w-4 h-4 text-gray-600" />
                              {statusBadge}
                            </div>
                            {canSeeReporterInfo(report) && (
                              <p className="text-sm text-gray-900 mb-1">
                                <span className="font-medium">Reporter:</span> {report.reporter_employee_name}
                              </p>
                            )}
                            <p className="text-sm text-gray-900 mb-1">
                              <span className="font-medium">Reported Employee:</span> {report.reported_employee_name}
                            </p>
                            <p className="text-sm text-gray-700 mb-2">{report.violation_description}</p>
                            <p className="text-xs text-gray-500">
                              Date: {formatDateTimeEST(report.created_at)}
                              {report.queue_position !== null && ` • Queue Position: ${report.queue_position}`}
                            </p>

                            {/* Info Request Display */}
                            {report.info_requested_at && (
                              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                                  <span className="text-sm font-medium text-yellow-800">
                                    Additional Information Requested
                                  </span>
                                </div>
                                {report.info_request_message && (
                                  <p className="text-sm text-yellow-700 mb-2 italic">
                                    &ldquo;{report.info_request_message}&rdquo;
                                  </p>
                                )}
                                <p className="text-xs text-yellow-600 mb-2">
                                  Requested on {formatDateTimeEST(report.info_requested_at)}
                                </p>

                                {/* Input for reporter to respond */}
                                {isReporter(report) && !report.additional_info_submitted_at && (
                                  <div className="mt-3">
                                    <textarea
                                      value={additionalInfoText}
                                      onChange={(e) => setAdditionalInfoText(e.target.value)}
                                      placeholder="Provide additional details..."
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                                      rows={3}
                                      disabled={processing}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleSubmitAdditionalInfo(report)}
                                      disabled={processing || !additionalInfoText.trim()}
                                      className="mt-2"
                                    >
                                      {processing ? 'Submitting...' : 'Submit Additional Info'}
                                    </Button>
                                  </div>
                                )}

                                {/* Show submitted info */}
                                {report.additional_info && (
                                  <div className="mt-2 p-2 bg-white rounded border border-yellow-200">
                                    <p className="text-xs font-medium text-gray-700 mb-1">Additional Info Provided:</p>
                                    <p className="text-sm text-gray-800">{report.additional_info}</p>
                                    {report.additional_info_submitted_at && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Submitted {formatDateTimeEST(report.additional_info_submitted_at)}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {report.status === 'collecting_responses' && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Timer className="w-4 h-4" />
                                  <span>
                                    {report.total_responses} of {report.total_required_responders} votes collected
                                  </span>
                                </div>
                              </div>
                            )}

                            {(report.status === 'pending_approval' || report.status === 'approved' || report.status === 'rejected' || report.status === 'expired') && totalVotes > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-900 mb-2">
                                  Vote Results ({totalVotes} responses)
                                </p>
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <ThumbsUp className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-gray-700">
                                      {report.votes_violation} voted violation ({percentageFor}%)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ThumbsDown className="w-4 h-4 text-red-600" />
                                    <span className="text-sm text-gray-700">
                                      {report.votes_no_violation} voted no violation ({100 - percentageFor}%)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {(report.status === 'approved' || report.status === 'rejected') && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-900 mb-1">Management Decision</p>
                                <p className="text-xs text-gray-600 mb-1">
                                  Reviewed by: <span className="font-medium">{report.reviewed_by_name}</span>
                                  {report.reviewed_at && ` on ${formatDateEST(report.reviewed_at)}`}
                                </p>
                                {report.action_type && report.action_type !== 'none' && (
                                  <p className="text-xs text-gray-700 mb-1">
                                    <span className="font-medium">Action Taken:</span> {report.action_type.replace('_', ' ')}
                                    {report.action_details && ` - ${report.action_details}`}
                                  </p>
                                )}
                                {report.manager_notes && (
                                  <p className="text-xs text-gray-700 italic mt-1">
                                    "{report.manager_notes}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ticket-changes' && canReviewReopenRequests && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Ticket Change Requests</h3>
              <p className="text-sm text-gray-600 mb-4">
                Review requests from Receptionists and Supervisors to reopen closed tickets for changes.
              </p>
              {ticketReopenRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No pending ticket change requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ticketReopenRequests.map((request) => (
                    <div key={request.request_id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="font-semibold text-gray-900">#{request.ticket_no}</span>
                          <span className="text-gray-500 ml-2">{request.customer_name || 'Walk-in'}</span>
                          <span className="text-gray-500 ml-2">${request.total.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500">{formatDateTimeEST(request.created_at)}</span>
                          <Badge variant="warning" className="ml-2">Pending</Badge>
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3">
                        <p className="text-sm font-medium text-amber-800 mb-1">Requested Changes:</p>
                        <p className="text-sm text-amber-700">{request.requested_changes_description}</p>
                        <p className="text-sm font-medium text-amber-800 mt-2 mb-1">Reason:</p>
                        <p className="text-sm text-amber-700">{request.reason_comment}</p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <p className="text-xs text-gray-500">
                          Requested by: <span className="font-medium">{request.created_by_name}</span>
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleViewTicket(request)}
                            disabled={processing}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Ticket
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setViewingRequest(request)}
                            disabled={processing}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            View Request
                          </Button>
                          {canTakeActions ? (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleApproveAndReopen(request)}
                                disabled={processing}
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Approve & Reopen
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setSelectedTicketReopenRequest(request);
                                  setTicketReopenReviewComment('');
                                }}
                                disabled={processing}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          ) : (
                            <span className="text-sm text-gray-500 italic self-center">View only</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'queue-history' && canViewQueueHistory && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Queue Removal History</h3>
                <p className="text-sm text-gray-600 mb-4">
                  View all technician removals from the queue with reasons and cooldown status
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={queueHistoryStartDate}
                        onChange={(e) => setQueueHistoryStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={queueHistoryEndDate}
                        onChange={(e) => setQueueHistoryEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <Button onClick={fetchQueueRemovalHistory} disabled={queueHistoryLoading}>
                      {queueHistoryLoading ? 'Loading...' : 'Apply Filter'}
                    </Button>
                    {queueRemovalRecords.length > 0 && (
                      <Button variant="secondary" onClick={exportQueueHistoryToCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {queueHistoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : queueRemovalRecords.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-900 mb-1">No removals found</p>
                  <p className="text-sm text-gray-500">No queue removals found for the selected date range</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Date/Time
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Technician
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Removed By
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Reason
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Notes
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {queueRemovalRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                {formatQueueRemovalDateTime(record.removed_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="font-medium">{record.employee_name}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                {record.removed_by_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                record.reason === 'Queue adjustment'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {record.reason}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                              {record.notes || (
                                <span className="text-gray-400 italic">No additional notes</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {!record.has_cooldown ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  No Cooldown
                                </span>
                              ) : record.is_active ? (
                                <div>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Active
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {record.minutes_remaining} min remaining
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Expired
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {queueRemovalRecords.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-600 text-center">
                      Showing {queueRemovalRecords.length} removal{queueRemovalRecords.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showRejectModal}
        onClose={() => !processing && setShowRejectModal(false)}
        title="Reject Ticket"
        onConfirm={handleReject}
        confirmText={processing ? 'Rejecting...' : 'Reject Ticket'}
        confirmVariant="danger"
        cancelText="Cancel"
      >
        {selectedTicket && (
          <div>
            <p className="text-gray-700 mb-3">
              Rejecting ticket <strong>{selectedTicket.ticket_no}</strong> will send it for admin review.
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
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showInventoryRejectModal}
        onClose={() => !processing && setShowInventoryRejectModal(false)}
        title="Reject Inventory Transaction"
        onConfirm={handleRejectInventory}
        confirmText={processing ? 'Rejecting...' : 'Reject Transaction'}
        confirmVariant="danger"
        cancelText="Cancel"
      >
        {selectedInventory && (
          <div>
            <p className="text-gray-700 mb-3">
              Rejecting transaction <strong>{selectedInventory.transaction_number}</strong> will prevent inventory quantities from being updated.
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
                placeholder="Please explain why you are rejecting this transaction..."
                disabled={processing}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showCashTransactionRejectModal}
        onClose={() => !processing && setShowCashTransactionRejectModal(false)}
        title="Reject Cash Transaction"
        onConfirm={handleRejectCashTransaction}
        confirmText={processing ? 'Rejecting...' : 'Reject Transaction'}
        confirmVariant="danger"
        cancelText="Cancel"
      >
        {selectedCashTransaction && (
          <div>
            <p className="text-gray-700 mb-3">
              Rejecting this {selectedCashTransaction.transaction_type === 'cash_in' ? 'cash in' : 'cash out'} transaction of <strong>${selectedCashTransaction.amount.toFixed(2)}</strong> will prevent it from being recorded in the cash reconciliation.
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
                placeholder="Please explain why you are rejecting this transaction..."
                disabled={processing}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showViolationDecisionModal}
        onClose={() => !processing && setShowViolationDecisionModal(false)}
        title="Review Turn Violation Report"
        onConfirm={handleSubmitViolationDecision}
        confirmText={processing ? 'Processing...' : 'Submit Decision'}
        confirmVariant={violationDecision === 'violation_confirmed' ? 'danger' : 'default'}
        cancelText="Cancel"
      >
        {selectedViolationReport && (
          <div className="space-y-4">
            {canSeeReporterInfo(selectedViolationReport) && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900 mb-1">Reporter</p>
                <p className="text-sm text-gray-700">{selectedViolationReport.reporter_employee_name}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900 mb-1">Reported Employee</p>
              <p className="text-sm text-gray-700">{selectedViolationReport.reported_employee_name}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900 mb-1">Violation Description</p>
              <p className="text-sm text-gray-700">{selectedViolationReport.violation_description}</p>
            </div>

            {/* Additional Info Display in Modal */}
            {selectedViolationReport.info_requested_at && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-900 mb-2">Additional Information</p>
                {selectedViolationReport.info_request_message && (
                  <p className="text-sm text-yellow-700 mb-2">
                    <span className="font-medium">Question asked:</span> &ldquo;{selectedViolationReport.info_request_message}&rdquo;
                  </p>
                )}
                {selectedViolationReport.additional_info ? (
                  <div className="bg-white rounded p-2 border border-yellow-200">
                    <p className="text-sm text-gray-800">{selectedViolationReport.additional_info}</p>
                    {selectedViolationReport.additional_info_submitted_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted {formatDateTimeEST(selectedViolationReport.additional_info_submitted_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-yellow-700 italic">Reporter has not yet provided additional information.</p>
                )}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900 mb-2">Employee Votes</p>
              <p className="text-sm text-blue-800">
                {selectedViolationReport.votes_for_violation} voted that violation occurred
              </p>
              <p className="text-sm text-blue-800">
                {selectedViolationReport.votes_against_violation} voted that no violation occurred
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Decision <span className="text-red-600">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="decision"
                    value="violation_confirmed"
                    checked={violationDecision === 'violation_confirmed'}
                    onChange={(e) => setViolationDecision(e.target.value as 'violation_confirmed')}
                    disabled={processing}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Confirm Violation</p>
                    <p className="text-sm text-gray-600">The violation did occur and action should be taken</p>
                  </div>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="decision"
                    value="no_violation"
                    checked={violationDecision === 'no_violation'}
                    onChange={(e) => setViolationDecision(e.target.value as 'no_violation')}
                    disabled={processing}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium text-gray-900">No Violation</p>
                    <p className="text-sm text-gray-600">The report is not substantiated</p>
                  </div>
                </label>
              </div>
            </div>

            {violationDecision === 'violation_confirmed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action to Take
                </label>
                <select
                  value={violationAction}
                  onChange={(e) => setViolationAction(e.target.value as any)}
                  disabled={processing}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">No immediate action</option>
                  <option value="warning">Verbal Warning</option>
                  <option value="written_warning">Written Warning</option>
                  <option value="queue_removal">Temporary Queue Removal</option>
                  <option value="suspension">Suspension</option>
                </select>
              </div>
            )}

            {violationDecision === 'violation_confirmed' && violationAction !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Details (Optional)
                </label>
                <textarea
                  value={violationActionDetails}
                  onChange={(e) => setViolationActionDetails(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional details about the action taken..."
                  disabled={processing}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manager Notes <span className="text-red-600">*</span>
              </label>
              <textarea
                value={violationNotes}
                onChange={(e) => setViolationNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Explain your decision and reasoning..."
                disabled={processing}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Request Additional Info Modal */}
      <Modal
        isOpen={showInfoRequestModal}
        onClose={() => {
          if (!processing) {
            setShowInfoRequestModal(false);
            setInfoRequestMessage('');
            setSelectedReportForInfoRequest(null);
          }
        }}
        title="Request Additional Information"
        onConfirm={handleRequestMoreInfo}
        confirmText={processing ? 'Sending...' : 'Send Request'}
        cancelText="Cancel"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Request additional details from the reporter to help make your decision.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question or Prompt (optional)
            </label>
            <textarea
              value={infoRequestMessage}
              onChange={(e) => setInfoRequestMessage(e.target.value)}
              placeholder="What additional information do you need?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
              disabled={processing}
            />
          </div>
        </div>
      </Modal>

      {/* Ticket Reopen Request Rejection Modal */}
      <Modal
        isOpen={!!selectedTicketReopenRequest}
        onClose={() => {
          setSelectedTicketReopenRequest(null);
          setTicketReopenReviewComment('');
        }}
        title="Reject Ticket Change Request"
      >
        {selectedTicketReopenRequest && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                You are about to reject the change request for ticket{' '}
                <span className="font-semibold">#{selectedTicketReopenRequest.ticket_no}</span>.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 mb-1">Requested Changes:</p>
              <p className="text-sm text-amber-700">{selectedTicketReopenRequest.requested_changes_description}</p>
              <p className="text-sm font-medium text-amber-800 mt-2 mb-1">Reason Given:</p>
              <p className="text-sm text-amber-700">{selectedTicketReopenRequest.reason_comment}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                value={ticketReopenReviewComment}
                onChange={(e) => setTicketReopenReviewComment(e.target.value)}
                placeholder="Explain why this request is being rejected..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedTicketReopenRequest(null);
                  setTicketReopenReviewComment('');
                }}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRejectTicketReopenRequest}
                disabled={processing || !ticketReopenReviewComment.trim()}
              >
                {processing ? 'Rejecting...' : 'Reject Request'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Request Modal */}
      <Modal
        isOpen={viewingRequest !== null}
        onClose={() => setViewingRequest(null)}
        title="Ticket Change Request Details"
      >
        {viewingRequest && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Ticket</p>
                <p className="text-lg font-semibold">#{viewingRequest.ticket_no}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Customer</p>
                <p className="text-lg">{viewingRequest.customer_name || 'Walk-in'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total</p>
                <p className="text-lg">${viewingRequest.total.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Ticket Date</p>
                <p className="text-lg">{viewingRequest.ticket_date}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Requested Changes</p>
              <p className="text-amber-700">{viewingRequest.requested_changes_description}</p>

              <p className="text-sm font-semibold text-amber-800 mt-4 mb-2">Reason</p>
              <p className="text-amber-700">{viewingRequest.reason_comment}</p>
            </div>

            <div className="text-sm text-gray-500">
              Requested by <span className="font-medium">{viewingRequest.created_by_name}</span>
              {' '}on {formatDateTimeEST(viewingRequest.created_at)}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  handleViewTicket(viewingRequest);
                  setViewingRequest(null);
                }}
                disabled={processing}
              >
                <Eye className="w-4 h-4 mr-1" />
                View Ticket
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleApproveAndReopen(viewingRequest);
                  setViewingRequest(null);
                }}
                disabled={processing}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Approve & Reopen
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
