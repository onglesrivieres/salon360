import { useState, useEffect, useRef } from 'react';
import { Receipt, Users, Briefcase, DollarSign, LogOut, Settings, Store as StoreIcon, ChevronDown, Calendar, Menu, X, CheckCircle, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPage, Permissions } from '../lib/permissions';
import { supabase, Store } from '../lib/supabase';
import { LanguageSelector } from './LanguageSelector';
import { DeviceToggle } from './DeviceToggle';
import { NotificationBadge } from './ui/NotificationBadge';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'home' | 'tickets' | 'eod' | 'technicians' | 'services' | 'settings' | 'attendance' | 'approvals';
  onNavigate: (page: 'home' | 'tickets' | 'eod' | 'technicians' | 'services' | 'settings' | 'attendance' | 'approvals') => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { session, selectedStoreId, selectStore, logout, t, deviceMode } = useAuth();
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedStoreId) {
      fetchStore();
    }
    if (session?.role_permission === 'Admin') {
      fetchAllStores();
    }
    if (session?.employee_id && session?.role && Permissions.tickets.canViewPendingApprovals(session.role)) {
      fetchPendingApprovalsCount();
    }
  }, [selectedStoreId, session]);

  useEffect(() => {
    if (!session?.employee_id || !session?.role || !Permissions.tickets.canViewPendingApprovals(session.role) || !selectedStoreId) return;

    // Poll every 30 seconds for pending approvals
    const interval = setInterval(() => {
      fetchPendingApprovalsCount();
    }, 30000);

    // Subscribe to real-time changes on sale_tickets table
    const approvalsChannel = supabase
      .channel(`approvals-${selectedStoreId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sale_tickets',
          filter: `store_id=eq.${selectedStoreId}`,
        },
        (payload) => {
          // Refresh count when tickets are closed, approved, or updated
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            fetchPendingApprovalsCount();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(approvalsChannel);
    };
  }, [session?.employee_id, session?.role, selectedStoreId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsStoreDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchStore() {
    if (!selectedStoreId) return;
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('id', selectedStoreId)
      .maybeSingle();
    if (data) setCurrentStore(data);
  }

  async function fetchAllStores() {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .order('code');
    if (data) setAllStores(data);
  }

  async function fetchPendingApprovalsCount() {
    if (!session?.employee_id || !selectedStoreId) return;

    try {
      // Determine which function to call based on role
      const isTechnicianOrSupervisor = session.role_permission === 'Technician' || session.role_permission === 'Supervisor';

      if (isTechnicianOrSupervisor) {
        const { data, error } = await supabase.rpc('get_pending_approvals_for_technician', {
          p_employee_id: session.employee_id,
          p_store_id: selectedStoreId,
        });

        if (error) throw error;
        setPendingApprovalsCount(data?.length || 0);
      } else {
        // For Receptionist, Manager, Owner - use management function
        const { data, error } = await supabase.rpc('get_pending_approvals_for_management', {
          p_store_id: selectedStoreId,
        });

        if (error) throw error;
        setPendingApprovalsCount(data?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching pending approvals count:', error);
    }
  }

  function handleStoreChange(storeId: string) {
    selectStore(storeId);
    setIsStoreDropdownOpen(false);
    window.location.reload();
  }

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'tickets' as const, label: t('nav.tickets'), icon: Receipt },
    { id: 'approvals' as const, label: 'Approvals', icon: CheckCircle, badge: pendingApprovalsCount },
    { id: 'eod' as const, label: t('nav.eod'), icon: DollarSign },
    { id: 'attendance' as const, label: 'Attendance', icon: Calendar },
    { id: 'technicians' as const, label: t('nav.employees'), icon: Users },
    { id: 'services' as const, label: t('nav.services'), icon: Briefcase },
  ];

  return (
    <div className={`min-h-screen bg-gray-50 ${deviceMode === 'iphone' ? 'device-iphone' : 'device-ipad'}`}>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-3 py-2 md:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
              </button>
              <Receipt className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              <h1 className="text-base md:text-lg font-bold text-gray-900">Salon360</h1>
              {currentStore && session?.role_permission === 'Admin' && allStores.length > 0 ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-200 transition-colors"
                  >
                    <StoreIcon className="w-3 h-3" />
                    {currentStore.name}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {isStoreDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px] z-50">
                      {allStores.map((store) => (
                        <button
                          key={store.id}
                          onClick={() => handleStoreChange(store.id)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                            store.id === selectedStoreId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          <StoreIcon className="w-3 h-3" />
                          {store.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : currentStore ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <StoreIcon className="w-3 h-3" />
                  {currentStore.name}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden md:flex md:items-center md:gap-2">
                <DeviceToggle />
                <LanguageSelector />
              </div>
              {session && session.role && Permissions.employees.canView(session.role) && (
                <button
                  onClick={() => onNavigate('settings')}
                  className="hidden md:flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                  title={t('nav.settings')}
                >
                  <Settings className="w-3 h-3" />
                  {t('nav.settings')}
                </button>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-700 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                title={t('actions.logout')}
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden md:inline">{t('actions.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className={`fixed md:sticky md:block w-64 md:w-44 bg-white border-r border-gray-200 min-h-[calc(100vh-49px)] top-[49px] left-0 z-20 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <nav className="p-2">
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const hasAccess = session && session.role && canAccessPage(item.id, session.role);

                if (!hasAccess) return null;

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onNavigate(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <NotificationBadge
                          count={item.badge}
                          variant={item.badge > 0 && item.id === 'approvals' ? 'urgent' : 'default'}
                          pulse={item.badge > 0 && item.id === 'approvals'}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="md:hidden mt-4 pt-4 border-t border-gray-200 px-2">
              <div className="mb-3 space-y-2">
                <DeviceToggle />
                <LanguageSelector />
              </div>
              {session && session.role && Permissions.employees.canView(session.role) && (
                <button
                  onClick={() => {
                    onNavigate('settings');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" />
                  <span>{t('nav.settings')}</span>
                </button>
              )}
            </div>
          </nav>
        </aside>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <main className="flex-1 p-2 md:p-3 layout-main">{children}</main>
      </div>
    </div>
  );
}
