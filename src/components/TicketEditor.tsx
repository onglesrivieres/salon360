import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Banknote, CreditCard, Clock, Award, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import {
  supabase,
  SaleTicket,
  TicketItemWithDetails,
  Service,
  Technician,
  TicketActivityLog,
  TechnicianWithQueue,
} from '../lib/supabase';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';

interface TicketEditorProps {
  ticketId: string | null;
  onClose: () => void;
  selectedDate: string;
}

interface TicketItemForm {
  id?: string;
  service_id: string;
  employee_id: string;
  qty: string;
  price_each: string;
  tip_customer: string;
  tip_receptionist: string;
  tip_customer_card: string;
  tip_receptionist_card: string;
  addon_details: string;
  addon_price: string;
  service?: Service;
  employee?: Technician;
}

export function TicketEditor({ ticketId, onClose, selectedDate }: TicketEditorProps) {
  const [ticket, setTicket] = useState<SaleTicket | null>(null);
  const [items, setItems] = useState<TicketItemForm[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Technician[]>([]);
  const [sortedTechnicians, setSortedTechnicians] = useState<TechnicianWithQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [lastUsedEmployeeId, setLastUsedEmployeeId] = useState<string>('');
  const [activityLogs, setActivityLogs] = useState<TicketActivityLog[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  const isApproved = ticket?.approval_status === 'approved' || ticket?.approval_status === 'auto_approved';

  const isReadOnly = ticket && session && session.role && !Permissions.tickets.canEdit(
    session.role,
    !!ticket.closed_at,
    isApproved
  );

  const canEditNotes = session && session.role && ticket && Permissions.tickets.canEditNotes(
    session.role,
    !!ticket.closed_at
  );

  const canClose = session && session.role && Permissions.tickets.canClose(session.role);

  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');

  const calculateTimeRemaining = (tech: TechnicianWithQueue): string => {
    if (!tech.ticket_start_time || !tech.estimated_duration_min) {
      return '';
    }

    const startTime = new Date(tech.ticket_start_time);
    const now = new Date();
    const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
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

  const [formData, setFormData] = useState({
    customer_type: '' as '' | 'Appointment' | 'Requested' | 'Assigned',
    customer_name: '',
    customer_phone: '',
    payment_method: '' as '' | SaleTicket['payment_method'],
    tip_customer: '0',
    tip_receptionist: '0',
    addon_details: '',
    addon_price: '0',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [ticketId]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchSortedTechnicians();

      const queueChannel = supabase
        .channel(`ready-queue-${selectedStoreId}`)
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
  }, [selectedStoreId]);

  async function fetchSortedTechnicians() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase.rpc('get_sorted_technicians_for_store', {
        p_store_id: selectedStoreId
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

      const [servicesRes, employeesRes] = await Promise.all([
        supabase.rpc('get_services_by_popularity', {
          p_store_id: selectedStoreId || null
        }),
        supabase
          .from('employees')
          .select('*')
          .or('status.eq.Active,status.eq.active')
          .order('display_name'),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setServices(servicesRes.data || []);

      const allEmployees = (employeesRes.data || []).filter(emp =>
        emp.role.includes('Technician')
      );
      const filteredEmployees = selectedStoreId
        ? allEmployees.filter(emp => !emp.store_id || emp.store_id === selectedStoreId)
        : allEmployees;

      setEmployees(filteredEmployees);

      if (filteredEmployees.length > 0) {
        setLastUsedEmployeeId(filteredEmployees[0].id);
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
              service:services(*),
              employee:employees(*)
            )
          `
          )
          .eq('id', ticketId)
          .single();

        if (ticketError) throw ticketError;

        setTicket(ticketData);

        const ticketItems = (ticketData as any).ticket_items || [];
        const firstItem = ticketItems[0];

        setFormData({
          customer_type: ticketData.customer_type || '',
          customer_name: ticketData.customer_name,
          customer_phone: ticketData.customer_phone || '',
          payment_method: ticketData.payment_method || '',
          tip_customer: firstItem?.tip_customer?.toString() || '0',
          tip_receptionist: firstItem?.tip_receptionist?.toString() || '0',
          addon_details: firstItem?.addon_details || '',
          addon_price: firstItem?.addon_price?.toString() || '0',
          notes: ticketData.notes,
        });

        setItems(
          ticketItems.map((item: any) => ({
            id: item.id,
            service_id: item.service_id,
            employee_id: item.employee_id,
            qty: item.qty.toString(),
            price_each: item.price_each.toString(),
            tip_customer: item.tip_customer?.toString() || '0',
            tip_receptionist: item.tip_receptionist?.toString() || '0',
            tip_customer_card: item.tip_customer_card?.toString() || '0',
            tip_receptionist_card: item.tip_receptionist_card?.toString() || '0',
            addon_details: item.addon_details || '',
            addon_price: item.addon_price?.toString() || '0',
            service: item.service,
            employee: item.employee,
          }))
        );

        if (firstItem?.employee_id) {
          setSelectedTechnicianId(firstItem.employee_id);
        }

        await fetchActivityLogs(ticketId);
      }
    } catch (error) {
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
        price_each: defaultService?.base_price.toString() || '0',
        tip_customer: '0',
        tip_receptionist: '0',
        tip_customer_card: '0',
        tip_receptionist_card: '0',
        addon_details: '',
        addon_price: '0',
        service: defaultService,
      },
    ]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof TicketItemForm, value: string) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'service_id') {
      const service = services.find((s) => s.id === value);
      newItems[index].price_each = service?.base_price.toString() || '0';
      newItems[index].service = service;
    }

    if (field === 'employee_id') {
      const employee = employees.find((e) => e.id === value);
      newItems[index].employee = employee;
      setLastUsedEmployeeId(value);
    }

    setItems(newItems);
  }

  function calculateTotal(): number {
    const itemsTotal = items.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price_each) || 0;
      return sum + (qty * price);
    }, 0);
    const addonPrice = parseFloat(formData.addon_price) || 0;
    return itemsTotal + addonPrice;
  }

  function calculateTotalTips(): number {
    return (
      (parseFloat(formData.tip_customer) || 0) +
      (parseFloat(formData.tip_receptionist) || 0)
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

    if (!ticketId && session && session.role && !Permissions.tickets.canCreate(session.role)) {
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

    if (!formData.customer_name.trim()) {
      showToast('Customer Name is required', 'error');
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

    try {
      setSaving(true);

      const total = calculateTotal();
      const tipCustomer = parseFloat(formData.tip_customer) || 0;
      const tipReceptionist = parseFloat(formData.tip_receptionist) || 0;

      if (ticketId && ticket) {
        const { error: updateError } = await supabase
          .from('sale_tickets')
          .update({
            customer_type: formData.customer_type || null,
            customer_name: formData.customer_name,
            customer_phone: formData.customer_phone,
            payment_method: formData.payment_method,
            total,
            notes: formData.notes,
            saved_by: session?.employee_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ticketId);

        if (updateError) throw updateError;

        await logActivity(ticketId, 'updated', `${session?.display_name} updated ticket`, {
          customer_name: formData.customer_name,
          total,
        });

        const existingItemIds = items.filter((item) => item.id).map((item) => item.id);
        const { error: deleteError } = await supabase
          .from('ticket_items')
          .delete()
          .eq('sale_ticket_id', ticketId)
          .not('id', 'in', `(${existingItemIds.join(',')})`);

        for (const item of items) {
          const addonPrice = parseFloat(formData.addon_price) || 0;
          const isCardPayment = formData.payment_method === 'Card';

          const itemData = {
            sale_ticket_id: ticketId,
            service_id: item.service_id,
            employee_id: item.employee_id,
            qty: parseFloat(item.qty),
            price_each: parseFloat(item.price_each),
            tip_customer: isCardPayment ? 0 : tipCustomer,
            tip_receptionist: isCardPayment ? 0 : tipReceptionist,
            tip_customer_card: isCardPayment ? tipCustomer : 0,
            tip_receptionist_card: isCardPayment ? tipReceptionist : 0,
            addon_details: formData.addon_details || '',
            addon_price: addonPrice,
            updated_at: new Date().toISOString(),
          };

          if (item.id) {
            const { error } = await supabase
              .from('ticket_items')
              .update(itemData)
              .eq('id', item.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('ticket_items').insert([itemData]);
            if (error) throw error;
          }
        }

        showToast('Ticket updated successfully', 'success');
      } else {
        const ticketNo = await generateTicketNumber();
        const tipCustomer = parseFloat(formData.tip_customer) || 0;
        const tipReceptionist = parseFloat(formData.tip_receptionist) || 0;

        const { data: newTicket, error: ticketError } = await supabase
          .from('sale_tickets')
          .insert([
            {
              ticket_no: ticketNo,
              ticket_date: selectedDate,
              customer_type: formData.customer_type || null,
              customer_name: formData.customer_name,
              customer_phone: formData.customer_phone,
              payment_method: formData.payment_method,
              total,
              notes: formData.notes,
              store_id: selectedStoreId || null,
              created_by: session?.employee_id,
              saved_by: session?.employee_id,
            },
          ])
          .select()
          .single();

        if (ticketError) throw ticketError;

        const addonPrice = parseFloat(formData.addon_price) || 0;
        const isCardPayment = formData.payment_method === 'Card';
        const itemsData = items.map((item) => {
          return {
            sale_ticket_id: newTicket.id,
            service_id: item.service_id,
            employee_id: item.employee_id,
            qty: parseFloat(item.qty),
            price_each: parseFloat(item.price_each),
            tip_customer: isCardPayment ? 0 : tipCustomer,
            tip_receptionist: isCardPayment ? 0 : tipReceptionist,
            tip_customer_card: isCardPayment ? tipCustomer : 0,
            tip_receptionist_card: isCardPayment ? tipReceptionist : 0,
            addon_details: formData.addon_details || '',
            addon_price: addonPrice,
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
        });

        showToast('Ticket created successfully', 'success');
      }

      onClose();
    } catch (error: any) {
      showToast(error.message || 'Failed to save ticket', 'error');
    } finally {
      setSaving(false);
    }
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

    if (!formData.payment_method || (formData.payment_method !== 'Cash' && formData.payment_method !== 'Card')) {
      showToast('Please select a payment method (Cash or Card) before closing the ticket', 'error');
      return;
    }

    const total = calculateTotal();
    if (total < 0) {
      showToast('Cannot close ticket with negative total', 'error');
      return;
    }

    try {
      await handleSave();

      const closerRoles = session?.role || [];
      const hasTechnicianRole = closerRoles.includes('Technician');
      const hasReceptionistRole = closerRoles.includes('Receptionist');
      const hasSupervisorRole = closerRoles.includes('Supervisor');
      const requiresHigherApproval = hasSupervisorRole || (hasTechnicianRole && hasReceptionistRole);

      const { error } = await supabase
        .from('sale_tickets')
        .update({
          closed_at: new Date().toISOString(),
          closed_by: session?.employee_id,
          closed_by_roles: closerRoles,
          requires_higher_approval: requiresHigherApproval,
        })
        .eq('id', ticketId);

      if (error) throw error;

      await logActivity(ticketId, 'closed', `${session?.display_name} closed ticket${requiresHigherApproval ? ' (requires management approval)' : ''}`, {
        total: calculateTotal(),
        requires_higher_approval: requiresHigherApproval,
      });

      if (requiresHigherApproval) {
        const reason = hasSupervisorRole ? 'Supervisor role' : 'dual role';
        showToast(`Ticket closed. Requires management approval due to ${reason}.`, 'success');
      } else {
        showToast('Ticket closed successfully', 'success');
      }
      onClose();
    } catch (error) {
      showToast('Failed to close ticket', 'error');
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

  const isTicketClosed = ticket?.closed_at !== null && ticket?.closed_at !== undefined;

  function getApprovalStatusBadge() {
    if (!ticket?.approval_status) return null;

    switch (ticket.approval_status) {
      case 'pending_approval':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending Approval
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
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
          onClick={onClose}
        />
        <div className="fixed inset-0 md:right-0 md:left-auto md:top-0 h-full w-full md:max-w-4xl bg-white shadow-xl z-50 overflow-y-auto flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 mb-6">
              You do not have permission to create tickets. Only Admin and Receptionist roles can create new tickets.
            </p>
            <Button onClick={onClose} variant="primary">
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
      <div className="fixed inset-0 md:right-0 md:left-auto md:top-0 h-full w-full md:max-w-4xl bg-white shadow-xl z-50 overflow-y-auto">
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
                  {getApprovalStatusBadge()}
                </div>
              </div>
              {ticketId && activityLogs.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    <strong>{activityLogs[0].action === 'created' ? 'Created' : activityLogs[0].action === 'updated' ? 'Updated' : activityLogs[0].action === 'closed' ? 'Closed' : 'Modified'}</strong> by{' '}
                    {activityLogs[0].employee?.display_name || 'Unknown'}{' '}
                    {new Date(activityLogs[0].created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => setShowActivityModal(true)}
                    className="text-blue-600 hover:text-blue-800 font-medium ml-2"
                  >
                    More
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-6 h-6 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-4 md:space-y-3 pb-20 md:pb-4">
          {ticket?.approval_status === 'pending_approval' && ticket.approval_deadline && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900">Awaiting Technician Approval</p>
                  <p className="text-xs text-orange-700 mt-1">
                    {getTimeUntilDeadline()} until automatic approval
                  </p>
                </div>
              </div>
            </div>
          )}

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

          {isApproved && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">
                    {ticket?.approval_status === 'approved' ? 'Ticket Approved' : 'Ticket Auto-Approved'}
                  </p>
                  {ticket?.approved_at && (
                    <p className="text-xs text-green-700 mt-1">
                      {ticket.approval_status === 'approved' ? 'Approved' : 'Auto-approved'} on {new Date(ticket.approved_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="border border-gray-200 rounded-lg p-3">
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
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isTicketClosed || isReadOnly}
              >
                Appointment
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, customer_type: 'Requested' })}
                className={`flex-1 py-3 md:py-1.5 px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 ${
                  formData.customer_type === 'Requested'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isTicketClosed || isReadOnly}
              >
                Requested
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, customer_type: 'Assigned' })}
                className={`flex-1 py-3 md:py-1.5 px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 ${
                  formData.customer_type === 'Assigned'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isTicketClosed || isReadOnly}
              >
                Assigned
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_name: e.target.value })
                    }
                    placeholder="e.g. John"
                    disabled={isTicketClosed}
                    className="w-full px-3 py-3 md:py-1.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] md:min-h-0"
                  />
                </div>
              </div>
              <div className="flex-1">
                <Input
                  label="Phone Number"
                  value={formData.customer_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_phone: e.target.value })
                  }
                  placeholder="e.g. 1234"
                  disabled={isTicketClosed}
                />
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Technician <span className="text-red-600">*</span>
            </label>

            <div className="flex items-start gap-3 mb-2">
              {sortedTechnicians.filter(t => t.queue_status === 'ready').length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-semibold text-green-700 uppercase whitespace-nowrap">Available</span>
                </div>
              )}
              {sortedTechnicians.filter(t => t.queue_status === 'neutral').length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Not Ready</span>
                </div>
              )}
              {sortedTechnicians.filter(t => t.queue_status === 'busy').length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-xs font-semibold text-red-700 uppercase whitespace-nowrap">Busy</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {sortedTechnicians.filter(t => t.queue_status === 'ready').map((tech) => (
                <button
                  key={tech.employee_id}
                  type="button"
                  onClick={() => {
                    setSelectedTechnicianId(tech.employee_id);
                    setLastUsedEmployeeId(tech.employee_id);
                    if (items.length > 0) {
                      updateItem(0, 'employee_id', tech.employee_id);
                    }
                  }}
                  className={`relative py-3 md:py-1.5 px-4 md:px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 ${
                    selectedTechnicianId === tech.employee_id
                      ? 'bg-green-600 text-white ring-2 ring-green-400'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                  disabled={isTicketClosed || isReadOnly}
                >
                  <div className="flex items-center gap-1.5">
                    {tech.queue_position > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-white text-green-600 rounded-full">
                        {tech.queue_position}
                      </span>
                    )}
                    <span>{tech.display_name}</span>
                  </div>
                </button>
              ))}

              {sortedTechnicians.filter(t => t.queue_status === 'neutral').map((tech) => (
                <button
                  key={tech.employee_id}
                  type="button"
                  onClick={() => {
                    setSelectedTechnicianId(tech.employee_id);
                    setLastUsedEmployeeId(tech.employee_id);
                    if (items.length > 0) {
                      updateItem(0, 'employee_id', tech.employee_id);
                    }
                  }}
                  className={`py-3 md:py-1.5 px-4 md:px-3 text-sm rounded-lg font-medium transition-colors min-h-[48px] md:min-h-0 ${
                    selectedTechnicianId === tech.employee_id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isTicketClosed || isReadOnly}
                >
                  {tech.display_name}
                </button>
              ))}

              {sortedTechnicians.filter(t => t.queue_status === 'busy').map((tech) => {
                const timeRemaining = calculateTimeRemaining(tech);
                return (
                  <button
                    key={tech.employee_id}
                    type="button"
                    disabled
                    className="py-3 md:py-1.5 px-4 md:px-3 text-sm rounded-lg font-medium bg-red-100 text-red-800 cursor-not-allowed opacity-60 min-h-[48px] md:min-h-0"
                    title={`${tech.display_name} is currently working on ${tech.open_ticket_count} ticket(s)${timeRemaining ? ` - ${timeRemaining} remaining` : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      <span>{tech.display_name}</span>
                      {timeRemaining && (
                        <span className="inline-flex items-center text-xs font-medium text-red-700">
                          {timeRemaining}
                        </span>
                      )}
                      {tech.open_ticket_count > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-600 text-white rounded-full">
                          {tech.open_ticket_count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {sortedTechnicians.length === 0 && (
              <div className="text-center py-3 text-sm text-gray-500">
                No technicians available
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Service Item <span className="text-red-600">*</span>
            </h3>
            {items.length === 0 ? (
              <div className="border border-gray-200 rounded-lg p-3">
                {!isTicketClosed && services.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          setItems([{
                            service_id: service.id,
                            employee_id: selectedTechnicianId || lastUsedEmployeeId,
                            qty: '1',
                            price_each: service.base_price.toString(),
                            tip_customer: '0',
                            tip_receptionist: '0',
                            tip_customer_card: '0',
                            tip_receptionist_card: '0',
                            addon_details: '',
                            addon_price: '0',
                            service: service,
                          }]);
                        }}
                        className="py-3 md:py-1.5 px-4 md:px-3 text-sm bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors min-h-[48px] md:min-h-0"
                      >
                        {service.code}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Select
                      label="Service"
                      value={items[0].service_id}
                      onChange={(e) => updateItem(0, 'service_id', e.target.value)}
                      options={services.map((s) => ({
                        value: s.id,
                        label: `${s.code} - ${s.name}`,
                      }))}
                      disabled={isTicketClosed || isReadOnly}
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={items[0].price_each}
                        onChange={(e) =>
                          updateItem(0, 'price_each', e.target.value)
                        }
                        className="w-full pl-6 pr-2 py-3 md:py-1.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] md:min-h-0"
                        disabled={isTicketClosed || isReadOnly}
                      />
                    </div>
                  </div>
                  {!isTicketClosed && (
                    <div className="flex items-end">
                      <button
                        onClick={() => setItems([])}
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
                      value={formData.addon_details}
                      onChange={(e) =>
                        setFormData({ ...formData, addon_details: e.target.value })
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
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.addon_price}
                        onChange={(e) =>
                          setFormData({ ...formData, addon_price: e.target.value })
                        }
                        className="w-full pl-6 pr-2 py-3 md:py-1.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] md:min-h-0"
                        disabled={isTicketClosed || isReadOnly}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Payment Method <span className="text-red-600">*</span>
            </h3>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_method: 'Cash' })}
                  className={`flex-1 py-3 md:py-1.5 px-3 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 min-h-[48px] md:min-h-0 ${
                    formData.payment_method === 'Cash'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isTicketClosed || isReadOnly}
                >
                  <Banknote className="w-4 h-4" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_method: 'Card' })}
                  className={`flex-1 py-3 md:py-1.5 px-3 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 min-h-[48px] md:min-h-0 ${
                    formData.payment_method === 'Card'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isTicketClosed || isReadOnly}
                >
                  <CreditCard className="w-4 h-4" />
                  Card
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Tip Given by Customer {formData.payment_method === 'Card' && <span className="text-blue-600">(Card)</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.tip_customer}
                      onChange={(e) =>
                        setFormData({ ...formData, tip_customer: e.target.value })
                      }
                      className="w-full pl-6 pr-2 py-3 md:py-1.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] md:min-h-0"
                      disabled={isTicketClosed || isReadOnly}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Tip Paired by Receptionist {formData.payment_method === 'Card' && <span className="text-blue-600">(Card)</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.tip_receptionist}
                      onChange={(e) =>
                        setFormData({ ...formData, tip_receptionist: e.target.value })
                      }
                      className="w-full pl-6 pr-2 py-3 md:py-1.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] md:min-h-0"
                      disabled={isTicketClosed || isReadOnly}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-2">
            <div className="flex justify-between items-center text-base font-bold">
              <span>Total:</span>
              <span>${calculateTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-semibold text-blue-600">
              <span>Total Tips:</span>
              <span>${calculateTotalTips().toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes / Comments
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!canEditNotes}
              placeholder={canEditNotes ? "Add notes or comments..." : ""}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-200 fixed md:static bottom-0 left-0 right-0 bg-white p-3 md:p-0 shadow-lg md:shadow-none z-10">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {!isTicketClosed && !isReadOnly && (
              <>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                {ticketId && (
                  <Button
                    variant="primary"
                    onClick={() => setShowCloseModal(true)}
                    disabled={saving}
                  >
                    Close Ticket
                  </Button>
                )}
              </>
            )}
            {isReadOnly && canEditNotes && ticketId && (
              <Button onClick={handleSaveComment} disabled={saving}>
                {saving ? 'Saving...' : 'Save Comment'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Close Ticket"
        onConfirm={handleCloseTicket}
        confirmText="Close Ticket"
        confirmVariant="primary"
      >
        <p className="text-gray-700">
          Are you sure you want to close this ticket? You will not be able to edit it
          after closing.
        </p>
      </Modal>

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
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{log.description}</p>
                {log.changes && Object.keys(log.changes).length > 0 && (
                  <div className="mt-2 text-xs text-gray-600 bg-white px-2 py-1 rounded">
                    {Object.entries(log.changes).map(([key, value]) => (
                      <div key={key}>
                        <strong>{key}:</strong> {JSON.stringify(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
