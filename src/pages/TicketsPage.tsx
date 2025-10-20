import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase, SaleTicket } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { TicketEditor } from '../components/TicketEditor';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';

interface TicketsPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function TicketsPage({ selectedDate, onDateChange }: TicketsPageProps) {
  const [tickets, setTickets] = useState<SaleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  useEffect(() => {
    fetchTickets();
  }, [selectedDate, selectedStoreId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function fetchTickets() {
    try {
      setLoading(true);

      let query = supabase
        .from('sale_tickets')
        .select(
          `
          *,
          ticket_items (
            id,
            employee_id,
            tip_customer,
            tip_receptionist,
            service:services(code, name),
            employee:employees(display_name)
          )
        `
        )
        .eq('ticket_date', selectedDate);

      if (selectedStoreId) {
        query = query.eq('store_id', selectedStoreId);
      }

      if (session?.role_permission === 'Technician') {
        const { data: technicianTickets, error: techError } = await supabase
          .from('ticket_items')
          .select('sale_ticket_id')
          .eq('employee_id', session.employee_id);

        if (techError) throw techError;

        const ticketIds = technicianTickets?.map(item => item.sale_ticket_id) || [];

        if (ticketIds.length === 0) {
          setTickets([]);
          setLoading(false);
          return;
        }

        query = query.in('id', ticketIds);
      }

      query = query.order('opened_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      showToast('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  }

  function openEditor(ticketId?: string) {
    setEditingTicketId(ticketId || null);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setEditingTicketId(null);
    fetchTickets();
  }

  function getTipCustomer(ticket: any): number {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return 0;
    return ticket.ticket_items[0]?.tip_customer || 0;
  }

  function getTipReceptionist(ticket: any): number {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return 0;
    return ticket.ticket_items[0]?.tip_receptionist || 0;
  }

  function getServiceName(ticket: any): string {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return '-';
    const service = ticket.ticket_items[0]?.service;
    return service ? service.code : '-';
  }

  function getTechnicianName(ticket: any): string {
    if (!ticket.ticket_items || ticket.ticket_items.length === 0) return '-';
    const employee = ticket.ticket_items[0]?.employee;
    return employee ? employee.display_name : '-';
  }

  function getCustomerType(ticket: any): string {
    return ticket.customer_type || '-';
  }

  function getApprovalStatusBadge(ticket: SaleTicket) {
    if (!ticket.approval_status) {
      if (ticket.closed_at) {
        return <Badge variant="success">Closed</Badge>;
      }
      return null;
    }

    switch (ticket.approval_status) {
      case 'pending_approval':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'auto_approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Auto
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  }

  const filteredTickets = useMemo(() => {
    if (approvalFilter === 'all') return tickets;

    return tickets.filter(ticket => {
      if (approvalFilter === 'open') return !ticket.closed_at;
      if (approvalFilter === 'closed') return ticket.closed_at && !ticket.approval_status;
      if (approvalFilter === 'pending_approval') return ticket.approval_status === 'pending_approval';
      if (approvalFilter === 'approved') return ticket.approval_status === 'approved';
      if (approvalFilter === 'auto_approved') return ticket.approval_status === 'auto_approved';
      if (approvalFilter === 'rejected') return ticket.approval_status === 'rejected';
      return true;
    });
  }, [tickets, approvalFilter]);

  function getMinDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  function getMaxDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  function formatDuration(openedAt: string): string {
    const opened = new Date(openedAt);
    const diff = Math.floor((currentTime.getTime() - opened.getTime()) / 1000);

    if (diff < 0) return '0s';

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading tickets...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-bold text-gray-900">Sale Tickets</h2>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] md:min-h-0"
          >
            <option value="all">All Tickets</option>
            <option value="open">Open</option>
            <option value="closed">Closed (No Status)</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="auto_approved">Auto-Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="flex items-center gap-1 flex-1 md:flex-initial">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              min={getMinDate()}
              max={getMaxDate()}
              className="px-2 py-1.5 md:py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:flex-initial min-h-[44px] md:min-h-0"
            />
          </div>
          {session && Permissions.tickets.canCreate(session.role_permission) && (
            <Button size="sm" onClick={() => openEditor()} className="min-h-[44px] md:min-h-0">
              <Plus className="w-4 h-4 md:w-3 md:h-3 mr-1" />
              <span className="hidden xs:inline">New Ticket</span>
              <span className="xs:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tech
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tip (C)
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tip (R)
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approval
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTickets.map((ticket) => {
                const tipCustomer = getTipCustomer(ticket);
                const tipReceptionist = getTipReceptionist(ticket);
                const serviceName = getServiceName(ticket);
                const technicianName = getTechnicianName(ticket);
                const customerType = getCustomerType(ticket);
                const time = new Date(ticket.opened_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });

                const isApproved = ticket.approval_status === 'approved' || ticket.approval_status === 'auto_approved';
                const canEdit = session && Permissions.tickets.canEdit(
                  session.role_permission,
                  !!ticket.closed_at,
                  isApproved
                );
                const canView = session && Permissions.tickets.canView(session.role_permission);

                return (
                  <tr
                    key={ticket.id}
                    className={`hover:bg-gray-50 ${canView ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                    onClick={() => canView && openEditor(ticket.id)}
                    title={!canView ? 'You do not have permission to view this ticket' : ''}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {time}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {customerType}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {serviceName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {technicianName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      ${ticket.total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      ${tipCustomer.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      ${tipReceptionist.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {ticket.closed_at ? (
                        <Badge variant="success">Closed</Badge>
                      ) : (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-red-600">
                          {formatDuration(ticket.opened_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {getApprovalStatusBadge(ticket)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTickets.length === 0 && tickets.length > 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No tickets match the selected filter</p>
          </div>
        )}
        {tickets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">No tickets found for this date</p>
            <Button size="sm" onClick={() => openEditor()}>Create First Ticket</Button>
          </div>
        )}
      </div>

      <div className="md:hidden space-y-2">
        {filteredTickets.map((ticket) => {
          const tipCustomer = getTipCustomer(ticket);
          const tipReceptionist = getTipReceptionist(ticket);
          const serviceName = getServiceName(ticket);
          const technicianName = getTechnicianName(ticket);
          const customerType = getCustomerType(ticket);
          const time = new Date(ticket.opened_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          const isApproved = ticket.approval_status === 'approved' || ticket.approval_status === 'auto_approved';
          const canEdit = session && Permissions.tickets.canEdit(
            session.role_permission,
            !!ticket.closed_at,
            isApproved
          );
          const canView = session && Permissions.tickets.canView(session.role_permission);

          return (
            <div
              key={ticket.id}
              onClick={() => canView && openEditor(ticket.id)}
              className={`bg-white rounded-lg shadow p-3 ${
                canView ? 'cursor-pointer active:bg-gray-50' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{customerType}</span>
                    <span className="text-xs text-gray-500">{time}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {serviceName} • {technicianName}
                  </div>
                </div>
                <div className="text-right flex flex-col gap-1 items-end">
                  {ticket.closed_at ? (
                    <Badge variant="success">Closed</Badge>
                  ) : (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-red-600">
                      {formatDuration(ticket.opened_at)}
                    </div>
                  )}
                  {getApprovalStatusBadge(ticket)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="text-sm font-semibold text-gray-900">${ticket.total.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Tip (C)</div>
                  <div className="text-sm font-semibold text-gray-900">${tipCustomer.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Tip (R)</div>
                  <div className="text-sm font-semibold text-gray-900">${tipReceptionist.toFixed(2)}</div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredTickets.length === 0 && tickets.length > 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-sm text-gray-500">No tickets match the selected filter</p>
          </div>
        )}
        {tickets.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">No tickets found for this date</p>
            <Button size="sm" onClick={() => openEditor()}>Create First Ticket</Button>
          </div>
        )}
      </div>

      {isEditorOpen && (
        <TicketEditor
          ticketId={editingTicketId}
          onClose={closeEditor}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
