import { useState, useEffect, useRef } from 'react';
import { Users, Briefcase, DollarSign, LogOut, Settings, Store as StoreIcon, ChevronDown, Calendar, Menu, X, CheckCircle, Home, Receipt, Star, Coins, AlertCircle, Package, List, RefreshCw, Circle, TrendingUp, Vault, Flag, UserCircle, FolderOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { canAccessPage, Permissions } from '../lib/permissions';
import { supabase, Store, TechnicianWithQueue, WorkingEmployee, PendingViolationResponse } from '../lib/supabase';
import { NotificationBadge } from './ui/NotificationBadge';
import { VersionNotification } from './VersionNotification';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';
import { Modal } from './ui/Modal';
import { TechnicianQueue } from './TechnicianQueue';
import { getCurrentDateEST } from '../lib/timezone';
import { ViewAsSelector } from './ViewAsSelector';
import { ViewAsBanner } from './ViewAsBanner';
import { RemoveTechnicianModal } from './RemoveTechnicianModal';
import { QueueReasonModal } from './QueueReasonModal';
import { ViolationReportModal } from './ViolationReportModal';
import { ViolationResponseRibbon } from './ViolationResponseRibbon';
import { useCheckInStatusCheck } from '../hooks/useCheckInStatusCheck';
import { useToast } from './ui/Toast';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'home' | 'tickets' | 'eod' | 'safebalance' | 'tipreport' | 'technicians' | 'services' | 'settings' | 'configuration' | 'attendance' | 'approvals' | 'inventory' | 'insights' | 'clients' | 'resources';
  onNavigate: (page: 'home' | 'tickets' | 'eod' | 'safebalance' | 'tipreport' | 'technicians' | 'services' | 'settings' | 'configuration' | 'attendance' | 'approvals' | 'inventory' | 'insights' | 'clients' | 'resources') => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { session, selectedStoreId, selectStore, logout, t, viewingAsRole, startViewingAs, stopViewingAs, isViewingAs, effectiveRole } = useAuth();
  const { getSettingBoolean } = useSettings();
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const { hasNewVersion, handleUpdate } = useServiceWorkerUpdate();
  const [isOpeningCashMissing, setIsOpeningCashMissing] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [sortedTechnicians, setSortedTechnicians] = useState<TechnicianWithQueue[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [leavingQueueEmployeeId, setLeavingQueueEmployeeId] = useState<string | undefined>();
  const [skippingTurnEmployeeId, setSkippingTurnEmployeeId] = useState<string | undefined>();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [employeeToRemove, setEmployeeToRemove] = useState<string | undefined>();
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [employeeToSkip, setEmployeeToSkip] = useState<string | undefined>();
  const [userQueueStatus, setUserQueueStatus] = useState<'ready' | 'neutral' | 'busy'>('neutral');
  const [showRemovalModal, setShowRemovalModal] = useState(false);
  const [technicianToRemove, setTechnicianToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removingTechnicianId, setRemovingTechnicianId] = useState<string | undefined>();
  const [isSubmittingRemoval, setIsSubmittingRemoval] = useState(false);
  const [showViolationReportModal, setShowViolationReportModal] = useState(false);
  const [pendingViolationResponses, setPendingViolationResponses] = useState<PendingViolationResponse[]>([]);
  const [workingEmployees, setWorkingEmployees] = useState<WorkingEmployee[]>([]);
  const [loadingWorkingEmployees, setLoadingWorkingEmployees] = useState(false);
  const [minVotesRequired, setMinVotesRequired] = useState(3);
  const [employeePayType, setEmployeePayType] = useState<'hourly' | 'daily' | 'commission' | undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { showToast } = useToast();

  const canViewAllQueueStatuses = effectiveRole && Permissions.queue.canViewAllQueueStatuses(effectiveRole);
  const canRemoveTechnicians = effectiveRole && Permissions.queue.canRemoveTechnicians(effectiveRole);
  const canReportViolations = session?.employee_id && selectedStoreId;

  // Check if Receptionist/Supervisor/Technician is checked in (to block store switching)
  const checkInStatus = useCheckInStatusCheck(
    session?.employee_id,
    selectedStoreId,
    session?.role_permission
  );
  const isCheckedInEmployee =
    ['Receptionist', 'Supervisor', 'Technician', 'Cashier'].includes(session?.role_permission ?? '') &&
    checkInStatus.isCheckedIn;
  const canSwitchStores = !isCheckedInEmployee;

  useEffect(() => {
    if (localStorage.getItem('app_just_updated') === 'true') {
      localStorage.removeItem('app_just_updated');
      showToast(t('common.updateSuccess'), 'success');
    }
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchStore();
      checkOpeningCash();
    }
    if (session?.employee_id) {
      fetchAllStores();
      fetchEmployeePayType();
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
    if (!session?.employee_id || !selectedStoreId) return;

    fetchPendingViolationResponses();

    // Poll every 10 seconds for pending violation responses
    const interval = setInterval(() => {
      fetchPendingViolationResponses();
    }, 10000);

    // Subscribe to real-time changes on violation tables
    const violationsChannel = supabase
      .channel(`violations-${selectedStoreId}-${session.employee_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_violation_reports',
          filter: `store_id=eq.${selectedStoreId}`,
        },
        () => {
          fetchPendingViolationResponses();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_violation_responses',
        },
        () => {
          fetchPendingViolationResponses();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(violationsChannel);
    };
  }, [session?.employee_id, selectedStoreId]);

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
    const handleOpeningCashUpdate = () => {
      checkOpeningCash();
    };

    window.addEventListener('openingCashUpdated', handleOpeningCashUpdate);

    return () => {
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
    if (data) {
      setCurrentStore(data);
      setMinVotesRequired(data.violation_min_votes_required || 3);
    }
  }

  async function fetchEmployeePayType() {
    if (!session?.employee_id) return;
    const { data } = await supabase
      .from('employees')
      .select('pay_type')
      .eq('id', session.employee_id)
      .maybeSingle();
    if (data) {
      setEmployeePayType(data.pay_type);
    }
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
      const userRoles = session?.role || [];
      const isManagement = userRoles.some(role => ['Owner', 'Manager'].includes(role));

      if (!isManagement) {
        setPendingApprovalsCount(0);
        return;
      }

      let ticketCount = 0;
      let inventoryCount = 0;
      let cashTransactionCount = 0;
      let ticketReopenCount = 0;

      const { data, error } = await supabase.rpc('get_pending_approvals_for_management', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;
      ticketCount = data?.length || 0;

      const { data: inventoryData, error: inventoryError } = await supabase.rpc('get_pending_inventory_approvals', {
        p_employee_id: session.employee_id,
        p_store_id: selectedStoreId,
      });

      if (!inventoryError) {
        inventoryCount = inventoryData?.length || 0;
      }

      const { data: cashData, error: cashError } = await supabase.rpc('get_pending_cash_transaction_approvals', {
        p_store_id: selectedStoreId,
      });

      if (!cashError) {
        cashTransactionCount = cashData?.length || 0;
      }

      const { data: ticketReopenData, error: ticketReopenError } = await supabase.rpc('get_pending_ticket_reopen_requests_count', {
        p_store_id: selectedStoreId,
      });

      if (!ticketReopenError) {
        ticketReopenCount = ticketReopenData || 0;
      }

      const totalCount = ticketCount + inventoryCount + cashTransactionCount + ticketReopenCount;
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

  const handleSkipTurn = async (employeeId: string) => {
    setEmployeeToSkip(employeeId);
    setShowSkipConfirm(true);
  };

  const confirmSkipTurn = async (reason: string, notes: string) => {
    if (!employeeToSkip || !selectedStoreId) return;

    setSkippingTurnEmployeeId(employeeToSkip);
    try {
      const { data, error } = await supabase.rpc('skip_queue_turn', {
        p_employee_id: employeeToSkip,
        p_store_id: selectedStoreId,
        p_reason: reason,
        p_notes: notes || null,
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.message || 'Failed to skip turn');
      }

      await fetchTechnicianQueue();
      setShowSkipConfirm(false);
      setEmployeeToSkip(undefined);
    } catch (error: any) {
      console.error('Error skipping turn:', error);
      alert(error.message || 'Failed to skip turn. Please try again.');
    } finally {
      setSkippingTurnEmployeeId(undefined);
    }
  };

  const confirmLeaveQueue = async (reason: string, notes: string) => {
    if (!employeeToRemove || !selectedStoreId) return;

    setLeavingQueueEmployeeId(employeeToRemove);
    try {
      const { error } = await supabase.rpc('leave_ready_queue', {
        p_employee_id: employeeToRemove,
        p_store_id: selectedStoreId,
        p_reason: reason,
        p_notes: notes || null
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

  const handleRemoveTechnician = (employeeId: string, employeeName: string) => {
    setTechnicianToRemove({ id: employeeId, name: employeeName });
    setShowRemovalModal(true);
  };

  const confirmRemoveTechnician = async (reason: string, notes: string) => {
    if (!technicianToRemove || !selectedStoreId) return;

    setIsSubmittingRemoval(true);
    setRemovingTechnicianId(technicianToRemove.id);

    try {
      const { data, error } = await supabase.rpc('remove_technician_from_queue_admin', {
        p_removed_by_employee_id: session?.employee_id,
        p_employee_id: technicianToRemove.id,
        p_store_id: selectedStoreId,
        p_reason: reason,
        p_notes: notes || null
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.message || 'Failed to remove technician');
      }

      await fetchTechnicianQueue();
      setShowRemovalModal(false);
      setTechnicianToRemove(null);

      // Dynamic message based on whether cooldown was applied
      if (data?.has_cooldown === false) {
        alert(`${technicianToRemove.name} has been removed from the queue.`);
      } else {
        alert(`${technicianToRemove.name} has been removed from the queue for 30 minutes.`);
      }
    } catch (error: any) {
      console.error('Error removing technician:', error);
      alert(error.message || 'Failed to remove technician. Please try again.');
    } finally {
      setIsSubmittingRemoval(false);
      setRemovingTechnicianId(undefined);
    }
  };

  async function fetchPendingViolationResponses() {
    if (!session?.employee_id || !selectedStoreId) return;

    try {
      const { data, error } = await supabase.rpc('get_pending_violation_responses', {
        p_employee_id: session.employee_id,
        p_store_id: selectedStoreId
      });

      if (error) throw error;
      setPendingViolationResponses(data || []);
    } catch (error) {
      console.error('Error fetching pending violation responses:', error);
    }
  }

  async function fetchWorkingEmployees() {
    if (!selectedStoreId) return;

    setLoadingWorkingEmployees(true);
    try {
      const today = getCurrentDateEST();
      const { data, error } = await supabase.rpc('get_employees_working_today', {
        p_store_id: selectedStoreId,
        p_date: today
      });

      if (error) throw error;
      setWorkingEmployees(data || []);
    } catch (error) {
      console.error('Error fetching working employees:', error);
    } finally {
      setLoadingWorkingEmployees(false);
    }
  }

  const handleOpenViolationReportModal = () => {
    setShowViolationReportModal(true);
    fetchWorkingEmployees();
  };

  const handleSubmitViolationReport = async (data: {
    reportedEmployeeId: string;
    description: string;
  }) => {
    if (!session?.employee_id || !selectedStoreId) return;

    try {
      const { data: result, error } = await supabase.rpc('create_queue_violation_report', {
        p_reported_employee_id: data.reportedEmployeeId,
        p_reporter_employee_id: session.employee_id,
        p_store_id: selectedStoreId,
        p_violation_description: data.description,
        p_queue_position_claimed: null
      });

      if (error) throw error;

      alert('Violation report submitted successfully. All employees will be notified to vote.');
      setShowViolationReportModal(false);
    } catch (error: any) {
      console.error('Error submitting violation report:', error);
      alert(error.message || 'Failed to submit violation report. Please try again.');
      throw error;
    }
  };

  const handleViolationResponse = async (
    reportId: string,
    response: boolean,
    notes?: string
  ) => {
    if (!session?.employee_id) return;

    try {
      const { data, error } = await supabase.rpc('submit_violation_response', {
        p_violation_report_id: reportId,
        p_employee_id: session.employee_id,
        p_response: response,
        p_response_notes: notes
      });

      if (error) throw error;

      await fetchPendingViolationResponses();
    } catch (error: any) {
      console.error('Error submitting violation response:', error);
      throw error;
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
      return { rating: '4.8', reviews: '617' };
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
    { id: 'home' as const, label: t('home.title'), icon: Home },
    { id: 'tickets' as const, label: t('nav.tickets'), icon: Receipt },
    { id: 'approvals' as const, label: t('approvals.title'), icon: CheckCircle, badge: showPendingApprovalBadge ? pendingApprovalsCount : 0 },
    { id: 'tipreport' as const, label: t('eod.title'), icon: Coins },
    { id: 'eod' as const, label: t('cash.title'), icon: DollarSign },
    { id: 'safebalance' as const, label: t('safe.title'), icon: Vault },
    { id: 'attendance' as const, label: t('attendance.title'), icon: Calendar },
    { id: 'technicians' as const, label: t('nav.employees'), icon: Users },
    { id: 'clients' as const, label: t('clients.title'), icon: UserCircle },
    { id: 'inventory' as const, label: t('inventory.title'), icon: Package, hidden: !showInventory },
    { id: 'services' as const, label: t('nav.services'), icon: Briefcase },
    { id: 'insights' as const, label: t('insights.title'), icon: TrendingUp },
    { id: 'resources' as const, label: t('common.details'), icon: FolderOpen },
    { id: 'configuration' as const, label: t('config.title'), icon: Settings },
  ];

  const navItems = allNavItems.filter(item => !item.hidden);

  const shouldShowQueueButton = enableReadyQueue && showQueueButtonInHeader;
  const canAccessEod = effectiveRole ? canAccessPage('eod', effectiveRole, employeePayType) : false;
  const shouldShowOpeningCashBanner = showOpeningCashBanner && requireOpeningCash && isOpeningCashMissing && canAccessEod;

  return (
    <div className="min-h-screen bg-gray-50">
      {pendingViolationResponses.length > 0 && (
        <ViolationResponseRibbon
          pendingResponses={pendingViolationResponses}
          onRespond={handleViolationResponse}
        />
      )}
      {hasNewVersion && showVersionNotifications && <VersionNotification onUpdate={handleUpdate} />}
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
              {currentStore && allStores.length > 1 && canSwitchStores ? (
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
                  <span>{t('queue.title')}</span>
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
                {t('cash.openingCashRequired')}
              </p>
            </div>
            <button
              onClick={() => onNavigate('eod')}
              className="flex-shrink-0 bg-white text-amber-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-amber-50 transition-colors whitespace-nowrap"
            >
              {t('cash.countNow')}
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
                const hasAccess = session && effectiveRole && canAccessPage(item.id, effectiveRole, employeePayType);

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
                ? t('queue.ready')
                : t('queue.ready')}
            </p>
            <button
              onClick={fetchTechnicianQueue}
              disabled={loadingQueue}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingQueue ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>
          </div>

          {loadingQueue && sortedTechnicians.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">{t('messages.loading')}</p>
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
              allowLeaveQueue={true}
              onLeaveQueue={handleLeaveQueue}
              leavingQueueEmployeeId={leavingQueueEmployeeId}
              allowSkipTurn={true}
              onSkipTurn={handleSkipTurn}
              skippingTurnEmployeeId={skippingTurnEmployeeId}
              canRemoveTechnicians={canRemoveTechnicians}
              onRemoveTechnician={handleRemoveTechnician}
              removingTechnicianId={removingTechnicianId}
            />
          )}

          {canReportViolations && (
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleOpenViolationReportModal}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors"
              >
                <Flag className="w-4 h-4" />
                {t('violations.reportViolation')}
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              {t('queue.ready')}
            </p>
          </div>
        </div>
      </Modal>

      <ViolationReportModal
        isOpen={showViolationReportModal}
        onClose={() => setShowViolationReportModal(false)}
        workingEmployees={workingEmployees}
        loadingEmployees={loadingWorkingEmployees}
        currentEmployeeId={session?.employee_id || ''}
        currentEmployeeName={session?.name || ''}
        storeId={selectedStoreId || ''}
        minVotesRequired={minVotesRequired}
        onSubmit={handleSubmitViolationReport}
      />

      <QueueReasonModal
        isOpen={showLeaveConfirm}
        onClose={() => {
          if (!leavingQueueEmployeeId) {
            setShowLeaveConfirm(false);
            setEmployeeToRemove(undefined);
          }
        }}
        onConfirm={confirmLeaveQueue}
        title={t('queue.leaveReasonTitle')}
        confirmLabel={t('queue.leaveQueue')}
        confirmingLabel={t('messages.loading')}
        isSubmitting={!!leavingQueueEmployeeId}
        confirmButtonColor="red"
      />

      <QueueReasonModal
        isOpen={showSkipConfirm}
        onClose={() => {
          if (!skippingTurnEmployeeId) {
            setShowSkipConfirm(false);
            setEmployeeToSkip(undefined);
          }
        }}
        onConfirm={confirmSkipTurn}
        title={t('queue.skipReasonTitle')}
        confirmLabel={t('queue.skipTurn')}
        confirmingLabel={t('queue.skippingTurn')}
        isSubmitting={!!skippingTurnEmployeeId}
        confirmButtonColor="yellow"
      />

      <RemoveTechnicianModal
        isOpen={showRemovalModal}
        onClose={() => {
          setShowRemovalModal(false);
          setTechnicianToRemove(null);
        }}
        onConfirm={confirmRemoveTechnician}
        technicianName={technicianToRemove?.name || ''}
        isSubmitting={isSubmittingRemoval}
      />
    </div>
  );
}
