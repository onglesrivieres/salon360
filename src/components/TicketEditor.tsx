import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Banknote, CreditCard, Clock, Award, Lock, CheckCircle, AlertCircle, Edit2, Gift, UserPlus, User, Eye, XCircle } from 'lucide-react';
import {
  supabase,
  SaleTicket,
  TicketItemWithDetails,
  Service,
  StoreServiceWithDetails,
  Technician,
  TicketActivityLog,
  TechnicianWithQueue,
  Client,
} from '../lib/supabase';
import { getCategoryColorClasses } from '../lib/category-colors';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { NumericInput } from './ui/NumericInput';
import { useToast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Permissions } from '../lib/permissions';
import { formatDateTimeEST, convertToESTDatetimeString, convertESTDatetimeStringToUTC } from '../lib/timezone';
import { getDayOfWeek, getFullDayName } from '../lib/schedule-utils';
import { TechnicianQueue } from './TechnicianQueue';
import { useClientLookup, addColorToHistory } from '../hooks/useClientLookup';
import { formatPhoneNumber, normalizePhoneNumber, hasEnoughDigitsForLookup, maskPhoneNumber } from '../lib/phoneUtils';
import { BlacklistWarning } from './clients/BlacklistWarning';
import { ColorDisplay } from './clients/ColorDisplay';
import { QuickAddClientModal } from './clients/QuickAddClientModal';
import { TicketReopenRequestModal } from './TicketReopenRequestModal';
import { TicketPhotosSection, TicketPhotosSectionRef } from './tickets/TicketPhotosSection';

interface TicketEditorProps {
  ticketId: string | null;
  onClose: () => void;
  selectedDate: string;
  hideTips?: boolean;
}

interface TicketItemForm {
  id?: string;
  service_id: string;
  employee_id: string;
  qty: string;
  price_each: string;
  tip_customer: string;
  tip_receptionist: string;
  addon_details: string;
  addon_price: string;
  service?: Service;
  employee?: Technician;
  is_custom?: boolean;
  custom_service_name?: string;
  // Timer fields
  started_at?: string | null;
  timer_stopped_at?: string | null;
  completed_at?: string | null;
}

