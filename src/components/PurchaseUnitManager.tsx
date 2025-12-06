import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Star } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from './ui/Toast';
import { supabase, PurchaseUnit } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PurchaseUnitManagerProps {
  masterItemId: string;
  isOpen: boolean;
}

export function PurchaseUnitManager({ masterItemId, isOpen }: PurchaseUnitManagerProps) {
  const { showToast } = useToast();
  const { selectedStoreId } = useAuth();
  const [purchaseUnits, setPurchaseUnits] = useState<PurchaseUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [formData, setFormData] = useState({ unit_name: '', multiplier: '' });

  useEffect(() => {
    if (isOpen && masterItemId && selectedStoreId) {
      fetchPurchaseUnits();
    }
  }, [isOpen, masterItemId, selectedStoreId]);

  async function fetchPurchaseUnits() {
    if (!selectedStoreId || !masterItemId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('store_product_purchase_units')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('master_item_id', masterItemId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPurchaseUnits(data || []);
    } catch (error) {
      console.error('Error fetching purchase units:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!selectedStoreId || !masterItemId) return;
    if (!formData.unit_name.trim() || !formData.multiplier) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    const multiplier = parseFloat(formData.multiplier);
    if (multiplier <= 0) {
      showToast('Multiplier must be greater than zero', 'error');
      return;
    }

    try {
      const isFirstUnit = purchaseUnits.length === 0;
      const { error } = await supabase
        .from('store_product_purchase_units')
        .insert({
          store_id: selectedStoreId,
          master_item_id: masterItemId,
          unit_name: formData.unit_name.trim(),
          multiplier,
          is_default: isFirstUnit,
          display_order: purchaseUnits.length,
        });

      if (error) throw error;

      showToast('Purchase unit added successfully', 'success');
      setFormData({ unit_name: '', multiplier: '' });
      setAddingNew(false);
      fetchPurchaseUnits();
    } catch (error: any) {
      console.error('Error adding purchase unit:', error);
      if (error.code === '23505') {
        showToast('A purchase unit with this name already exists', 'error');
      } else {
        showToast('Failed to add purchase unit', 'error');
      }
    }
  }

  async function handleUpdate(id: string) {
    if (!formData.unit_name.trim() || !formData.multiplier) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    const multiplier = parseFloat(formData.multiplier);
    if (multiplier <= 0) {
      showToast('Multiplier must be greater than zero', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('store_product_purchase_units')
        .update({
          unit_name: formData.unit_name.trim(),
          multiplier,
        })
        .eq('id', id);

      if (error) throw error;

      showToast('Purchase unit updated successfully', 'success');
      setEditingId(null);
      setFormData({ unit_name: '', multiplier: '' });
      fetchPurchaseUnits();
    } catch (error: any) {
      console.error('Error updating purchase unit:', error);
      if (error.code === '23505') {
        showToast('A purchase unit with this name already exists', 'error');
      } else {
        showToast('Failed to update purchase unit', 'error');
      }
    }
  }

  async function handleDelete(id: string, isDefault: boolean) {
    if (isDefault && purchaseUnits.length === 1) {
      showToast('Cannot delete the only purchase unit', 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete this purchase unit?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('store_product_purchase_units')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showToast('Purchase unit deleted successfully', 'success');
      fetchPurchaseUnits();
    } catch (error) {
      console.error('Error deleting purchase unit:', error);
      showToast('Failed to delete purchase unit', 'error');
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const { error } = await supabase
        .from('store_product_purchase_units')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;

      showToast('Default purchase unit updated', 'success');
      fetchPurchaseUnits();
    } catch (error) {
      console.error('Error setting default:', error);
      showToast('Failed to update default', 'error');
    }
  }

  function startEdit(unit: PurchaseUnit) {
    setEditingId(unit.id);
    setFormData({ unit_name: unit.unit_name, multiplier: unit.multiplier.toString() });
    setAddingNew(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setAddingNew(false);
    setFormData({ unit_name: '', multiplier: '' });
  }

  if (!isOpen) return null;

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Purchase Units</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Define how this product can be purchased (e.g., single, pack, case)
          </p>
        </div>
        {!addingNew && !editingId && (
          <Button
            type="button"
            onClick={() => setAddingNew(true)}
            size="sm"
            variant="secondary"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Unit
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 text-center py-4">Loading...</div>
      ) : (
        <div className="space-y-2">
          {purchaseUnits.map((unit) => (
            <div
              key={unit.id}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
            >
              {editingId === unit.id ? (
                <>
                  <Input
                    type="text"
                    value={formData.unit_name}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_name: e.target.value })
                    }
                    placeholder="e.g., Pack of 6"
                    className="flex-1 text-sm"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.multiplier}
                    onChange={(e) =>
                      setFormData({ ...formData, multiplier: e.target.value })
                    }
                    placeholder="Multiplier"
                    className="w-24 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate(unit.id)}
                    className="text-green-600 hover:text-green-700 p-1"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-gray-600 hover:text-gray-700 p-1"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {unit.unit_name}
                      </span>
                      {unit.is_default && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          <Star className="w-3 h-3 mr-0.5" />
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      Multiplier: x{unit.multiplier}
                    </span>
                  </div>
                  {!unit.is_default && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(unit.id)}
                      className="text-gray-400 hover:text-blue-600 p-1"
                      title="Set as default"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(unit)}
                    className="text-gray-600 hover:text-blue-600 p-1"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(unit.id, unit.is_default)}
                    className="text-gray-600 hover:text-red-600 p-1"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}

          {addingNew && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <Input
                type="text"
                value={formData.unit_name}
                onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                placeholder="e.g., Pack of 6 bottles"
                className="flex-1 text-sm"
                autoFocus
              />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.multiplier}
                onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
                placeholder="6"
                className="w-24 text-sm"
              />
              <button
                type="button"
                onClick={handleAdd}
                className="text-green-600 hover:text-green-700 p-1"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-gray-600 hover:text-gray-700 p-1"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {purchaseUnits.length === 0 && !addingNew && (
            <div className="text-sm text-gray-500 text-center py-4">
              No purchase units defined. Add one to get started.
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        Purchase units are editable. Changes won't affect historical transactions.
      </p>
    </div>
  );
}
