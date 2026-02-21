import { useState, useEffect } from 'react';
import { Package, User, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { supabase, DistributionBatchDetail } from '../../lib/supabase';
import { formatDateTimeEST } from '../../lib/timezone';

interface DistributionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
}

export function DistributionDetailModal({ isOpen, onClose, batchId }: DistributionDetailModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<DistributionBatchDetail[]>([]);

  useEffect(() => {
    if (isOpen && batchId) {
      fetchDetails();
    }
  }, [isOpen, batchId]);

  async function fetchDetails() {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_distribution_batch_details', {
        p_batch_id: batchId,
      });

      if (error) throw error;
      setDetails(data || []);
    } catch (error: any) {
      showToast(error.message || 'Failed to load distribution details', 'error');
    } finally {
      setLoading(false);
    }
  }

  const first = details[0];
  const totalQty = details.reduce((sum, d) => sum + d.quantity, 0);
  const totalValue = details.reduce((sum, d) => sum + d.quantity * d.unit_cost, 0);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Distribution Details"
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : details.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No details found</p>
      ) : (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="bg-green-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-gray-900">{first.item_name}</span>
              <Badge variant={first.status === 'rejected' ? 'danger' : 'success'}>
                {first.status === 'rejected' ? 'REJECTED' : 'DISTRIBUTION'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Distributed by:</span>{' '}
                <span className="font-medium">{first.distributed_by_name}</span>
              </div>
              <div>
                <span className="text-gray-500">To:</span>{' '}
                <span className="font-medium">{first.to_employee_name}</span>
              </div>
              <div>
                <span className="text-gray-500">Date:</span>{' '}
                <span className="font-medium">{formatDateTimeEST(first.distribution_date)}</span>
              </div>
              <div>
                <span className="text-gray-500">Total:</span>{' '}
                <span className="font-medium">{totalQty} units &bull; ${totalValue.toFixed(2)}</span>
              </div>
            </div>
            {first.condition_notes && (
              <p className="text-sm text-gray-600 italic">{first.condition_notes}</p>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                first.status === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : first.status !== 'pending'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {first.status === 'rejected'
                ? 'Rejected'
                : first.status !== 'pending'
                  ? 'Acknowledged'
                  : 'Pending Acknowledgment'}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                first.status === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : first.manager_approved
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {first.status === 'rejected'
                ? 'Rejected'
                : first.manager_approved
                  ? 'Manager Approved'
                  : 'Pending Manager Approval'}
            </span>
          </div>

          {/* Manager Approval Info */}
          {first.manager_approved && first.manager_approved_by_name && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
              <CheckCircle className="w-4 h-4" />
              <span>
                Approved by {first.manager_approved_by_name}
                {first.manager_approved_at && ` on ${formatDateTimeEST(first.manager_approved_at)}`}
              </span>
            </div>
          )}

          {/* Rejection Info */}
          {first.status === 'rejected' && (
            <div className="bg-red-50 p-3 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <XCircle className="w-4 h-4" />
                <span className="font-medium">
                  Rejected by {first.rejected_by_name}
                  {first.rejected_at && ` on ${formatDateTimeEST(first.rejected_at)}`}
                </span>
              </div>
              {first.rejection_reason && (
                <p className="text-sm text-red-600 ml-6">{first.rejection_reason}</p>
              )}
            </div>
          )}

          {/* Lot Breakdown Table */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Lot Breakdown ({details.length} {details.length === 1 ? 'lot' : 'lots'})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-3 text-gray-500 font-medium">Distribution #</th>
                    <th className="text-left py-2 pr-3 text-gray-500 font-medium">Lot #</th>
                    <th className="text-right py-2 pr-3 text-gray-500 font-medium">Qty</th>
                    <th className="text-right py-2 pr-3 text-gray-500 font-medium">Unit Cost</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d) => (
                    <tr key={d.distribution_id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-gray-700 font-mono text-xs">{d.distribution_number}</td>
                      <td className="py-2 pr-3 text-gray-700 font-mono text-xs">{d.lot_number}</td>
                      <td className="py-2 pr-3 text-right text-gray-900">{d.quantity}</td>
                      <td className="py-2 pr-3 text-right text-gray-600">${d.unit_cost.toFixed(2)}</td>
                      <td className="py-2 text-right text-gray-900 font-medium">
                        ${(d.quantity * d.unit_cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={2} className="py-2 font-semibold text-gray-700">Total</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{totalQty}</td>
                    <td className="py-2"></td>
                    <td className="py-2 text-right font-semibold text-gray-900">${totalValue.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
