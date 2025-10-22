import { useState, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { TicketsPage } from './pages/TicketsPage';

const EndOfDayPage = lazy(() => import('./pages/EndOfDayPage').then(m => ({ default: m.EndOfDayPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PendingApprovalsPage = lazy(() => import('./pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })));

type Page = 'home' | 'tickets' | 'eod' | 'attendance' | 'technicians' | 'services' | 'settings' | 'approvals';

function AppContent() {
  const { isAuthenticated, selectedStoreId, session } = useAuth();

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
  const [hasEnteredApp, setHasEnteredApp] = useState(false);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!hasEnteredApp) {
    return <HomePage onActionSelected={(action) => {
      if (action === 'report') {
        setCurrentPage('eod');
      } else {
        // Set page based on user role after action selection
        setCurrentPage(getDefaultPage());
      }
      setHasEnteredApp(true);
    }} />;
  }

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={(page) => {
        if (page === 'home') {
          setHasEnteredApp(false);
        } else {
          setCurrentPage(page);
        }
      }}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      }>
        {currentPage === 'home' && <HomePage onActionSelected={(action) => {
          if (action === 'report') {
            setCurrentPage('eod');
          }
        }} />}
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
