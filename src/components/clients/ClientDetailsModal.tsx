import { useState, useEffect } from 'react';
import { X, User, Phone, FileText, Calendar, Hash, AlertTriangle, Palette, Edit2, ChevronDown, ChevronUp, DollarSign, CreditCard, Gift } from 'lucide-react';
import { ClientWithStats, VisitHistoryEntry, supabase } from '../../lib/supabase';
import { formatPhoneNumber, maskPhoneNumber } from '../../lib/phoneUtils';

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
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [visitHistory, setVisitHistory] = useState<VisitHistoryEntry[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);

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
      setExpandedVisitId(null);
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
          payment_method,
          total,
          closed_at,
          ticket_items (
            id,
            custom_service_name,
            price_each,
            service:store_services!ticket_items_store_service_id_fkey(name),
            employee:employees!ticket_items_employee_id_fkey(display_name)
          )
        `)
        .eq('client_id', client.id)
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
        payment_method: ticket.payment_method || '',
        total: ticket.total || 0,
        closed_at: ticket.closed_at,
        services: (ticket.ticket_items || []).map((item: any) => ({
          id: item.id,
          name: item.service?.name || item.custom_service_name || 'Unknown Service',
          employee_name: item.employee?.display_name || 'Unknown',
          price: item.price_each || 0,
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

  if (!isOpen) return null;

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

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <DollarSign className="w-3.5 h-3.5" />;
      case 'card': return <CreditCard className="w-3.5 h-3.5" />;
      case 'gift_card': return <Gift className="w-3.5 h-3.5" />;
      case 'mixed': return <CreditCard className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'card': return 'Card';
      case 'gift_card': return 'Gift Card';
      case 'mixed': return 'Mixed';
      default: return method;
    }
  };

  const getUniqueNames = (services: VisitHistoryEntry['services']) => {
    const names = new Set(services.map(s => s.employee_name).filter(n => n !== 'Unknown'));
    return Array.from(names);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold ${
                client.is_blacklisted
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{client.name}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  client.is_blacklisted
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {client.is_blacklisted ? 'Blacklisted' : 'Active'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit client"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Blacklist Warning */}
          {client.is_blacklisted && (
            <div className="bg-red-50 border-b border-red-200 px-6 py-3">
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
          <div className="border-b border-gray-200 px-6">
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
          <div className="flex-1 overflow-y-auto p-6">
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
                  <div className="divide-y divide-gray-100">
                    {visitHistory.map((visit) => {
                      const isExpanded = expandedVisitId === visit.id;
                      const serviceNames = visit.services.map(s => s.name).join(', ');
                      const techNames = getUniqueNames(visit.services);

                      return (
                        <div key={visit.id}>
                          {/* Summary Row */}
                          <button
                            onClick={() => setExpandedVisitId(isExpanded ? null : visit.id)}
                            className="w-full text-left py-3 hover:bg-gray-50 transition-colors flex items-center gap-3"
                          >
                            {/* Date */}
                            <div className="w-14 flex-shrink-0">
                              <span className="text-sm font-medium text-gray-900">
                                {formatShortDate(visit.ticket_date)}
                              </span>
                            </div>

                            {/* Services & Technicians */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 truncate">
                                {serviceNames || 'No services'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {techNames.length > 0 ? techNames.join(', ') : '—'}
                              </p>
                            </div>

                            {/* Color indicator */}
                            {visit.colors.length > 0 && (
                              <Palette className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                            )}

                            {/* Total & Status */}
                            <div className="flex-shrink-0 text-right">
                              {visit.closed_at ? (
                                <span className="text-sm font-medium text-gray-900">
                                  ${visit.total.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                  Open
                                </span>
                              )}
                            </div>

                            {/* Expand icon */}
                            <div className="flex-shrink-0 text-gray-400">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </button>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="pb-3 pl-4 pr-2 bg-gray-50 rounded-b-lg mb-1">
                              {/* Ticket info */}
                              <div className="flex items-center gap-3 py-2 text-xs text-gray-500 border-b border-gray-200">
                                <span className="font-mono">#{visit.ticket_no}</span>
                                {visit.closed_at && visit.payment_method && (
                                  <span className="flex items-center gap-1">
                                    {getPaymentIcon(visit.payment_method)}
                                    {getPaymentLabel(visit.payment_method)}
                                  </span>
                                )}
                              </div>

                              {/* Service lines */}
                              <div className="py-2 space-y-1.5">
                                {visit.services.map((svc) => (
                                  <div key={svc.id} className="flex items-center justify-between text-xs">
                                    <div>
                                      <span className="text-gray-800">{svc.name}</span>
                                      <span className="text-gray-400"> — by </span>
                                      <span className="text-blue-600">{svc.employee_name}</span>
                                    </div>
                                    <span className="text-gray-600 font-medium">${svc.price.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Colors */}
                              {visit.colors.length > 0 && (
                                <div className="pt-1.5 border-t border-gray-200">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Palette className="w-3 h-3 text-purple-500" />
                                    {visit.colors.map((c) => (
                                      <span
                                        key={c.id}
                                        className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full"
                                      >
                                        {c.color}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
