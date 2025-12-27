import { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';
import { supabase, AttendanceChangeProposalWithDetails } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { formatTimeEST, formatDateEST } from '../lib/timezone';

interface AttendanceProposalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  onProposalReviewed?: () => void;
}

interface ProposalWithAttendance extends AttendanceChangeProposalWithDetails {
  work_date?: string;
}

export function AttendanceProposalReviewModal({
  isOpen,
  onClose,
  storeId,
  onProposalReviewed,
}: AttendanceProposalReviewModalProps) {
  const [proposals, setProposals] = useState<ProposalWithAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithAttendance | null>(null);
  const { showToast } = useToast();
  const { session } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchProposals();
    }
  }, [isOpen, storeId]);

  async function fetchProposals() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_change_proposals')
        .select(`
          *,
          employee:employees!attendance_change_proposals_employee_id_fkey(id, display_name, legal_name),
          attendance_records!inner(work_date, store_id)
        `)
        .eq('attendance_records.store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData = (data || []).map((item: any) => ({
        ...item,
        work_date: item.attendance_records?.work_date,
      }));

      setProposals(transformedData);
    } catch (error: any) {
      console.error('Error fetching proposals:', error);
      showToast('Failed to load proposals', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewProposal(proposalId: string, action: 'approve' | 'reject') {
    if (!session?.employee_id) return;

    try {
      setReviewingId(proposalId);

      const proposal = proposals.find(p => p.id === proposalId);
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

        if (proposal.proposed_check_in_time && proposal.proposed_check_out_time) {
          const checkIn = new Date(proposal.proposed_check_in_time);
          const checkOut = new Date(proposal.proposed_check_out_time);
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
      onProposalReviewed?.();
      await fetchProposals();
    } catch (error: any) {
      console.error('Error reviewing proposal:', error);
      showToast(error.message || 'Failed to review proposal', 'error');
    } finally {
      setReviewingId(null);
    }
  }

  const formatTime = (dateStr: string) => {
    return formatTimeEST(new Date(dateStr), {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    return formatDateEST(new Date(dateStr), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const pendingProposals = proposals.filter(p => p.status === 'pending');
  const reviewedProposals = proposals.filter(p => p.status !== 'pending');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attendance Change Requests"
    >
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-8 text-sm text-gray-500">Loading proposals...</div>
        ) : (
          <>
            {pendingProposals.length === 0 && reviewedProposals.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No change requests</p>
              </div>
            ) : (
              <>
                {pendingProposals.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      Pending Requests ({pendingProposals.length})
                    </h3>
                    <div className="space-y-3">
                      {pendingProposals.map((proposal) => (
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
                                <span>{proposal.work_date ? formatDate(proposal.work_date) : 'N/A'}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(proposal.created_at).toLocaleDateString('en-US', {
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
                                    {formatTime(proposal.current_check_in_time)}
                                  </span>
                                </div>
                                {proposal.proposed_check_in_time && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-green-600" />
                                    <span className="text-sm font-semibold text-green-700">
                                      {formatTime(proposal.proposed_check_in_time)}
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
                                      ? formatTime(proposal.current_check_out_time)
                                      : 'Not checked out'}
                                  </span>
                                </div>
                                {proposal.proposed_check_out_time && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-green-600" />
                                    <span className="text-sm font-semibold text-green-700">
                                      {formatTime(proposal.proposed_check_out_time)}
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
                              />
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            {selectedProposal?.id === proposal.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setSelectedProposal(null);
                                    setReviewComment('');
                                  }}
                                  disabled={reviewingId === proposal.id}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleReviewProposal(proposal.id, 'reject')}
                                  disabled={reviewingId === proposal.id}
                                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleReviewProposal(proposal.id, 'approve')}
                                  disabled={reviewingId === proposal.id}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  {reviewingId === proposal.id ? 'Processing...' : 'Approve'}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => setSelectedProposal(proposal)}
                              >
                                Review
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reviewedProposals.length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="font-semibold text-gray-700 mb-3">
                      Previously Reviewed ({reviewedProposals.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {reviewedProposals.map((proposal) => (
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
                                {proposal.work_date ? formatDate(proposal.work_date) : 'N/A'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {proposal.reviewed_at
                                ? new Date(proposal.reviewed_at).toLocaleDateString('en-US', {
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
          </>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
