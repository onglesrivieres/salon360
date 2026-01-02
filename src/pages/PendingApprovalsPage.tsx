import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, AlertCircle, Package, PackagePlus, PackageMinus, ArrowDownLeft, ArrowUpRight, DollarSign, Flag, ThumbsUp, ThumbsDown, AlertOctagon, UserX, FileText, Ban, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, PendingApprovalTicket, ApprovalStatistics, PendingInventoryApproval, PendingCashTransactionApproval, ViolationReportForApproval, ViolationDecision, ViolationActionType } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/Modal';
import { getCurrentDateEST } from '../lib/timezone';
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
}

type TabType = 'tickets' | 'inventory' | 'cash' | 'violations';

export function PendingApprovalsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('tickets');
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDateEST());
  const [tickets, setTickets] = useState<PendingApprovalTicket[]>([]);
  const [inventoryApprovals, setInventoryApprovals] = useState<PendingInventoryApproval[]>([]);
  const [cashTransactionApprovals, setCashTransactionApprovals] = useState<PendingCashTransactionApproval[]>([]);
  const [violationReports, setViolationReports] = useState<ViolationReportForApproval[]>([]);
  const [violationHistory, setViolationHistory] = useState<ViolationHistoryReport[]>([]);
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
  const [processing, setProcessing] = useState(false);
  const [approvalStats, setApprovalStats] = useState<ApprovalStatistics | null>(null);
  const [violationStatusFilter, setViolationStatusFilter] = useState<string>('all');
  const [violationSearchTerm, setViolationSearchTerm] = useState('');
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  const userRoles = session?.role || [];
  const isManagement = userRoles.some(role => ['Owner', 'Manager'].includes(role));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['tickets', 'inventory', 'cash', 'violations'].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, []);

  useEffect(() => {
    if (!isManagement) return;

    if (session?.employee_id) {
      if (activeTab === 'tickets') {
        fetchPendingApprovals();
        fetchApprovalStats();
      } else if (activeTab === 'inventory') {
        fetchInventoryApprovals();
      } else if (activeTab === 'cash') {
        fetchCashTransactionApprovals();
      } else if (activeTab === 'violations') {
        fetchViolationReports();
        fetchViolationHistory();
      }
    }
  }, [session?.employee_id, selectedStoreId, selectedDate, activeTab, isManagement]);

  useEffect(() => {
    if (!isManagement) return;

    const interval = setInterval(() => {
      if (session?.employee_id) {
        if (activeTab === 'tickets') {
          fetchPendingApprovals();
          fetchApprovalStats();
        } else if (activeTab === 'inventory') {
          fetchInventoryApprovals();
        } else if (activeTab === 'cash') {
          fetchCashTransactionApprovals();
        } else if (activeTab === 'violations') {
          fetchViolationReports();
          fetchViolationHistory();
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [session?.employee_id, selectedStoreId, activeTab, isManagement]);

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
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      showToast('Failed to load pending approvals', 'error');
    } finally {
      setLoading(false);
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
      setInventoryApprovals(data || []);
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
      setCashTransactionApprovals(data || []);
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
      setViolationReports(data || []);
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
      setViolationHistory(data || []);
    } catch (error) {
      console.error('Error fetching violation history:', error);
    }
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
    setSelectedDate(d.toISOString().split('T')[0]);
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

  if (!isManagement) {
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Management Approvals</h2>
            <p className="text-sm text-gray-600">
              Review and approve pending requests across all categories
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
              {tickets.length > 0 && (
                <Badge variant="error" className="ml-1">
                  {tickets.length}
                </Badge>
              )}
            </button>
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
              {inventoryApprovals.length > 0 && (
                <Badge variant="warning" className="ml-1">
                  {inventoryApprovals.length}
                </Badge>
              )}
            </button>
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
              {cashTransactionApprovals.length > 0 && (
                <Badge variant="warning" className="ml-1">
                  {cashTransactionApprovals.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => handleTabChange('violations')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'violations'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Flag className="w-4 h-4" />
              Violation History
              {violationReports.length > 0 && (
                <Badge variant="error" className="ml-1">
                  {violationReports.length}
                </Badge>
              )}
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'tickets' && (
            <div>
              {approvalStats && approvalStats.total_closed > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    {selectedDate === getCurrentDateEST() ? "Today's" : new Date(selectedDate + 'T00:00:00').toLocaleDateString()} Approval Status
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
                      </div>
                    );
                  })}
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
                            Date: {new Date(approval.date).toLocaleDateString()}
                          </p>
                        </div>
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
                      </div>
                    </div>
                  ))}
                </div>
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

                      return (
                        <div
                          key={report.report_id}
                          className="bg-white rounded-lg border-2 border-red-500 p-4"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Flag className="w-5 h-5 text-red-600" />
                                <span className="font-semibold text-gray-900">
                                  Turn Violation Report
                                </span>
                                <Badge variant="error">PENDING REVIEW</Badge>
                              </div>
                              <p className="text-sm text-gray-900 mb-2">
                                <span className="font-medium">Reported Employee:</span> {report.reported_employee_name}
                              </p>
                              <p className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">Reported by:</span> {report.reporter_employee_name}
                              </p>
                              <p className="text-sm text-gray-900 mb-2">
                                <span className="font-medium">Description:</span> {report.violation_description}
                              </p>
                              <p className="text-xs text-gray-500">
                                Date: {new Date(report.violation_date).toLocaleDateString()}
                              </p>

                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-900 mb-2">
                                  Employee Votes ({totalVotes} responses)
                                </p>
                                <div className="flex items-center gap-4 mb-2">
                                  <div className="flex items-center gap-2">
                                    <ThumbsUp className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-medium text-gray-900">
                                      {votesFor} voted violation occurred ({percentageFor}%)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ThumbsDown className="w-4 h-4 text-red-600" />
                                    <span className="text-sm font-medium text-gray-900">
                                      {votesAgainst} voted no violation ({100 - percentageFor}%)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleViolationDecisionClick(report)}
                                disabled={processing}
                              >
                                Review & Decide
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Violation History</h3>
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
                            <p className="text-sm text-gray-900 mb-1">
                              <span className="font-medium">Reported Employee:</span> {report.reported_employee_name}
                            </p>
                            <p className="text-sm text-gray-600 mb-1">
                              <span className="font-medium">Reported by:</span> {report.reporter_employee_name}
                            </p>
                            <p className="text-sm text-gray-700 mb-2">{report.violation_description}</p>
                            <p className="text-xs text-gray-500">
                              Date: {new Date(report.violation_date).toLocaleDateString()}
                              {report.queue_position !== null && ` • Queue Position: ${report.queue_position}`}
                            </p>

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
                                  {report.reviewed_at && ` on ${new Date(report.reviewed_at).toLocaleDateString()}`}
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
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900 mb-1">Reported Employee</p>
              <p className="text-sm text-gray-700">{selectedViolationReport.reported_employee_name}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900 mb-1">Reported By</p>
              <p className="text-sm text-gray-700">{selectedViolationReport.reporter_employee_name}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900 mb-1">Violation Description</p>
              <p className="text-sm text-gray-700">{selectedViolationReport.violation_description}</p>
            </div>

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
    </div>
  );
}
