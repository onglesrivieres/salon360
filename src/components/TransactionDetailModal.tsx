import { useState, useEffect, useMemo } from 'react';
import { Package, User, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useToast } from './ui/Toast';
import { supabase, TransactionDetail, InventoryTransactionItemPhotoWithUrl } from '../lib/supabase';
import { batchIn } from '../lib/batch-queries';
import { formatDateTimeEST } from '../lib/timezone';
import { useSettings } from '../contexts/SettingsContext';
import { getStorageService, type StorageService } from '../lib/storage';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
}

export function TransactionDetailModal({ isOpen, onClose, transactionId }: TransactionDetailModalProps) {
  const { showToast } = useToast();
  const { getStorageConfig } = useSettings();
  const [loading, setLoading] = useState(false);
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  // Map<transactionItemId, photos[]>
  const [itemPhotos, setItemPhotos] = useState<Map<string, InventoryTransactionItemPhotoWithUrl[]>>(new Map());

  const storageConfig = getStorageConfig();
  const storagePublicUrl = storageConfig?.r2Config?.publicUrl;
  const storage: StorageService | null = useMemo(() => {
    if (!storageConfig || !storagePublicUrl) return null;
    try {
      return getStorageService(storageConfig);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePublicUrl]);

  useEffect(() => {
    if (isOpen && transactionId) {
      fetchTransactionDetails();
    }
  }, [isOpen, transactionId]);

  async function fetchTransactionDetails() {
    try {
      setLoading(true);

      const { data: transactionData, error: transactionError } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          requested_by:employees!inventory_transactions_requested_by_id_fkey(display_name),
          recipient:employees!inventory_transactions_recipient_id_fkey(display_name),
          supplier:suppliers(name),
          recipient_approved_by:employees!inventory_transactions_recipient_approved_by_id_fkey(display_name),
          manager_approved_by:employees!inventory_transactions_manager_approved_by_id_fkey(display_name)
        `)
        .eq('id', transactionId)
        .maybeSingle();

      if (transactionError) throw transactionError;
      if (!transactionData) {
        showToast('Transaction not found', 'error');
        onClose();
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('inventory_transaction_items')
        .select(`
          *,
          purchase_unit:store_product_purchase_units(unit_name, multiplier)
        `)
        .eq('transaction_id', transactionId);

      if (itemsError) throw itemsError;

      const inventoryItemIds = [...new Set(itemsData.map((item: any) => item.item_id).filter(Boolean))];

      const inventoryItemsData = await batchIn<{ id: string; name: string; unit: string }>(
        (ids) => supabase.from('inventory_items').select('id, name, unit').in('id', ids),
        inventoryItemIds
      );

      const itemsMap = new Map(inventoryItemsData.map((item) => [item.id, item]));

      const detail: TransactionDetail = {
        id: transactionData.id,
        transaction_number: transactionData.transaction_number,
        transaction_type: transactionData.transaction_type,
        status: transactionData.status,
        created_at: transactionData.created_at,
        requested_by_id: transactionData.requested_by_id,
        requested_by_name: transactionData.requested_by?.display_name || 'Unknown',
        recipient_id: transactionData.recipient_id,
        recipient_name: transactionData.recipient?.display_name,
        supplier_id: transactionData.supplier_id,
        supplier_name: transactionData.supplier?.name,
        invoice_reference: transactionData.invoice_reference,
        notes: transactionData.notes || '',
        requires_recipient_approval: transactionData.requires_recipient_approval,
        requires_manager_approval: transactionData.requires_manager_approval,
        recipient_approved: transactionData.recipient_approved,
        recipient_approved_at: transactionData.recipient_approved_at,
        recipient_approved_by_name: transactionData.recipient_approved_by?.display_name,
        manager_approved: transactionData.manager_approved,
        manager_approved_at: transactionData.manager_approved_at,
        manager_approved_by_name: transactionData.manager_approved_by?.display_name,
        rejection_reason: transactionData.rejection_reason,
        items: (itemsData || []).map((item: any) => {
          const inventoryItem = itemsMap.get(item.item_id);
          return {
            id: item.id,
            item_id: item.item_id,
            item_name: inventoryItem?.name || 'Unknown Item',
            purchase_unit_name: item.purchase_unit?.unit_name,
            purchase_quantity: item.purchase_quantity,
            purchase_unit_price: item.purchase_unit_price,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            notes: item.notes || '',
          };
        }),
      };

      setTransaction(detail);

      // Fetch photos for all transaction items
      const itemIds = (itemsData || []).map((item: any) => item.id).filter(Boolean);
      if (itemIds.length > 0) {
        const photosData = await batchIn<any>(
          (ids) => supabase
            .from('inventory_transaction_item_photos')
            .select('*')
            .in('transaction_item_id', ids)
            .order('display_order', { ascending: true }),
          itemIds
        );

        if (photosData.length > 0) {
          const photosMap = new Map<string, InventoryTransactionItemPhotoWithUrl[]>();
          for (const photo of photosData) {
            const url = storage ? storage.getPublicUrl(photo.storage_path) : photo.storage_path;
            const photoWithUrl: InventoryTransactionItemPhotoWithUrl = { ...photo, url };
            const existing = photosMap.get(photo.transaction_item_id) || [];
            existing.push(photoWithUrl);
            photosMap.set(photo.transaction_item_id, existing);
          }
          setItemPhotos(photosMap);
        } else {
          setItemPhotos(new Map());
        }
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      showToast('Failed to load transaction details', 'error');
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadgeVariant(status: string): 'default' | 'warning' | 'success' | 'danger' {
    switch (status) {
      case 'draft':
        return 'default';
      case 'pending':
        return 'warning';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      default:
        return 'warning';
    }
  }

  function getTypeBadgeVariant(type: string): 'success' | 'warning' {
    return type === 'in' ? 'success' : 'warning';
  }

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details" size="xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!transaction) {
    return null;
  }

  const totalValue = transaction.items.reduce((sum, item) => {
    if (transaction.transaction_type === 'in' && item.purchase_unit_price && item.purchase_quantity) {
      return sum + item.purchase_quantity * item.purchase_unit_price;
    }
    return sum + item.quantity * item.unit_cost;
  }, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details" size="xl">
      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Transaction Number</p>
              <p className="text-lg font-semibold text-gray-900">{transaction.transaction_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Date</p>
              <p className="text-lg font-semibold text-gray-900">{formatDateTimeEST(transaction.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Type</p>
              <Badge variant={getTypeBadgeVariant(transaction.transaction_type)} className="text-sm">
                {transaction.transaction_type === 'in' ? 'STOCK IN' : 'STOCK OUT'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <Badge variant={getStatusBadgeVariant(transaction.status)} className="text-sm">
                {transaction.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Requested By</p>
                <p className="text-sm text-gray-900">{transaction.requested_by_name}</p>
              </div>
            </div>

            {transaction.recipient_name && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Recipient</p>
                  <p className="text-sm text-gray-900">{transaction.recipient_name}</p>
                </div>
              </div>
            )}

            {transaction.supplier_name && (
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Supplier</p>
                  <p className="text-sm text-gray-900">{transaction.supplier_name}</p>
                </div>
              </div>
            )}

            {transaction.invoice_reference && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Invoice Reference</p>
                  <p className="text-sm text-gray-900">{transaction.invoice_reference}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Approval Status</h4>

            {transaction.requires_recipient_approval && (
              <div className="flex items-start gap-3">
                {transaction.recipient_approved ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">Recipient Approval</p>
                  {transaction.recipient_approved ? (
                    <p className="text-sm text-gray-900">
                      Approved by {transaction.recipient_approved_by_name}
                      <br />
                      <span className="text-xs text-gray-500">
                        {formatDateTimeEST(transaction.recipient_approved_at || '')}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-yellow-600">Pending</p>
                  )}
                </div>
              </div>
            )}

            {transaction.requires_manager_approval && (
              <div className="flex items-start gap-3">
                {transaction.manager_approved ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">Manager Approval</p>
                  {transaction.manager_approved ? (
                    <p className="text-sm text-gray-900">
                      Approved by {transaction.manager_approved_by_name}
                      <br />
                      <span className="text-xs text-gray-500">
                        {formatDateTimeEST(transaction.manager_approved_at || '')}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-yellow-600">Pending</p>
                  )}
                </div>
              </div>
            )}

            {transaction.status === 'rejected' && transaction.rejection_reason && (
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Rejection Reason</p>
                  <p className="text-sm text-red-600">{transaction.rejection_reason}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {transaction.notes && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{transaction.notes}</p>
          </div>
        )}

        <div>
          <h4 className="font-medium text-gray-900 mb-3">Items</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Item Name
                  </th>
                  {transaction.transaction_type === 'in' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Purchase Unit
                    </th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Quantity
                  </th>
                  {transaction.transaction_type === 'in' && (
                    <>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Total
                      </th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transaction.items.map((item) => {
                  const photos = itemPhotos.get(item.id) || [];
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.item_name}
                        {photos.length > 0 && (
                          <div className="flex gap-2 flex-wrap mt-2">
                            {photos.map(photo => (
                              <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={photo.url}
                                  alt={photo.filename}
                                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:ring-2 hover:ring-blue-400"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      {transaction.transaction_type === 'in' && (
                        <td className="px-4 py-3 text-sm text-gray-700">{item.purchase_unit_name || 'N/A'}</td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {transaction.transaction_type === 'in' ? item.purchase_quantity : item.quantity}
                      </td>
                      {transaction.transaction_type === 'in' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            ${(item.purchase_unit_price || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            ${((item.purchase_quantity || 0) * (item.purchase_unit_price || 0)).toFixed(2)}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-500">{item.notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
              {transaction.transaction_type === 'in' && totalValue > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      Total Value:
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      ${totalValue.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
