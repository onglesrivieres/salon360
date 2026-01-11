import { Ban, CheckCircle } from 'lucide-react';
import { ClientWithStats } from '../../lib/supabase';
import { formatPhoneNumber, maskPhoneNumber } from '../../lib/phoneUtils';

interface ClientsTableProps {
  clients: ClientWithStats[];
  isLoading: boolean;
  onViewDetails: (client: ClientWithStats) => void;
  canViewFullPhone?: boolean;
}

export function ClientsTable({
  clients,
  isLoading,
  onViewDetails,
  canViewFullPhone = false,
}: ClientsTableProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
                  <span className="text-sm text-gray-700">
                    {canViewFullPhone
                      ? formatPhoneNumber(client.phone_number)
                      : maskPhoneNumber(client.phone_number)}
                  </span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
