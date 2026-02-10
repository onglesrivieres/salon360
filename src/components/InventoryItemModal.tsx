import { useState, useEffect } from 'react';
import { ArrowUpDown, Info } from 'lucide-react';
import { Drawer } from './ui/Drawer';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { NumericInput } from './ui/NumericInput';
import { Select } from './ui/Select';
import { SearchableSelect } from './ui/SearchableSelect';
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
    size: '',
  });
  const [itemType, setItemType] = useState<'standalone' | 'master' | 'sub'>('standalone');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [masterItems, setMasterItems] = useState<InventoryItem[]>([]);
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [loadingTransactionCount, setLoadingTransactionCount] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      fetchMasterItems();
      if (item) {
        fetchTransactionCount();
      }
    }
  }, [isOpen, item]);

  async function fetchMasterItems() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from('store_inventory_levels')
        .select('*, item:inventory_items!inner(*)')
        .eq('store_id', selectedStoreId)
        .eq('is_active', true)
        .eq('inventory_items.is_master_item', true)
        .order('name', { referencedTable: 'inventory_items' });

      if (error) throw error;

      // Flatten to InventoryItem shape
      const items = (data || []).map((level: any) => ({
        ...level.item,
        store_id: level.store_id,
        quantity_on_hand: level.quantity_on_hand,
        unit_cost: level.unit_cost,
        reorder_level: level.reorder_level,
        is_active: level.is_active,
      }));
      setMasterItems(items);
    } catch (error) {
      console.error('Error fetching master items:', error);
    }
  }

  useEffect(() => {
    if (item) {
      setFormData({
        supplier: item.supplier || '',
        brand: item.brand || '',
        name: item.name,
        description: item.description || '',
        category: item.category,
        reorder_level: item.reorder_level.toString(),
        size: item.size || '',
      });
      // Set item type based on existing item
      if (item.is_master_item) {
        setItemType('master');
        setSelectedParentId(null);
      } else if (item.parent_id) {
        setItemType('sub');
        setSelectedParentId(item.parent_id);
      } else {
        setItemType('standalone');
        setSelectedParentId(null);
      }
    } else {
      setFormData({
        supplier: '',
        brand: '',
        name: '',
        description: '',
        category: '',
        reorder_level: '0',
        size: '',
      });
      setItemType('standalone');
      setSelectedParentId(null);
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

    // Validation - master items don't need supplier, sub-items need parent
    const isMasterItem = itemType === 'master';
    const isSubItem = itemType === 'sub';

    if (!isMasterItem && !formData.supplier) {
      showToast('Please select a supplier', 'error');
      return;
    }

    if (!formData.name || !formData.category) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (isSubItem && !selectedParentId) {
      showToast('Please select a parent master item', 'error');
      return;
    }

    try {
      setSaving(true);

      if (item) {
        // Update existing item - catalog fields go to inventory_items (global)
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            category: formData.category,
            brand: formData.brand.trim() || null,
            supplier: isMasterItem ? '' : formData.supplier,
            size: formData.size.trim() || null,
            is_master_item: isMasterItem,
            parent_id: isSubItem ? selectedParentId : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateError) throw updateError;

        // Per-store reorder_level goes to store_inventory_levels
        if (!isSubItem) {
          const { error: levelError } = await supabase
            .from('store_inventory_levels')
            .update({
              reorder_level: parseFloat(formData.reorder_level) || 0,
              updated_at: new Date().toISOString(),
            })
            .eq('store_id', selectedStoreId)
            .eq('item_id', item.id);

          if (levelError) throw levelError;
        }

        showToast('Item updated successfully', 'success');
      } else {
        // Create new item - global catalog entry (no store_id)
        // The DB trigger auto-creates store_inventory_levels for all active stores
        const itemData = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          unit: 'piece',
          brand: formData.brand.trim() || null,
          supplier: isMasterItem ? '' : formData.supplier,
          size: formData.size.trim() || null,
          is_master_item: isMasterItem,
          parent_id: isSubItem ? selectedParentId : null,
        };

        const { data: insertedItem, error: insertError } = await supabase
          .from('inventory_items')
          .insert(itemData)
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Update the reorder_level for the current store (trigger created levels with 0)
        if (!isSubItem && insertedItem) {
          const reorderLevel = parseFloat(formData.reorder_level) || 0;
          if (reorderLevel > 0) {
            await supabase
              .from('store_inventory_levels')
              .update({ reorder_level: reorderLevel, updated_at: new Date().toISOString() })
              .eq('store_id', selectedStoreId)
              .eq('item_id', insertedItem.id);
          }
        }

        showToast(`${isMasterItem ? 'Master item' : 'Item'} created successfully`, 'success');
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

  const masterItemOptions = masterItems.map(master => ({
    value: master.id,
    label: master.name,
  }));

  function handleParentSelect(value: string) {
    setSelectedParentId(value || null);
    const parent = masterItems.find(m => m.id === value);
    if (parent) {
      setFormData(prev => ({
        ...prev,
        brand: parent.brand || '',
        name: parent.name,
        size: parent.size || '',
        category: parent.category,
        description: parent.description || '',
      }));
    }
  }

  const canCreateSupplier = session ? Permissions.suppliers.canCreate(session.role) : false;

  return (
    <>
      <Drawer
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
        footer={
          <div className="flex gap-3">
            <Button type="submit" form="inventory-item-form" disabled={saving} className="flex-1">
              {saving ? 'Saving...' : item ? 'Update' : 'Create Item'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        }
      >
        <form id="inventory-item-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Item Type Selection - only for new items */}
          {!item && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Item Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="item_type"
                    checked={itemType === 'standalone'}
                    onChange={() => {
                      setItemType('standalone');
                      setSelectedParentId(null);
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">Standalone Item</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="item_type"
                    checked={itemType === 'master'}
                    onChange={() => {
                      setItemType('master');
                      setSelectedParentId(null);
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">Master Item (Group)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="item_type"
                    checked={itemType === 'sub'}
                    onChange={() => setItemType('sub')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">Sub-Item (Variation)</span>
                </label>
              </div>

              {/* Parent Selection for Sub-Items */}
              {itemType === 'sub' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent Master Item <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={masterItemOptions}
                    value={selectedParentId || ''}
                    onChange={handleParentSelect}
                    placeholder="Search master items..."
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Supplier - not required for master items */}
            {itemType !== 'master' && (
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
            )}

            {/* Brand */}
            {(
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
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={itemType === 'master' ? 'e.g., Gel Color Collection' : 'e.g., Base Gel'}
              required
            />
          </div>

          {/* Size - for master and sub-items */}
          {itemType !== 'standalone' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size
              </label>
              <Input
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                placeholder="e.g., Small, Medium, Large"
              />
            </div>
          )}

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

        {/* Reorder Level - not for sub-items */}
        {itemType !== 'sub' && (
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
        )}

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

      </form>
    </Drawer>

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
