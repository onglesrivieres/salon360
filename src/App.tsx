import { useState, useEffect, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { StoreSwitcherPage } from './pages/StoreSwitcherPage';
import { TicketsPage } from './pages/TicketsPage';
import { supabase } from './lib/supabase';

const EndOfDayPage = lazy(() => import('./pages/EndOfDayPage').then(m => ({ default: m.EndOfDayPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PendingApprovalsPage = lazy(() => import('./pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })));

type Page = 'tickets' | 'eod' | 'attendance' | 'technicians' | 'services' | 'settings' | 'approvals';

function AppContent() {
  const { isAuthenticated, selectedStoreId, selectStore, session } = useAuth();
  const [showWelcome, setShowWelcome] = useState(() => {
    return sessionStorage.getItem('welcome_shown') !== 'true';
  });
  const [selectedAction, setSelectedAction] = useState<'checkin' | 'ready' | 'report' | null>(null);
  const [needsStoreSelection, setNeedsStoreSelection] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowWelcome(sessionStorage.getItem('welcome_shown') !== 'true');
      setSelectedAction(null);
      setNeedsStoreSelection(false);
    }
  }, [isAuthenticated]);

  // Set default page based on user role
  const getDefaultPage = (): Page => {
    if (!session?.role_permission) return 'tickets';

    const role = session.role_permission;
    // Admin and Manager default to reports (End of Day page)
    if (role === 'Admin' || role === 'Manager') {
      return 'eod';
    }
    // Technician and Supervisor default to tickets
    return 'tickets';
  };

  const [currentPage, setCurrentPage] = useState<Page>(getDefaultPage());
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (isAuthenticated && !selectedStoreId && session?.employee_id && !showWelcome) {
      checkStoreAccess();
    }
  }, [isAuthenticated, session?.employee_id, showWelcome]);

  useEffect(() => {
    if (isAuthenticated && selectedStoreId && session?.employee_id && selectedAction === 'ready') {
      // User has completed login for Ready action, show HomePage again
      sessionStorage.setItem('welcome_shown', 'false');
      setShowWelcome(true);
      setSelectedAction(null);
    }
  }, [isAuthenticated, selectedStoreId, session?.employee_id, selectedAction]);


  async function checkStoreAccess() {
    if (!session?.employee_id) return;

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

    let availableStores = stores || [];

    if (employeeStoreIds.length > 0) {
      availableStores = availableStores.filter(store =>
        employeeStoreIds.includes(store.id)
      );
    }

    if (availableStores.length === 1) {
      selectStore(availableStores[0].id);
      setNeedsStoreSelection(false);
    } else if (availableStores.length > 1) {
      setNeedsStoreSelection(true);
    }
  }


  if (showWelcome) {
    return <HomePage onActionSelected={(action) => {
      sessionStorage.setItem('welcome_shown', 'true');
      setSelectedAction(action);
      setShowWelcome(false);
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

  if (needsStoreSelection && !selectedStoreId) {
    return <StoreSwitcherPage onStoreSelected={() => {
      setNeedsStoreSelection(false);
      if (selectedAction === 'report') {
        setCurrentPage('eod');
      } else {
        setCurrentPage(getDefaultPage());
      }
    }} />;
  }

  return (
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
