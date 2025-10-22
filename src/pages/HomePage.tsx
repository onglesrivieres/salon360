import { useState } from 'react';
import { Store as StoreIcon, ClipboardCheck, UserCheck, FileText } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { PinModal } from '../components/PinModal';
import { LanguageSelector } from '../components/LanguageSelector';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { authenticateWithPIN } from '../lib/auth';

interface HomePageProps {
  onActionSelected: (action: 'checkin' | 'ready' | 'report') => void;
}

export function HomePage({ onActionSelected }: HomePageProps) {
  const { logout } = useAuth();
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [authenticatedSession, setAuthenticatedSession] = useState<{
    employee_id: string;
    store_id: string;
  } | null>(null);

  const handleReadyClick = () => {
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

      // Get the first store for this employee
      const { data: employeeStores, error: storeError } = await supabase
        .from('employee_stores')
        .select('store_id')
        .eq('employee_id', session.employee_id)
        .limit(1);

      if (storeError || !employeeStores || employeeStores.length === 0) {
        setPinError('No store found for this employee.');
        setIsLoading(false);
        return;
      }

      const storeId = employeeStores[0].store_id;
      setAuthenticatedSession({ employee_id: session.employee_id, store_id: storeId });

      // Check if already in queue
      const { data: inQueue, error: checkError } = await supabase.rpc('check_queue_status', {
        p_employee_id: session.employee_id,
        p_store_id: storeId
      });

      if (checkError) {
        console.error('Check queue error:', checkError);
        throw checkError;
      }

      setShowPinModal(false);

      if (inQueue) {
        setShowConfirmModal(true);
      } else {
        const { error: joinError } = await supabase.rpc('join_ready_queue', {
          p_employee_id: session.employee_id,
          p_store_id: storeId
        });

        if (joinError) {
          console.error('Join queue error:', joinError);
          throw joinError;
        }

        setSuccessMessage('You have successfully joined the ready queue!');
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Queue operation failed:', error);
      setPinError('Failed to process request. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
    logout();
  };

  const handleStayInQueue = () => {
    setShowConfirmModal(false);
    setAuthenticatedSession(null);
    logout();
  };

  const handlePinModalClose = () => {
    setShowPinModal(false);
    setPinError('');
    setIsLoading(false);
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
            onClick={() => onActionSelected('checkin')}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95"
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
            onClick={handleReadyClick}
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
            onClick={() => onActionSelected('report')}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95"
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

      {/* PIN Modal */}
      <PinModal
        isOpen={showPinModal}
        onClose={handlePinModalClose}
        onSubmit={handlePinSubmit}
        title="Enter PIN for Ready Queue"
        isLoading={isLoading}
        error={pinError}
      />

      {/* Success Modal */}
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

      {/* Confirmation Modal */}
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
