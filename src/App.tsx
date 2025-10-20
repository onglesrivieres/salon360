import { useState } from 'react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { StoreSwitcherPage } from './pages/StoreSwitcherPage';
import { TicketsPage } from './pages/TicketsPage';
import { EndOfDayPage } from './pages/EndOfDayPage';
import { AttendancePage } from './pages/AttendancePage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ServicesPage } from './pages/ServicesPage';
import { SettingsPage } from './pages/SettingsPage';
import { PendingApprovalsPage } from './pages/PendingApprovalsPage';

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
      {currentPage === 'tickets' && <TicketsPage selectedDate={selectedDate} onDateChange={setSelectedDate} />}
      {currentPage === 'approvals' && <PendingApprovalsPage />}
      {currentPage === 'eod' && <EndOfDayPage selectedDate={selectedDate} onDateChange={setSelectedDate} />}
      {currentPage === 'attendance' && <AttendancePage />}
      {currentPage === 'technicians' && <EmployeesPage />}
      {currentPage === 'services' && <ServicesPage />}
      {currentPage === 'settings' && <SettingsPage />}
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
