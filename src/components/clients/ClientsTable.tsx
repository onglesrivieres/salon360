import { useState } from 'react';
import { MoreVertical, Eye, Edit2, Ban, Trash2, CheckCircle } from 'lucide-react';
import { ClientWithStats } from '../../lib/supabase';
import { formatPhoneNumber } from '../../lib/phoneUtils';

interface ClientsTableProps {
  clients: ClientWithStats[];
  isLoading: boolean;
  onViewDetails: (client: ClientWithStats) => void;
  onEdit: (client: ClientWithStats) => void;
  onBlacklistToggle?: (client: ClientWithStats, reason?: string) => void;
  onDelete?: (client: ClientWithStats) => void;
}

export function ClientsTable({
  clients,
  isLoading,
  onViewDetails,
  onEdit,
  onBlacklistToggle,
  onDelete,
}: ClientsTableProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [showBlacklistInput, setShowBlacklistInput] = useState<string | null>(null);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleBlacklistSubmit = (client: ClientWithStats) => {
    if (blacklistReason.trim() && onBlacklistToggle) {
      onBlacklistToggle(client, blacklistReason.trim());
      setBlacklistReason('');
      setShowBlacklistInput(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="animate-pulse p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No clients found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Last Visit
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Visits
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onViewDetails(client)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{client.name}</p>
                      {client.notes && (
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{client.notes}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{formatPhoneNumber(client.phone_number)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{formatDate(client.last_visit)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{client.total_visits || 0}</span>
                </td>
                <td className="px-4 py-3">
                  {client.is_blacklisted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                      <Ban className="w-3 h-3" />
                      Blacklisted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-block">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === client.id ? null : client.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>

                    {openDropdown === client.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => {
                            setOpenDropdown(null);
                            setShowBlacklistInput(null);
                          }}
                        />
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                          <button
                            onClick={() => {
                              onViewDetails(client);
                              setOpenDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              onEdit(client);
                              setOpenDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          {onBlacklistToggle && (
                            <>
                              {client.is_blacklisted ? (
                                <button
                                  onClick={() => {
                                    onBlacklistToggle(client);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Remove from Blacklist
                                </button>
                              ) : (
                                <>
                                  {showBlacklistInput === client.id ? (
                                    <div className="px-4 py-2 space-y-2">
                                      <input
                                        type="text"
                                        value={blacklistReason}
                                        onChange={(e) => setBlacklistReason(e.target.value)}
                                        placeholder="Reason..."
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={() => handleBlacklistSubmit(client)}
                                        disabled={!blacklistReason.trim()}
                                        className="w-full px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Confirm Blacklist
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setShowBlacklistInput(client.id)}
                                      className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <Ban className="w-4 h-4" />
                                      Blacklist
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => {
                                onDelete(client);
                                setOpenDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
