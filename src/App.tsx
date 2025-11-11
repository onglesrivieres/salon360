import { useState, useEffect, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { TicketsPage } from './pages/TicketsPage';
import { supabase } from './lib/supabase';
import { StoreSelectionModal } from './components/StoreSelectionModal';

const EndOfDayPage = lazy(() => import('./pages/EndOfDayPage').then(m => ({ default: m.EndOfDayPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PendingApprovalsPage = lazy(() => import('./pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })));

type Page = 'tickets' | 'eod' | 'attendance' | 'technicians' | 'services' | 'settings' | 'approvals';

function AppContent() {
  const { isAuthenticated, selectedStoreId, selectStore, session, login } = useAuth();
  const [showWelcome, setShowWelcome] = useState(() => {
    return sessionStorage.getItem('welcome_shown') !== 'true';
  });
  const [selectedAction, setSelectedAction] = useState<'checkin' | 'ready' | 'report' | null>(null);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [availableStoreIds, setAvailableStoreIds] = useState<string[]>([]);

  // Diagnostic: Test Supabase connection on mount
  useEffect(() => {
    const testConnection = async () => {
      console.log('App: Testing Supabase connection...');
      try {
        const { data, error, count } = await supabase
          .from('stores')
          .select('*', { count: 'exact', head: false })
          .limit(1);

        if (error) {
          console.error('App: Supabase connection test FAILED:', error);
        } else {
          console.log('App: Supabase connection test SUCCESSFUL. Store count:', count, 'Sample:', data);
        }
      } catch (err) {
        console.error('App: Supabase connection test EXCEPTION:', err);
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowWelcome(sessionStorage.getItem('welcome_shown') !== 'true');
      setSelectedAction(null);
    }
  }, [isAuthenticated]);

  // Set default page to tickets for all users
  const [currentPage, setCurrentPage] = useState<Page>('tickets');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    console.log('App: Auth state changed - isAuthenticated:', isAuthenticated, 'selectedStoreId:', selectedStoreId, 'showWelcome:', showWelcome);
    if (isAuthenticated && !selectedStoreId && session?.employee_id && !showWelcome) {
      console.log('App: Need to check store access');
      checkStoreAccess();
    }
  }, [isAuthenticated, selectedStoreId, session?.employee_id, showWelcome]);



  async function checkStoreAccess() {
    if (!session?.employee_id) {
      console.log('App: Cannot check store access - no employee_id');
      return;
    }

    console.log('App: Checking store access for employee:', session.employee_id, 'with role:', session.role_permission);
    let availableStores: any[] = [];

    if (session.role_permission === 'Admin' || session.role_permission === 'Manager' || session.role_permission === 'Owner') {
      console.log('App: User has admin/manager/owner role - fetching all stores');
      const { data: stores, error } = await supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('App: Error fetching stores:', error);
      } else {
        console.log('App: Fetched stores:', stores);
        availableStores = stores || [];
      }
    } else {
      console.log('App: User is regular employee - fetching assigned stores');
      const { data: employeeStores, error: empError } = await supabase
        .from('employee_stores')
        .select('store_id')
        .eq('employee_id', session.employee_id);

      if (empError) {
        console.error('App: Error fetching employee_stores:', empError);
      } else {
        console.log('App: Employee stores:', employeeStores);
        const employeeStoreIds = employeeStores?.map(es => es.store_id) || [];

        const { data: stores, error: storesError } = await supabase
          .from('stores')
          .select('*')
          .eq('active', true)
          .order('name');

        if (storesError) {
          console.error('App: Error fetching stores:', storesError);
        } else {
          if (employeeStoreIds.length > 0) {
            availableStores = (stores || []).filter(store =>
              employeeStoreIds.includes(store.id)
            );
            console.log('App: Filtered stores for employee:', availableStores);
          }
        }
      }
    }

    console.log('App: Available stores count:', availableStores.length);
    if (availableStores.length > 0) {
      const previouslySelectedStore = sessionStorage.getItem('selected_store_id');
      console.log('App: Previously selected store:', previouslySelectedStore);
      if (previouslySelectedStore && availableStores.some(s => s.id === previouslySelectedStore)) {
        console.log('App: Restoring previous store selection:', previouslySelectedStore);
        selectStore(previouslySelectedStore);
      } else {
        console.log('App: Selecting first available store:', availableStores[0].id);
        selectStore(availableStores[0].id);
      }
    } else {
      console.log('App: No available stores found for this user');
    }
  }


  if (showWelcome) {
    return <HomePage onActionSelected={(action, session, storeId, hasMultipleStores, availableStoreIds) => {
      // Check-in and Ready actions are handled entirely within HomePage
      if (action === 'checkin' || action === 'ready') {
        return;
      }

      // Report action needs to redirect to app
      // Store selection is now handled in HomePage via ReportStoreSelectionModal
      if (action === 'report' && session && storeId) {
        sessionStorage.setItem('welcome_shown', 'true');
        login(session);
        setSelectedAction(action);
        setShowWelcome(false);
        // Store has already been selected in HomePage, so select it directly
        selectStore(storeId);
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
          {currentPage === 'tickets' && <TicketsPage selectedDate={selectedDate} onDateChange={setSelectedDate} />}
          {currentPage === 'approvals' && <PendingApprovalsPage />}
          {currentPage === 'eod' && <EndOfDayPage selectedDate={selectedDate} onDateChange={setSelectedDate} />}
          {currentPage === 'attendance' && <AttendancePage />}
          {currentPage === 'technicians' && <EmployeesPage />}
          {currentPage === 'services' && <ServicesPage />}
          {currentPage === 'settings' && <SettingsPage />}
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
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