export function TicketEditor({ ticketId, onClose, selectedDate, hideTips = false }: TicketEditorProps) {
  const [ticket, setTicket] = useState<SaleTicket | null>(null);
  const [items, setItems] = useState<TicketItemForm[]>([]);
  const [services, setServices] = useState<StoreServiceWithDetails[]>([]);
  const [employees, setEmployees] = useState<Technician[]>([]);
  const [sortedTechnicians, setSortedTechnicians] = useState<TechnicianWithQueue[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [categoryOptions, setCategoryOptions] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUsedEmployeeId, setLastUsedEmployeeId] = useState<string>('');
  const [activityLogs, setActivityLogs] = useState<TicketActivityLog[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();
  const { getSettingBoolean } = useSettings();
  const photosSectionRef = useRef<TicketPhotosSectionRef>(null);

  const enableCashPayments = getSettingBoolean('enable_cash_payments', true);
  const enableCardPayments = getSettingBoolean('enable_card_payments', true);
  const enableGiftCardPayments = getSettingBoolean('enable_gift_card_payments', true);
  const enableMixedPayments = getSettingBoolean('enable_mixed_payment_methods', true);
  const requireCustomerName = getSettingBoolean('require_customer_name_on_tickets', false);
  const requireCustomerPhone = getSettingBoolean('require_customer_phone_on_tickets', false);
  const requireEmployeeCheckin = getSettingBoolean('require_employee_checkin_before_tickets', true);
  const requireOpeningCashValidation = getSettingBoolean('require_opening_cash_validation', false);
  const showCustomerName = getSettingBoolean('show_customer_name_field', true);
  const showCustomerPhone = getSettingBoolean('show_customer_phone_field', true);
  const showTodaysColor = getSettingBoolean('show_todays_color_field', true);
  const requireTodaysColor = getSettingBoolean('require_todays_color_on_tickets', false);

  const isApproved = ticket?.approval_status === 'approved' || ticket?.approval_status === 'auto_approved';

  const isSelfServiceMode = !ticketId && session?.role_permission && Permissions.tickets.isSelfServiceRole(session.role_permission);

  const canEditAsSelfService = ticketId && ticket?.opened_by_role &&
    ['Supervisor'].includes(ticket.opened_by_role) &&
    session?.employee_id === ticket.created_by &&
    session?.role_permission &&
    Permissions.tickets.canEditSelfServiceTicket(
      session.role_permission,
      session.employee_id,
      ticket.created_by
    );

  const canVoid = session && session.role_permission && Permissions.tickets.canVoid(session.role_permission);

  const isVoided = !!ticket?.voided_at;

  const isReadOnly = ticket && session && session.role_permission && (
    isVoided ||
    !Permissions.tickets.canEdit(
      session.role_permission,
      !!ticket.closed_at,
      isApproved
    ) || (
      Permissions.tickets.isSelfServiceRole(session.role_permission) &&
      ticket.created_by === session.employee_id &&
      !canEditAsSelfService
    )
  );

  const canEditNotes = session && session.role_permission && (
    !ticketId || (ticket && Permissions.tickets.canEditNotes(
      session.role_permission,
      !!ticket.closed_at
    ))
  );

  const canClose = session && session.role_permission && Permissions.tickets.canClose(session.role_permission);

  const canMarkCompleted = session && session.role_permission && Permissions.tickets.canMarkCompleted(session.role_permission);

  const canSelectPaymentMethod = session && session.role_permission && Permissions.tickets.canSelectPaymentMethod(session.role_permission);

  const canViewPaymentDetailsWhenClosed = session && session.role_permission && Permissions.tickets.canViewPaymentDetailsWhenClosed(session.role_permission);

  const canReopen = session && session.role_permission && Permissions.tickets.canReopen(session.role_permission);

  const canRequestChanges = session && session.role_permission && Permissions.tickets.canRequestChanges(session.role_permission);

  const canDelete = session && session.role_permission && Permissions.tickets.canDelete(session.role_permission);

  // Permission checks for Today's Color and Services (Technician can edit until completed)
  const isTicketCompleted = !!ticket?.completed_at;
  const isTicketClosed = !!ticket?.closed_at;

  const canEditTodaysColor = session?.role_permission &&
    Permissions.tickets.canEditTodaysColor(
      session.role_permission,
      isTicketCompleted,
      isTicketClosed,
      isApproved
    );

  const canEditServices = session?.role_permission &&
    Permissions.tickets.canEditServices(
      session.role_permission,
      isTicketCompleted,
      isTicketClosed,
      isApproved
    );

  // Check if user is Technician (restricted roles for customer info)
  const isRestrictedCustomerInfoRole = session?.role &&
    (session.role.includes('Technician') || session.role.includes('Trainee'));

  const canViewFullPhoneWhenClosed = session?.role_permission &&
    Permissions.tickets.canViewFullPhoneWhenClosed(session.role_permission);
  const shouldMaskPhone = isTicketClosed && !canViewFullPhoneWhenClosed;

  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [showCustomService, setShowCustomService] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Client lookup state
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [linkedClient, setLinkedClient] = useState<Client | null>(null);
  const [blacklistedByName, setBlacklistedByName] = useState<string>('');

  const calculateTimeRemaining = (tech: TechnicianWithQueue): string => {
    if (!tech.ticket_start_time || !tech.estimated_duration_min) {
      return '';
    }

    const startTime = new Date(tech.ticket_start_time);
    const elapsedMinutes = Math.floor((currentTime.getTime() - startTime.getTime()) / (1000 * 60));
    const remainingMinutes = Math.max(0, tech.estimated_duration_min - elapsedMinutes);

    if (remainingMinutes === 0) {
      return 'Finishing soon';
    }

    if (remainingMinutes < 60) {
      return `~${remainingMinutes}min`;
    }

    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    return mins > 0 ? `~${hours}h ${mins}min` : `~${hours}h`;
  };

  const calculateCompletionDuration = (): number => {
    if (!ticket?.opened_at || !ticket?.completed_at) return 0;

    const opened = new Date(ticket.opened_at);
    const completed = new Date(ticket.completed_at);
    const durationMinutes = Math.floor((completed.getTime() - opened.getTime()) / (1000 * 60));

    return Math.max(0, durationMinutes);
  };

  const formatCompletionDuration = (minutes: number): string => {
    if (minutes === 0) return '0 min';

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const getServiceDuration = (): number => {
    if (!ticket || !items.length) return 0;
    const firstItem = items[0];
    if (!firstItem?.service) return 0;
    return firstItem.service.duration_min || 0;
  };

  const getCompletionTimeStatus = (): 'on_time' | 'moderate_deviation' | 'extreme_deviation' | 'unknown' => {
    const serviceDuration = getServiceDuration();
    if (serviceDuration === 0 || !ticket?.completed_at) return 'unknown';

    const actualDuration = calculateCompletionDuration();
    if (actualDuration === 0) return 'unknown';

    const percentage = (actualDuration / serviceDuration) * 100;

    if (percentage < 70) return 'extreme_deviation';
    if (percentage < 90) return 'moderate_deviation';
    if (percentage <= 110) return 'on_time';
    if (percentage <= 130) return 'moderate_deviation';
    return 'extreme_deviation';
  };

  const canEmployeePerformService = (employeeId: string, serviceId: string): boolean => {
    // All service performers (Technician, Supervisor, Manager, Owner) can perform all services
    return true;
  };

  const getServiceColor = (category: string): string => {
    const colorKey = categoryColors[category] || 'pink';
    return `${getCategoryColorClasses(colorKey)} border-2`;
  };

  const [formData, setFormData] = useState({
    customer_type: 'Assigned' as '' | 'Appointment' | 'Requested' | 'Assigned',
    customer_name: '',
    customer_phone: '',
    todays_color: '',
    payment_method: '' as '' | 'Cash' | 'Card' | 'Mixed',
    payment_cash: '',
    payment_card: '',
    payment_gift_card: '',
    tip_customer_cash: '',
    tip_customer_card: '',
    tip_receptionist: '',
    discount_percentage: '',
    discount_amount: '',
    discount_percentage_cash: '',
    discount_amount_cash: '',
    notes: '',
    opening_time: '',
  });

  const [isEditingOpeningTime, setIsEditingOpeningTime] = useState(false);
  const [tempOpeningTime, setTempOpeningTime] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRequestChangesModal, setShowRequestChangesModal] = useState(false);
  const [hasPendingReopenRequest, setHasPendingReopenRequest] = useState(false);
  const [tempPaymentData, setTempPaymentData] = useState({
    payment_cash: '',
    payment_card: '',
    payment_gift_card: '',
    tip_customer_cash: '',
    tip_customer_card: '',
    tip_receptionist: '',
    discount_amount: '',
    discount_percentage: '',
    discount_percentage_cash: '',
    discount_amount_cash: '',
  });

  // Client lookup hook - only enabled when not editing an existing ticket with a client already linked
  const clientLookup = useClientLookup(
    formData.customer_phone,
    selectedStoreId,
    { enabled: showCustomerPhone && !linkedClient }
  );

  // Update linked client when lookup finds one
  useEffect(() => {
    if (clientLookup.client && !linkedClient) {
      setLinkedClient(clientLookup.client);
      // Auto-fill customer name if empty
      if (!formData.customer_name && clientLookup.client.name) {
        setFormData(prev => ({ ...prev, customer_name: clientLookup.client!.name }));
      }
      // Fetch blacklisted_by name if blacklisted
      if (clientLookup.client.is_blacklisted && clientLookup.client.blacklisted_by) {
        fetchBlacklistedByName(clientLookup.client.blacklisted_by);
      }
    }
  }, [clientLookup.client]);

  // Clear linked client when phone changes significantly
  useEffect(() => {
    if (linkedClient) {
      const currentNormalized = normalizePhoneNumber(formData.customer_phone);
      const linkedNormalized = linkedClient.phone_number;
      if (currentNormalized !== linkedNormalized) {
        setLinkedClient(null);
        setBlacklistedByName('');
      }
    }
  }, [formData.customer_phone, linkedClient]);

  async function fetchBlacklistedByName(employeeId: string) {
    const { data } = await supabase
      .from('employees')
      .select('display_name')
      .eq('id', employeeId)
      .maybeSingle();
    if (data) {
      setBlacklistedByName(data.display_name);
    }
  }

  useEffect(() => {
    loadData();
  }, [ticketId]);

  useEffect(() => {
    if (isSelfServiceMode && !ticketId) {
      checkAttendanceAndValidate();
    }
  }, [isSelfServiceMode, ticketId]);

  useEffect(() => {
    if (isSelfServiceMode && session?.employee_id && !ticketId) {
      setLastUsedEmployeeId(session.employee_id);
      setSelectedTechnicianId(session.employee_id);
    }
  }, [isSelfServiceMode, session?.employee_id, ticketId]);

  async function checkAttendanceAndValidate() {
    if (!session?.employee_id || !selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('employee_id', session.employee_id)
        .eq('store_id', selectedStoreId)
        .eq('work_date', selectedDate)
        .eq('status', 'checked_in')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        showToast('You must be checked in to create tickets. Please check in first.', 'error');
        setTimeout(() => onClose(), 2000);
      }
    } catch (error) {
      console.error('Error checking attendance:', error);
      showToast('Failed to verify attendance status', 'error');
    }
  }

  useEffect(() => {
    if (selectedStoreId) {
      fetchSortedTechnicians();

      const queueChannel = supabase
        .channel(`ready-queue-${selectedStoreId}-${selectedDate}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'technician_ready_queue',
            filter: `store_id=eq.${selectedStoreId}`,
          },
          () => {
            fetchSortedTechnicians();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sale_tickets',
            filter: `store_id=eq.${selectedStoreId}`,
          },
          () => {
            fetchSortedTechnicians();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(queueChannel);
      };
    }
  }, [selectedStoreId, selectedDate]);

  // Timer interval for real-time updates
  // Use 1-second interval if there's an active service timer, otherwise 1-minute for general time display
  useEffect(() => {
    const hasActiveTimer = ticketId &&
      !ticket?.completed_at &&
      !ticket?.closed_at &&
      items.some((item: any) => item.started_at && !item.timer_stopped_at && !item.completed_at);

    const intervalMs = hasActiveTimer ? 1000 : 60000;

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [ticketId, items.length, ticket?.completed_at, ticket?.closed_at]);

  // Check for pending reopen request when viewing a closed ticket
  useEffect(() => {
    async function checkPendingReopenRequest() {
      if (!ticketId || !isTicketClosed || !canRequestChanges) {
        setHasPendingReopenRequest(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_pending_ticket_reopen_request', {
          p_ticket_id: ticketId
        });

        if (error) throw error;
        setHasPendingReopenRequest(data === true);
      } catch (error) {
        console.error('Error checking pending reopen request:', error);
      }
    }

    checkPendingReopenRequest();
  }, [ticketId, isTicketClosed, canRequestChanges]);

  async function fetchSortedTechnicians() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase.rpc('get_sorted_technicians_for_store', {
        p_store_id: selectedStoreId,
        p_date: selectedDate
      });

      if (error) throw error;

      setSortedTechnicians(data || []);

      if (data && data.length > 0) {
        setLastUsedEmployeeId(data[0].employee_id);
      }
    } catch (error) {
      console.error('Error fetching sorted technicians:', error);
    }
  }

  async function loadData() {
    try {
      setLoading(true);

      const [servicesRes, employeesRes, categoriesRes] = await Promise.all([
        supabase.rpc('get_services_by_popularity', {
          p_store_id: selectedStoreId
        }),
        supabase
          .from('employees')
          .select('*')
          .or('status.eq.Active,status.eq.active')
          .order('display_name'),
        supabase
          .from('store_service_categories')
          .select('name, color')
          .eq('store_id', selectedStoreId)
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setServices(servicesRes.data || []);

      // Build category color map and options
      if (categoriesRes.data) {
        const colorMap: Record<string, string> = {};
        const options: string[] = ['all'];
        categoriesRes.data.forEach((cat: { name: string; color: string }) => {
          colorMap[cat.name] = cat.color;
          options.push(cat.name);
        });
        setCategoryColors(colorMap);
        setCategoryOptions(options);
      }

      const allEmployees = (employeesRes.data || []).filter(emp =>
        (emp.role.includes('Technician') || emp.role.includes('Trainee') || emp.role.includes('Receptionist')) && !emp.role.includes('Cashier')
      );
      const storeFilteredEmployees = selectedStoreId
        ? allEmployees.filter(emp => !emp.store_id || emp.store_id === selectedStoreId)
        : allEmployees;

      setEmployees(storeFilteredEmployees);

      if (storeFilteredEmployees.length > 0) {
        setLastUsedEmployeeId(storeFilteredEmployees[0].id);
      }

      await fetchSortedTechnicians();

      if (ticketId) {
        const { data: ticketData, error: ticketError } = await supabase
          .from('sale_tickets')
          .select(
            `
            *,
            ticket_items (
              *,
              service:store_services!ticket_items_store_service_id_fkey(*),
              employee:employees!ticket_items_employee_id_fkey(*)
            )
          `
          )
          .eq('id', ticketId)
          .order('id', { ascending: true, referencedTable: 'ticket_items' })
          .single();

        if (ticketError) throw ticketError;

        if (ticketData.approved_by) {
          const { data: approverData } = await supabase
            .from('employees')
            .select('id, display_name, employee_code')
            .eq('id', ticketData.approved_by)
            .maybeSingle();

          if (approverData) {
            (ticketData as any).approver = approverData;
          }
        }

        setTicket(ticketData);

        // Restore linkedClient from existing client_id to prevent edit flow from overwriting it to null
        if (ticketData.client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', ticketData.client_id)
            .maybeSingle();
          if (clientData) {
            setLinkedClient(clientData);
            if (clientData.is_blacklisted && clientData.blacklisted_by) {
              fetchBlacklistedByName(clientData.blacklisted_by);
            }
          }
        }

        const ticketItems = (ticketData as any).ticket_items || [];
        const firstItem = ticketItems[0];

        setFormData({
          customer_type: ticketData.customer_type || '',
          customer_name: ticketData.customer_name,
          customer_phone: ticketData.customer_phone || '',
          todays_color: (ticketData as any).todays_color || '',
          payment_method: ticketData.payment_method || '',
          payment_cash: firstItem ? parseFloat(firstItem.payment_cash || 0).toString() : '0',
          payment_card: firstItem ? parseFloat(firstItem.payment_card || 0).toString() : '0',
          payment_gift_card: firstItem ? parseFloat(firstItem.payment_gift_card || 0).toString() : '0',
          tip_customer_cash: firstItem ? parseFloat(firstItem.tip_customer_cash || 0).toString() : '0',
          tip_customer_card: firstItem ? parseFloat(firstItem.tip_customer_card || 0).toString() : '0',
          tip_receptionist: firstItem ? parseFloat(firstItem.tip_receptionist || 0).toString() : '0',
          discount_percentage: firstItem ? parseFloat(firstItem.discount_percentage || 0).toString() : '0',
          discount_amount: firstItem ? parseFloat(firstItem.discount_amount || 0).toString() : '0',
          discount_percentage_cash: firstItem ? parseFloat(firstItem.discount_percentage_cash || 0).toString() : '0',
          discount_amount_cash: firstItem ? parseFloat(firstItem.discount_amount_cash || 0).toString() : '0',
          notes: ticketData.notes,
          opening_time: ticketData.opened_at || '',
        });

        setItems(
          ticketItems.map((item: any) => ({
            id: item.id,
            service_id: item.store_service_id || '',
            employee_id: item.employee_id,
            qty: parseFloat(item.qty || 0).toString(),
            price_each: parseFloat(item.price_each || 0).toString(),
            tip_customer: (parseFloat(item.tip_customer_cash || 0) + parseFloat(item.tip_customer_card || 0)).toString(),
            tip_receptionist: parseFloat(item.tip_receptionist || 0).toString(),
            addon_details: item.addon_details || '',
            addon_price: parseFloat(item.addon_price || 0).toString(),
            service: item.service,
            employee: item.employee,
            is_custom: !item.store_service_id,
            custom_service_name: item.custom_service_name || '',
            // Timer fields
            started_at: item.started_at,
            timer_stopped_at: item.timer_stopped_at,
            completed_at: item.completed_at,
          }))
        );

        if (ticketItems.length > 0 && ticketItems[0].custom_service_name) {
          setShowCustomService(true);
        }

        if (firstItem?.employee_id) {
          setSelectedTechnicianId(firstItem.employee_id);
        }

        await fetchActivityLogs(ticketId);
      } else {
        setFormData(prev => ({
          ...prev,
          opening_time: new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('Error loading ticket data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchActivityLogs(ticketId: string) {
    try {
      const { data, error } = await supabase
        .from('ticket_activity_log')
        .select(`
          *,
          employee:employees(id, display_name)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    }
  }

  function handleEditOpeningTime() {
    setTempOpeningTime(convertToESTDatetimeString(formData.opening_time));
    setIsEditingOpeningTime(true);
  }

  function handleCancelEditOpeningTime() {
    setIsEditingOpeningTime(false);
    setTempOpeningTime('');
  }

  function handleSaveOpeningTime() {
    if (!tempOpeningTime) {
      showToast('Opening time is required', 'error');
      return;
    }

    const utcDateString = convertESTDatetimeStringToUTC(tempOpeningTime);
    const newDate = new Date(utcDateString);
    const now = new Date();

    if (newDate > now) {
      showToast('Opening time cannot be in the future', 'error');
      return;
    }

    if (ticket?.closed_at) {
      const closedDate = new Date(ticket.closed_at);
      if (newDate > closedDate) {
        showToast('Opening time cannot be after closing time', 'error');
        return;
      }
    }

    setFormData({ ...formData, opening_time: utcDateString });
    setIsEditingOpeningTime(false);
    setTempOpeningTime('');
  }

  async function logActivity(ticketId: string, action: TicketActivityLog['action'], description: string, changes?: Record<string, any>) {
    try {
      await supabase
        .from('ticket_activity_log')
        .insert([{
          ticket_id: ticketId,
          employee_id: session?.employee_id,
          action,
          description,
          changes: changes || {},
        }]);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  function addItem() {
    const defaultService = services[0];
    setItems([
      ...items,
      {
        service_id: defaultService?.id || '',
        employee_id: lastUsedEmployeeId,
        qty: '1',
        price_each: defaultService?.price.toString() || '0',
        tip_customer: '0',
        tip_receptionist: '0',
        addon_details: '',
        addon_price: '0',
        service: defaultService,
      },
    ]);
  }

  async function removeItem(index: number) {
    const itemToRemove = items[index];
    const isActiveTimer = itemToRemove.started_at &&
                         !(itemToRemove as any).timer_stopped_at &&
                         !(itemToRemove as any).completed_at;

    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);

    // If we removed the active timer and there are other services, reactivate previous timer
    if (ticketId && isActiveTimer && newItems.length > 0) {
      const stoppedItems = newItems
        .filter((item: any) => item.timer_stopped_at)
        .sort((a: any, b: any) =>
          new Date(b.timer_stopped_at!).getTime() - new Date(a.timer_stopped_at!).getTime()
        );

      if (stoppedItems.length > 0 && (stoppedItems[0] as any).id) {
        const { error } = await supabase
          .from('ticket_items')
          .update({ timer_stopped_at: null, updated_at: new Date().toISOString() })
          .eq('id', (stoppedItems[0] as any).id);

        if (error) {
          console.error('Error reactivating timer:', error);
        }
      }
    }

    // Delete from database if exists
    if ((itemToRemove as any).id) {
      const { error } = await supabase
        .from('ticket_items')
        .delete()
        .eq('id', (itemToRemove as any).id);

      if (error) {
        console.error('Error deleting item:', error);
      }
    }
  }

  function updateItem(index: number, field: keyof TicketItemForm, value: string) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'service_id') {
      const service = services.find((s) => s.id === value);
      newItems[index].price_each = service?.price.toString() || '0';
      newItems[index].service = service as any;
    }

    if (field === 'employee_id') {
      const employee = employees.find((e) => e.id === value);
      newItems[index].employee = employee;
      setLastUsedEmployeeId(value);
    }

    setItems(newItems);
  }

  // Timer calculation functions for service timers
  function calculateServiceDuration(item: any, time: Date): number {
    if (!item.started_at) return 0;

    const startTime = new Date(item.started_at);
    let endTime: Date;

    // Priority: timer_stopped_at > item.completed_at > ticket.completed_at > ticket.closed_at > current time
    if (item.timer_stopped_at) {
      endTime = new Date(item.timer_stopped_at);
    } else if (item.completed_at) {
      endTime = new Date(item.completed_at);
    } else if (ticket?.completed_at) {
      endTime = new Date(ticket.completed_at);
    } else if (ticket?.closed_at) {
      endTime = new Date(ticket.closed_at);
    } else {
      endTime = time; // Active timer uses current time
    }

    const durationMs = endTime.getTime() - startTime.getTime();
    return Math.max(0, Math.floor(durationMs / (1000 * 60))); // Minutes, minimum 0
  }

  function calculateTotalTimerDuration(time: Date): number {
    return items.reduce((sum, item) => sum + calculateServiceDuration(item, time), 0);
  }

  function formatTimerDisplay(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  // Helper function to stop current active service timer
  async function stopCurrentServiceTimer(ticketIdToStop: string) {
    // Find active service (has started_at but no timer_stopped_at)
    const { data: activeItems, error } = await supabase
      .from('ticket_items')
      .select('id, started_at, timer_stopped_at')
      .eq('sale_ticket_id', ticketIdToStop)
      .is('timer_stopped_at', null)
      .not('started_at', 'is', null);

    if (error) {
      console.error('Error finding active timer:', error);
      return;
    }

    if (activeItems && activeItems.length > 0) {
      const { error: updateError } = await supabase
        .from('ticket_items')
        .update({
          timer_stopped_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', activeItems.map(item => item.id));

      if (updateError) {
        console.error('Error stopping timer:', updateError);
      }
    }
  }

  // Check if any service in the ticket requires photos
  const hasRequiresPhotosService = items.some(item => {
    if (item.is_custom) return false;
    const svc = services.find(s => s.id === item.service_id);
    return svc?.requires_photos;
  });

  function calculateSubtotal(): number {
    const itemsTotal = items.reduce((sum, item) => {
      const price = parseFloat(item.price_each) || 0;
      const addonPrice = parseFloat(item.addon_price) || 0;
      return sum + price + addonPrice;
    }, 0);
    return itemsTotal;
  }

  function calculateTotal(): number {
    const subtotal = calculateSubtotal();
    const totalDiscount = calculateTotalDiscount();
    return Math.max(0, subtotal - totalDiscount);
  }

  function calculateTotalPayments(): number {
    return (
      (parseFloat(formData.payment_cash) || 0) +
      (parseFloat(formData.payment_card) || 0) +
      (parseFloat(formData.payment_gift_card) || 0)
    );
  }

  function calculateTotalTips(): number {
    return (
      (parseFloat(formData.tip_customer_cash) || 0) +
      (parseFloat(formData.tip_customer_card) || 0) +
      (parseFloat(formData.tip_receptionist) || 0)
    );
  }

  function calculateTipsExcludingReceptionist(): number {
    return parseFloat(formData.tip_customer_card) || 0;
  }

  function calculateCashTips(): number {
    return parseFloat(formData.tip_customer_cash) || 0;
  }

  function calculateCardTips(): number {
    return parseFloat(formData.tip_customer_card) || 0;
  }

  function calculateTotalCashCollected(): number {
    return (
      (parseFloat(formData.payment_cash) || 0) +
      calculateCashTips()
    );
  }

  function calculateTotalCardCollected(): number {
    return (
      (parseFloat(formData.payment_card) || 0) +
      calculateCardTips()
    );
  }

  function calculateTotalGiftCardCollected(): number {
    return parseFloat(formData.payment_gift_card) || 0;
  }

  function calculateTotalDiscount(): number {
    const cashDiscountAmount = parseFloat(formData.discount_amount_cash) || 0;
    const cardDiscountAmount = parseFloat(formData.discount_amount) || 0;

    if (formData.payment_method === 'Cash') {
      return cashDiscountAmount;
    } else if (formData.payment_method === 'Card') {
      return cardDiscountAmount;
    } else if (formData.payment_method === 'Mixed') {
      return cardDiscountAmount; // Mixed uses only card discount
    }

    return 0;
  }

  function calculateTotalCashPayment(): number {
    const paymentCash = parseFloat(tempPaymentData.payment_cash) || 0;
    const discountAmountCash = parseFloat(tempPaymentData.discount_amount_cash) || 0;
    return Math.max(0, paymentCash - discountAmountCash);
  }

  function calculateTotalCollected(): number {
    const totalPayments = calculateTotalPayments();
    const totalDiscount = calculateTotalDiscount();
    const tips = calculateTipsExcludingReceptionist();
    return totalPayments - totalDiscount + tips;
  }


  function calculateTempTotalCollected(): number {
    const servicePrice = calculateTotal();
    const tipsExcludingReceptionist = (
      (parseFloat(tempPaymentData.tip_customer_cash) || 0) +
      (parseFloat(tempPaymentData.tip_customer_card) || 0)
    );
    return servicePrice + tipsExcludingReceptionist;
  }

  function handleNumericFieldFocus(event: React.FocusEvent<HTMLInputElement>) {
    const value = event.target.value;
    const numericValue = parseFloat(value);

    // Auto-select text if the field contains 0, 0.00, or is empty
    if (!value || value === '' || numericValue === 0 || value === '0' || value === '0.00' || value === '0.0') {
      event.target.select();
    }
  }

  function handleNumericFieldBlur(event: React.FocusEvent<HTMLInputElement>, fieldName: string) {
    const value = event.target.value;

    // If field is empty or invalid, reset to '0'
    if (!value || value.trim() === '' || isNaN(parseFloat(value))) {
      setFormData({ ...formData, [fieldName]: '0' });
    }
  }

  function hasExistingPaymentData(): boolean {
    const hasPaymentAmount = parseFloat(formData.payment_cash || '0') > 0 ||
                            parseFloat(formData.payment_card || '0') > 0 ||
                            parseFloat(formData.payment_gift_card || '0') > 0;
    const hasTips = parseFloat(formData.tip_customer_cash || '0') > 0 ||
                   parseFloat(formData.tip_customer_card || '0') > 0 ||
                   parseFloat(formData.tip_receptionist || '0') > 0;
    const hasDiscounts = parseFloat(formData.discount_amount || '0') > 0 ||
                        parseFloat(formData.discount_percentage || '0') > 0 ||
                        parseFloat(formData.discount_percentage_cash || '0') > 0 ||
                        parseFloat(formData.discount_amount_cash || '0') > 0;

    return hasPaymentAmount || hasTips || hasDiscounts;
  }

  function handlePaymentMethodClick(method: 'Cash' | 'Card' | 'Mixed') {
    const subtotal = calculateSubtotal();
    const subtotalStr = subtotal > 0 ? subtotal.toFixed(2) : '';
    const existingData = hasExistingPaymentData();

    setTempPaymentData({
      // Always prefill payment with current subtotal for the selected method
      payment_cash: method === 'Cash' ? subtotalStr : (existingData ? (formData.payment_cash || '0') : ''),
      payment_card: method === 'Card' ? subtotalStr : (existingData ? (formData.payment_card || '0') : ''),
      payment_gift_card: existingData ? (formData.payment_gift_card || '0') : '',
      // Preserve existing tips and discounts
      tip_customer_cash: existingData ? (formData.tip_customer_cash || '0') : '',
      tip_customer_card: existingData ? (formData.tip_customer_card || '0') : '',
      tip_receptionist: existingData ? (formData.tip_receptionist || '0') : '',
      discount_amount: existingData ? (formData.discount_amount || '0') : '',
      discount_percentage: existingData ? (formData.discount_percentage || '0') : '',
      discount_percentage_cash: existingData ? (formData.discount_percentage_cash || '0') : '',
      discount_amount_cash: existingData ? (formData.discount_amount_cash || '0') : '',
    });
    setFormData({ ...formData, payment_method: method });
    setShowPaymentModal(true);
  }

  function handlePaymentModalSave() {
    // Warn if cash discount is entered - prevents accidental phantom discounts
    const cashDiscountAmount = parseFloat(tempPaymentData.discount_amount_cash) || 0;
    if (cashDiscountAmount > 0) {
      const confirmed = window.confirm(
        `A cash discount of $${cashDiscountAmount.toFixed(2)} will be applied. This will reduce the Expected Cash Collected in End of Day reports.\n\nAre you sure you want to apply this discount?`
      );
      if (!confirmed) {
        return;
      }
    }

    setFormData({
      ...formData,
      payment_cash: tempPaymentData.payment_cash,
      payment_card: tempPaymentData.payment_card,
      payment_gift_card: tempPaymentData.payment_gift_card,
      tip_customer_cash: tempPaymentData.tip_customer_cash,
      tip_customer_card: tempPaymentData.tip_customer_card,
      tip_receptionist: tempPaymentData.tip_receptionist,
      discount_amount: tempPaymentData.discount_amount,
      discount_percentage: tempPaymentData.discount_percentage,
      discount_percentage_cash: tempPaymentData.discount_percentage_cash,
      discount_amount_cash: tempPaymentData.discount_amount_cash,
    });
    setShowPaymentModal(false);
    showToast('Payment details saved', 'success');
  }

  function handlePaymentModalCancel() {
    setShowPaymentModal(false);
  }

  function handleViewPaymentDetails() {
    setTempPaymentData({
      payment_cash: formData.payment_cash || '0',
      payment_card: formData.payment_card || '0',
      payment_gift_card: formData.payment_gift_card || '0',
      tip_customer_cash: formData.tip_customer_cash || '0',
      tip_customer_card: formData.tip_customer_card || '0',
      tip_receptionist: formData.tip_receptionist || '0',
      discount_amount: formData.discount_amount || '0',
      discount_percentage: formData.discount_percentage || '0',
      discount_percentage_cash: formData.discount_percentage_cash || '0',
      discount_amount_cash: formData.discount_amount_cash || '0',
    });
    setShowPaymentModal(true);
  }

  async function checkOpeningCashRecorded(storeId: string, ticketDate: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('end_of_day_records')
      .select('opening_cash_amount, bill_20, bill_10, bill_5, bill_2, bill_1, coin_25, coin_10, coin_5')
      .eq('store_id', storeId)
      .eq('date', ticketDate)
      .maybeSingle();

    if (error) {
      console.error('Error checking opening cash:', error);
      return false;
    }

    if (!data) {
      return false;
    }

    return (
      (data.opening_cash_amount || 0) > 0 ||
      (data.bill_20 || 0) > 0 ||
      (data.bill_10 || 0) > 0 ||
      (data.bill_5 || 0) > 0 ||
      (data.bill_2 || 0) > 0 ||
      (data.bill_1 || 0) > 0 ||
      (data.coin_25 || 0) > 0 ||
      (data.coin_10 || 0) > 0 ||
      (data.coin_5 || 0) > 0
    );
  }

  async function generateTicketNumber(): Promise<string> {
    const dateStr = selectedDate.replace(/-/g, '');

    const { data, error } = await supabase
      .from('sale_tickets')
      .select('ticket_no')
      .like('ticket_no', `ST-${dateStr}-%`)
      .order('ticket_no', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextNum = 1;
    if (data && data.length > 0) {
      const lastTicket = data[0].ticket_no;
      const lastNum = parseInt(lastTicket.split('-')[2]);
      nextNum = lastNum + 1;
    }

    return `ST-${dateStr}-${nextNum.toString().padStart(4, '0')}`;
  }

  async function handleSaveComment() {
    if (!ticketId || !ticket) return;

    try {
      setSaving(true);

      const { error: updateError } = await supabase
        .from('sale_tickets')
        .update({
          notes: formData.notes,
          saved_by: session?.employee_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      await logActivity(ticketId, 'updated', `${session?.display_name} added a comment`);

      showToast('Comment saved successfully', 'success');
      onClose();
    } catch (error) {
      console.error('Error saving comment:', error);
      showToast('Failed to save comment', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (isReadOnly) {
      showToast('You do not have permission to edit this ticket', 'error');
      return;
    }

    if (!ticketId && session && session.role_permission && !Permissions.tickets.canCreate(session.role_permission)) {
      showToast('You do not have permission to create tickets', 'error');
      return;
    }

    if (ticket?.closed_at) {
      showToast('Cannot edit closed ticket', 'error');
      return;
    }

    if (!formData.customer_type) {
      showToast('Customer Type is required', 'error');
      return;
    }

    // Customer info validation - only when settings require them
    if (requireCustomerName && showCustomerName && (!formData.customer_name || formData.customer_name.trim() === '')) {
      showToast('Customer name is required', 'error');
      return;
    }

    if (requireCustomerPhone && showCustomerPhone && (!formData.customer_phone || formData.customer_phone.trim() === '')) {
      showToast('Customer phone number is required', 'error');
      return;
    }

    if (requireTodaysColor && showTodaysColor && (!formData.todays_color || formData.todays_color.trim() === '')) {
      showToast('Today\'s Color is required', 'error');
      return;
    }

    if (!selectedTechnicianId) {
      showToast('Technician is required', 'error');
      return;
    }

    if (items.length === 0) {
      showToast('Service is required', 'error');
      return;
    }

    const totalPayments = calculateTotalPayments();
    const subtotalAfterDiscount = calculateTotal();

    if (totalPayments > 0 && Math.abs(totalPayments - subtotalAfterDiscount) > 0.01) {
      const difference = subtotalAfterDiscount - totalPayments;
      if (difference > 0) {
        showToast(`Payment amount ($${totalPayments.toFixed(2)}) is less than service total ($${subtotalAfterDiscount.toFixed(2)}). Please adjust payment amounts.`, 'error');
      }
    }

    for (const item of items) {
      if (item.is_custom) {
        if (!item.custom_service_name || item.custom_service_name.trim() === '') {
          showToast('Custom service name is required', 'error');
          return;
        }
        if (parseFloat(item.price_each) <= 0) {
          showToast('Custom service price must be greater than 0', 'error');
          return;
        }
      } else {
        if (!item.service_id) {
          showToast('Service is required', 'error');
          return;
        }
        if (!canEmployeePerformService(item.employee_id, item.service_id)) {
          const employee = employees.find(e => e.id === item.employee_id);
          const service = services.find(s => s.id === item.service_id);
          showToast(`${employee?.display_name || 'This employee'} cannot perform ${service?.name || 'this service'}.`, 'error');
          return;
        }
      }
    }

    // Validate photos and notes for new tickets with requires_photos services
    if (!ticketId && hasRequiresPhotosService) {
      if (!formData.notes || formData.notes.trim() === '') {
        showToast('Notes are required for this service', 'error');
        return;
      }
      const pendingCount = photosSectionRef.current?.pendingCount ?? 0;
      if (pendingCount < 1) {
        showToast('At least 1 photo is required for this service', 'error');
        return;
      }
    }

    try {
      setSaving(true);

      // Only check opening cash if validation is required in configuration
      if (!ticketId && selectedStoreId && requireOpeningCashValidation) {
        const openingCashRecorded = await checkOpeningCashRecorded(selectedStoreId, selectedDate);
        if (!openingCashRecorded) {
          showToast('Opening cash count must be recorded before creating tickets. Please go to End of Day and count the opening cash first.', 'error');
          setSaving(false);
          return;
        }
      }

      const total = calculateTotal();
      let createdTicketId: string | null = null;
      let paymentCash = parseFloat(formData.payment_cash) || 0;
      let paymentCard = parseFloat(formData.payment_card) || 0;
      let paymentGiftCard = parseFloat(formData.payment_gift_card) || 0;
      let tipCustomerCash = parseFloat(formData.tip_customer_cash) || 0;
      let tipCustomerCard = parseFloat(formData.tip_customer_card) || 0;
      const tipReceptionist = parseFloat(formData.tip_receptionist) || 0;

      // Clear payment and tip fields based on payment method
      if (formData.payment_method === 'Cash') {
        paymentCard = 0;
        paymentGiftCard = 0;
        tipCustomerCard = 0;
      }
      if (formData.payment_method === 'Card') {
        paymentCash = 0;
        paymentGiftCard = 0;
        tipCustomerCash = 0;
      }
      // Mixed keeps all payment types and tips

      if (ticketId && ticket) {
        const updateData: any = {
          customer_type: formData.customer_type || null,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          client_id: linkedClient?.id || null,
          payment_method: formData.payment_method || null,
          total,
          notes: formData.notes,
          saved_by: session?.employee_id,
          updated_at: new Date().toISOString(),
          todays_color: formData.todays_color || '',
        };

        if (
          ticket.opened_by_role &&
          ['Technician', 'Trainee', 'Supervisor'].includes(ticket.opened_by_role) &&
          !ticket.reviewed_by_receptionist &&
          session?.role_permission &&
          Permissions.tickets.canReviewSelfServiceTicket(session.role_permission)
        ) {
          updateData.reviewed_by_receptionist = true;
        }

        if (formData.opening_time && formData.opening_time !== ticket.opened_at) {
          updateData.opened_at = formData.opening_time;
          await logActivity(ticketId, 'updated', `${session?.display_name} updated ticket opening time`, {
            opening_time: {
              old: ticket.opened_at,
              new: formData.opening_time,
            },
          });
        }

        const { error: updateError } = await supabase
          .from('sale_tickets')
          .update(updateData)
          .eq('id', ticketId);

        if (updateError) throw updateError;

        await logActivity(ticketId, 'updated', `${session?.display_name} updated ticket`, {
          customer_name: formData.customer_name,
          total,
          payment_method: formData.payment_method,
          payment_cash: paymentCash,
          payment_card: paymentCard,
          payment_gift_card: paymentGiftCard,
          tip_customer_cash: tipCustomerCash,
          tip_customer_card: tipCustomerCard,
          tip_receptionist: tipReceptionist,
          discount_amount: parseFloat(formData.discount_amount) || 0,
          discount_percentage: parseFloat(formData.discount_percentage) || 0,
          discount_percentage_cash: parseFloat(formData.discount_percentage_cash) || 0,
          discount_amount_cash: parseFloat(formData.discount_amount_cash) || 0,
        });

        const existingItemIds = items.filter((item) => item.id).map((item) => item.id);
        const newItems = items.filter((item) => !item.id);

        // If we're adding new services and there are existing services with timers, stop the current timer
        if (newItems.length > 0 && existingItemIds.length > 0) {
          await stopCurrentServiceTimer(ticketId);
        }

        const { error: deleteError } = await supabase
          .from('ticket_items')
          .delete()
          .eq('sale_ticket_id', ticketId)
          .not('id', 'in', `(${existingItemIds.join(',')})`);

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
          const item = items[itemIndex];
          const addonPrice = parseFloat(item.addon_price) || 0;
          // Clear discount fields based on payment method
          let discountPercentage = parseFloat(formData.discount_percentage) || 0;
          let discountAmount = parseFloat(formData.discount_amount) || 0;
          let discountPercentageCash = parseFloat(formData.discount_percentage_cash) || 0;
          let discountAmountCash = parseFloat(formData.discount_amount_cash) || 0;

          if (formData.payment_method === 'Card' || formData.payment_method === 'Mixed') {
            discountPercentageCash = 0;
            discountAmountCash = 0;
          }
          if (formData.payment_method === 'Cash') {
            discountPercentage = 0;
            discountAmount = 0;
          }

          // Only store payment/tip values on the first item to avoid double-counting in EOD
          const isFirstItem = itemIndex === 0;
          const itemData: any = {
            sale_ticket_id: ticketId,
            store_service_id: item.is_custom ? null : item.service_id,
            custom_service_name: item.is_custom ? item.custom_service_name : null,
            employee_id: item.employee_id,
            qty: parseFloat(item.qty),
            price_each: parseFloat(item.price_each),
            payment_cash: isFirstItem ? paymentCash : 0,
            payment_card: isFirstItem ? paymentCard : 0,
            payment_gift_card: isFirstItem ? paymentGiftCard : 0,
            tip_customer_cash: isFirstItem ? tipCustomerCash : 0,
            tip_customer_card: isFirstItem ? tipCustomerCard : 0,
            tip_receptionist: isFirstItem ? tipReceptionist : 0,
            addon_details: item.addon_details || '',
            addon_price: addonPrice,
            discount_percentage: isFirstItem ? discountPercentage : 0,
            discount_amount: isFirstItem ? discountAmount : 0,
            discount_percentage_cash: isFirstItem ? discountPercentageCash : 0,
            discount_amount_cash: isFirstItem ? discountAmountCash : 0,
            updated_at: new Date().toISOString(),
          };

          if (item.id) {
            // Existing item - don't overwrite started_at or timer_stopped_at
            const { error } = await supabase
              .from('ticket_items')
              .update(itemData)
              .eq('id', item.id);
            if (error) throw error;
          } else {
            // New item - started_at will be auto-set by DB trigger
            const { error } = await supabase.from('ticket_items').insert([itemData]);
            if (error) throw error;
          }
        }

        showToast('Ticket updated successfully', 'success');
      } else {
        const ticketNo = await generateTicketNumber();

        const newTicketData: any = {
          ticket_no: ticketNo,
          ticket_date: selectedDate,
          customer_type: formData.customer_type || null,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          client_id: linkedClient?.id || null,
          payment_method: formData.payment_method || null,
          total,
          notes: formData.notes,
          store_id: selectedStoreId || null,
          created_by: session?.employee_id,
          saved_by: session?.employee_id,
          opened_by_role: session?.role_permission || null,
          reviewed_by_receptionist: session?.role_permission && Permissions.tickets.isSelfServiceRole(session.role_permission) ? false : true,
          todays_color: formData.todays_color || '',
        };

        if (formData.opening_time) {
          newTicketData.opened_at = formData.opening_time;
        }

        const { data: newTicket, error: ticketError } = await supabase
          .from('sale_tickets')
          .insert([newTicketData])
          .select()
          .single();

        if (ticketError) throw ticketError;
        createdTicketId = newTicket.id;

        // Clear discount fields based on payment method
        let discountPercentage = parseFloat(formData.discount_percentage) || 0;
        let discountAmount = parseFloat(formData.discount_amount) || 0;
        let discountPercentageCash = parseFloat(formData.discount_percentage_cash) || 0;
        let discountAmountCash = parseFloat(formData.discount_amount_cash) || 0;

        if (formData.payment_method === 'Card' || formData.payment_method === 'Mixed') {
          discountPercentageCash = 0;
          discountAmountCash = 0;
        }
        if (formData.payment_method === 'Cash') {
          discountPercentage = 0;
          discountAmount = 0;
        }

        // Only store payment/tip values on the first item to avoid double-counting in EOD
        const itemsData = items.map((item, index) => {
          const addonPrice = parseFloat(item.addon_price) || 0;
          const isFirstItem = index === 0;
          return {
            sale_ticket_id: newTicket.id,
            store_service_id: item.is_custom ? null : item.service_id,
            custom_service_name: item.is_custom ? item.custom_service_name : null,
            employee_id: item.employee_id,
            qty: parseFloat(item.qty),
            price_each: parseFloat(item.price_each),
            payment_cash: isFirstItem ? paymentCash : 0,
            payment_card: isFirstItem ? paymentCard : 0,
            payment_gift_card: isFirstItem ? paymentGiftCard : 0,
            tip_customer_cash: isFirstItem ? tipCustomerCash : 0,
            tip_customer_card: isFirstItem ? tipCustomerCard : 0,
            tip_receptionist: isFirstItem ? tipReceptionist : 0,
            addon_details: item.addon_details || '',
            addon_price: addonPrice,
            discount_percentage: isFirstItem ? discountPercentage : 0,
            discount_amount: isFirstItem ? discountAmount : 0,
            discount_percentage_cash: isFirstItem ? discountPercentageCash : 0,
            discount_amount_cash: isFirstItem ? discountAmountCash : 0,
            started_at: new Date().toISOString(),
          };
        });

        const { error: itemsError } = await supabase
          .from('ticket_items')
          .insert(itemsData);

        if (itemsError) throw itemsError;

        await logActivity(newTicket.id, 'created', `${session?.display_name} created ticket`, {
          ticket_no: ticketNo,
          customer_name: formData.customer_name,
          total,
          payment_method: formData.payment_method,
          payment_cash: paymentCash,
          payment_card: paymentCard,
          payment_gift_card: paymentGiftCard,
          tip_customer_cash: tipCustomerCash,
          tip_customer_card: tipCustomerCard,
          tip_receptionist: tipReceptionist,
          discount_amount: parseFloat(formData.discount_amount) || 0,
          discount_percentage: parseFloat(formData.discount_percentage) || 0,
          discount_percentage_cash: parseFloat(formData.discount_percentage_cash) || 0,
          discount_amount_cash: parseFloat(formData.discount_amount_cash) || 0,
        });

        showToast('Ticket created successfully', 'success');
      }

      // Upload any pending photos before closing
      if (photosSectionRef.current?.hasPendingChanges) {
        const photoUploadSuccess = await photosSectionRef.current.uploadPendingPhotos(createdTicketId || undefined);
        if (!photoUploadSuccess) {
          showToast('Some photos failed to upload', 'error');
        }
      }

      onClose();
    } catch (error: any) {
      showToast(error.message || 'Failed to save ticket', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectBusyTechnician(technicianId: string, currentTicketId?: string) {
    setSelectedTechnicianId(technicianId);
    setLastUsedEmployeeId(technicianId);
    if (items.length > 0) {
      updateItem(0, 'employee_id', technicianId);
    }
  }

  function handleTechnicianSelect(technicianId: string, currentTicketId?: string) {
    if (isTicketClosed || isReadOnly) return;
    handleSelectBusyTechnician(technicianId, currentTicketId);
  }

  function handleClose() {
    onClose();
  }

  async function handleCloseTicket() {
    if (!canClose) {
      showToast('You do not have permission to close tickets', 'error');
      return;
    }

    if (!ticketId || !ticket) return;

    if (items.length === 0) {
      showToast('Cannot close ticket with no items', 'error');
      return;
    }

    if (requireCustomerName && showCustomerName && (!formData.customer_name || formData.customer_name.trim() === '')) {
      showToast('Customer name is required to close this ticket', 'error');
      return;
    }

    if (requireCustomerPhone && showCustomerPhone && (!formData.customer_phone || formData.customer_phone.trim() === '')) {
      showToast('Customer phone number is required to close this ticket', 'error');
      return;
    }

    if (requireTodaysColor && showTodaysColor && (!formData.todays_color || formData.todays_color.trim() === '')) {
      showToast('Today\'s Color is required to close this ticket', 'error');
      return;
    }

    if (!formData.payment_method || !['Cash', 'Card', 'Mixed', 'Gift Card'].includes(formData.payment_method)) {
      showToast('Please select a payment method before closing the ticket', 'error');
      return;
    }

    const total = calculateTotal();
    if (total < 0) {
      showToast('Cannot close ticket with negative total', 'error');
      return;
    }

    // Validate photos and notes for tickets with requires_photos services
    if (hasRequiresPhotosService) {
      if (!formData.notes || formData.notes.trim() === '') {
        showToast('Notes are required for this service', 'error');
        return;
      }
      const totalPhotos = photosSectionRef.current?.totalPhotoCount ?? 0;
      if (totalPhotos < 1) {
        showToast('At least 1 photo is required for this service', 'error');
        return;
      }
    }

    try {
      await handleSave();

      // Stop all active service timers before closing the ticket
      await stopCurrentServiceTimer(ticketId);

      const closerRoles = session?.role || [];
      const now = new Date().toISOString();

      const updateData: any = {
        closed_at: now,
        closed_by: session?.employee_id,
        closed_by_roles: closerRoles,
      };

      if (!ticket.completed_at) {
        updateData.completed_at = now;
        updateData.completed_by = session?.employee_id;
      }

      const { error } = await supabase
        .from('sale_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      // Save color to client history if we have a linked client and today's color
      if (linkedClient && formData.todays_color && formData.todays_color.trim()) {
        try {
          await addColorToHistory({
            client_id: linkedClient.id,
            ticket_id: ticketId,
            color: formData.todays_color.trim(),
          });
        } catch (colorError) {
          console.error('Error saving color to history:', colorError);
          // Don't fail the close operation for this
        }
      }

      await logActivity(ticketId, 'closed', `${session?.display_name} closed ticket`, {
        total: calculateTotal(),
        closed_by_roles: closerRoles,
      });

      showToast('Ticket closed successfully. Approval workflow initiated.', 'success');
      onClose();
    } catch (error) {
      console.error('Error closing ticket:', error);
      showToast('Failed to close ticket', 'error');
    }
  }

  async function handleReopenTicket() {
    if (!canReopen) {
      showToast('You do not have permission to reopen tickets', 'error');
      return;
    }

    if (!ticketId || !ticket) {
      showToast('Invalid ticket', 'error');
      return;
    }

    try {
      setSaving(true);

      const { error, data } = await supabase
        .from('sale_tickets')
        .update({
          closed_at: null,
          closed_by: null,
          closed_by_roles: null,
          requires_higher_approval: false,
          approval_status: null,
          approval_deadline: null,
          approved_at: null,
          approved_by: null,
          rejection_reason: null,
          requires_admin_review: false,
        })
        .eq('id', ticketId)
        .select();

      if (error) {
        console.error('Database error reopening ticket:', error);
        throw error;
      }

      await logActivity(ticketId, 'updated', `${session?.display_name} reopened ticket`, {
        reopened: true,
      });

      showToast('Ticket reopened successfully', 'success');
      onClose();
    } catch (error: any) {
      console.error('Error reopening ticket:', error);
      showToast(error?.message || 'Failed to reopen ticket', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitReopenRequest(data: { reason_comment: string; requested_changes_description: string }) {
    if (!canRequestChanges) {
      showToast('You do not have permission to request ticket changes', 'error');
      throw new Error('Permission denied');
    }

    if (!ticketId || !ticket || !session?.employee_id) {
      showToast('Invalid ticket or session', 'error');
      throw new Error('Invalid state');
    }

    try {
      const { data: result, error } = await supabase.rpc('create_ticket_reopen_request', {
        p_ticket_id: ticketId,
        p_reason_comment: data.reason_comment,
        p_requested_changes_description: data.requested_changes_description,
        p_created_by_employee_id: session.employee_id,
      });

      if (error) throw error;

      const response = result as { success: boolean; error?: string; request_id?: string };
      if (!response.success) {
        showToast(response.error || 'Failed to submit request', 'error');
        throw new Error(response.error);
      }

      // Log the activity
      await logActivity(ticketId, 'updated', `${session?.display_name} requested changes to closed ticket`, {
        request_type: 'reopen_request',
        reason: data.reason_comment,
        changes_requested: data.requested_changes_description,
      });

      setHasPendingReopenRequest(true);
      showToast('Change request submitted successfully', 'success');
    } catch (error: any) {
      console.error('Error submitting reopen request:', error);
      throw error;
    }
  }

  async function handleMarkCompleted() {
    if (!canMarkCompleted) {
      showToast('You do not have permission to mark tickets as completed', 'error');
      return;
    }

    if (!ticketId || !ticket) return;

    if (ticket.closed_at) {
      showToast('Cannot mark closed ticket as completed', 'error');
      return;
    }

    if (ticket.completed_at) {
      showToast('Ticket is already marked as completed', 'error');
      return;
    }

    try {
      setSaving(true);

      // Stop all active service timers before marking ticket as completed
      await stopCurrentServiceTimer(ticketId);

      const { error } = await supabase
        .from('sale_tickets')
        .update({
          completed_at: new Date().toISOString(),
          completed_by: session?.employee_id,
        })
        .eq('id', ticketId);

      if (error) throw error;

      await logActivity(ticketId, 'updated', `${session?.display_name} marked ticket as completed`, {
        completed_at: new Date().toISOString(),
      });

      showToast('Ticket marked as completed (all timers stopped)', 'success');
      onClose();
    } catch (error) {
      console.error('Error marking ticket as completed:', error);
      showToast('Failed to mark ticket as completed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTicket() {
    if (!canDelete) {
      showToast('You do not have permission to delete tickets', 'error');
      return;
    }

    if (!ticketId || !ticket) {
      showToast('No ticket to delete', 'error');
      return;
    }

    if (ticket.closed_at) {
      showToast('Cannot delete closed tickets', 'error');
      return;
    }

    try {
      setSaving(true);

      await logActivity(ticketId, 'deleted', `${session?.display_name} deleted ticket`, {
        ticket_no: ticket.ticket_no,
        customer_name: formData.customer_name,
        total: calculateTotal(),
        items_count: items.length,
      });

      const { error } = await supabase
        .from('sale_tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw error;

      showToast('Ticket deleted successfully', 'success');
      onClose();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      showToast('Failed to delete ticket', 'error');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleVoidTicket() {
    if (!canVoid) {
      showToast('You do not have permission to void tickets', 'error');
      return;
    }

    if (!ticketId || !ticket) {
      showToast('No ticket to void', 'error');
      return;
    }

    if (ticket.closed_at) {
      showToast('Cannot void closed tickets', 'error');
      return;
    }

    if (ticket.voided_at) {
      showToast('This ticket is already voided', 'error');
      return;
    }

    if (!voidReason.trim()) {
      setVoidError('Please provide a reason for voiding this ticket');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('sale_tickets')
        .update({
          voided_at: new Date().toISOString(),
          voided_by: session?.employee_id,
          void_reason: voidReason.trim(),
        })
        .eq('id', ticketId);

      if (error) throw error;

      await logActivity(ticketId, 'voided', `${session?.display_name} voided ticket`, {
        ticket_no: ticket.ticket_no,
        void_reason: voidReason.trim(),
      });

      showToast('Ticket voided successfully', 'success');
      onClose();
    } catch (error) {
      console.error('Error voiding ticket:', error);
      showToast('Failed to void ticket', 'error');
    } finally {
      setSaving(false);
      setShowVoidConfirm(false);
      setVoidReason('');
      setVoidError('');
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  function getApprovalStatusBadge() {
    if (!ticket?.approval_status) return null;

    switch (ticket.approval_status) {
      case 'pending_approval': {
        const timeRemaining = getTimeUntilDeadline();
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              <Clock className="w-3 h-3 mr-1" />
              Pending Approval
            </span>
            {timeRemaining && (
              <span className="text-[10px] text-gray-500">
                {timeRemaining === 'Expired' ? 'Auto-approval pending...' : `Auto-approves in ${timeRemaining}`}
              </span>
            )}
          </div>
        );
      }
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {ticket.approved_by ? 'Approved' : 'Auto-Approved'}
          </span>
        );
      case 'auto_approved':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Auto-Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  }

  function getTimeUntilDeadline(): string | null {
    if (!ticket?.approval_deadline || ticket.approval_status !== 'pending_approval') return null;

    const deadline = new Date(ticket.approval_deadline);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 0) return 'Expired';
    if (diffHours < 1) {
      const minutes = Math.floor(diffHours * 60);
      return `${minutes} min remaining`;
    }
    const hours = Math.floor(diffHours);
    const minutes = Math.floor((diffHours - hours) * 60);
    return minutes > 0 ? `${hours}h ${minutes}m remaining` : `${hours}h remaining`;
  }

  if (!ticketId && session && !Permissions.tickets.canCreate(session.role_permission)) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={handleClose}
        />
        <div className="fixed inset-0 md:right-0 md:left-auto md:top-0 h-full w-full md:max-w-4xl bg-white shadow-xl z-50 overflow-y-auto flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 mb-6">
              You do not have permission to create tickets. Only Admin and Receptionist roles can create new tickets.
            </p>
            <Button onClick={handleClose} variant="primary">
              Close
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 md:right-0 md:left-auto md:top-0 h-full w-full md:max-w-2xl bg-white shadow-xl z-50 flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-3 md:px-4 py-3 md:py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {ticketId ? `Ticket ${ticket?.ticket_no}` : 'New Ticket'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {isTicketClosed && !ticket?.approval_status && (
                    <p className="text-xs text-green-600 font-medium">Closed</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getApprovalStatusBadge()}
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-6 h-6 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-2 pb-4 flex-1 overflow-y-auto min-h-0">

          {ticket?.approval_status === 'rejected' && ticket.requires_admin_review && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Ticket Rejected</p>
                  <p className="text-xs text-red-700 mt-1">
                    Reason: {ticket.rejection_reason || 'No reason provided'}
                  </p>
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    This ticket requires admin review before any changes can be made.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isVoided && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">This ticket has been voided</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Reason: {ticket?.void_reason || 'No reason provided'}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Voided on {ticket?.voided_at ? formatDateTimeEST(ticket.voided_at) : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {ticket?.closed_by === session?.employee_id && ticket?.approval_status === 'pending_approval' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">You closed this ticket</p>
                  <p className="text-xs text-blue-700 mt-1">
                    You cannot approve tickets you closed. The assigned technician must approve it.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isSelfServiceMode && !ticketId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 mb-1">
                    Self-Service Mode
                  </p>
                  <p className="text-xs text-green-700">
                    • You can only create new tickets for yourself<br/>
                    • You cannot edit, complete, or close tickets after creation<br/>
                    • Only receptionists and managers can modify tickets
                  </p>
                </div>
              </div>
            </div>
          )}

          {isReadOnly &&
           ticket?.opened_by_role &&
           (ticket.opened_by_role === 'Technician' || ticket.opened_by_role === 'Trainee') &&
           session?.employee_id === ticket.created_by && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">View Only</p>
                  <p className="text-xs text-blue-700 mt-1">
                    You can only view this ticket. You cannot edit, complete, or close it. Contact a receptionist or manager for any changes.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
            {isEditingOpeningTime ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <label className="text-xs font-medium text-gray-700 flex-shrink-0">
                    Start at
                  </label>
                  <input
                    type="datetime-local"
                    value={tempOpeningTime}
                    onChange={(e) => setTempOpeningTime(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveOpeningTime}
                    className="flex-1"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCancelEditOpeningTime}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : !ticketId ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                <label className="text-xs font-medium text-gray-700 flex-shrink-0">
                  Start at
                </label>
                <input
                  type="datetime-local"
                  value={convertToESTDatetimeString(formData.opening_time || new Date().toISOString())}
                  onChange={(e) => {
                    const utcDateString = convertESTDatetimeStringToUTC(e.target.value);
                    setFormData({ ...formData, opening_time: utcDateString });
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isReadOnly}
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {/* Left side: Start at and End at */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {/* Start at */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <label className="text-xs font-medium text-gray-700 flex-shrink-0">
                      Start at
                    </label>
                    <p className="text-sm text-gray-900 font-medium flex-shrink-0">
                      {formData.opening_time ? formatDateTimeEST(formData.opening_time) : 'Not set'}
                    </p>
                    {!isReadOnly && session && session.role_permission && (
                      Permissions.tickets.canEdit(session.role_permission, false, false) && !isEditingOpeningTime && (
                        <button
                          type="button"
                          onClick={handleEditOpeningTime}
                          className="text-blue-600 hover:text-blue-700 p-1 rounded transition-colors"
                          title="Edit opening time"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>

                  {/* Divider between Start and End */}
                  {(ticket?.completed_at || ticket?.closed_at) && (
                    <div className="hidden sm:block w-px h-6 bg-gray-300" />
                  )}

                  {/* End at */}
                  {(ticket?.completed_at || ticket?.closed_at) && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                      <label className="text-xs font-medium text-gray-700 flex-shrink-0">
                        End at
                      </label>
                      <p className="text-sm text-gray-900 font-medium flex-shrink-0">
                        {ticket.completed_at ? formatDateTimeEST(ticket.completed_at) : 'Not completed'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right side: Total Time */}
                {ticketId && items.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <label className="text-xs font-medium text-gray-700 flex-shrink-0">
                      Total Time
                    </label>
                    <p className={`text-sm font-medium flex-shrink-0 ${
                      items.some((item: any) => item.started_at && !item.timer_stopped_at && !item.completed_at)
                        ? 'text-blue-700'
                        : 'text-gray-900'
                    }`}>
                      {formatTimerDisplay(calculateTotalTimerDuration(currentTime))}
                    </p>
                    {items.some((item: any) => item.started_at && !item.timer_stopped_at && !item.completed_at) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        Active
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-2 bg-purple-50">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Customer Type <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, customer_type: 'Appointment' })}
                className={`flex-1 py-3 md:py-1.5 px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 ${
                  formData.customer_type === 'Appointment'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-600'
                }`}
                disabled={isTicketClosed || isReadOnly}
              >
                Appointment
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, customer_type: 'Assigned' })}
                className={`flex-1 py-3 md:py-1.5 px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 ${
                  formData.customer_type === 'Assigned'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-600'
                }`}
                disabled={isTicketClosed || isReadOnly}
              >
                Assigned
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, customer_type: 'Requested' })}
                className={`flex-1 py-3 md:py-1.5 px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 ${
                  formData.customer_type === 'Requested'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-600'
                }`}
                disabled={isTicketClosed || isReadOnly}
              >
                Requested
              </button>
            </div>

            {/* Customer Info Fields */}
            {(showCustomerName || showCustomerPhone || showTodaysColor) && (
              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {showCustomerPhone && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">
                        Customer Phone {requireCustomerPhone && <span className="text-red-600">*</span>}
                      </label>
                      <div className="relative">
                        {isRestrictedCustomerInfoRole ? (
                          <input
                            type="text"
                            value={formData.customer_phone ? maskPhoneNumber(formData.customer_phone) : ''}
                            disabled
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                          />
                        ) : shouldMaskPhone ? (
                          <input
                            type="text"
                            value={formData.customer_phone ? maskPhoneNumber(formData.customer_phone) : ''}
                            disabled
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                          />
                        ) : (
                          <>
                            <input
                              type="tel"
                              value={formatPhoneNumber(formData.customer_phone)}
                              onChange={(e) => {
                                const digits = normalizePhoneNumber(e.target.value);
                                setFormData({ ...formData, customer_phone: digits });
                              }}
                              disabled={isTicketClosed || isReadOnly}
                              placeholder="(514) 123-4567"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            {clientLookup.isLoading && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {/* Client status indicator - hidden for restricted roles and masked phone */}
                      {!isRestrictedCustomerInfoRole && !shouldMaskPhone && showCustomerPhone && hasEnoughDigitsForLookup(formData.customer_phone) && !clientLookup.isLoading && !isTicketClosed && !isVoided && (
                        <div className="mt-1">
                          {linkedClient ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                              <User className="w-3 h-3" />
                              Existing Client
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowQuickAddClient(true)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors"
                            >
                              <UserPlus className="w-3 h-3" />
                              + Add New Client
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {showCustomerName && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">
                        Customer Name {requireCustomerName && <span className="text-red-600">*</span>}
                      </label>
                      <input
                        type="text"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        disabled={isTicketClosed || isReadOnly || isRestrictedCustomerInfoRole}
                        placeholder="Enter customer name"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      {isRestrictedCustomerInfoRole && (
                        <p className="text-xs text-gray-500 mt-1">Contact front desk to update</p>
                      )}
                    </div>
                  )}
                  {showTodaysColor && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">
                        Today's Color {requireTodaysColor && <span className="text-red-600">*</span>}
                      </label>
                      <input
                        type="text"
                        value={formData.todays_color}
                        onChange={(e) => setFormData({ ...formData, todays_color: e.target.value })}
                        disabled={!canEditTodaysColor || isVoided}
                        placeholder="Enter color"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>

                {/* Blacklist Warning - hidden for restricted roles */}
                {!isRestrictedCustomerInfoRole && linkedClient?.is_blacklisted && (
                  <BlacklistWarning
                    client={linkedClient}
                    blacklistedByName={blacklistedByName}
                  />
                )}

                {/* Last Color Used - hidden for restricted roles */}
                {!isRestrictedCustomerInfoRole && linkedClient && clientLookup.lastColor && !isTicketClosed && !isVoided && (
                  <ColorDisplay
                    colorHistory={clientLookup.lastColor}
                    compact={true}
                  />
                )}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-blue-50">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Technician <span className="text-red-600">*</span>
            </label>

            {employees.length === 0 && !isTicketClosed && !isVoided && (
              <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  No employees scheduled for {getFullDayName(getDayOfWeek(selectedDate))}. Please update employee schedules.
                </p>
              </div>
            )}

            {!isTicketClosed && !isVoided ? (
              <TechnicianQueue
                sortedTechnicians={
                  session?.role && Permissions.tickets.canViewAllTechniciansInEditor(session.role)
                    ? sortedTechnicians
                    : sortedTechnicians.filter(t => t.employee_id === session?.employee_id)
                }
                selectedTechnicianId={selectedTechnicianId}
                onTechnicianSelect={handleTechnicianSelect}
                isReadOnly={isReadOnly}
                showLegend={true}
                currentTime={currentTime}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {items.length > 0 && Array.from(new Set(items.map(item => item.employee_id))).map((employeeId) => {
                  const item = items.find(i => i.employee_id === employeeId);
                  if (!item?.employee) return null;
                  return (
                    <div
                      key={employeeId}
                      className="py-3 md:py-1.5 px-4 md:px-3 text-sm rounded-lg font-medium bg-gray-100 text-gray-700 min-h-[48px] md:min-h-0 flex items-center"
                    >
                      {item.employee.display_name}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-2 bg-yellow-50">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Service Item <span className="text-red-600">*</span>
            </label>
            {items.length === 0 ? (
              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                {!isTicketClosed && !isVoided && services.length > 0 && (
                  <>
                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {categoryOptions.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setSelectedCategory(category)}
                          className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                            selectedCategory === category
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {category === 'all' ? 'Popular' : category}
                        </button>
                      ))}
                    </div>

                    {/* Service Buttons - Top 10 for Popular, all for other categories */}
                    <div className="flex flex-wrap gap-2">
                      {services
                        .filter(service => selectedCategory === 'all' || service.category === selectedCategory)
                        .filter(service => canEmployeePerformService(selectedTechnicianId || lastUsedEmployeeId, service.service_id))
                        .slice(0, selectedCategory === 'all' ? 10 : undefined)
                        .map((service) => (
                      <button
                        key={service.store_service_id}
                        type="button"
                        onClick={() => {
                          const employeeId = selectedTechnicianId || lastUsedEmployeeId;
                          if (!employeeId) {
                            showToast('Please wait while loading employee data', 'error');
                            return;
                          }
                          setItems([{
                            service_id: service.service_id,
                            employee_id: employeeId,
                            qty: '1',
                            price_each: service.price.toString(),
                            tip_customer: '0',
                            tip_receptionist: '0',
                            addon_details: '',
                            addon_price: '0',
                            service: service as any,
                            is_custom: false,
                          }]);
                        }}
                        className={`py-3 md:py-1.5 px-4 md:px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 ${getServiceColor(service.category)}`}
                      >
                        {service.code}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const employeeId = selectedTechnicianId || lastUsedEmployeeId;
                        if (!employeeId) {
                          showToast('Please wait while loading employee data', 'error');
                          return;
                        }
                        setShowCustomService(true);
                        setItems([{
                          service_id: '',
                          employee_id: employeeId,
                          qty: '1',
                          price_each: '0',
                          tip_customer: '0',
                          tip_receptionist: '0',
                          addon_details: '',
                          addon_price: '0',
                          is_custom: true,
                          custom_service_name: '',
                        }]);
                      }}
                      className="py-3 md:py-1.5 px-4 md:px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 bg-gray-100 text-gray-800 hover:bg-gray-200 border-2 border-gray-300"
                    >
                      CUSTOM
                    </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-2 space-y-2 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600">
                        Service {items.length > 1 ? `#${index + 1}` : ''}
                      </span>
                      {canEditServices && items.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Service Timer Display */}
                    {ticketId && (item as any).started_at ? (
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                        (item as any).timer_stopped_at || (item as any).completed_at
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-blue-50 text-blue-700 font-medium'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span>Timer: {formatTimerDisplay(calculateServiceDuration(item, currentTime))}</span>
                        {!(item as any).timer_stopped_at && !(item as any).completed_at && (
                          <span className="ml-auto text-[10px]">(Active)</span>
                        )}
                      </div>
                    ) : !ticketId ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-gray-50 text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Timer starts on save</span>
                      </div>
                    ) : null}

                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {item.is_custom ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-0.5">
                              Service Name
                            </label>
                            <input
                              type="text"
                              value={item.custom_service_name || ''}
                              onChange={(e) => {
                                const updatedItems = [...items];
                                updatedItems[index].custom_service_name = e.target.value;
                                setItems(updatedItems);
                              }}
                              className="w-full px-3 py-3 md:py-1.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] md:min-h-0"
                              placeholder="Enter custom service name"
                              disabled={!canEditServices || isTicketClosed || isVoided}
                            />
                          </div>
                        ) : (
                          <Select
                            label="Service"
                            value={item.service_id}
                            onChange={(e) => updateItem(index, 'service_id', e.target.value)}
                            disabled={!canEditServices || isVoided}
                          >
                            <option value="">-- Select Service --</option>
                            {categoryOptions
                              .filter(cat => cat !== 'all')
                              .map(category => {
                                const categoryServices = services
                                  .filter(s => s.category === category)
                                  .filter(s => canEmployeePerformService(item?.employee_id || selectedTechnicianId || lastUsedEmployeeId, s.id))
                                  .sort((a, b) => b.price - a.price);
                                if (categoryServices.length === 0) return null;
                                return (
                                  <optgroup key={category} label={category}>
                                    {categoryServices.map(s => (
                                      <option key={s.id} value={s.id}>
                                        {s.code} - {s.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                );
                              })}
                          </Select>
                        )}
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">
                          Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 z-10">$</span>
                          <NumericInput
                            step="0.01"
                            min="0"
                            value={item.price_each}
                            onChange={(e) =>
                              updateItem(index, 'price_each', e.target.value)
                            }
                            className="pl-6 pr-2"
                            disabled={isTicketClosed || isReadOnly}
                          />
                        </div>
                      </div>
                      {canEditServices && items.length === 1 && (
                        <div className="flex items-end">
                          <button
                            onClick={() => {
                              setItems([]);
                              setShowCustomService(false);
                            }}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Add-ons
                        </label>
                        <Input
                          value={item.addon_details}
                          onChange={(e) =>
                            updateItem(index, 'addon_details', e.target.value)
                          }
                          placeholder="Enter add-on details"
                          disabled={isTicketClosed || isReadOnly}
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">
                          Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 z-10">$</span>
                          <NumericInput
                            step="0.01"
                            min="0"
                            value={item.addon_price}
                            onChange={(e) =>
                              updateItem(index, 'addon_price', e.target.value)
                            }
                            className="pl-6 pr-2"
                            disabled={isTicketClosed || isReadOnly}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {canEditServices && !isVoided && (
                  <button
                    type="button"
                    onClick={() => {
                      const employeeId = selectedTechnicianId || lastUsedEmployeeId;
                      if (!employeeId) {
                        showToast('Please select a technician first', 'error');
                        return;
                      }
                      setItems([
                        ...items,
                        {
                          service_id: '',
                          employee_id: employeeId,
                          qty: '1',
                          price_each: '0',
                          tip_customer: '0',
                          tip_receptionist: '0',
                          addon_details: '',
                          addon_price: '0',
                          is_custom: false,
                        }
                      ]);
                    }}
                    className="w-full py-3 md:py-2 px-4 text-sm font-medium text-blue-700 bg-blue-50 border-2 border-blue-300 border-dashed rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Service
                  </button>
                )}
              </div>
            )}
          </div>

          {ticketId && !isRestrictedCustomerInfoRole && canSelectPaymentMethod && (
            <div className="border border-gray-200 rounded-lg p-2 bg-green-50">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Payment Method <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2.5">
                {enableCashPayments && (
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodClick('Cash')}
                    disabled={isTicketClosed || isReadOnly}
                    className={`relative p-2.5 rounded-lg border-2 transition-all duration-200 ${
                      formData.payment_method === 'Cash'
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-300 bg-white hover:border-green-400 hover:bg-green-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <Banknote className={`w-6 h-6 ${formData.payment_method === 'Cash' ? 'text-green-600' : 'text-gray-600'}`} />
                      <span className={`text-xs font-semibold ${formData.payment_method === 'Cash' ? 'text-green-700' : 'text-gray-700'}`}>
                        Cash
                      </span>
                    </div>
                    {formData.payment_method === 'Cash' && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    )}
                  </button>
                )}

                {enableCardPayments && (
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodClick('Card')}
                    disabled={isTicketClosed || isReadOnly}
                    className={`relative p-2.5 rounded-lg border-2 transition-all duration-200 ${
                      formData.payment_method === 'Card'
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <CreditCard className={`w-6 h-6 ${formData.payment_method === 'Card' ? 'text-blue-600' : 'text-gray-600'}`} />
                      <span className={`text-xs font-semibold ${formData.payment_method === 'Card' ? 'text-blue-700' : 'text-gray-700'}`}>
                        Card
                      </span>
                    </div>
                    {formData.payment_method === 'Card' && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      </div>
                    )}
                  </button>
                )}

                {enableMixedPayments && (
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodClick('Mixed')}
                    disabled={isTicketClosed || isReadOnly}
                    className={`relative p-2.5 rounded-lg border-2 transition-all duration-200 ${
                      formData.payment_method === 'Mixed'
                        ? 'border-teal-500 bg-teal-50 shadow-md'
                        : 'border-gray-300 bg-white hover:border-teal-400 hover:bg-teal-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1">
                        <Banknote className={`w-5 h-5 ${formData.payment_method === 'Mixed' ? 'text-teal-600' : 'text-gray-600'}`} />
                        <CreditCard className={`w-5 h-5 ${formData.payment_method === 'Mixed' ? 'text-teal-600' : 'text-gray-600'}`} />
                      </div>
                      <span className={`text-xs font-semibold ${formData.payment_method === 'Mixed' ? 'text-teal-700' : 'text-gray-700'}`}>
                        Mixed
                      </span>
                    </div>
                    {formData.payment_method === 'Mixed' && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                      </div>
                    )}
                  </button>
                )}
              </div>

              {isTicketClosed && formData.payment_method && canViewPaymentDetailsWhenClosed && (
                <button
                  type="button"
                  onClick={handleViewPaymentDetails}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Payment Details
                </button>
              )}

            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes / Comments{hasRequiresPhotosService && !ticketId && <span className="text-red-500"> *</span>}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={hasRequiresPhotosService && !ticketId ? 2 : 1}
              className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                hasRequiresPhotosService && !ticketId && (!formData.notes || formData.notes.trim() === '')
                  ? 'border-red-300'
                  : 'border-gray-300'
              }`}
              disabled={!canEditNotes}
              placeholder={canEditNotes ? (hasRequiresPhotosService && !ticketId ? "Notes required for this service..." : "Add notes or comments...") : ""}
            />
          </div>

          {/* Photos Section */}
          {(ticketId || (!ticketId && hasRequiresPhotosService)) && selectedStoreId && (
            <TicketPhotosSection
              ref={photosSectionRef}
              storeId={selectedStoreId}
              ticketId={ticketId || null}
              readOnly={isReadOnly}
            />
          )}

        </div>
        <div className="flex justify-between items-center gap-3 border-t border-gray-200 bg-white p-3 flex-shrink-0">
            <div className="flex gap-2.5">
              <button
                onClick={onClose}
                className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium min-h-[44px] md:min-h-0"
              >
                Close
              </button>
              {!isTicketClosed && (!isReadOnly || isVoided) && canDelete && ticketId && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium min-h-[44px] md:min-h-0"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              {!isTicketClosed && !isVoided && !isReadOnly && canVoid && !canDelete && ticketId && (
                <button
                  onClick={() => { setShowVoidConfirm(true); setVoidReason(''); setVoidError(''); }}
                  disabled={saving}
                  className="px-3 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium min-h-[44px] md:min-h-0"
                >
                  <XCircle className="w-4 h-4" />
                  Void
                </button>
              )}
              {!isTicketClosed && !isReadOnly && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium min-h-[44px] md:min-h-0"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  {ticketId && !ticket?.completed_at && canMarkCompleted && (
                    <button
                      onClick={handleMarkCompleted}
                      disabled={saving}
                      className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium min-h-[44px] md:min-h-0"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete
                    </button>
                  )}
                  {ticketId && (
                    <button
                      onClick={handleCloseTicket}
                      disabled={saving}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium min-h-[44px] md:min-h-0"
                    >
                      Close Ticket
                    </button>
                  )}
                </>
              )}
              {isTicketClosed && canReopen && ticketId && (
                <button
                  onClick={handleReopenTicket}
                  disabled={saving}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium min-h-[44px] md:min-h-0"
                >
                  {saving ? 'Reopening...' : 'Reopen Ticket'}
                </button>
              )}
              {isTicketClosed && !canReopen && canRequestChanges && ticketId && (
                <button
                  onClick={() => setShowRequestChangesModal(true)}
                  disabled={saving || hasPendingReopenRequest}
                  className="px-3 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium min-h-[44px] md:min-h-0"
                >
                  {hasPendingReopenRequest ? 'Request Pending' : 'Request Changes'}
                </button>
              )}
              {isReadOnly && canEditNotes && ticketId && !canReopen && (
                <button
                  onClick={handleSaveComment}
                  disabled={saving}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium min-h-[44px] md:min-h-0"
                >
                  {saving ? 'Saving...' : 'Save Comment'}
                </button>
              )}
            </div>
            {ticketId && activityLogs.length > 0 && (
              <button
                onClick={() => setShowActivityModal(true)}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center gap-1 font-medium min-h-[44px] md:min-h-0"
              >
                <Clock className="w-4 h-4" />
                Activity
              </button>
            )}
          </div>
      </div>

      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="Ticket Activity Log"
      >
        <div className="space-y-3">
          {activityLogs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No activity logs yet</p>
          ) : (
            activityLogs.map((log) => (
              <div key={log.id} className="border-l-4 border-blue-500 bg-gray-50 px-4 py-3 rounded-r-lg">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                      log.action === 'created' ? 'bg-green-100 text-green-800' :
                      log.action === 'updated' ? 'bg-blue-100 text-blue-800' :
                      log.action === 'closed' ? 'bg-gray-100 text-gray-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {log.employee?.display_name || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDateTimeEST(log.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{log.description}</p>
                {log.changes && Object.keys(log.changes).length > 0 && (() => {
                  const shouldShowValue = (value: any): boolean => {
                    if (value === null || value === undefined) return false;

                    if (typeof value === 'number') {
                      return value !== 0;
                    }

                    if (typeof value === 'string') {
                      const trimmed = value.trim();
                      return trimmed !== '' && trimmed !== '0' && trimmed !== '0.00';
                    }

                    if (typeof value === 'boolean') {
                      return value === true;
                    }

                    if (Array.isArray(value)) {
                      return value.length > 0;
                    }

                    if (typeof value === 'object') {
                      return Object.keys(value).length > 0;
                    }

                    return true;
                  };

                  const filteredChanges = Object.entries(log.changes).filter(
                    ([key, value]) =>
                      !['customer_name', 'ticket_no', 'closed_by_roles'].includes(key) &&
                      shouldShowValue(value)
                  );

                  const formatValue = (key: string, value: any): string => {
                    const monetaryFields = [
                      'total', 'payment_cash', 'payment_card', 'payment_gift_card',
                      'tip_customer_cash', 'tip_customer_card', 'tip_receptionist',
                      'discount_amount'
                    ];

                    if (monetaryFields.includes(key) && typeof value === 'number') {
                      return `$${value.toFixed(2)}`;
                    }

                    if (key === 'discount_percentage' && typeof value === 'number') {
                      return `${value}%`;
                    }

                    if (typeof value === 'object' && value !== null) {
                      return JSON.stringify(value);
                    }

                    return String(value);
                  };

                  const formatFieldName = (key: string): string => {
                    return key
                      .split('_')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');
                  };

                  return filteredChanges.length > 0 ? (
                    <div className="mt-2 text-xs text-gray-600 bg-white px-2 py-1 rounded">
                      {filteredChanges.map(([key, value]) => (
                        <div key={key} className="py-0.5">
                          <strong className="text-gray-700">{formatFieldName(key)}:</strong>{' '}
                          <span className="text-gray-900">{formatValue(key, value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Ticket"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 mb-1">
                Warning: This action cannot be undone
              </p>
              <p className="text-sm text-red-700">
                You are about to permanently delete this open ticket. All ticket information and associated items will be removed.
              </p>
            </div>
          </div>

          {ticket && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ticket Number:</span>
                <span className="font-medium text-gray-900">{ticket.ticket_no}</span>
              </div>
              {formData.customer_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium text-gray-900">{formData.customer_name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium text-gray-900">${calculateTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Services:</span>
                <span className="font-medium text-gray-900">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <button
              onClick={handleDeleteTicket}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {saving ? 'Deleting...' : 'Delete Ticket'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showVoidConfirm}
        onClose={() => { setShowVoidConfirm(false); setVoidReason(''); setVoidError(''); }}
        title="Void Ticket"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 mb-1">
                Warning: This ticket will be voided
              </p>
              <p className="text-sm text-amber-700">
                The ticket will be marked as voided and excluded from all financial reports. This action can only be reversed by an administrator.
              </p>
            </div>
          </div>

          {ticket && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ticket Number:</span>
                <span className="font-medium text-gray-900">{ticket.ticket_no}</span>
              </div>
              {formData.customer_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium text-gray-900">{formData.customer_name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium text-gray-900">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for voiding <span className="text-red-500">*</span>
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => { setVoidReason(e.target.value); setVoidError(''); }}
              placeholder="Please explain why you are voiding this ticket..."
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                voidError ? 'border-red-300' : 'border-gray-300'
              }`}
              rows={3}
            />
            {voidError && (
              <p className="text-xs text-red-600 mt-1">{voidError}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setShowVoidConfirm(false); setVoidReason(''); setVoidError(''); }}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <button
              onClick={handleVoidTicket}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {saving ? 'Voiding...' : 'Void Ticket'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showPaymentModal}
        onClose={handlePaymentModalCancel}
        title={`Payment Details - ${formData.payment_method}`}
        size="lg"
        className="max-h-[98vh]"
      >
        <div className="space-y-4">
          {hasExistingPaymentData() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Previously Saved Payment Details</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  The fields below are pre-filled with previously saved payment information. You can review and modify as needed.
                </p>
              </div>
            </div>
          )}
          <div className={formData.payment_method === 'Mixed' ? 'grid grid-cols-1 md:grid-cols-3 gap-3' : 'grid grid-cols-1 gap-3'}>
            {(formData.payment_method === 'Cash' || formData.payment_method === 'Mixed') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-600" />
                  Cash Payment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">$</span>
                  <NumericInput
                    step="0.01"
                    min="0"
                    value={tempPaymentData.payment_cash}
                    onChange={(e) =>
                      setTempPaymentData({ ...tempPaymentData, payment_cash: e.target.value })
                    }
                    className="pl-8 pr-3"
                    placeholder="0.00"
                    disabled={isTicketClosed || isReadOnly}
                  />
                </div>
                {formData.payment_method === 'Cash' && tempPaymentData.payment_cash && parseFloat(tempPaymentData.payment_cash) === calculateSubtotal() && calculateSubtotal() > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Prefilled with service subtotal</p>
                )}
              </div>
            )}

            {(formData.payment_method === 'Card' || formData.payment_method === 'Mixed') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Card Payment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">$</span>
                  <NumericInput
                    step="0.01"
                    min="0"
                    value={tempPaymentData.payment_card}
                    onChange={(e) =>
                      setTempPaymentData({ ...tempPaymentData, payment_card: e.target.value })
                    }
                    className="pl-8 pr-3"
                    placeholder="0.00"
                    disabled={isTicketClosed || isReadOnly}
                  />
                </div>
                {formData.payment_method === 'Card' && tempPaymentData.payment_card && parseFloat(tempPaymentData.payment_card) === calculateSubtotal() && calculateSubtotal() > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Prefilled with service subtotal</p>
                )}
              </div>
            )}

            {formData.payment_method === 'Mixed' && enableGiftCardPayments && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-purple-600" />
                  Gift Card Payment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">$</span>
                  <NumericInput
                    step="0.01"
                    min="0"
                    value={tempPaymentData.payment_gift_card}
                    onChange={(e) =>
                      setTempPaymentData({ ...tempPaymentData, payment_gift_card: e.target.value })
                    }
                    className="pl-8 pr-3"
                    placeholder="0.00"
                    disabled={isTicketClosed || isReadOnly}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              {formData.payment_method === 'Cash' ? 'Cash Discounts' : 'Discounts'}
            </h4>

            {formData.payment_method === 'Cash' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cash Discount Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">$</span>
                      <NumericInput
                        step="0.01"
                        min="0"
                        value={tempPaymentData.discount_amount_cash}
                        onChange={(e) =>
                          setTempPaymentData({ ...tempPaymentData, discount_amount_cash: e.target.value })
                        }
                        className="pl-8 pr-3"
                        placeholder="0.00"
                        disabled={isTicketClosed || isReadOnly}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cash Discount Percentage
                    </label>
                    <div className="relative">
                      <NumericInput
                        step="0.01"
                        min="0"
                        max="100"
                        value={tempPaymentData.discount_percentage_cash}
                        onChange={(e) => {
                          const percentage = parseFloat(e.target.value) || 0;
                          const paymentCash = parseFloat(tempPaymentData.payment_cash) || 0;
                          const calculatedAmount = (paymentCash * percentage / 100).toFixed(2);
                          setTempPaymentData({
                            ...tempPaymentData,
                            discount_percentage_cash: e.target.value,
                            discount_amount_cash: calculatedAmount
                          });
                        }}
                        className="pl-3 pr-8"
                        placeholder="0"
                        disabled={isTicketClosed || isReadOnly}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">%</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">$</span>
                    <NumericInput
                      step="0.01"
                      min="0"
                      value={tempPaymentData.discount_amount}
                      onChange={(e) =>
                        setTempPaymentData({ ...tempPaymentData, discount_amount: e.target.value })
                      }
                      className="pl-8 pr-3"
                      placeholder="0.00"
                      disabled={isTicketClosed || isReadOnly}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Percentage
                  </label>
                  <div className="relative">
                    <NumericInput
                      step="0.01"
                      min="0"
                      max="100"
                      value={tempPaymentData.discount_percentage}
                      onChange={(e) => {
                        const percentage = parseFloat(e.target.value) || 0;
                        const subtotal = calculateSubtotal();
                        const calculatedAmount = (subtotal * percentage / 100).toFixed(2);
                        setTempPaymentData({
                          ...tempPaymentData,
                          discount_percentage: e.target.value,
                          discount_amount: calculatedAmount
                        });
                      }}
                      className="pl-3 pr-8"
                      placeholder="0"
                      disabled={isTicketClosed || isReadOnly}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!hideTips && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Tips</h4>

              <div className={formData.payment_method === 'Mixed' ? 'grid grid-cols-1 md:grid-cols-3 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
                {(formData.payment_method === 'Cash' || formData.payment_method === 'Mixed') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tip (Cash) by Customer
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">$</span>
                      <NumericInput
                        step="0.01"
                        min="0"
                        value={tempPaymentData.tip_customer_cash}
                        onChange={(e) =>
                          setTempPaymentData({ ...tempPaymentData, tip_customer_cash: e.target.value })
                        }
                        className="pl-8 pr-3"
                        placeholder="All tips must be distributed to technicians"
                        disabled={true}
                      />
                    </div>
                  </div>
                )}

                {(formData.payment_method === 'Card' || formData.payment_method === 'Mixed') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tip (Card) by Customer
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">$</span>
                      <NumericInput
                        step="0.01"
                        min="0"
                        value={tempPaymentData.tip_customer_card}
                        onChange={(e) =>
                          setTempPaymentData({ ...tempPaymentData, tip_customer_card: e.target.value })
                        }
                        className="pl-8 pr-3"
                        placeholder="0.00"
                        disabled={isTicketClosed || isReadOnly}
                      />
                    </div>
                  </div>
                )}

                {(() => {
                  const isTipPairedEnabled = items.some(item => {
                    const employee = employees.find(emp => emp.id === item.employee_id);
                    return employee?.tip_paired_enabled !== false;
                  });

                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tip Paired by Receptionist
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">$</span>
                        <NumericInput
                          step="0.01"
                          min="0"
                          value={tempPaymentData.tip_receptionist}
                          onChange={(e) =>
                            setTempPaymentData({ ...tempPaymentData, tip_receptionist: e.target.value })
                          }
                          disabled={isTicketClosed || isReadOnly || !isTipPairedEnabled}
                          className="pl-8 pr-3"
                          placeholder="0.00"
                        />
                      </div>
                      {!isTipPairedEnabled && (
                        <p className="text-xs text-gray-500 mt-1">Tip pairing is disabled for all employees on this ticket</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50">
            <h4 className="text-xs font-semibold text-gray-700 mb-1.5">Payment Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Payments:</span>
                <span className="font-semibold text-gray-900">${calculateTotalPayments().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Total Discounts:</span>
                <span className="font-semibold">-${calculateTotalDiscount().toFixed(2)}</span>
              </div>
              {!hideTips && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Tips Given by Clients:</span>
                  <span className="font-semibold text-gray-900">${calculateTipsExcludingReceptionist().toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-base font-bold text-blue-700 pt-2 border-t border-gray-300 mt-2">
                <span>Grand Total Collected:</span>
                <span>${calculateTotalCollected().toFixed(2)}</span>
              </div>
              {!hideTips && (
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Total Tips Paired by Receptionist:</span>
                  <span className="font-semibold">${(parseFloat(formData.tip_receptionist) || 0).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handlePaymentModalCancel}
              variant="outline"
              className="flex-1"
            >
              {isTicketClosed ? 'Close' : 'Cancel'}
            </Button>
            {!isTicketClosed && (
              <Button
                onClick={handlePaymentModalSave}
                variant="primary"
                className="flex-1"
              >
                Save Payment Details
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Ticket Reopen Request Modal */}
      <TicketReopenRequestModal
        isOpen={showRequestChangesModal}
        onClose={() => setShowRequestChangesModal(false)}
        onSubmit={handleSubmitReopenRequest}
        ticket={ticket ? {
          id: ticket.id,
          ticket_no: ticket.ticket_no,
          customer_name: ticket.customer_name || '',
          total: ticket.total || 0,
          ticket_date: ticket.ticket_date,
        } : null}
        currentRole={session?.role_permission}
      />

      {/* Quick Add Client Modal */}
      {selectedStoreId && (
        <QuickAddClientModal
          isOpen={showQuickAddClient}
          onClose={() => setShowQuickAddClient(false)}
          onSuccess={(client) => {
            setLinkedClient(client);
            setFormData(prev => ({ ...prev, customer_name: client.name }));
            setShowQuickAddClient(false);
          }}
          phoneNumber={formData.customer_phone}
          storeId={selectedStoreId}
        />
      )}
    </>
  );
}
