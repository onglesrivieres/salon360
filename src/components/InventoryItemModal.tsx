import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import { supabase, InventoryItem } from '../lib/supabase';
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
    }
  }, [item, isOpen]);

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

      const itemData = {
        store_id: selectedStoreId,
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        unit: formData.unit,
        quantity_on_hand: parseFloat(formData.quantity_on_hand) || 0,
        reorder_level: parseFloat(formData.reorder_level) || 0,
        unit_cost: parseFloat(formData.unit_cost) || 0,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (item) {
        const { error } = await supabase
          .from('inventory_items')
          .update(itemData)
          .eq('id', item.id);

        if (error) throw error;
        showToast('Item updated successfully', 'success');
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert({
            ...itemData,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
        showToast('Item created successfully', 'success');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving item:', error);
      if (error.code === '23505') {
        showToast('Item code already exists', 'error');
      } else {
        showToast('Failed to save item', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Item' : 'Add New Item'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Code <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., POLISH-001"
              required
              disabled={!!item}
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
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <Select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost ($)</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
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

        {!item && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Quantity
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
              For existing items, use IN transaction to adjust quantity
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Saving...' : item ? 'Update Item' : 'Add Item'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
