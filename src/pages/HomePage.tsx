import { useState } from 'react';
import { ClipboardCheck, UserCheck, FileText, Building2 } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { PinModal } from '../components/PinModal';
import { StoreSelectionModal } from '../components/StoreSelectionModal';
import { LanguageSelector } from '../components/LanguageSelector';
import { VersionNotification } from '../components/VersionNotification';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../lib/supabase';
import { authenticateWithPIN } from '../lib/auth';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';
import { getCurrentDateEST } from '../lib/timezone';

interface HomePageProps {
  onActionSelected: (action: 'checkin' | 'checkout' | 'ready' | 'report', session?: any, storeId?: string, hasMultipleStores?: boolean, availableStoreIds?: string[], checkedInStoreId?: string) => void;
}

export function HomePage({ onActionSelected }: HomePageProps) {
  const { logout, t } = useAuth();
  const { getAppName, getAppLogoUrl } = useSettings();
  const [selectedAction, setSelectedAction] = useState<'checkin' | 'checkout' | 'ready' | 'report' | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [authenticatedSession, setAuthenticatedSession] = useState<{
    employee_id: string;
    store_id: string;
    display_name: string;
    pay_type: string;
    role: string[];
  } | null>(null);
  const { hasNewVersion, handleUpdate } = useServiceWorkerUpdate();
  const [showStoreSelection, setShowStoreSelection] = useState(false);
  const [availableStoreIds, setAvailableStoreIds] = useState<string[]>([]);
  const [storeSelectionContext, setStoreSelectionContext] = useState<'checkin' | 'checkout' | 'ready' | 'general'>('general');
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState<string>('');

  const handleActionClick = (action: 'checkin' | 'checkout' | 'ready' | 'report') => {
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
        setPinError(t('home.invalidPin'));
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
          setPinError(t('home.noStoresAvailable'));
          setIsLoading(false);
          return;
        }

        employeeStores = allStores;
        hasMultipleStores = allStores.length > 1;

        // Check for previously selected store
        const previouslySelectedStore = sessionStorage.getItem('selected_store_id');
        if (previouslySelectedStore && allStores.some(s => s.id === previouslySelectedStore)) {
          storeId = previouslySelectedStore;
        } else {
          storeId = allStores[0].id;
        }
      } else {
        const { data: assignedStores, error: storeError } = await supabase
          .from('employee_stores')
          .select('store_id')
          .eq('employee_id', session.employee_id);

        if (storeError || !assignedStores || assignedStores.length === 0) {
          setPinError(t('home.noStoreFound'));
          setIsLoading(false);
          return;
        }

        employeeStores = assignedStores;
        hasMultipleStores = assignedStores.length > 1;

        // Check for previously selected store
        const previouslySelectedStore = sessionStorage.getItem('selected_store_id');
        if (previouslySelectedStore && assignedStores.some(s => s.store_id === previouslySelectedStore)) {
          storeId = previouslySelectedStore;
        } else {
          storeId = assignedStores[0].store_id;
        }
      }

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('pay_type, display_name, skip_queue_on_checkin')
        .eq('id', session.employee_id)
        .maybeSingle();

      if (empError) throw empError;

      const payType = employee?.pay_type || 'hourly';
      const displayName = employee?.display_name || session.display_name || 'Employee';

      const roleArray: string[] = Array.isArray(session.role) ? session.role : [];

      setAuthenticatedSession({
        employee_id: session.employee_id,
        store_id: storeId,
        display_name: displayName,
        pay_type: payType,
        role: roleArray
      });

      setShowPinModal(false);

      if (selectedAction === 'checkin' || selectedAction === 'checkout') {
        if (hasMultipleStores) {
          const storeIds = employeeStores.map(s => s.id || s.store_id);
          setAvailableStoreIds(storeIds);
          setStoreSelectionContext(selectedAction);
          setPendingEmployeeId(session.employee_id);
          setShowStoreSelection(true);
        } else {
          await handleCheckInOut(session.employee_id, storeId, displayName, payType, selectedAction);
        }
      } else if (selectedAction === 'ready') {
        // Block Cashiers from joining the ready queue
        if (roleArray.includes('Cashier')) {
          setPinError(t('home.queueNotAvailableForRole'));
          setIsLoading(false);
          return;
        }

        // Find the store where employee is currently checked in
        const today = getCurrentDateEST();
        const { data: activeCheckIn, error: checkInError } = await supabase
          .from('attendance_records')
          .select('store_id')
          .eq('employee_id', session.employee_id)
          .eq('work_date', today)
          .eq('status', 'checked_in')
          .order('check_in_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (checkInError) {
          console.error('Error checking attendance:', checkInError);
          setPinError(t('home.failedToVerifyCheckIn'));
          setIsLoading(false);
          return;
        }

        if (!activeCheckIn) {
          setPinError(t('home.mustCheckInFirst'));
          setIsLoading(false);
          return;
        }

        // Check if employee is configured to skip queue
        if (employee?.skip_queue_on_checkin === true) {
          setPinError(t('home.queueNotAvailable'));
          setIsLoading(false);
          return;
        }

        // Use the store where they're checked in
        await handleReady(session.employee_id, activeCheckIn.store_id);
      } else if (selectedAction === 'report') {
        // Check if already checked in at a store today
        const today = getCurrentDateEST();
        const { data: checkedInRecord } = await supabase
          .from('attendance_records')
          .select('store_id')
          .eq('employee_id', session.employee_id)
          .eq('work_date', today)
          .eq('status', 'checked_in')
          .is('check_out_time', null)
          .maybeSingle();

        const storeIds = employeeStores.map(s => s.id || s.store_id);
        const checkedInStoreId = checkedInRecord?.store_id;
        onActionSelected('report', session, storeId, hasMultipleStores, storeIds, checkedInStoreId);
      }
    } catch (error: any) {
      console.error('Authentication failed:', error);
      setPinError(t('home.failedToProcess'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStoreSelected = async (storeId: string) => {
    if (!authenticatedSession || !selectedAction) return;

    setShowStoreSelection(false);
    setIsLoading(true);

    try {
      const { data: store } = await supabase
        .from('stores')
        .select('name')
        .eq('id', storeId)
        .maybeSingle();

      const storeName = store?.name || 'Store';
      setSelectedStoreName(storeName);

      authenticatedSession.store_id = storeId;
      setAuthenticatedSession(authenticatedSession);

      if (selectedAction === 'checkin' || selectedAction === 'checkout') {
        await handleCheckInOut(
          authenticatedSession.employee_id,
          storeId,
          authenticatedSession.display_name,
          authenticatedSession.pay_type,
          selectedAction,
          storeName
        );
      } else if (selectedAction === 'ready') {
        // Defense in depth: block Cashiers from reaching handleReady
        if (authenticatedSession.role.includes('Cashier')) {
          setPinError(t('home.queueNotAvailableForRole'));
          return;
        }
        await handleReady(authenticatedSession.employee_id, storeId, storeName);
      }
    } catch (error) {
      console.error('Error handling store selection:', error);
      setPinError(t('home.failedStoreSelection'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckInOut = async (employeeId: string, storeId: string, displayName: string, payType: string, action: 'checkin' | 'checkout', storeName?: string) => {
    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('attendance_display, role, skip_queue_on_checkin, pay_type')
        .eq('id', employeeId)
        .maybeSingle();

      if (employee && employee.attendance_display === false) {
        setPinError(t('home.attendanceNotEnabled'));
        return;
      }

      const today = getCurrentDateEST();
      console.log('Check-in/out flow:', { employeeId, storeId, displayName, today, action });

      if (action === 'checkin') {
        // For check-in: check if already checked in today
        const { data: todayAttendance } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', employeeId)
          .eq('store_id', storeId)
          .eq('work_date', today)
          .eq('status', 'checked_in')
          .is('check_out_time', null)
          .maybeSingle();

        console.log('Today attendance record found:', todayAttendance);

        if (todayAttendance) {
          setPinError(t('home.alreadyCheckedIn'));
          return;
        }

        // Check if within check-in window (15 min before opening)
        const { data: canCheckIn, error: windowError } = await supabase.rpc('can_checkin_now', {
          p_store_id: storeId
        });

        if (windowError) throw windowError;

        if (!canCheckIn) {
          setPinError(t('home.checkInWindowOnly'));
          return;
        }

        const { error: checkInError } = await supabase.rpc('check_in_employee', {
          p_employee_id: employeeId,
          p_store_id: storeId,
          p_pay_type: payType
        });

        if (checkInError) throw checkInError;

        // Only join queue if not skipping (hourly technician with skip_queue_on_checkin enabled)
        const roleArray = Array.isArray(employee?.role) ? employee.role : [];
        const employeePayType = employee?.pay_type || payType;
        const shouldSkipQueue = roleArray.includes('Cashier') ||
                                ((roleArray.includes('Technician') || roleArray.includes('Trainee')) &&
                                employeePayType === 'hourly' &&
                                employee?.skip_queue_on_checkin === true);

        if (!shouldSkipQueue) {
          const { data: queueResult, error: queueError } = await supabase.rpc('join_ready_queue_with_checkin', {
            p_employee_id: employeeId,
            p_store_id: storeId
          });

          if (queueError || !queueResult?.success) {
            console.error('Failed to join queue:', queueError || queueResult?.message);
          }
        }

        const storeMessage = storeName ? ` at ${storeName}` : '';
        const checkedInMessage = shouldSkipQueue ? t('home.checkedInOnly') : t('home.checkedIn');
        setSuccessMessage(`${t('home.welcome')} ${displayName}! ${checkedInMessage}${storeMessage}`);
        setShowSuccessModal(true);
      } else if (action === 'checkout') {
        // For check-out: find any active check-in regardless of date
        const { data: activeAttendance } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', employeeId)
          .eq('store_id', storeId)
          .eq('status', 'checked_in')
          .is('check_out_time', null)
          .order('check_in_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('Active attendance record found:', activeAttendance);

        if (!activeAttendance) {
          console.log('No active check-in found for employee');
          setPinError(t('home.notCheckedIn'));
          return;
        }

        console.log('Attempting to check out employee:', { employeeId, storeId, checkInDate: activeAttendance.work_date });

        const { data: checkOutSuccess, error: checkOutError } = await supabase.rpc('check_out_employee', {
          p_employee_id: employeeId,
          p_store_id: storeId
        });

        console.log('Check-out result:', { checkOutSuccess, checkOutError });

        if (checkOutError) {
          console.error('Check-out error:', checkOutError);
          throw checkOutError;
        }

        if (!checkOutSuccess) {
          console.error('Check-out failed: No active check-in found');
          setPinError(t('home.noActiveCheckIn'));
          return;
        }

        console.log('Check-out successful, removing from queue');

        const { error: deleteError } = await supabase
          .from('technician_ready_queue')
          .delete()
          .eq('employee_id', employeeId)
          .eq('store_id', storeId);

        if (deleteError) {
          console.error('Failed to remove from queue:', deleteError);
        }

        const storeMessage = storeName ? ` from ${storeName}` : '';
        setSuccessMessage(`${t('home.goodbye')} ${displayName}! ${t('home.checkedOut')}${storeMessage}`);
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Check-in/out failed:', error);
      setPinError(t('home.checkInOutFailed'));
    }
  };

  const handleReady = async (employeeId: string, storeId: string, storeName?: string) => {
    console.log('=== handleReady DEBUG ===');
    console.log('employeeId:', employeeId);
    console.log('storeId:', storeId);
    console.log('storeName:', storeName);

    try {
      console.log('Calling check_queue_status...');
      const { data: queueStatus, error: checkError } = await supabase.rpc('check_queue_status', {
        p_employee_id: employeeId,
        p_store_id: storeId
      });
      console.log('check_queue_status response:', { queueStatus, checkError });

      if (checkError) {
        console.error('check_queue_status error:', checkError);
        throw checkError;
      }

      if (queueStatus?.in_queue) {
        console.log('User already in queue, showing confirm modal');
        setShowConfirmModal(true);
      } else {
        console.log('Calling join_ready_queue_with_checkin...');
        const { data: queueResult, error: joinError } = await supabase.rpc('join_ready_queue_with_checkin', {
          p_employee_id: employeeId,
          p_store_id: storeId
        });
        console.log('join_ready_queue_with_checkin response:', { queueResult, joinError });

        if (joinError) {
          console.error('join_ready_queue_with_checkin error:', joinError);
          throw joinError;
        }

        if (!queueResult?.success) {
          console.log('Join queue failed with result:', queueResult);
          setShowPinModal(false);

          if (queueResult?.error === 'COOLDOWN_ACTIVE') {
            const minutesRemaining = queueResult.minutes_remaining || 0;
            const reason = queueResult.reason || 'policy violation';
            setErrorMessage(
              `You cannot join the queue for ${minutesRemaining} more minute${minutesRemaining !== 1 ? 's' : ''}. You were removed for: ${reason}`
            );
          } else if (queueResult?.error === 'CHECK_IN_REQUIRED') {
            setErrorMessage('You must check in before joining the ready queue.');
          } else if (queueResult?.error === 'SKIP_QUEUE_ENABLED') {
            setErrorMessage(t('home.queueNotAvailable'));
          } else if (queueResult?.error === 'ROLE_NOT_ELIGIBLE') {
            setErrorMessage(t('home.queueNotAvailableForRole'));
          } else {
            setErrorMessage(queueResult?.message || 'Unable to join the ready queue. Please ensure you are checked in.');
          }

          setShowErrorModal(true);
          return;
        }

        console.log('Join queue successful!');
        const storeMessage = storeName ? ` at ${storeName}` : '';
        setSuccessMessage(`${t('home.joinedQueue')}${storeMessage}`);
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('=== Queue operation FAILED ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error details:', error?.details);
      console.error('Full error:', error);
      setErrorMessage(`Failed to process request: ${error?.message || 'Unknown error'}. Please try again.`);
      setShowErrorModal(true);
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
      setSuccessMessage(t('home.leftQueue'));
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

  const handleErrorClose = () => {
    setShowErrorModal(false);
    setErrorMessage('');
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
    if (selectedAction === 'checkin') return 'Clock In - Enter PIN';
    if (selectedAction === 'checkout') return 'Clock Out - Enter PIN';
    if (selectedAction === 'ready') return `${t('home.enterPinFor')} ${t('technician.ready')}`;
    if (selectedAction === 'report') return `${t('home.enterPinFor')} ${t('technician.report')}`;
    return t('auth.enterPIN');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-3 sm:p-4">
      {hasNewVersion && <VersionNotification onUpdate={handleUpdate} />}
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center mb-3 sm:mb-4">
            {getAppLogoUrl() ? (
              <img
                src={getAppLogoUrl()}
                alt={getAppName()}
                className="w-32 h-32 sm:w-40 sm:h-40 object-contain"
              />
            ) : (
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-blue-600 flex items-center justify-center">
                <Building2 className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
              </div>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2 sm:mb-3">{getAppName()}</h1>

          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-lg mx-auto px-2">
            {t('home.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="hidden custom:flex bg-white rounded-xl p-5 sm:p-6 shadow-lg">
            <div className="flex flex-col items-center text-center w-full">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mb-2 sm:mb-3">
                <UserCheck className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                {t('technician.checkInOut')}
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm mb-4">
                {t('technician.checkInOutDesc')}
              </p>
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  onClick={() => handleActionClick('checkin')}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 hover:scale-105 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <UserCheck className="w-4 h-4" />
                  In
                </button>
                <button
                  onClick={() => handleActionClick('checkout')}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 hover:scale-105 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <UserCheck className="w-4 h-4" />
                  Out
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleActionClick('ready')}
            disabled={isLoading}
            className="hidden custom:flex bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center text-center w-full">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2 sm:mb-3">
                <ClipboardCheck className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                {t('technician.ready')}
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                {t('technician.readyDesc')}
              </p>
            </div>
          </button>

          <button
            onClick={() => handleActionClick('report')}
            disabled={isLoading}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex"
          >
            <div className="flex flex-col items-center text-center w-full">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-orange-100 flex items-center justify-center mb-2 sm:mb-3">
                <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                {t('technician.report')}
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                {t('technician.reportDesc')}
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

      <Modal isOpen={showSuccessModal} onClose={handleSuccessClose} title={t('home.success')}>
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-lg text-gray-900 mb-6">{successMessage}</p>
          <button
            onClick={handleSuccessClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('actions.close')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title={t('queue.title')}>
        <div className="text-center py-4">
          <p className="text-lg text-gray-900 mb-6">{t('home.alreadyInQueue')}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleStayInQueue}
              disabled={isLoading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {t('home.stayInQueue')}
            </button>
            <button
              onClick={handleLeaveQueue}
              disabled={isLoading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {t('home.leaveQueue')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showErrorModal} onClose={handleErrorClose} title="Check-In Required">
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-lg text-gray-900 mb-6">{errorMessage}</p>
          <button
            onClick={handleErrorClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('actions.close')}
          </button>
        </div>
      </Modal>

      <StoreSelectionModal
        isOpen={showStoreSelection}
        storeIds={availableStoreIds}
        onSelect={handleStoreSelected}
        context={storeSelectionContext}
        employeeId={pendingEmployeeId || undefined}
      />
    </div>
  );
}
