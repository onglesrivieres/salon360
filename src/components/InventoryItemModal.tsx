import { useState, useEffect } from 'react';
import { ArrowUpDown, Info } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { NumericInput } from './ui/NumericInput';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import { supabase, InventoryItem, Supplier } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SupplierModal } from './SupplierModal';
import { PurchaseUnitManager } from './PurchaseUnitManager';
import { ItemTransactionHistoryModal } from './ItemTransactionHistoryModal';
import { TransactionDetailModal } from './TransactionDetailModal';
import { Permissions } from '../lib/permissions';
import { CATEGORIES } from '../lib/inventory-constants';

interface InventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  onSuccess: () => void;
}

export function InventoryItemModal({ isOpen, onClose, item, onSuccess }: InventoryItemModalProps) {
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [formData, setFormData] = useState({
    supplier: '',
    brand: '',
    name: '',
    description: '',
    category: '',
    reorder_level: '0',
  });
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [loadingTransactionCount, setLoadingTransactionCount] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      if (item) {
        fetchTransactionCount();
      }
    }
  }, [isOpen, item]);

  useEffect(() => {
    if (item) {
      setFormData({
        supplier: item.supplier || '',
        brand: item.brand || '',
        name: item.name,
        description: item.description || '',
        category: item.category,
        reorder_level: item.reorder_level.toString(),
      });
    } else {
      setFormData({
        supplier: '',
        brand: '',
        name: '',
        description: '',
        category: '',
        reorder_level: '0',
      });
    }
    setTransactionCount(0);
  }, [item, isOpen]);

  async function fetchSuppliers() {
    try {
      setLoadingSuppliers(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      showToast('Failed to load suppliers', 'error');
    } finally {
      setLoadingSuppliers(false);
    }
  }

  async function fetchTransactionCount() {
    if (!item?.id) return;

    try {
      setLoadingTransactionCount(true);
      const { count, error } = await supabase
        .from('inventory_transaction_items')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', item.id);

      if (error) throw error;
      setTransactionCount(count || 0);
    } catch (error) {
      console.error('Error fetching transaction count:', error);
    } finally {
      setLoadingTransactionCount(false);
    }
  }

  function handleSupplierDropdownChange(value: string) {
    if (value === '__add_new__') {
      setShowSupplierModal(true);
    } else {
      setFormData({ ...formData, supplier: value });
    }
  }

  function handleSupplierAdded() {
    fetchSuppliers();
    setShowSupplierModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedStoreId) {
      showToast('No store selected', 'error');
      return;
    }

    if (!formData.supplier || !formData.name || !formData.category) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setSaving(true);

      if (item) {
        // Update existing item
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            category: formData.category,
            brand: formData.brand.trim() || null,
            supplier: formData.supplier,
            reorder_level: parseFloat(formData.reorder_level) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
        showToast('Item updated successfully', 'success');
      } else {
        // Create new item
        const itemData = {
          store_id: selectedStoreId,
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          unit: 'piece',
          unit_cost: 0,
          quantity_on_hand: 0,
          reorder_level: parseFloat(formData.reorder_level) || 0,
          brand: formData.brand.trim() || null,
          supplier: formData.supplier,
          is_active: true,
        };

        const { error: insertError } = await supabase
          .from('inventory_items')
          .insert(itemData);

        if (insertError) throw insertError;
        showToast('New item created successfully', 'success');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving item:', error);

      if (error.code === '23503') {
        showToast('Invalid reference. Please refresh and try again.', 'error');
      } else if (error.code === '42501') {
        showToast('Permission denied. Please check your role permissions.', 'error');
      } else if (error.message) {
        showToast(`Error: ${error.message}`, 'error');
      } else {
        showToast('Failed to save item', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  const isEditingExistingItem = !!item;

  const canCreateSupplier = session ? Permissions.suppliers.canCreate(session.role) : false;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={item ? 'Edit Item' : 'Add Item'}
        size="lg"
        headerActions={
          item ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowTransactionHistory(true)}
              disabled={loadingTransactionCount}
              className="flex items-center gap-2"
            >
              <ArrowUpDown className="w-4 h-4" />
              View Transactions
              {transactionCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  {transactionCount}
                </span>
              )}
            </Button>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.supplier}
                onChange={(e) => handleSupplierDropdownChange(e.target.value)}
                required
                disabled={isEditingExistingItem || loadingSuppliers}
              >
                <option value="">Select Supplier</option>
                {!isEditingExistingItem && canCreateSupplier && (
                  <option value="__add_new__" className="text-blue-600 font-medium">
                    + Add New Supplier
                  </option>
                )}
                {suppliers.length > 0 && !isEditingExistingItem && canCreateSupplier && (
                  <option disabled>──────────</option>
                )}
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.name}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand
            </label>
            <Input
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="e.g., OPI"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Base Gel"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <Select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
          >
            <option value="">Select Category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reorder Level (Purchase Units)
          </label>
          <NumericInput
            step="1"
            min="0"
            value={formData.reorder_level}
            onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>Reorder when stock falls below this many purchase units (e.g., "2" means reorder when below 2 cases)</span>
          </p>
        </div>

        {item && (
          <>
            <PurchaseUnitManager
              masterItemId={item.id}
              isOpen={isOpen}
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-2">Store Units for Distribution Tracking</h4>
                  <p className="text-sm text-blue-800 mb-2">
                    Each purchase unit breaks down into smaller store units for employee distribution and theft prevention.
                  </p>
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Example:</span> A "Case of 24" purchase unit equals 24 "bottles" in store units.
                    Employees are tracked at the bottle level for precise accountability.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Saving...' : item ? 'Update' : 'Create Item'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>

      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSuccess={handleSupplierAdded}
      />

      {item && (
        <>
          <ItemTransactionHistoryModal
            isOpen={showTransactionHistory}
            onClose={() => setShowTransactionHistory(false)}
            item={item}
            onViewTransactionDetail={(transactionId) => {
              setSelectedTransactionId(transactionId);
              setShowTransactionHistory(false);
            }}
          />

          <TransactionDetailModal
            isOpen={!!selectedTransactionId}
            onClose={() => {
              setSelectedTransactionId(null);
              setShowTransactionHistory(true);
            }}
            transactionId={selectedTransactionId || ''}
          />
        </>
      )}
    </>
  );
}
