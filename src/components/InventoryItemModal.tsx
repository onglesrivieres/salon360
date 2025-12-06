import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import { supabase, InventoryItem, MasterInventoryItem, Supplier } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SupplierModal } from './SupplierModal';
import { PurchaseUnitManager } from './PurchaseUnitManager';
import { Permissions } from '../lib/permissions';
import { UNITS, CATEGORIES } from '../lib/inventory-constants';

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
  const [existingMasterItem, setExistingMasterItem] = useState<MasterInventoryItem | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [formData, setFormData] = useState({
    supplier: '',
    brand: '',
    name: '',
    description: '',
    category: '',
    unit: 'piece',
    quantity_on_hand: '0',
    reorder_level: '0',
    unit_cost: '0',
  });

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (item) {
      setFormData({
        supplier: item.supplier || '',
        brand: item.brand || '',
        name: item.name,
        description: item.description || '',
        category: item.category,
        unit: item.unit,
        quantity_on_hand: item.quantity_on_hand.toString(),
        reorder_level: item.reorder_level.toString(),
        unit_cost: item.unit_cost.toString(),
      });
      if (item.master_item_id) {
        setExistingMasterItem({
          id: item.master_item_id,
          name: item.name,
          description: item.description,
          category: item.category,
          unit: item.unit,
          unit_cost: item.unit_cost,
          reorder_level: item.reorder_level,
          brand: item.brand,
          supplier: item.supplier,
          is_active: item.is_active,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }
    } else {
      setFormData({
        supplier: '',
        brand: '',
        name: '',
        description: '',
        category: '',
        unit: 'piece',
        quantity_on_hand: '0',
        reorder_level: '0',
        unit_cost: '0',
      });
      setExistingMasterItem(null);
    }
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

      let masterItemId: string;

      if (item && item.master_item_id) {
        masterItemId = item.master_item_id;

        const { error: updateError } = await supabase
          .from('store_inventory_stock')
          .update({
            quantity_on_hand: parseFloat(formData.quantity_on_hand) || 0,
            unit_cost_override: parseFloat(formData.unit_cost) || null,
            reorder_level_override: parseFloat(formData.reorder_level) || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
        showToast('Item updated successfully', 'success');
      } else if (existingMasterItem) {
        masterItemId = existingMasterItem.id;

        const { data: existingStock } = await supabase
          .from('store_inventory_stock')
          .select('id')
          .eq('store_id', selectedStoreId)
          .eq('item_id', masterItemId)
          .maybeSingle();

        if (existingStock) {
          showToast('This item already exists in this store', 'error');
          setSaving(false);
          return;
        }

        const { error: stockError } = await supabase
          .from('store_inventory_stock')
          .insert({
            store_id: selectedStoreId,
            item_id: masterItemId,
            quantity_on_hand: parseFloat(formData.quantity_on_hand) || 0,
            unit_cost_override:
              parseFloat(formData.unit_cost) !== existingMasterItem.unit_cost
                ? parseFloat(formData.unit_cost)
                : null,
            reorder_level_override:
              parseFloat(formData.reorder_level) !== existingMasterItem.reorder_level
                ? parseFloat(formData.reorder_level)
                : null,
          });

        if (stockError) throw stockError;
        showToast('Item added to store successfully', 'success');
      } else {
        const masterItemData = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          unit: formData.unit,
          unit_cost: parseFloat(formData.unit_cost) || 0,
          reorder_level: parseFloat(formData.reorder_level) || 0,
          brand: formData.brand.trim() || null,
          supplier: formData.supplier,
          is_active: true,
        };

        const { data: newMasterItem, error: masterError } = await supabase
          .from('master_inventory_items')
          .insert(masterItemData)
          .select()
          .single();

        if (masterError) throw masterError;
        masterItemId = newMasterItem.id;

        const { error: stockError } = await supabase
          .from('store_inventory_stock')
          .insert({
            store_id: selectedStoreId,
            item_id: masterItemId,
            quantity_on_hand: parseFloat(formData.quantity_on_hand) || 0,
          });

        if (stockError) throw stockError;
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
  const isUsingMasterItem = !!existingMasterItem && !item;
  const isNewMasterItem = !existingMasterItem && !item;

  const canCreateSupplier = session ? Permissions.suppliers.canCreate(session.role) : false;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Item' : 'Add Item'} size="lg">
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
              disabled={isUsingMasterItem}
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
            disabled={isUsingMasterItem}
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
            disabled={isUsingMasterItem}
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
            disabled={isUsingMasterItem}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <Select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              disabled={isUsingMasterItem}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Cost ($)
              {isUsingMasterItem && (
                <span className="text-xs text-gray-500 ml-1">(override)</span>
              )}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.unit_cost}
              onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reorder Level
              {isUsingMasterItem && (
                <span className="text-xs text-gray-500 ml-1">(override)</span>
              )}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.reorder_level}
              onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isEditingExistingItem ? 'Current Quantity' : 'Initial Quantity'}
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.quantity_on_hand}
            onChange={(e) => setFormData({ ...formData, quantity_on_hand: e.target.value })}
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1">
            Store-specific quantity. Use transactions to adjust stock.
          </p>
        </div>

        {(item?.master_item_id || existingMasterItem) && (
          <PurchaseUnitManager
            masterItemId={item?.master_item_id || existingMasterItem?.id || ''}
            isOpen={isOpen}
          />
        )}

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Saving...' : item ? 'Update' : isUsingMasterItem ? 'Add to Store' : 'Create Item'}
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
    </>
  );
}
