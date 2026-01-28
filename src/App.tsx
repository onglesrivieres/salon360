import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { NumericKeypadProvider } from './contexts/NumericKeypadContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { PermissionsCacheProvider } from './contexts/PermissionsCacheContext';
import { NumericKeypad } from './components/NumericKeypad';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { TicketsPage } from './pages/TicketsPage';
import { supabase } from './lib/supabase';
import { getCurrentDateEST } from './lib/timezone';
import { StoreSelectionModal } from './components/StoreSelectionModal';
import { OutsideWorkingHoursPage } from './components/OutsideWorkingHoursPage';
import { CheckInOutModal } from './components/CheckInOutModal';
import { CheckInRequiredModal } from './components/CheckInRequiredModal';
import { useWorkingHoursCheck } from './hooks/useWorkingHoursCheck';
import { useCheckInStatusCheck } from './hooks/useCheckInStatusCheck';
import { usePendingApprovalsRedirect } from './hooks/usePendingApprovalsRedirect';

const EndOfDayPage = lazy(() => import('./pages/EndOfDayPage').then(m => ({ default: m.EndOfDayPage })));
const SafeBalancePage = lazy(() => import('./pages/SafeBalancePage').then(m => ({ default: m.SafeBalancePage })));
const TipReportPage = lazy(() => import('./pages/TipReportPage').then(m => ({ default: m.TipReportPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ConfigurationPage = lazy(() => import('./pages/ConfigurationPage').then(m => ({ default: m.ConfigurationPage })));
const PendingApprovalsPage = lazy(() => import('./pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const InsightsPage = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const ClientsPage = lazy(() => import('./pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage').then(m => ({ default: m.ResourcesPage })));

type Page = 'tickets' | 'eod' | 'safebalance' | 'tipreport' | 'attendance' | 'technicians' | 'services' | 'settings' | 'configuration' | 'approvals' | 'inventory' | 'insights' | 'clients' | 'resources';

function AppContent() {
  const { isAuthenticated, selectedStoreId, selectStore, session, login, logout } = useAuth();
  const { getAppName } = useSettings();
  const [showWelcome, setShowWelcome] = useState(() => {
    return sessionStorage.getItem('welcome_shown') !== 'true';
  });
  const [selectedAction, setSelectedAction] = useState<'checkin' | 'ready' | 'report' | null>(null);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [availableStoreIds, setAvailableStoreIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowWelcome(sessionStorage.getItem('welcome_shown') !== 'true');
      setSelectedAction(null);
    }
  }, [isAuthenticated]);

  // Update browser tab title with app name
  useEffect(() => {
    const appName = getAppName();
    document.title = `${appName} - Sale Ticket Tracker`;
  }, [getAppName]);

  // Set default page to tickets for all users
  const [currentPage, setCurrentPage] = useState<Page>('tickets');
  const [selectedDate, setSelectedDate] = useState(
    getCurrentDateEST()
  );
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);

  // Lock Cashiers and Receptionists to today's date only
  useEffect(() => {
    if (session?.role_permission === 'Cashier' || session?.role_permission === 'Receptionist') {
      const today = getCurrentDateEST();
      if (selectedDate !== today) {
        setSelectedDate(today);
      }
    }
  }, [session?.role_permission, selectedDate]);

  // Handle date changes - prevent Cashiers and Receptionists from changing date
  const handleDateChange = (newDate: string) => {
    if (session?.role_permission === 'Cashier' || session?.role_permission === 'Receptionist') {
      // Cashiers and Receptionists can only view today - ignore date changes
      return;
    }
    setSelectedDate(newDate);
  };

  // Listen for ticket navigation events from PendingApprovalsPage
  useEffect(() => {
    interface TicketNavigationState {
      ticketId: string;
      ticketDate: string;
      timestamp: number;
    }

    function handleTicketNavigation(event: Event) {
      const customEvent = event as CustomEvent<TicketNavigationState>;
      const navState = customEvent.detail;

      // Validate state is fresh (within 5 seconds)
      if (Date.now() - navState.timestamp > 5000) return;

      // Check if user has date restrictions
      const isDateRestricted = session?.role_permission === 'Cashier' ||
                               session?.role_permission === 'Receptionist';

      // Set the date (if allowed)
      if (!isDateRestricted) {
        setSelectedDate(navState.ticketDate);
      }

      setHighlightedTicketId(navState.ticketId);
      setCurrentPage('tickets');
      sessionStorage.removeItem('ticket_navigation_state');
    }

    window.addEventListener('navigateToTicket', handleTicketNavigation);

    // Check sessionStorage on mount for page refresh scenarios
    const storedState = sessionStorage.getItem('ticket_navigation_state');
    if (storedState) {
      try {
        const navState = JSON.parse(storedState) as TicketNavigationState;
        if (Date.now() - navState.timestamp < 30000) {
          handleTicketNavigation(new CustomEvent('navigateToTicket', { detail: navState }));
        }
      } catch (e) {
        // Invalid state, ignore
      }
      sessionStorage.removeItem('ticket_navigation_state');
    }

    return () => {
      window.removeEventListener('navigateToTicket', handleTicketNavigation);
    };
  }, [session?.role_permission]);

  // Check working hours for time-restricted roles (Technician, Cashier, Receptionist, Supervisor)
  const workingHoursCheck = useWorkingHoursCheck(selectedStoreId, session?.role_permission);

  // Check if Receptionist/Supervisor is checked in
  const checkInStatus = useCheckInStatusCheck(
    session?.employee_id,
    selectedStoreId,
    session?.role_permission
  );
  const [showCheckInOutModal, setShowCheckInOutModal] = useState(false);

  // Determine if check-in required modal should be shown
  const shouldShowCheckInRequiredModal =
    (session?.role_permission === 'Receptionist' || session?.role_permission === 'Supervisor') &&
    !checkInStatus.isLoading &&
    !checkInStatus.isCheckedIn &&
    !showStoreModal; // Don't show while store selection is open

  // Check for pending approvals redirect
  const isReadyForRedirectCheck =
    isAuthenticated &&
    !!selectedStoreId &&
    !showWelcome &&
    !showStoreModal &&
    !shouldShowCheckInRequiredModal &&
    !workingHoursCheck.isLoading &&
    workingHoursCheck.isWithinWorkingHours;

  const pendingApprovalsRedirect = usePendingApprovalsRedirect(
    session?.employee_id,
    selectedStoreId,
    session?.role,
    session?.role_permission,
    isReadyForRedirectCheck
  );

  // Track if we've already done the initial redirect for this session
  const hasRedirectedToApprovals = useRef(false);

  // Reset redirect flag when store changes (to allow redirect for new store)
  useEffect(() => {
    hasRedirectedToApprovals.current = false;
  }, [selectedStoreId]);

  // Auto-redirect to approvals page if there are pending items (only once per store)
  useEffect(() => {
    if (
      pendingApprovalsRedirect.hasChecked &&
      pendingApprovalsRedirect.shouldRedirect &&
      !hasRedirectedToApprovals.current &&
      currentPage !== 'approvals'
    ) {
      hasRedirectedToApprovals.current = true;
      setCurrentPage('approvals');
    }
  }, [pendingApprovalsRedirect.hasChecked, pendingApprovalsRedirect.shouldRedirect, currentPage]);

  useEffect(() => {
    if (isAuthenticated && !selectedStoreId && session?.employee_id && !showWelcome) {
      checkStoreAccess();
    }
  }, [isAuthenticated, selectedStoreId, session?.employee_id, showWelcome]);



  async function checkStoreAccess() {
    if (!session?.employee_id) return;

    let availableStores: any[] = [];

    if (session.role_permission === 'Admin' || session.role_permission === 'Manager' || session.role_permission === 'Owner') {
      const { data: stores } = await supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('name');

      availableStores = stores || [];
    } else {
      const { data: employeeStores } = await supabase
        .from('employee_stores')
        .select('store_id')
        .eq('employee_id', session.employee_id);

      const employeeStoreIds = employeeStores?.map(es => es.store_id) || [];

      const { data: stores } = await supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('name');

      if (employeeStoreIds.length > 0) {
        availableStores = (stores || []).filter(store =>
          employeeStoreIds.includes(store.id)
        );
      }
    }

    if (availableStores.length > 0) {
      const previouslySelectedStore = sessionStorage.getItem('selected_store_id');
      if (previouslySelectedStore && availableStores.some(s => s.id === previouslySelectedStore)) {
        selectStore(previouslySelectedStore);
      } else {
        selectStore(availableStores[0].id);
      }
    }
  }


  if (showWelcome) {
    return <HomePage onActionSelected={(action, session, storeId, hasMultipleStores, availableStoreIds, checkedInStoreId) => {
      // Check-in and Ready actions are handled entirely within HomePage
      if (action === 'checkin' || action === 'ready') {
        return;
      }

      // Report action needs to redirect to app
      if (action === 'report' && session && storeId) {
        sessionStorage.setItem('welcome_shown', 'true');
        login(session);
        setSelectedAction(action);
        setShowWelcome(false);

        // If already checked in at a store, auto-select it (skip modal)
        if (checkedInStoreId && availableStoreIds?.includes(checkedInStoreId)) {
          selectStore(checkedInStoreId);
        } else if (hasMultipleStores && availableStoreIds && availableStoreIds.length > 1) {
          // Not checked in - show store selection modal
          setAvailableStoreIds(availableStoreIds);
          setShowStoreModal(true);
        } else {
          // Single store - select it directly
          selectStore(storeId);
        }
      }
    }} />;
  }

  if (!isAuthenticated) {
    return <LoginPage
      selectedAction={selectedAction}
      onCheckOutComplete={() => {
        sessionStorage.setItem('welcome_shown', 'false');
        setShowWelcome(true);
        setSelectedAction(null);
      }}
      onBack={() => {
        sessionStorage.setItem('welcome_shown', 'false');
        setShowWelcome(true);
        setSelectedAction(null);
      }}
    />;
  }

  // Block time-restricted roles outside access hours (8:45 AM to 30 min after closing)
  const TIME_RESTRICTED_ROLES = ['Technician', 'Cashier', 'Receptionist', 'Supervisor'];
  if (
    TIME_RESTRICTED_ROLES.includes(session?.role_permission ?? '') &&
    !workingHoursCheck.isLoading &&
    !workingHoursCheck.isWithinWorkingHours
  ) {
    return (
      <OutsideWorkingHoursPage
        accessStartTime={workingHoursCheck.accessStartTime || '08:45'}
        accessEndTime={workingHoursCheck.accessEndTime || ''}
        currentDay={workingHoursCheck.currentDay}
      />
    );
  }

  return (
    <>
      <Layout
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        }>
          {currentPage === 'tickets' && (
            <TicketsPage
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              highlightedTicketId={highlightedTicketId}
              onHighlightComplete={() => setHighlightedTicketId(null)}
            />
          )}
          {currentPage === 'approvals' && <PendingApprovalsPage />}
          {currentPage === 'tipreport' && <TipReportPage selectedDate={selectedDate} onDateChange={handleDateChange} />}
          {currentPage === 'eod' && <EndOfDayPage selectedDate={selectedDate} onDateChange={handleDateChange} />}
          {currentPage === 'safebalance' && <SafeBalancePage selectedDate={selectedDate} onDateChange={handleDateChange} />}
          {currentPage === 'attendance' && <AttendancePage />}
          {currentPage === 'technicians' && <EmployeesPage />}
          {currentPage === 'clients' && <ClientsPage />}
          {currentPage === 'inventory' && <InventoryPage />}
          {currentPage === 'services' && <ServicesPage />}
          {currentPage === 'insights' && <InsightsPage />}
          {currentPage === 'resources' && <ResourcesPage />}
          {currentPage === 'settings' && <SettingsPage />}
          {currentPage === 'configuration' && <ConfigurationPage />}
        </Suspense>
      </Layout>

      <StoreSelectionModal
        isOpen={showStoreModal}
        storeIds={availableStoreIds}
        onSelect={(storeId) => {
          selectStore(storeId);
          setShowStoreModal(false);
        }}
      />

      {/* Check-in required modal for Receptionist/Supervisor */}
      <CheckInRequiredModal
        isOpen={shouldShowCheckInRequiredModal && !showCheckInOutModal}
        onExit={() => {
          logout();
        }}
        onCheckIn={() => {
          setShowCheckInOutModal(true);
        }}
        employeeName={session?.display_name}
      />

      {/* Check-in/out modal for actual check-in process */}
      {showCheckInOutModal && selectedStoreId && (
        <CheckInOutModal
          storeId={selectedStoreId}
          onClose={() => setShowCheckInOutModal(false)}
          onCheckInComplete={() => {
            setShowCheckInOutModal(false);
            checkInStatus.refetch();
          }}
          onCheckOutComplete={() => {
            setShowCheckInOutModal(false);
          }}
        />
      )}
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <PermissionsProvider>
          <PermissionsCacheProvider>
            <SettingsProvider>
              <NumericKeypadProvider>
                <AppContent />
                <NumericKeypad />
              </NumericKeypadProvider>
            </SettingsProvider>
          </PermissionsCacheProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
