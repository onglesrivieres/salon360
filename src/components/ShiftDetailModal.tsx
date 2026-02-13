import { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle } from 'lucide-react';
import { supabase, StoreAttendance, AttendanceChangeProposal } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { formatTimeEST, formatDateEST, convertESTDatetimeStringToUTC, getCurrentTimezone } from '../lib/timezone';

interface ShiftDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance: StoreAttendance | null;
  onProposalSubmitted?: () => void;
}

function convertUTCToESTDate(utcDate: Date): Date {
  const timezone = getCurrentTimezone();
  const estDateString = utcDate.toLocaleString('en-US', { timeZone: timezone });
  return new Date(estDateString);
}

export function ShiftDetailModal({
  isOpen,
  onClose,
  attendance,
  onProposalSubmitted,
}: ShiftDetailModalProps) {
  const [pendingProposal, setPendingProposal] = useState<AttendanceChangeProposal | null>(null);
  const [proposedCheckInTime, setProposedCheckInTime] = useState('');
  const [proposedCheckOutTime, setProposedCheckOutTime] = useState('');
  const [reasonComment, setReasonComment] = useState('');
  const [_loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const { session } = useAuth();

  useEffect(() => {
    if (isOpen && attendance) {
      fetchPendingProposal();
      initializeTimes();
    }
  }, [isOpen, attendance]);

  function initializeTimes() {
    if (!attendance) return;

    const checkInDateEST = convertUTCToESTDate(new Date(attendance.check_in_time));
    const checkInTimeStr = `${String(checkInDateEST.getHours()).padStart(2, '0')}:${String(checkInDateEST.getMinutes()).padStart(2, '0')}`;
    setProposedCheckInTime(checkInTimeStr);

    if (attendance.check_out_time) {
      const checkOutDateEST = convertUTCToESTDate(new Date(attendance.check_out_time));
      const checkOutTimeStr = `${String(checkOutDateEST.getHours()).padStart(2, '0')}:${String(checkOutDateEST.getMinutes()).padStart(2, '0')}`;
      setProposedCheckOutTime(checkOutTimeStr);
    } else {
      setProposedCheckOutTime('');
    }

    setReasonComment('');
  }

  async function fetchPendingProposal() {
    if (!attendance) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_change_proposals')
        .select('*')
        .eq('attendance_record_id', attendance.attendance_record_id)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;

      setPendingProposal(data);
    } catch (error: any) {
      console.error('Error fetching pending proposal:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitProposal() {
    if (!attendance || !session?.employee_id) return;

    if (!reasonComment.trim()) {
      showToast('Please provide a reason for the change', 'error');
      return;
    }

    const currentCheckInEST = convertUTCToESTDate(new Date(attendance.check_in_time));
    const currentCheckInTimeStr = `${String(currentCheckInEST.getHours()).padStart(2, '0')}:${String(currentCheckInEST.getMinutes()).padStart(2, '0')}`;

    let currentCheckOutTimeStr = '';
    if (attendance.check_out_time) {
      const currentCheckOutEST = convertUTCToESTDate(new Date(attendance.check_out_time));
      currentCheckOutTimeStr = `${String(currentCheckOutEST.getHours()).padStart(2, '0')}:${String(currentCheckOutEST.getMinutes()).padStart(2, '0')}`;
    }

    const checkInChanged = proposedCheckInTime !== currentCheckInTimeStr;
    const checkOutChanged = proposedCheckOutTime !== currentCheckOutTimeStr;

    if (!checkInChanged && !checkOutChanged) {
      showToast('No changes detected', 'error');
      return;
    }

    if (proposedCheckInTime && proposedCheckOutTime) {
      const [checkInHour, checkInMin] = proposedCheckInTime.split(':').map(Number);
      const [checkOutHour, checkOutMin] = proposedCheckOutTime.split(':').map(Number);
      const checkInMinutes = checkInHour * 60 + checkInMin;
      const checkOutMinutes = checkOutHour * 60 + checkOutMin;

      if (checkOutMinutes <= checkInMinutes) {
        showToast('Check-out time must be after check-in time', 'error');
        return;
      }
    }

    try {
      setSubmitting(true);

      const [year, month, day] = attendance.work_date.split('-').map(Number);

      let proposedCheckInISO = null;
      if (checkInChanged && proposedCheckInTime) {
        const [hour, minute] = proposedCheckInTime.split(':').map(Number);
        const estDatetimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        proposedCheckInISO = convertESTDatetimeStringToUTC(estDatetimeString);
      }

      let proposedCheckOutISO = null;
      if (checkOutChanged && proposedCheckOutTime) {
        const [hour, minute] = proposedCheckOutTime.split(':').map(Number);
        const estDatetimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        proposedCheckOutISO = convertESTDatetimeStringToUTC(estDatetimeString);
      }

      const { error } = await supabase
        .from('attendance_change_proposals')
        .insert({
          attendance_record_id: attendance.attendance_record_id,
          employee_id: session.employee_id,
          proposed_check_in_time: proposedCheckInISO,
          proposed_check_out_time: proposedCheckOutISO,
          current_check_in_time: attendance.check_in_time,
          current_check_out_time: attendance.check_out_time,
          reason_comment: reasonComment.trim(),
          status: 'pending',
        });

      if (error) throw error;

      showToast('Change proposal submitted successfully', 'success');
      onProposalSubmitted?.();
      onClose();
    } catch (error: any) {
      console.error('Error submitting proposal:', error);
      showToast(error.message || 'Failed to submit proposal', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!attendance) return null;

  const currentCheckIn = new Date(attendance.check_in_time);
  const currentCheckOut = attendance.check_out_time ? new Date(attendance.check_out_time) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Shift Details"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-5 h-5" />
          <span>{formatDateEST(new Date(attendance.work_date), {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</span>
        </div>

        {pendingProposal && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">Pending Change Request</p>
                <p className="text-sm text-yellow-800 mt-1">
                  You have a pending change request for this shift. Please wait for manager approval.
                </p>
                <p className="text-sm text-yellow-700 mt-2">
                  <span className="font-medium">Reason:</span> {pendingProposal.reason_comment}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Current Times</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Check In</label>
              <div className="flex items-center gap-2 text-gray-900">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="font-medium">{formatTimeEST(currentCheckIn, {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Check Out</label>
              <div className="flex items-center gap-2 text-gray-900">
                <Clock className="w-4 h-4 text-red-600" />
                <span className="font-medium">
                  {currentCheckOut ? formatTimeEST(currentCheckOut, {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  }) : 'Not checked out'}
                </span>
              </div>
            </div>
          </div>
          {attendance.total_hours !== null && attendance.total_hours !== undefined && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Total Hours: </span>
              <span className="font-semibold text-gray-900">
                {attendance.total_hours.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {!pendingProposal && (
          <>
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-900 mb-4">Request Time Change</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Proposed Check In
                    </label>
                    <Input
                      type="time"
                      value={proposedCheckInTime}
                      onChange={(e) => setProposedCheckInTime(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Proposed Check Out
                    </label>
                    <Input
                      type="time"
                      value={proposedCheckOutTime}
                      onChange={(e) => setProposedCheckOutTime(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Change
                  </label>
                  <textarea
                    value={reasonComment}
                    onChange={(e) => setReasonComment(e.target.value)}
                    placeholder="Please explain why you need to change these times..."
                    rows={4}
                    disabled={submitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800">
                      Your request will be reviewed by a manager. You'll be notified once it's approved or rejected.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitProposal}
                disabled={submitting || !reasonComment.trim()}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </>
        )}

        {pendingProposal && (
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
