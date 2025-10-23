import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { supabase, PendingApprovalTicket, ApprovalStatistics } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/Modal';

export function PendingApprovalsPage() {
  const [tickets, setTickets] = useState<PendingApprovalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<PendingApprovalTicket | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [approvalStats, setApprovalStats] = useState<ApprovalStatistics | null>(null);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  useEffect(() => {
    if (session?.employee_id) {
      fetchPendingApprovals();
      fetchApprovalStats();
    }
  }, [session?.employee_id, selectedStoreId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (session?.employee_id) {
        fetchPendingApprovals();
        fetchApprovalStats();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [session?.employee_id, selectedStoreId]);

  async function fetchApprovalStats() {
    if (!selectedStoreId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
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

      let data, error;

      if (isManagement) {
        const regularResult = await supabase.rpc('get_pending_approvals_for_technician', {
          p_employee_id: session?.employee_id,
          p_store_id: selectedStoreId,
        });

        const managementResult = await supabase.rpc('get_pending_approvals_for_management', {
          p_store_id: selectedStoreId,
        });

        if (regularResult.error) throw regularResult.error;
        if (managementResult.error) throw managementResult.error;

        const regularTickets = regularResult.data || [];
        const managementTickets = managementResult.data || [];

        data = [...regularTickets, ...managementTickets];
        error = null;
      } else {
        const result = await supabase.rpc('get_pending_approvals_for_technician', {
          p_employee_id: session?.employee_id,
          p_store_id: selectedStoreId,
        });
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      showToast('Failed to load pending approvals', 'error');
    } finally {
      setLoading(false);
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

  function handleApproveClick(ticket: PendingApprovalTicket) {
    setSelectedTicket(ticket);
    setShowApproveModal(true);
  }

  function handleRejectClick(ticket: PendingApprovalTicket) {
    setSelectedTicket(ticket);
    setRejectionReason('');
    setShowRejectModal(true);
  }

  async function handleApprove() {
    if (!selectedTicket) return;

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('approve_ticket', {
        p_ticket_id: selectedTicket.ticket_id,
        p_employee_id: session?.employee_id,
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
        action: 'approved',
        description: `${session?.display_name} approved ticket`,
        changes: {
          approval_status: 'approved',
          ticket_no: selectedTicket.ticket_no,
        },
      }]);

      showToast('Ticket approved successfully', 'success');
      setShowApproveModal(false);
      setSelectedTicket(null);
      fetchPendingApprovals();
    } catch (error: any) {
      showToast(error.message || 'Failed to approve ticket', 'error');
    } finally {
      setProcessing(false);
    }
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
              <div className="flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-orange-600" />
                <p className="text-xs text-orange-700 font-medium">Pending</p>
              </div>
              <p className="text-xl font-bold text-orange-900">{approvalStats.pending_approval}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <p className="text-xs text-green-700 font-medium">Approved</p>
              </div>
              <p className="text-xl font-bold text-green-900">{approvalStats.approved}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-blue-600" />
                <p className="text-xs text-blue-700 font-medium">Auto-Approved</p>
              </div>
              <p className="text-xl font-bold text-blue-900">{approvalStats.auto_approved}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-1">
                <AlertCircle className="w-3 h-3 text-red-600" />
                <p className="text-xs text-red-700 font-medium">Rejected</p>
              </div>
              <p className="text-xl font-bold text-red-900">{approvalStats.rejected}</p>
            </div>
            {approvalStats.requires_review > 0 && (
              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
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
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-900 mb-1">All caught up!</p>
          <p className="text-sm text-gray-500">You have no tickets pending approval.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const urgency = getUrgencyLevel(ticket.hours_remaining);
            const timeRemaining = formatTimeRemaining(ticket.hours_remaining);

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
                    <div className="flex items-center gap-2 mb-1">
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
                    </div>
                    <p className="text-sm text-gray-600">
                      Customer: <span className="font-medium">{ticket.customer_name}</span>
                      {ticket.customer_phone && <span className="text-gray-400"> • {ticket.customer_phone}</span>}
                    </p>
                    <p className="text-sm text-gray-600">
                      Closed by: <span className="font-medium">{ticket.closed_by_name}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Service</p>
                    <p className="text-sm font-semibold text-gray-900">{ticket.service_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Bill Total</p>
                    <p className="text-sm font-semibold text-gray-900">${ticket.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tip (Customer) {ticket.payment_method === 'Card' ? 'Card' : 'Cash'}</p>
                    <p className={`text-sm font-semibold ${ticket.payment_method === 'Card' ? 'text-blue-600' : 'text-green-600'}`}>
                      ${ticket.tip_customer.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tip (Receptionist)</p>
                    <p className="text-sm font-semibold text-green-600">
                      ${ticket.tip_receptionist.toFixed(2)}
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
        isOpen={showApproveModal}
        onClose={() => !processing && setShowApproveModal(false)}
        title="Approve Ticket"
        onConfirm={handleApprove}
        confirmText={processing ? 'Approving...' : 'Approve'}
        confirmVariant="primary"
        cancelText="Cancel"
      >
        {selectedTicket && (
          <div>
            <p className="text-gray-700 mb-4">
              Are you sure you want to approve ticket <strong>{selectedTicket.ticket_no}</strong>?
            </p>
            <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{selectedTicket.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Service:</span>
                <span className="font-medium">{selectedTicket.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bill Total:</span>
                <span className="font-medium">${selectedTicket.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tip (Customer) {selectedTicket.payment_method === 'Card' ? 'Card' : 'Cash'}:</span>
                <span className={`font-medium ${selectedTicket.payment_method === 'Card' ? 'text-blue-600' : 'text-green-600'}`}>
                  ${selectedTicket.tip_customer.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tip (Receptionist):</span>
                <span className="font-medium text-green-600">
                  ${selectedTicket.tip_receptionist.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

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
    </div>
  );
}
