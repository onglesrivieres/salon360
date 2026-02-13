import { useState, useEffect, lazy, Suspense, Component, type ReactNode } from 'react';
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

import { TimeFilterType, DateRange } from './lib/timeFilters';

function lazyWithReload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch(() => {
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', 'true');
        window.location.reload();
      }
      throw new Error('Failed to load page module');
    })
  );
}

class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-gray-600">Something went wrong loading this page.</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => {
              sessionStorage.removeItem('chunk_reload');
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const EndOfDayPage = lazyWithReload(() => import('./pages/EndOfDayPage').then(m => ({ default: m.EndOfDayPage })));
const SafeBalancePage = lazyWithReload(() => import('./pages/SafeBalancePage').then(m => ({ default: m.SafeBalancePage })));
const TipReportPage = lazyWithReload(() => import('./pages/TipReportPage').then(m => ({ default: m.TipReportPage })));
const AttendancePage = lazyWithReload(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const EmployeesPage = lazyWithReload(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const ServicesPage = lazyWithReload(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const SettingsPage = lazyWithReload(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ConfigurationPage = lazyWithReload(() => import('./pages/ConfigurationPage').then(m => ({ default: m.ConfigurationPage })));
const PendingApprovalsPage = lazyWithReload(() => import('./pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })));
const InventoryPage = lazyWithReload(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const InsightsPage = lazyWithReload(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const ClientsPage = lazyWithReload(() => import('./pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ResourcesPage = lazyWithReload(() => import('./pages/ResourcesPage').then(m => ({ default: m.ResourcesPage })));

type Page = 'tickets' | 'eod' | 'safebalance' | 'tipreport' | 'attendance' | 'technicians' | 'services' | 'settings' | 'configuration' | 'approvals' | 'inventory' | 'insights' | 'clients' | 'resources' | 'home';

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
  // Per-page date state (persists across page switches)
  const [ticketsDate, setTicketsDate] = useState(getCurrentDateEST());
  const [tipReportDate, setTipReportDate] = useState(getCurrentDateEST());
  const [eodDate, setEodDate] = useState(getCurrentDateEST());
  const [safeBalanceDate, setSafeBalanceDate] = useState(getCurrentDateEST());
  const [attendanceDate, setAttendanceDate] = useState(new Date());
  const [insightsFilter, setInsightsFilter] = useState<TimeFilterType>('today');
  const [insightsCustomDateRange, setInsightsCustomDateRange] = useState<DateRange | undefined>();
  const [approvalsDate, setApprovalsDate] = useState(getCurrentDateEST());
  const [approvalsQueueStartDate, setApprovalsQueueStartDate] = useState(getCurrentDateEST());
  const [approvalsQueueEndDate, setApprovalsQueueEndDate] = useState(getCurrentDateEST());

  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);

  // Lock Cashiers and Receptionists to today's date only
  useEffect(() => {
    if (session?.role_permission === 'Cashier' || session?.role_permission === 'Receptionist') {
      const today = getCurrentDateEST();
      if (ticketsDate !== today) setTicketsDate(today);
      if (tipReportDate !== today) setTipReportDate(today);
      if (eodDate !== today) setEodDate(today);
      if (safeBalanceDate !== today) setSafeBalanceDate(today);
    }
  }, [session?.role_permission, ticketsDate, tipReportDate, eodDate, safeBalanceDate]);

  // Handle date changes - prevent Cashiers and Receptionists from changing date
  const makeDateHandler = (setter: (d: string) => void) => (newDate: string) => {
    if (session?.role_permission === 'Cashier' || session?.role_permission === 'Receptionist') return;
    setter(newDate);
  };
  const handleTicketsDateChange = makeDateHandler(setTicketsDate);
  const handleTipReportDateChange = makeDateHandler(setTipReportDate);
  const handleEodDateChange = makeDateHandler(setEodDate);
  const handleSafeBalanceDateChange = makeDateHandler(setSafeBalanceDate);

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
        setTicketsDate(navState.ticketDate);
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
    (session?.role_permission === 'Receptionist' || session?.role_permission === 'Supervisor' || session?.role_permission === 'Cashier') &&
    !checkInStatus.isLoading &&
    !checkInStatus.isCheckedIn &&
    !showStoreModal; // Don't show while store selection is open

  useEffect(() => {
    if (isAuthenticated && !selectedStoreId && session?.employee_id && !showWelcome) {
      checkStoreAccess();
    }
  }, [isAuthenticated, selectedStoreId, session?.employee_id, showWelcome]);



  async function checkStoreAccess() {
    if (!session?.employee_id) return;

    let availableStores: any[] = [];

    if (session.role_permission === 'Admin') {
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
        onGoHome={logout}
      />
    );
  }

  return (
    <>
      <Layout
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
      >
        <ChunkErrorBoundary>
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          }>
            {currentPage === 'tickets' && (
              <TicketsPage
                selectedDate={ticketsDate}
                onDateChange={handleTicketsDateChange}
                highlightedTicketId={highlightedTicketId}
                onHighlightComplete={() => setHighlightedTicketId(null)}
              />
            )}
            {currentPage === 'approvals' && (
              <PendingApprovalsPage
                selectedDate={approvalsDate}
                onSelectedDateChange={setApprovalsDate}
                queueHistoryStartDate={approvalsQueueStartDate}
                onQueueHistoryStartDateChange={setApprovalsQueueStartDate}
                queueHistoryEndDate={approvalsQueueEndDate}
                onQueueHistoryEndDateChange={setApprovalsQueueEndDate}
              />
            )}
            {currentPage === 'tipreport' && <TipReportPage selectedDate={tipReportDate} onDateChange={handleTipReportDateChange} />}
            {currentPage === 'eod' && <EndOfDayPage selectedDate={eodDate} onDateChange={handleEodDateChange} />}
            {currentPage === 'safebalance' && <SafeBalancePage selectedDate={safeBalanceDate} onDateChange={handleSafeBalanceDateChange} />}
            {currentPage === 'attendance' && <AttendancePage currentDate={attendanceDate} onCurrentDateChange={setAttendanceDate} />}
            {currentPage === 'technicians' && <EmployeesPage />}
            {currentPage === 'clients' && <ClientsPage />}
            {currentPage === 'inventory' && <InventoryPage />}
            {currentPage === 'services' && <ServicesPage />}
            {currentPage === 'insights' && (
              <InsightsPage
                selectedFilter={insightsFilter}
                onFilterChange={setInsightsFilter}
                customDateRange={insightsCustomDateRange}
                onCustomDateRangeChange={setInsightsCustomDateRange}
              />
            )}
            {currentPage === 'resources' && <ResourcesPage />}
            {currentPage === 'settings' && <SettingsPage />}
            {currentPage === 'configuration' && <ConfigurationPage />}
          </Suspense>
        </ChunkErrorBoundary>
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
