import { useState, useEffect, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NumericKeypadProvider } from './contexts/NumericKeypadContext';
import { NumericKeypad } from './components/NumericKeypad';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { TicketsPage } from './pages/TicketsPage';
import { supabase } from './lib/supabase';
import { getCurrentDateEST } from './lib/timezone';
import { StoreSelectionModal } from './components/StoreSelectionModal';

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

type Page = 'tickets' | 'eod' | 'safebalance' | 'tipreport' | 'attendance' | 'technicians' | 'services' | 'settings' | 'configuration' | 'approvals' | 'inventory' | 'insights';

function AppContent() {
  const { isAuthenticated, selectedStoreId, selectStore, session, login } = useAuth();
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

  // Set default page to tickets for all users
  const [currentPage, setCurrentPage] = useState<Page>('tickets');
  const [selectedDate, setSelectedDate] = useState(
    getCurrentDateEST()
  );

  // Lock Cashiers to today's date only
  useEffect(() => {
    if (session?.role_permission === 'Cashier') {
      const today = getCurrentDateEST();
      if (selectedDate !== today) {
        setSelectedDate(today);
      }
    }
  }, [session?.role_permission, selectedDate]);

  // Handle date changes - prevent Cashiers from changing date
  const handleDateChange = (newDate: string) => {
    if (session?.role_permission === 'Cashier') {
      // Cashiers can only view today - ignore date changes
      return;
    }
    setSelectedDate(newDate);
  };

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
    return <HomePage onActionSelected={(action, session, storeId, hasMultipleStores, availableStoreIds) => {
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

        // If user has multiple stores, show selection modal
        if (hasMultipleStores && availableStoreIds && availableStoreIds.length > 1) {
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
          {currentPage === 'tickets' && <TicketsPage selectedDate={selectedDate} onDateChange={handleDateChange} />}
          {currentPage === 'approvals' && <PendingApprovalsPage />}
          {currentPage === 'tipreport' && <TipReportPage selectedDate={selectedDate} onDateChange={handleDateChange} />}
          {currentPage === 'eod' && <EndOfDayPage selectedDate={selectedDate} onDateChange={handleDateChange} />}
          {currentPage === 'safebalance' && <SafeBalancePage selectedDate={selectedDate} onDateChange={handleDateChange} />}
          {currentPage === 'attendance' && <AttendancePage />}
          {currentPage === 'technicians' && <EmployeesPage />}
          {currentPage === 'inventory' && <InventoryPage />}
          {currentPage === 'services' && <ServicesPage />}
          {currentPage === 'insights' && <InsightsPage />}
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
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <NumericKeypadProvider>
            <AppContent />
            <NumericKeypad />
          </NumericKeypadProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
