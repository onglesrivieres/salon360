import { useState, useEffect, useRef } from 'react';
import { Users, Briefcase, DollarSign, LogOut, Settings, Store as StoreIcon, ChevronDown, Calendar, Menu, X, CheckCircle, Home, Receipt, Star, Coins, AlertCircle, Package, List, RefreshCw, Circle, TrendingUp, Vault } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { canAccessPage, Permissions } from '../lib/permissions';
import { supabase, Store, TechnicianWithQueue } from '../lib/supabase';
import { NotificationBadge } from './ui/NotificationBadge';
import { VersionNotification } from './VersionNotification';
import { initializeVersionCheck, startVersionCheck } from '../lib/version';
import { Modal } from './ui/Modal';
import { TechnicianQueue } from './TechnicianQueue';
import { getCurrentDateEST } from '../lib/timezone';
import { ViewAsSelector } from './ViewAsSelector';
import { ViewAsBanner } from './ViewAsBanner';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'home' | 'tickets' | 'eod' | 'safebalance' | 'tipreport' | 'technicians' | 'services' | 'settings' | 'configuration' | 'attendance' | 'approvals' | 'inventory' | 'insights';
  onNavigate: (page: 'home' | 'tickets' | 'eod' | 'safebalance' | 'tipreport' | 'technicians' | 'services' | 'settings' | 'configuration' | 'attendance' | 'approvals' | 'inventory' | 'insights') => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { session, selectedStoreId, selectStore, logout, t, viewingAsRole, startViewingAs, stopViewingAs, isViewingAs, effectiveRole } = useAuth();
  const { getSettingBoolean } = useSettings();
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [isOpeningCashMissing, setIsOpeningCashMissing] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [sortedTechnicians, setSortedTechnicians] = useState<TechnicianWithQueue[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [leavingQueueEmployeeId, setLeavingQueueEmployeeId] = useState<string | undefined>();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [employeeToRemove, setEmployeeToRemove] = useState<string | undefined>();
  const [userQueueStatus, setUserQueueStatus] = useState<'ready' | 'neutral' | 'busy'>('neutral');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canViewAllQueueStatuses = effectiveRole && Permissions.queue.canViewAllQueueStatuses(effectiveRole);

  useEffect(() => {
    if (selectedStoreId) {
      fetchStore();
      checkOpeningCash();
    }
    if (session?.employee_id) {
      fetchAllStores();
    }
    if (session?.employee_id && effectiveRole && Permissions.tickets.canViewPendingApprovals(effectiveRole)) {
      fetchPendingApprovalsCount();
    }
  }, [selectedStoreId, session, effectiveRole]);

  useEffect(() => {
    if (!session?.employee_id || !effectiveRole || !Permissions.tickets.canViewPendingApprovals(effectiveRole) || !selectedStoreId) return;

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_transactions',
          filter: `store_id=eq.${selectedStoreId}`,
        },
        (payload) => {
          // Refresh count when inventory transactions are updated
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            fetchPendingApprovalsCount();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_transactions',
          filter: `store_id=eq.${selectedStoreId}`,
        },
        (payload) => {
          // Refresh count when cash transactions are updated
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
  }, [session?.employee_id, effectiveRole, selectedStoreId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsStoreDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    initializeVersionCheck();

    const stopVersionCheck = startVersionCheck(() => {
      setHasNewVersion(true);
    });

    const handleOpeningCashUpdate = () => {
      checkOpeningCash();
    };

    window.addEventListener('openingCashUpdated', handleOpeningCashUpdate);

    return () => {
      stopVersionCheck();
      window.removeEventListener('openingCashUpdated', handleOpeningCashUpdate);
    };
  }, [selectedStoreId]);

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
    if (!session?.employee_id) return;

    // Admin can see all stores
    if (session?.role_permission === 'Admin') {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('code');
      if (data) {
        console.log('Admin - Fetched stores:', data);
        setAllStores(data);
      }
      return;
    }

    // Other users see only their assigned stores
    const { data: employeeStores } = await supabase
      .from('employee_stores')
      .select('store_id')
      .eq('employee_id', session.employee_id);

    console.log('Employee stores:', employeeStores);
    const employeeStoreIds = employeeStores?.map(es => es.store_id) || [];

    if (employeeStoreIds.length > 0) {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .in('id', employeeStoreIds)
        .eq('active', true)
        .order('code');
      if (data) {
        console.log('Non-admin - Fetched stores:', data);
        setAllStores(data);
      }
    } else {
      console.log('No employee stores found');
    }
  }

  async function checkOpeningCash() {
    if (!selectedStoreId) return;

    try {
      const today = getCurrentDateEST();
      const { data, error } = await supabase
        .from('end_of_day_records')
        .select('opening_cash_amount, bill_100, bill_50, bill_20, bill_10, bill_5, bill_2, bill_1, coin_25, coin_10, coin_5')
        .eq('store_id', selectedStoreId)
        .eq('date', today)
        .maybeSingle();

      if (error) {
        console.error('Error checking opening cash:', error);
        return;
      }

      if (!data) {
        setIsOpeningCashMissing(true);
        return;
      }

      const hasOpeningCash = (
        (data.opening_cash_amount || 0) > 0 ||
        (data.bill_100 || 0) > 0 ||
        (data.bill_50 || 0) > 0 ||
        (data.bill_20 || 0) > 0 ||
        (data.bill_10 || 0) > 0 ||
        (data.bill_5 || 0) > 0 ||
        (data.bill_2 || 0) > 0 ||
        (data.bill_1 || 0) > 0 ||
        (data.coin_25 || 0) > 0 ||
        (data.coin_10 || 0) > 0 ||
        (data.coin_5 || 0) > 0
      );

      setIsOpeningCashMissing(!hasOpeningCash);
    } catch (error) {
      console.error('Error checking opening cash:', error);
    }
  }

  async function fetchPendingApprovalsCount() {
    if (!session?.employee_id || !selectedStoreId) return;

    try {
      let ticketCount = 0;
      let inventoryCount = 0;
      let cashTransactionCount = 0;

      // Determine which function to call based on role
      const isTechnicianOrSupervisor = session.role_permission === 'Technician' || session.role_permission === 'Supervisor';

      if (isTechnicianOrSupervisor) {
        const { data, error } = await supabase.rpc('get_pending_approvals_for_technician', {
          p_employee_id: session.employee_id,
          p_store_id: selectedStoreId,
        });

        if (error) throw error;
        ticketCount = data?.length || 0;
      } else {
        // For Receptionist, Manager, Owner - use management function
        const { data, error } = await supabase.rpc('get_pending_approvals_for_management', {
          p_store_id: selectedStoreId,
        });

        if (error) throw error;
        ticketCount = data?.length || 0;
      }

      // Fetch inventory approvals for all roles
      const { data: inventoryData, error: inventoryError } = await supabase.rpc('get_pending_inventory_approvals', {
        p_employee_id: session.employee_id,
        p_store_id: selectedStoreId,
      });

      if (!inventoryError) {
        inventoryCount = inventoryData?.length || 0;
      }

      // Fetch cash transaction approvals for managers and owners only
      const userRoles = session?.role || [];
      const isManagement = userRoles.some(role => ['Owner', 'Manager'].includes(role));

      if (isManagement) {
        const { data: cashData, error: cashError } = await supabase.rpc('get_pending_cash_transaction_approvals', {
          p_store_id: selectedStoreId,
        });

        if (!cashError) {
          cashTransactionCount = cashData?.length || 0;
        }
      }

      const totalCount = ticketCount + inventoryCount + cashTransactionCount;
      setPendingApprovalsCount(totalCount);
    } catch (error) {
      console.error('Error fetching pending approvals count:', error);
    }
  }

  function handleStoreChange(storeId: string) {
    selectStore(storeId);
    setIsStoreDropdownOpen(false);
    setShowQueueModal(false);
  }

  const handleRefresh = () => {
    window.location.reload();
  };

  async function fetchTechnicianQueue() {
    if (!selectedStoreId) return;

    setLoadingQueue(true);
    try {
      const today = getCurrentDateEST();
      const { data, error } = await supabase.rpc('get_sorted_technicians_for_store', {
        p_store_id: selectedStoreId,
        p_date: today
      });

      if (error) throw error;
      setSortedTechnicians(data || []);
    } catch (error) {
      console.error('Error fetching technician queue:', error);
    } finally {
      setLoadingQueue(false);
    }
  }

  const handleOpenQueueModal = () => {
    setShowQueueModal(true);
    fetchTechnicianQueue();
  };

  const handleLeaveQueue = async (employeeId: string) => {
    setEmployeeToRemove(employeeId);
    setShowLeaveConfirm(true);
  };

  const confirmLeaveQueue = async () => {
    if (!employeeToRemove || !selectedStoreId) return;

    setLeavingQueueEmployeeId(employeeToRemove);
    try {
      const { error } = await supabase.rpc('leave_ready_queue', {
        p_employee_id: employeeToRemove,
        p_store_id: selectedStoreId
      });

      if (error) throw error;

      await fetchTechnicianQueue();
      setShowLeaveConfirm(false);
      setEmployeeToRemove(undefined);
    } catch (error) {
      console.error('Error leaving queue:', error);
      alert('Failed to leave queue. Please try again.');
    } finally {
      setLeavingQueueEmployeeId(undefined);
    }
  };

  useEffect(() => {
    // Extract current user's queue status from sortedTechnicians
    if (session?.employee_id && sortedTechnicians.length > 0) {
      const currentUser = sortedTechnicians.find(tech => tech.employee_id === session.employee_id);
      if (currentUser) {
        setUserQueueStatus(currentUser.queue_status as 'ready' | 'neutral' | 'busy');
      } else {
        setUserQueueStatus('neutral');
      }
    } else {
      setUserQueueStatus('neutral');
    }
  }, [sortedTechnicians, session?.employee_id]);

  useEffect(() => {
    // Fetch initial queue status on mount
    if (session?.employee_id && selectedStoreId && effectiveRole && canAccessPage('tickets', effectiveRole)) {
      fetchTechnicianQueue();
    }

    // Set up real-time subscription for queue status updates
    if (!session?.employee_id || !selectedStoreId || !effectiveRole || !canAccessPage('tickets', effectiveRole)) return;

    const queueStatusChannel = supabase
      .channel(`queue-status-${selectedStoreId}-${session.employee_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'technician_ready_queue',
          filter: `store_id=eq.${selectedStoreId}`,
        },
        () => {
          fetchTechnicianQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueStatusChannel);
    };
  }, [session?.employee_id, selectedStoreId, effectiveRole]);

  useEffect(() => {
    if (!showQueueModal) return;

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const refreshInterval = setInterval(() => {
      fetchTechnicianQueue();
    }, 30000);

    const queueChannel = supabase
      .channel(`queue-${selectedStoreId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'technician_ready_queue',
          filter: `store_id=eq.${selectedStoreId}`,
        },
        () => {
          fetchTechnicianQueue();
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      clearInterval(refreshInterval);
      supabase.removeChannel(queueChannel);
    };
  }, [showQueueModal, selectedStoreId]);

  const getGoogleRating = () => {
    if (!currentStore) return null;

    const storeName = currentStore.name.toLowerCase();
    if (storeName.includes('riviere')) {
      return { rating: '4.8', reviews: '553' };
    } else if (storeName.includes('maily')) {
      return { rating: '3.9', reviews: '575' };
    } else if (storeName.includes('charlesbourg')) {
      return { rating: '3.9', reviews: '232' };
    }
    return null;
  };

  const googleRating = getGoogleRating();

  const showInventory = getSettingBoolean('enable_inventory_module', true);
  const showVersionNotifications = getSettingBoolean('show_version_notifications', true);
  const showPendingApprovalBadge = getSettingBoolean('show_pending_approval_badge', true);
  const enableReadyQueue = getSettingBoolean('enable_ready_queue', true);
  const showQueueButtonInHeader = getSettingBoolean('show_queue_button_in_header', true);
  const showOpeningCashBanner = getSettingBoolean('show_opening_cash_missing_banner', true);
  const requireOpeningCash = getSettingBoolean('require_opening_cash_count', false);

  const allNavItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'tickets' as const, label: t('nav.tickets'), icon: Receipt },
    { id: 'approvals' as const, label: 'Approvals', icon: CheckCircle, badge: showPendingApprovalBadge ? pendingApprovalsCount : 0 },
    { id: 'tipreport' as const, label: 'Tip Report', icon: Coins },
    { id: 'eod' as const, label: 'End of Day', icon: DollarSign },
    { id: 'safebalance' as const, label: 'Safe Balance', icon: Vault },
    { id: 'attendance' as const, label: 'Attendance', icon: Calendar },
    { id: 'technicians' as const, label: t('nav.employees'), icon: Users },
    { id: 'inventory' as const, label: 'Inventory', icon: Package, hidden: !showInventory },
    { id: 'services' as const, label: t('nav.services'), icon: Briefcase },
    { id: 'insights' as const, label: 'Insights', icon: TrendingUp },
    { id: 'configuration' as const, label: 'Configuration', icon: Settings },
  ];

  const navItems = allNavItems.filter(item => !item.hidden);

  const shouldShowQueueButton = enableReadyQueue && showQueueButtonInHeader;
  const shouldShowOpeningCashBanner = showOpeningCashBanner && requireOpeningCash && isOpeningCashMissing;

  return (
    <div className="min-h-screen bg-gray-50">
      {hasNewVersion && showVersionNotifications && <VersionNotification onRefresh={handleRefresh} />}
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
              {currentStore && allStores.length > 0 ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    <StoreIcon className="w-4 h-4" />
                    {currentStore.name}
                    <ChevronDown className="w-4 h-4" />
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
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                  <StoreIcon className="w-4 h-4" />
                  {currentStore.name}
                </span>
              ) : null}
              {session && effectiveRole && canAccessPage('tickets', effectiveRole) && shouldShowQueueButton && (
                <button
                  onClick={handleOpenQueueModal}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-blue-600 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
                >
                  <Circle
                    className={`w-4 h-4 animate-pulse ${
                      userQueueStatus === 'ready'
                        ? 'text-green-500 fill-green-500'
                        : userQueueStatus === 'busy'
                        ? 'text-red-500 fill-red-500'
                        : 'text-gray-400 fill-gray-400'
                    }`}
                  />
                  <span>QUEUE</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              {googleRating && (
                <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-medium text-gray-700">{googleRating.rating} ({googleRating.reviews})</span>
                </div>
              )}
              {session && session.role && (session.role.includes('Admin') || session.role.includes('Owner')) && (
                <ViewAsSelector
                  currentRole={viewingAsRole}
                  onSelectRole={startViewingAs}
                  isViewingAs={isViewingAs}
                />
              )}
              {session && effectiveRole && canAccessPage('settings', effectiveRole) && (
                <button
                  onClick={() => onNavigate('settings')}
                  className="flex items-center gap-2 px-2 py-1 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title={t('nav.settings')}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden md:inline">{t('nav.settings')}</span>
                </button>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-2 px-2 py-1 text-xs text-red-700 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                title={t('actions.logout')}
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden md:inline">{t('actions.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {isViewingAs && viewingAsRole && (
        <ViewAsBanner role={viewingAsRole} onExit={stopViewingAs} />
      )}

      {shouldShowOpeningCashBanner && (
        <div className="bg-amber-500 text-white px-3 py-2 md:px-4 md:py-3 border-b border-amber-600">
          <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 flex-1">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">
                Opening cash count required! Record opening cash before creating any sale tickets today.
              </p>
            </div>
            <button
              onClick={() => onNavigate('eod')}
              className="flex-shrink-0 bg-white text-amber-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-amber-50 transition-colors whitespace-nowrap"
            >
              Count Now
            </button>
          </div>
        </div>
      )}

      <div className="flex">
        <aside className={`fixed md:sticky md:block w-64 md:w-44 bg-white border-r border-gray-200 min-h-[calc(100vh-49px)] top-[49px] left-0 z-20 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <nav className="p-2">
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const hasAccess = session && effectiveRole && canAccessPage(item.id, effectiveRole);

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
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
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

      <Modal
        isOpen={showQueueModal}
        onClose={() => setShowQueueModal(false)}
        title={`Technician Queue - ${currentStore?.name || 'Store'}`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {canViewAllQueueStatuses
                ? 'Real-time view of all technicians and their current status'
                : 'Technicians who have checked in and joined the queue'}
            </p>
            <button
              onClick={fetchTechnicianQueue}
              disabled={loadingQueue}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingQueue ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingQueue && sortedTechnicians.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Loading queue...</p>
            </div>
          ) : (
            <TechnicianQueue
              sortedTechnicians={canViewAllQueueStatuses
                ? sortedTechnicians
                : sortedTechnicians.filter(t => t.queue_status === 'ready')}
              isReadOnly={true}
              showLegend={true}
              currentTime={currentTime}
              currentEmployeeId={session?.employee_id}
              allowLeaveQueue={!canViewAllQueueStatuses}
              onLeaveQueue={handleLeaveQueue}
              leavingQueueEmployeeId={leavingQueueEmployeeId}
            />
          )}

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Queue updates automatically every 30 seconds
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLeaveConfirm}
        onClose={() => {
          setShowLeaveConfirm(false);
          setEmployeeToRemove(undefined);
        }}
        title="Leave Queue"
      >
        <div className="text-center py-4">
          <p className="text-lg text-gray-900 mb-6">
            Are you sure you want to leave the ready queue?
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setShowLeaveConfirm(false);
                setEmployeeToRemove(undefined);
              }}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmLeaveQueue}
              disabled={!!leavingQueueEmployeeId}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {leavingQueueEmployeeId ? 'Leaving...' : 'Leave Queue'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
