import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, AlertCircle, Package, PackagePlus, PackageMinus, ArrowDownLeft, ArrowUpRight, DollarSign } from 'lucide-react';
import { supabase, PendingApprovalTicket, ApprovalStatistics, PendingInventoryApproval, PendingCashTransactionApproval } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/Modal';
import { getCurrentDateEST } from '../lib/timezone';

export function PendingApprovalsPage() {
  const [tickets, setTickets] = useState<PendingApprovalTicket[]>([]);
  const [inventoryApprovals, setInventoryApprovals] = useState<PendingInventoryApproval[]>([]);
  const [cashTransactionApprovals, setCashTransactionApprovals] = useState<PendingCashTransactionApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<PendingApprovalTicket | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<PendingInventoryApproval | null>(null);
  const [selectedCashTransaction, setSelectedCashTransaction] = useState<PendingCashTransactionApproval | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showInventoryRejectModal, setShowInventoryRejectModal] = useState(false);
  const [showCashTransactionRejectModal, setShowCashTransactionRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [approvalStats, setApprovalStats] = useState<ApprovalStatistics | null>(null);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  useEffect(() => {
    if (session?.employee_id) {
      fetchPendingApprovals();
      fetchInventoryApprovals();
      fetchCashTransactionApprovals();
      fetchApprovalStats();
    }
  }, [session?.employee_id, selectedStoreId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (session?.employee_id) {
        fetchPendingApprovals();
        fetchInventoryApprovals();
        fetchCashTransactionApprovals();
        fetchApprovalStats();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [session?.employee_id, selectedStoreId]);

  async function fetchApprovalStats() {
    if (!selectedStoreId) return;

    try {
      const today = getCurrentDateEST();
      const { data, error } = await supabase.rpc('get_approval_statistics', {
        p_store_id: selectedStoreId,
        p_start_date: today,
        p_end_date: today,
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

      // Must have store_id to fetch approvals
      if (!selectedStoreId) {
        setTickets([]);
        return;
      }

      const userRoles = session?.role || [];
      const isManagement = userRoles.some(role => ['Owner', 'Manager'].includes(role));
      const isSupervisor = userRoles.includes('Supervisor');
      const isTechnician = userRoles.some(role => ['Technician', 'Spa Expert'].includes(role));

      let allTickets: any[] = [];

      if (isTechnician) {
        const techResult = await supabase.rpc('get_pending_approvals_for_technician', {
          p_employee_id: session?.employee_id,
          p_store_id: selectedStoreId,
        });
        if (techResult.error) throw techResult.error;
        allTickets.push(...(techResult.data || []));
      }

      if (isSupervisor) {
        const supervisorResult = await supabase.rpc('get_pending_approvals_for_supervisor', {
          p_employee_id: session?.employee_id,
          p_store_id: selectedStoreId,
        });
        if (supervisorResult.error) throw supervisorResult.error;
        allTickets.push(...(supervisorResult.data || []));
      }

      if (isManagement) {
        const managementResult = await supabase.rpc('get_pending_approvals_for_management', {
          p_store_id: selectedStoreId,
        });
        if (managementResult.error) throw managementResult.error;
        allTickets.push(...(managementResult.data || []));
      }

      const uniqueTickets = Array.from(
        new Map(allTickets.map(ticket => [ticket.ticket_id, ticket])).values()
      );

      const data = uniqueTickets;
      const error = null;

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
      const { data, error } = await supabase.rpc('get_pending_inventory_approvals', {
        p_employee_id: session.employee_id,
        p_store_id: selectedStoreId,
      });

      if (error) throw error;
      setInventoryApprovals(data || []);
    } catch (error) {
      console.error('Error fetching inventory approvals:', error);
    }
  }

  async function fetchCashTransactionApprovals() {
    if (!selectedStoreId) return;

    const userRoles = session?.role || [];
    const isManagement = userRoles.some(role => ['Owner', 'Manager'].includes(role));

    if (!isManagement) {
      setCashTransactionApprovals([]);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_pending_cash_transaction_approvals', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;
      setCashTransactionApprovals(data || []);
    } catch (error) {
      console.error('Error fetching cash transaction approvals:', error);
    }
  }

  async function handleApproveInventory(approval: PendingInventoryApproval) {
    if (!session?.employee_id) {
      console.error('❌ No session.employee_id found');
      return;
    }

    console.log('=== APPROVAL DEBUG START ===');
    console.log('📋 Session Data:', {
      employee_id: session.employee_id,
      display_name: session.display_name,
      role: session.role,
      full_session: session,
    });
    console.log('📦 Approval Data:', {
      id: approval.id,
      transaction_number: approval.transaction_number,
      requested_by_id: approval.requested_by_id,
      recipient_id: approval.recipient_id,
      requires_manager_approval: approval.requires_manager_approval,
      requires_recipient_approval: approval.requires_recipient_approval,
    });

    if (approval.requested_by_id === session.employee_id) {
      await supabase.from('inventory_approval_audit_log').insert({
        employee_id: session.employee_id,
        transaction_id: approval.id,
        store_id: selectedStoreId,
        action_attempted: 'approve',
        transaction_type: approval.transaction_type,
        transaction_number: approval.transaction_number,
        blocked_reason: 'Self-approval not allowed',
      });

      showToast('You cannot approve transactions you created', 'error');
      return;
    }

    try {
      setProcessing(true);

      console.log('🔍 Step 1: Validating employee exists in database...');
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id, display_name, role, status')
        .eq('id', session.employee_id)
        .maybeSingle();

      if (employeeError) {
        console.error('❌ Employee validation query error:', employeeError);
        throw new Error(`Employee validation failed: ${employeeError.message}`);
      }

      if (!employeeData) {
        console.error('❌ Employee not found in database:', session.employee_id);
        showToast('Your employee record could not be verified. Please log out and log back in.', 'error');
        return;
      }

      console.log('✅ Employee validated:', employeeData);

      console.log('🔍 Step 2: Verifying employee has correct store assignment...');
      const { data: storeAssignment, error: storeError } = await supabase
        .from('employee_stores')
        .select('*')
        .eq('employee_id', session.employee_id)
        .eq('store_id', selectedStoreId)
        .maybeSingle();

      if (storeError) {
        console.error('❌ Store assignment validation error:', storeError);
      } else {
        console.log('✅ Store assignment:', storeAssignment ? 'Found' : 'Not found');
      }

      const userRoles = session.role || [];
      const isManager = userRoles.some((role) => ['Manager', 'Owner'].includes(role));
      const isRecipient = approval.recipient_id && session.employee_id === approval.recipient_id;

      console.log('🔐 Authorization Check:', {
        userRoles,
        isManager,
        isRecipient,
        canApprove: isManager || isRecipient,
      });

      if (!isManager && !isRecipient) {
        console.error('❌ User is neither manager nor recipient');
        showToast('You do not have permission to approve this transaction', 'error');
        return;
      }

      const updates: any = { updated_at: new Date().toISOString() };

      if (isManager) {
        updates.manager_approved = true;
        updates.manager_approved_at = new Date().toISOString();
        updates.manager_approved_by_id = session.employee_id;
        console.log('✅ Adding manager approval fields');
      }

      if (isRecipient) {
        updates.recipient_approved = true;
        updates.recipient_approved_at = new Date().toISOString();
        updates.recipient_approved_by_id = session.employee_id;
        console.log('✅ Adding recipient approval fields');
      }

      console.log('📝 Update object to be sent:', JSON.stringify(updates, null, 2));
      console.log('🎯 Updating transaction ID:', approval.id);

      console.log('🔍 Step 3: Executing database update...');
      const { data: updateData, error } = await supabase
        .from('inventory_transactions')
        .update(updates)
        .eq('id', approval.id)
        .select();

      if (error) {
        console.error('❌ Database update error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          full_error: error,
        });
        throw error;
      }

      console.log('✅ Update successful:', updateData);
      console.log('=== APPROVAL DEBUG END ===');

      showToast('Inventory transaction approved', 'success');
      fetchInventoryApprovals();
    } catch (error: any) {
      console.error('💥 APPROVAL FAILED:', {
        error_message: error?.message,
        error_code: error?.code,
        error_details: error?.details,
        error_hint: error?.hint,
        full_error: error,
      });

      let errorMessage = 'Failed to approve transaction';

      if (error?.code === '23503') {
        errorMessage = 'Employee verification failed. Please log out and log back in.';
      } else if (error?.code === '42501') {
        errorMessage = 'Insufficient permissions to approve this transaction';
      } else if (error?.code) {
        errorMessage = `Database error (${error.code}): ${error.message}`;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      showToast(errorMessage, 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRejectInventoryClick(approval: PendingInventoryApproval) {
    if (!session?.employee_id) return;

    if (approval.requested_by_id === session.employee_id) {
      await supabase.from('inventory_approval_audit_log').insert({
        employee_id: session.employee_id,
        transaction_id: approval.id,
        store_id: selectedStoreId,
        action_attempted: 'reject',
        transaction_type: approval.transaction_type,
        transaction_number: approval.transaction_number,
        blocked_reason: 'Self-rejection not allowed',
      });

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

  function isOwnTransaction(approval: PendingInventoryApproval): boolean {
    return approval.requested_by_id === session?.employee_id;
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

    const userRoles = session?.role || [];
    const isManager = userRoles.some((role) => ['Manager', 'Owner'].includes(role));

    if (!isManager) {
      showToast('You do not have permission to approve cash transactions', 'error');
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
      console.error('Error approving cash transaction:', error);
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

  function isOwnCashTransaction(approval: PendingCashTransactionApproval): boolean {
    return approval.created_by_id === session?.employee_id;
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

      await supabase.from('ticket_activity_log').insert([{
        ticket_id: ticket.ticket_id,
        employee_id: session?.employee_id,
        action: 'approved',
        description: `${session?.display_name} approved ticket`,
        changes: {
          approval_status: 'approved',
          ticket_no: ticket.ticket_no,
        },
      }]);

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

      await supabase.from('ticket_activity_log').insert([{
        ticket_id: selectedTicket.ticket_id,
        employee_id: session?.employee_id,
        action: 'rejected',
        description: `${session?.display_name} rejected ticket: ${rejectionReason}`,
        changes: {
          approval_status: 'rejected',
          rejection_reason: rejectionReason,
          ticket_no: selectedTicket.ticket_no,
        },
      }]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pending approvals...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Pending Approvals</h2>
        <p className="text-sm text-gray-600">
          Review and approve tickets that you worked on. Tickets will be automatically approved after 48 hours.
        </p>
      </div>

      {approvalStats && approvalStats.total_closed > 0 && (
        <div className="bg-white rounded-lg shadow mb-4 p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Today's Approval Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Total Closed</p>
              <p className="text-xl font-bold text-gray-900">{approvalStats.total_closed}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3 h-3 text-orange-600" />
                <p className="text-xs text-orange-700 font-medium">Pending</p>
              </div>
              <p className="text-xl font-bold text-orange-900">{approvalStats.pending_approval}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <p className="text-xs text-green-700 font-medium">Approved</p>
              </div>
              <p className="text-xl font-bold text-green-900">{approvalStats.approved}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3 h-3 text-blue-600" />
                <p className="text-xs text-blue-700 font-medium">Auto-Approved</p>
              </div>
              <p className="text-xl font-bold text-blue-900">{approvalStats.auto_approved}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-3 h-3 text-red-600" />
                <p className="text-xs text-red-700 font-medium">Rejected</p>
              </div>
              <p className="text-xl font-bold text-red-900">{approvalStats.rejected}</p>
            </div>
            {approvalStats.requires_review > 0 && (
              <div className="bg-yellow-50 rounded-lg p-3">
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

      {inventoryApprovals.length > 0 && (
        <div className="mb-6">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Pending Inventory Approvals ({inventoryApprovals.length})
            </h3>
            <p className="text-sm text-gray-600">
              Review and approve inventory transactions
            </p>
          </div>
          <div className="space-y-3">
            {inventoryApprovals.map((approval) => {
              const isOwn = isOwnTransaction(approval);
              return (
                <div
                  key={approval.id}
                  className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                    isOwn ? 'border-gray-400 opacity-75' : 'border-blue-500'
                  }`}
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
                        {isOwn && (
                          <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                            Created by you
                          </Badge>
                        )}
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
                      <div className="flex items-center gap-2 mt-2">
                        {approval.requires_manager_approval && !approval.manager_approved && (
                          <Badge variant="warning" className="text-xs">
                            Needs Manager Approval
                          </Badge>
                        )}
                        {approval.requires_recipient_approval && !approval.recipient_approved && (
                          <Badge variant="warning" className="text-xs">
                            Needs Recipient Approval
                          </Badge>
                        )}
                        {isOwn && (
                          <p className="text-xs text-gray-500 italic">
                            Self-approval not allowed for audit compliance
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveInventory(approval)}
                        disabled={processing || isOwn}
                        title={isOwn ? 'You cannot approve transactions you created' : 'Approve transaction'}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRejectInventoryClick(approval)}
                        disabled={processing || isOwn}
                        title={isOwn ? 'You cannot reject transactions you created' : 'Reject transaction'}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cashTransactionApprovals.length > 0 && (
        <div className="mb-6">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Pending Cash Transaction Approvals ({cashTransactionApprovals.length})
            </h3>
            <p className="text-sm text-gray-600">
              Review and approve cash in/out transactions
            </p>
          </div>
          <div className="space-y-3">
            {cashTransactionApprovals.map((approval) => {
              const isOwn = isOwnCashTransaction(approval);
              return (
                <div
                  key={approval.transaction_id}
                  className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                    isOwn ? 'border-gray-400 opacity-75' :
                    approval.transaction_type === 'cash_in' ? 'border-green-500' : 'border-red-500'
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
                        {isOwn && (
                          <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                            Created by you
                          </Badge>
                        )}
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
                      {isOwn && (
                        <p className="text-xs text-gray-500 italic mt-1">
                          Self-approval not allowed for audit compliance
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveCashTransaction(approval)}
                        disabled={processing || isOwn}
                        title={isOwn ? 'You cannot approve transactions you created' : 'Approve transaction'}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRejectCashTransactionClick(approval)}
                        disabled={processing || isOwn}
                        title={isOwn ? 'You cannot reject transactions you created' : 'Reject transaction'}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tickets.length === 0 && inventoryApprovals.length === 0 && cashTransactionApprovals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-900 mb-1">All caught up!</p>
          <p className="text-sm text-gray-500">You have no pending approvals.</p>
        </div>
      ) : tickets.length > 0 ? (
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Pending Ticket Approvals ({tickets.length})
          </h3>
        </div>
      ) : null}

      {tickets.length > 0 && (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const urgency = getUrgencyLevel(ticket.hours_remaining);
            const timeRemaining = formatTimeRemaining(ticket.hours_remaining);
            const totalTips = ticket.tip_customer + ticket.tip_receptionist;
            const isHighTip = totalTips > 20;

            return (
              <div
                key={ticket.ticket_id}
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                  urgency === 'urgent'
                    ? 'border-red-500'
                    : urgency === 'warning'
                    ? 'border-yellow-500'
                    : 'border-green-500'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={urgency === 'urgent' ? 'error' : urgency === 'warning' ? 'warning' : 'default'}>
                        {urgency === 'urgent' ? (
                          <AlertTriangle className="w-3 h-3 mr-1" />
                        ) : (
                          <Clock className="w-3 h-3 mr-1" />
                        )}
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
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRejectClick(ticket)}
                    className="flex-1 text-red-600 hover:bg-red-50"
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                The ticket will be locked and require admin review before any further action can be taken.
              </p>
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
    </div>
  );
}
