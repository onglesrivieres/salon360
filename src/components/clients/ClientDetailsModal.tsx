import { useState, useEffect } from 'react';
import { User, Phone, FileText, Calendar, Hash, AlertTriangle, Palette, Edit2, Eye } from 'lucide-react';
import { ClientWithStats, VisitHistoryEntry, supabase } from '../../lib/supabase';
import { formatPhoneNumber, maskPhoneNumber } from '../../lib/phoneUtils';
import { Drawer } from '../ui/Drawer';
import { TicketEditor } from '../TicketEditor';
import { useAuth } from '../../contexts/AuthContext';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientWithStats;
  onEdit: () => void;
  canViewFullPhone?: boolean;
}

type Tab = 'details' | 'visits';

export function ClientDetailsModal({
  isOpen,
  onClose,
  client,
  onEdit,
  canViewFullPhone = false,
}: ClientDetailsModalProps) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [visitHistory, setVisitHistory] = useState<VisitHistoryEntry[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [viewingTicketId, setViewingTicketId] = useState<string | null>(null);
  const [viewingTicketDate, setViewingTicketDate] = useState<string>('');

  // Check if user is a commission employee (tips hidden for commission non-management)
  const [isCommissionEmployee, setIsCommissionEmployee] = useState(false);

  useEffect(() => {
    async function checkPayType() {
      if (session?.employee_id) {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('pay_type')
          .eq('id', session.employee_id)
          .maybeSingle();
        setIsCommissionEmployee(employeeData?.pay_type === 'commission');
      }
    }
    checkPayType();
  }, [session?.employee_id]);

  const MANAGEMENT_ROLES = ['Admin', 'Manager', 'Owner', 'Supervisor'] as const;
  const isManagement = session?.role ?
    MANAGEMENT_ROLES.some(r => session.role?.includes(r)) : false;
  const shouldHideTips = isCommissionEmployee && !isManagement;

  // Fetch visit history when visits tab is selected
  useEffect(() => {
    if (isOpen && activeTab === 'visits' && client.id) {
      fetchVisitHistory();
    }
  }, [isOpen, activeTab, client.id]);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('details');
      setViewingTicketId(null);
    }
  }, [isOpen]);

  const fetchVisitHistory = async () => {
    setIsLoadingVisits(true);
    try {
      // Query 1: Fetch tickets with nested ticket_items
      const { data: ticketData, error: ticketError } = await supabase
        .from('sale_tickets')
        .select(`
          id,
          ticket_no,
          ticket_date,
          closed_at,
          ticket_items (
            id,
            custom_service_name,
            service:store_services!ticket_items_store_service_id_fkey(name),
            employee:employees!ticket_items_employee_id_fkey(display_name)
          )
        `)
        .eq('client_id', client.id)
        .is('voided_at', null)
        .order('ticket_date', { ascending: false })
        .limit(20);

      if (ticketError) throw ticketError;

      // Query 2: Fetch all color history for this client
      const { data: colorData, error: colorError } = await supabase
        .from('client_color_history')
        .select('id, ticket_id, color')
        .eq('client_id', client.id);

      if (colorError) throw colorError;

      // Build color map by ticket_id
      const colorMap = new Map<string, Array<{ id: string; color: string }>>();
      (colorData || []).forEach((c) => {
        if (c.ticket_id) {
          const existing = colorMap.get(c.ticket_id) || [];
          existing.push({ id: c.id, color: c.color });
          colorMap.set(c.ticket_id, existing);
        }
      });

      // Map tickets to VisitHistoryEntry
      const visits: VisitHistoryEntry[] = (ticketData || []).map((ticket: any) => ({
        id: ticket.id,
        ticket_no: ticket.ticket_no,
        ticket_date: ticket.ticket_date,
        closed_at: ticket.closed_at,
        services: (ticket.ticket_items || []).map((item: any) => ({
          id: item.id,
          name: item.service?.name || item.custom_service_name || 'Unknown Service',
          employee_name: item.employee?.display_name || 'Unknown',
        })),
        colors: colorMap.get(ticket.id) || [],
      }));

      setVisitHistory(visits);
    } catch (err) {
      console.error('Error fetching visit history:', err);
    } finally {
      setIsLoadingVisits(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getUniqueNames = (services: VisitHistoryEntry['services']) => {
    const names = new Set(services.map(s => s.employee_name).filter(n => n !== 'Unknown'));
    return Array.from(names);
  };

  return (
    <>
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={client.name}
      size="xl"
      headerActions={
        <>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            client.is_blacklisted
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {client.is_blacklisted ? 'Blacklisted' : 'Active'}
          </span>
          <button
            onClick={onEdit}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit client"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </>
      }
      footer={
        <button
          onClick={onClose}
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Close
        </button>
      }
    >
      {/* Blacklist Warning */}
      {client.is_blacklisted && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">This client is blacklisted</p>
              {client.blacklist_reason && (
                <p className="text-sm text-red-700 mt-0.5">{client.blacklist_reason}</p>
              )}
              <p className="text-xs text-red-600 mt-1">
                {client.blacklisted_by_name && `By ${client.blacklisted_by_name}`}
                {client.blacklist_date && ` on ${formatDate(client.blacklist_date)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 -mx-6 px-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('visits')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'visits'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Visit History
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Hash className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Total Visits</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {client.total_visits || 0}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Last Visit</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDate(client.last_visit)}
                </p>
              </div>
            </div>

            {/* Last Color */}
            {client.last_color && (
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-purple-600 mb-1">
                  <Palette className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Last Color Used</span>
                </div>
                <p className="text-sm font-medium text-purple-900">{client.last_color}</p>
              </div>
            )}

            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Contact Information
              </h3>
              <div className="flex items-center gap-3 text-gray-700">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{client.name}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="w-4 h-4 text-gray-400" />
                {canViewFullPhone ? (
                  <a
                    href={`tel:${client.phone_number}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {formatPhoneNumber(client.phone_number)}
                  </a>
                ) : (
                  <span className="text-sm text-gray-500">{maskPhoneNumber(client.phone_number)}</span>
                )}
              </div>
            </div>

            {/* Notes */}
            {client.notes && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  Notes
                </h3>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                  {client.notes}
                </p>
              </div>
            )}

            {/* Timestamps */}
            <div className="text-xs text-gray-400 pt-4 border-t border-gray-100">
              <p>Created: {formatDate(client.created_at)}</p>
              <p>Last updated: {formatDate(client.updated_at)}</p>
            </div>
          </div>
        )}

        {activeTab === 'visits' && (
          <div>
            {isLoadingVisits ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : visitHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No visit history yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                      <th className="py-2 px-2 font-medium">Date</th>
                      <th className="py-2 px-2 font-medium">Service</th>
                      <th className="py-2 px-2 font-medium">Technician</th>
                      <th className="py-2 px-2 font-medium">Color</th>
                      <th className="py-2 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visitHistory.map((visit) => {
                      const serviceNames = visit.services.map(s => s.name).join(', ');
                      const techNames = getUniqueNames(visit.services);
                      const colorNames = visit.colors.map(c => c.color).join(', ');

                      return (
                        <tr key={visit.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {formatShortDate(visit.ticket_date)}
                            </span>
                            {!visit.closed_at && (
                              <span className="ml-1.5 text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                Open
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-gray-800">
                            {serviceNames || '—'}
                          </td>
                          <td className="py-2.5 px-2 text-gray-600">
                            {techNames.length > 0 ? techNames.join(', ') : '—'}
                          </td>
                          <td className="py-2.5 px-2">
                            {colorNames ? (
                              <span className="text-purple-600">{colorNames}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            <button
                              onClick={() => {
                                setViewingTicketId(visit.id);
                                setViewingTicketDate(visit.ticket_date);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View ticket"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
    {viewingTicketId && (
      <TicketEditor
        ticketId={viewingTicketId}
        onClose={() => setViewingTicketId(null)}
        selectedDate={viewingTicketDate}
        hideTips={shouldHideTips}
      />
    )}
    </>
  );
}
