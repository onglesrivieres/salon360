import { useState, useEffect } from 'react';
import { Clock, User, AlertCircle, Calendar, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Permissions } from '../lib/permissions';

interface RemovalRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  removed_by_employee_id: string;
  removed_by_name: string;
  reason: string;
  notes: string | null;
  removed_at: string;
  cooldown_expires_at: string;
  is_active: boolean;
  minutes_remaining: number | null;
}

export function QueueRemovalHistoryPage() {
  const { selectedStoreId, effectiveRole } = useAuth();
  const [records, setRecords] = useState<RemovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const canView = effectiveRole && Permissions.queue.canViewRemovalHistory(effectiveRole);

  useEffect(() => {
    if (!canView) {
      setError('You do not have permission to view queue removal history');
      setLoading(false);
      return;
    }

    const today = new Date();
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, [canView]);

  useEffect(() => {
    if (selectedStoreId && startDate && endDate && canView) {
      fetchHistory();
    }
  }, [selectedStoreId, startDate, endDate, canView]);

  const fetchHistory = async () => {
    if (!selectedStoreId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.rpc('get_queue_removal_history', {
        p_store_id: selectedStoreId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });

      if (fetchError) throw fetchError;

      setRecords(data || []);
    } catch (err: any) {
      console.error('Error fetching removal history:', err);
      setError(err.message || 'Failed to load removal history');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (records.length === 0) return;

    const headers = [
      'Date/Time',
      'Technician',
      'Employee Code',
      'Removed By',
      'Reason',
      'Notes',
      'Cooldown Status',
      'Minutes Remaining'
    ];

    const rows = records.map(record => [
      new Date(record.removed_at).toLocaleString(),
      record.employee_name,
      record.employee_code,
      record.removed_by_name,
      record.reason,
      record.notes || '',
      record.is_active ? 'Active' : 'Expired',
      record.minutes_remaining?.toString() || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-removals-${startDate}-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!canView) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Access Denied</h3>
            <p className="text-sm text-red-700 mt-1">
              You do not have permission to view queue removal history.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Queue Removal History</h1>
        <p className="text-gray-600">
          View all technician removals from the queue with reasons and cooldown status
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button onClick={fetchHistory} disabled={loading}>
            {loading ? 'Loading...' : 'Apply Filter'}
          </Button>
          {records.length > 0 && (
            <Button variant="secondary" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No removals found for the selected date range</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Technician
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Removed By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatDateTime(record.removed_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{record.employee_name}</div>
                        <div className="text-xs text-gray-500">{record.employee_code}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {record.removed_by_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {record.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                      {record.notes || (
                        <span className="text-gray-400 italic">No additional notes</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {record.is_active ? (
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Active
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {record.minutes_remaining} min remaining
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Expired
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 text-center">
          Showing {records.length} removal{records.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
