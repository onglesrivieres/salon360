import { useState, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { StoreSwitcherPage } from './pages/StoreSwitcherPage';
import { TicketsPage } from './pages/TicketsPage';

const EndOfDayPage = lazy(() => import('./pages/EndOfDayPage').then(m => ({ default: m.EndOfDayPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PendingApprovalsPage = lazy(() => import('./pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })));

type Page = 'tickets' | 'eod' | 'attendance' | 'technicians' | 'services' | 'settings' | 'approvals';

function AppContent() {
  const { isAuthenticated, selectedStoreId } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('tickets');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!selectedStoreId) {
    return <StoreSwitcherPage onStoreSelected={(action) => {
      if (action === 'report') {
        setCurrentPage('eod');
      } else {
        setCurrentPage('tickets');
      }
    }} />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
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
