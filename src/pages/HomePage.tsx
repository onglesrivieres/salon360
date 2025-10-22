import { useState } from 'react';
import { Store as StoreIcon, ClipboardCheck, UserCheck, FileText } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { PinModal } from '../components/PinModal';
import { LanguageSelector } from '../components/LanguageSelector';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { authenticateWithPIN } from '../lib/auth';

interface HomePageProps {
  onActionSelected: (action: 'checkin' | 'ready' | 'report', session?: any, storeId?: string, hasMultipleStores?: boolean) => void;
}

export function HomePage({ onActionSelected }: HomePageProps) {
  const { logout } = useAuth();
  const [selectedAction, setSelectedAction] = useState<'checkin' | 'ready' | 'report' | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [authenticatedSession, setAuthenticatedSession] = useState<{
    employee_id: string;
    store_id: string;
    display_name: string;
    pay_type: string;
  } | null>(null);

  const handleActionClick = (action: 'checkin' | 'ready' | 'report') => {
    setSelectedAction(action);
    setShowPinModal(true);
    setPinError('');
  };

  const handlePinSubmit = async (pin: string) => {
    setIsLoading(true);
    setPinError('');

    try {
      const session = await authenticateWithPIN(pin);

      if (!session) {
        setPinError('Invalid PIN. Please try again.');
        setIsLoading(false);
        return;
      }

      let employeeStores: any[] = [];
      let hasMultipleStores = false;
      let storeId: string | undefined;

      if (session.role_permission === 'Admin' || session.role_permission === 'Manager' || session.role_permission === 'Owner') {
        const { data: allStores, error: allStoresError } = await supabase
          .from('stores')
          .select('id')
          .eq('active', true);

        if (allStoresError || !allStores || allStores.length === 0) {
          setPinError('No stores available.');
          setIsLoading(false);
          return;
        }

        employeeStores = allStores;
        hasMultipleStores = allStores.length > 1;
        storeId = allStores[0].id;
      } else {
        const { data: assignedStores, error: storeError } = await supabase
          .from('employee_stores')
          .select('store_id')
          .eq('employee_id', session.employee_id);

        if (storeError || !assignedStores || assignedStores.length === 0) {
          setPinError('No store found for this employee.');
          setIsLoading(false);
          return;
        }

        employeeStores = assignedStores;
        hasMultipleStores = assignedStores.length > 1;
        storeId = assignedStores[0].store_id;
      }

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('pay_type, display_name')
        .eq('id', session.employee_id)
        .maybeSingle();

      if (empError) throw empError;

      const payType = employee?.pay_type || 'hourly';
      const displayName = employee?.display_name || session.display_name || 'Employee';

      setAuthenticatedSession({
        employee_id: session.employee_id,
        store_id: storeId,
        display_name: displayName,
        pay_type: payType
      });

      setShowPinModal(false);

      if (selectedAction === 'checkin') {
        await handleCheckInOut(session.employee_id, storeId, displayName, payType);
      } else if (selectedAction === 'ready') {
        await handleReady(session.employee_id, storeId);
      } else if (selectedAction === 'report') {
        onActionSelected('report', session, storeId, hasMultipleStores);
      }
    } catch (error: any) {
      console.error('Authentication failed:', error);
      setPinError('Failed to process request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckInOut = async (employeeId: string, storeId: string, displayName: string, payType: string) => {
    try {
      if (payType === 'daily') {
        setSuccessMessage(`${displayName}, you don't need to check in/out. You're paid daily!`);
        setShowSuccessModal(true);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('store_id', storeId)
        .eq('work_date', today)
        .maybeSingle();

      const isCheckedIn = attendance && attendance.status === 'checked_in';

      if (!isCheckedIn) {
        const { error: checkInError } = await supabase.rpc('check_in_employee', {
          p_employee_id: employeeId,
          p_store_id: storeId,
          p_pay_type: payType
        });

        if (checkInError) throw checkInError;

        const { error: queueError } = await supabase.rpc('join_ready_queue', {
          p_employee_id: employeeId,
          p_store_id: storeId
        });

        if (queueError) console.error('Failed to join queue:', queueError);

        setSuccessMessage(`Welcome ${displayName}! You're checked in and in the ready queue.`);
        setShowSuccessModal(true);
      } else {
        const { data: checkOutSuccess, error: checkOutError } = await supabase.rpc('check_out_employee', {
          p_employee_id: employeeId,
          p_store_id: storeId
        });

        if (checkOutError) throw checkOutError;

        if (!checkOutSuccess) {
          setPinError('No active check-in found');
          return;
        }

        const { error: deleteError } = await supabase
          .from('technician_ready_queue')
          .delete()
          .eq('employee_id', employeeId)
          .eq('store_id', storeId);

        if (deleteError) {
          console.error('Failed to remove from queue:', deleteError);
        }

        setSuccessMessage(`Goodbye ${displayName}! You've been checked out. See you soon!`);
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Check-in/out failed:', error);
      setPinError('Check-in/out failed. Please try again.');
    }
  };

  const handleReady = async (employeeId: string, storeId: string) => {
    try {
      const { data: inQueue, error: checkError } = await supabase.rpc('check_queue_status', {
        p_employee_id: employeeId,
        p_store_id: storeId
      });

      if (checkError) throw checkError;

      if (inQueue) {
        setShowConfirmModal(true);
      } else {
        const { error: joinError } = await supabase.rpc('join_ready_queue', {
          p_employee_id: employeeId,
          p_store_id: storeId
        });

        if (joinError) throw joinError;

        setSuccessMessage('You have successfully joined the ready queue!');
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Queue operation failed:', error);
      setPinError('Failed to process request. Please try again.');
    }
  };

  const handleStayInQueue = () => {
    setShowConfirmModal(false);
    setAuthenticatedSession(null);
    setSelectedAction(null);
    logout();
  };

  const handleLeaveQueue = async () => {
    if (!authenticatedSession) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('leave_ready_queue', {
        p_employee_id: authenticatedSession.employee_id,
        p_store_id: authenticatedSession.store_id
      });

      if (error) throw error;

      setShowConfirmModal(false);
      setSuccessMessage('You have left the ready queue.');
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Failed to leave queue:', error);
      alert('Failed to leave queue. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setSuccessMessage('');
    setAuthenticatedSession(null);
    setSelectedAction(null);
    logout();
  };

  const handlePinModalClose = () => {
    setShowPinModal(false);
    setPinError('');
    setIsLoading(false);
    setSelectedAction(null);
  };

  const getPinModalTitle = () => {
    if (selectedAction === 'checkin') return 'Enter PIN for Check In/Out';
    if (selectedAction === 'ready') return 'Enter PIN for Ready Queue';
    if (selectedAction === 'report') return 'Enter PIN for Reports';
    return 'Enter PIN';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 rounded-full mb-3 sm:mb-4 shadow-lg">
            <StoreIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2 sm:mb-3">Salon360</h1>

          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-lg mx-auto px-2">
            Complete salon management system for scheduling, tracking, and reporting
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <button
            onClick={() => handleActionClick('checkin')}
            disabled={isLoading}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mb-2 sm:mb-3">
                <UserCheck className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Check In/Out
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Clock in and out for your shift
              </p>
            </div>
          </button>

          <button
            onClick={() => handleActionClick('ready')}
            disabled={isLoading}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2 sm:mb-3">
                <ClipboardCheck className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Ready
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Mark yourself ready for customers
              </p>
            </div>
          </button>

          <button
            onClick={() => handleActionClick('report')}
            disabled={isLoading}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-orange-100 flex items-center justify-center mb-2 sm:mb-3">
                <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Report
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                View reports and manage tickets
              </p>
            </div>
          </button>
        </div>
      </div>

      <PinModal
        isOpen={showPinModal}
        onClose={handlePinModalClose}
        onSubmit={handlePinSubmit}
        title={getPinModalTitle()}
        isLoading={isLoading}
        error={pinError}
      />

      <Modal isOpen={showSuccessModal} onClose={handleSuccessClose} title="Success">
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-lg text-gray-900 mb-6">{successMessage}</p>
          <button
            onClick={handleSuccessClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            OK
          </button>
        </div>
      </Modal>

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Queue Status">
        <div className="text-center py-4">
          <p className="text-lg text-gray-900 mb-6">You are already in the ready queue. What would you like to do?</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleStayInQueue}
              disabled={isLoading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Stay in Queue
            </button>
            <button
              onClick={handleLeaveQueue}
              disabled={isLoading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Leave Queue
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
