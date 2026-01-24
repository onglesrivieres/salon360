import { useState, useEffect } from 'react';
import { X, Clock, LogIn, LogOut, CheckCircle } from 'lucide-react';
import { supabase, AttendanceRecord } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { formatTimeEST, formatDateEST, getCurrentDateEST } from '../lib/timezone';

interface CheckInOutModalProps {
  onClose: () => void;
  storeId: string;
  onCheckInComplete?: () => void;
  onCheckOutComplete?: () => void;
}

export function CheckInOutModal({ onClose, storeId, onCheckInComplete, onCheckOutComplete }: CheckInOutModalProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentAttendance, setCurrentAttendance] = useState<AttendanceRecord | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    checkTodayAttendance();
  }, []);

  async function checkTodayAttendance() {
    if (!session?.employee_id) return;

    try {
      const today = getCurrentDateEST();

      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', session.employee_id)
        .eq('store_id', storeId)
        .eq('work_date', today)
        .maybeSingle();

      if (error) throw error;

      setCurrentAttendance(data);
    } catch (error: any) {
      console.error('Error checking attendance:', error);
    } finally {
      setCheckingStatus(false);
    }
  }

  async function handleCheckIn() {
    if (!session?.employee_id) {
      showToast('Employee not found', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('pay_type, display_name, role, skip_queue_on_checkin')
        .eq('id', session.employee_id)
        .maybeSingle();

      const payType = employee?.pay_type || 'hourly';
      const displayName = employee?.display_name || session.display_name || 'Employee';

      const { error } = await supabase.rpc('check_in_employee', {
        p_employee_id: session.employee_id,
        p_store_id: storeId,
        p_pay_type: payType
      });

      if (error) throw error;

      const checkInTime = formatTimeEST(new Date());

      // Only join queue if not skipping (hourly technician with skip_queue_on_checkin enabled)
      const roleArray = Array.isArray(employee?.role) ? employee.role : [];
      const shouldSkipQueue = roleArray.includes('Technician') &&
                              payType === 'hourly' &&
                              employee?.skip_queue_on_checkin === true;

      console.log('DEBUG shouldSkipQueue check (CheckInOutModal):', {
        roleArray,
        roleIncludesTechnician: roleArray.includes('Technician'),
        payType,
        skipQueueValue: employee?.skip_queue_on_checkin,
        shouldSkipQueue
      });

      if (shouldSkipQueue) {
        showToast(`Welcome to work, ${displayName}! Checked in at ${checkInTime}.`, 'success');
      } else {
        // Automatically join the ready queue after check-in
        const { data: queueResult, error: queueError } = await supabase.rpc('join_ready_queue_with_checkin', {
          p_employee_id: session.employee_id,
          p_store_id: storeId
        });

        if (queueError || !queueResult?.success) {
          console.error('Failed to join queue:', queueError || queueResult?.message);
          showToast(`Welcome to work, ${displayName}! Checked in at ${checkInTime}. Note: Could not join ready queue automatically.`, 'success');
        } else {
          showToast(`Welcome to work, ${displayName}! Checked in at ${checkInTime} and added to the ready queue.`, 'success');
        }
      }

      setTimeout(() => {
        onCheckInComplete?.();
      }, 2000);

    } catch (error: any) {
      console.error('Error checking in:', error);
      showToast(error.message || 'Failed to check in', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!session?.employee_id) {
      showToast('Employee not found', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('display_name')
        .eq('id', session.employee_id)
        .maybeSingle();

      const displayName = employee?.display_name || session.display_name || 'Employee';

      const { data, error } = await supabase.rpc('check_out_employee', {
        p_employee_id: session.employee_id,
        p_store_id: storeId
      });

      if (error) throw error;

      if (!data) {
        showToast('No active check-in found', 'error');
        return;
      }

      // Remove from ready queue after checkout
      const { error: deleteError } = await supabase
        .from('technician_ready_queue')
        .delete()
        .eq('employee_id', session.employee_id)
        .eq('store_id', storeId);

      if (deleteError) {
        console.error('Failed to remove from queue:', deleteError);
      }

      const checkOutTime = formatTimeEST(new Date());

      showToast(`Goodbye, ${displayName}! Checked out at ${checkOutTime}. See you soon!`, 'success');

      setTimeout(() => {
        onCheckOutComplete?.();
      }, 2000);

    } catch (error: any) {
      console.error('Error checking out:', error);
      showToast(error.message || 'Failed to check out', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (checkingStatus) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="text-center text-gray-500">Checking attendance status...</div>
        </div>
      </div>
    );
  }

  const isCheckedIn = currentAttendance && currentAttendance.status === 'checked_in';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isCheckedIn ? 'Check Out' : 'Check In'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {isCheckedIn ? (
            <div className="space-y-6">
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-600 mb-2">You are currently checked in</p>
                <p className="text-sm text-gray-500">
                  Since: {formatTimeEST(currentAttendance.check_in_time)}
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-900 mb-1">Ready to leave?</p>
                    <p className="text-xs text-orange-700">
                      Checking out will log you out of the system and record your work hours for today.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCheckOut}
                disabled={loading}
                variant="primary"
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {loading ? 'Checking out...' : 'Check Out & Log Out'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <LogIn className="w-10 h-10 text-blue-600" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-600 mb-2">Ready to start your shift?</p>
                <p className="text-sm text-gray-500">
                  {formatDateEST(new Date(), {
                    weekday: 'long',
                    month: 'long'
                  })}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">Clock in now</p>
                    <p className="text-xs text-blue-700">
                      Your check-in time will be recorded and you'll be automatically added to the ready queue.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCheckIn}
                disabled={loading}
                variant="primary"
                className="w-full"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {loading ? 'Checking in...' : 'Check In'}
              </Button>
            </div>
          )}

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full mt-3"
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
