import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import { supabase, InventoryItem, MasterInventoryItem } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface InventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  onSuccess: () => void;
}

const CATEGORIES = [
  'Polish',
  'Tools',
  'Supplies',
  'Equipment',
  'Furniture',
  'Cleaning',
  'PPE',
  'Other',
];

const UNITS = [
  'piece',
  'bottle',
  'box',
  'pack',
  'gallon',
  'liter',
  'set',
  'pair',
];

export function InventoryItemModal({ isOpen, onClose, item, onSuccess }: InventoryItemModalProps) {
  const { showToast } = useToast();
  const { selectedStoreId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [searchingItem, setSearchingItem] = useState(false);
  const [existingMasterItem, setExistingMasterItem] = useState<MasterInventoryItem | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    unit: 'piece',
    quantity_on_hand: '0',
    reorder_level: '0',
    unit_cost: '0',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code,
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
          code: item.code,
          name: item.name,
          description: item.description,
          category: item.category,
          unit: item.unit,
          unit_cost: item.unit_cost,
          reorder_level: item.reorder_level,
          is_active: item.is_active,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }
    } else {
      setFormData({
        code: '',
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

  async function handleCodeBlur() {
    if (!formData.code.trim() || item) return;

    try {
      setSearchingItem(true);
      const { data, error } = await supabase
        .from('master_inventory_items')
        .select('*')
        .eq('code', formData.code.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingMasterItem(data);
        setFormData({
          ...formData,
          name: data.name,
          description: data.description,
          category: data.category,
          unit: data.unit,
          unit_cost: data.unit_cost.toString(),
          reorder_level: data.reorder_level.toString(),
        });
        showToast(`Found existing item: ${data.name}`, 'success');
      } else {
        setExistingMasterItem(null);
      }
    } catch (error) {
      console.error('Error searching for item:', error);
    } finally {
      setSearchingItem(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedStoreId) {
      showToast('No store selected', 'error');
      return;
    }

    if (!formData.code || !formData.name || !formData.category) {
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
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          unit: formData.unit,
          unit_cost: parseFloat(formData.unit_cost) || 0,
          reorder_level: parseFloat(formData.reorder_level) || 0,
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

      if (error.code === '23505') {
        showToast('Item code already exists', 'error');
      } else if (error.code === '23503') {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Item' : 'Add Item'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                onBlur={handleCodeBlur}
                placeholder="e.g., POLISH-001"
                required
                disabled={isEditingExistingItem}
              />
              {searchingItem && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Search className="w-4 h-4 text-gray-400 animate-pulse" />
                </div>
              )}
            </div>
            {!isEditingExistingItem && (
              <p className="text-xs text-gray-500 mt-1">
                {isUsingMasterItem
                  ? '✓ Found in catalog - adding to this store'
                  : 'Company-wide unique code'}
              </p>
            )}
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., OPI Polish - Red"
            required
            disabled={isUsingMasterItem}
          />
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
  );
}
