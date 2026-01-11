import { useState, useEffect } from 'react';
import { X, User, Phone, FileText, Calendar, Hash, AlertTriangle, Palette, Edit2 } from 'lucide-react';
import { ClientWithStats, ClientColorHistoryWithDetails, supabase } from '../../lib/supabase';
import { formatPhoneNumber, maskPhoneNumber } from '../../lib/phoneUtils';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientWithStats;
  onEdit: () => void;
  canViewFullPhone?: boolean;
}

type Tab = 'details' | 'colors';

export function ClientDetailsModal({
  isOpen,
  onClose,
  client,
  onEdit,
  canViewFullPhone = false,
}: ClientDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [colorHistory, setColorHistory] = useState<ClientColorHistoryWithDetails[]>([]);
  const [isLoadingColors, setIsLoadingColors] = useState(false);

  // Fetch color history when colors tab is selected
  useEffect(() => {
    if (isOpen && activeTab === 'colors' && client.id) {
      fetchColorHistory();
    }
  }, [isOpen, activeTab, client.id]);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('details');
    }
  }, [isOpen]);

  const fetchColorHistory = async () => {
    setIsLoadingColors(true);
    try {
      // Fetch color history entries
      const { data: colorData, error } = await supabase
        .from('client_color_history')
        .select('*')
        .eq('client_id', client.id)
        .order('applied_date', { ascending: false })
        .limit(20);

      if (error) throw error;

      // For each entry with a ticket_id, fetch ticket details
      const colorHistoryWithDetails = await Promise.all(
        (colorData || []).map(async (entry) => {
          if (!entry.ticket_id) {
            return { ...entry, ticket_date: null, services: [] };
          }

          // Get ticket date
          const { data: ticketData } = await supabase
            .from('sale_tickets')
            .select('ticket_date')
            .eq('id', entry.ticket_id)
            .maybeSingle();

          // Get services and employees from ticket_items
          const { data: ticketItems } = await supabase
            .from('ticket_items')
            .select(`
              service:store_services!ticket_items_store_service_id_fkey(name),
              employee:employees!ticket_items_employee_id_fkey(display_name)
            `)
            .eq('sale_ticket_id', entry.ticket_id);

          const services = ticketItems?.map((item: any) => ({
            name: item.service?.name || 'Unknown Service',
            employee_name: item.employee?.display_name || 'Unknown',
          })) || [];

          return {
            ...entry,
            ticket_date: ticketData?.ticket_date || null,
            services,
          };
        })
      );

      setColorHistory(colorHistoryWithDetails);
    } catch (err) {
      console.error('Error fetching color history:', err);
    } finally {
      setIsLoadingColors(false);
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
                onClick={() => setActiveTab('colors')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  activeTab === 'colors'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Palette className="w-4 h-4" />
                Color History
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

            {activeTab === 'colors' && (
              <div>
                {isLoadingColors ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  </div>
                ) : colorHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No color history yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {colorHistory.map((entry) => (
                      <div key={entry.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                        {/* Color and Date Header */}
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium text-gray-900">{entry.color}</p>
                          <span className="text-xs text-gray-400">
                            {formatDate(entry.ticket_date || entry.applied_date)}
                          </span>
                        </div>

                        {/* Services with Employees */}
                        {entry.services.length > 0 && (
                          <div className="text-xs text-gray-600 space-y-1">
                            {entry.services.map((svc, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-gray-500">{svc.name}</span>
                                <span className="text-blue-600">by {svc.employee_name}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Service type fallback if no ticket linked */}
                        {entry.services.length === 0 && entry.service_type && (
                          <p className="text-xs text-gray-500">{entry.service_type}</p>
                        )}
                      </div>
                    ))}
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
