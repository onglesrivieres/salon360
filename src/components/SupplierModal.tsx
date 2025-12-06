import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from './ui/Toast';
import { supabase, Supplier } from '../lib/supabase';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier?: Supplier | null;
}

export function SupplierModal({ isOpen, onClose, onSuccess, supplier }: SupplierModalProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    notes: '',
  });

  useEffect(() => {
    if (supplier && isOpen) {
      setFormData({
        name: supplier.name,
        contact: supplier.contact || '',
        notes: supplier.notes || '',
      });
    } else if (!supplier && isOpen) {
      setFormData({
        name: '',
        contact: '',
        notes: '',
      });
    }
  }, [supplier, isOpen]);

  function handleClose() {
    setFormData({
      name: '',
      contact: '',
      notes: '',
    });
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Please enter a supplier name', 'error');
      return;
    }

    if (formData.name.trim().length < 2) {
      showToast('Supplier name must be at least 2 characters', 'error');
      return;
    }

    try {
      setSaving(true);

      const supplierName = formData.name.trim();

      if (supplier) {
        const oldName = supplier.name;
        const nameChanged = oldName !== supplierName;

        if (nameChanged) {
          const { data: existingSupplier } = await supabase
            .from('suppliers')
            .select('id')
            .eq('name', supplierName)
            .neq('id', supplier.id)
            .maybeSingle();

          if (existingSupplier) {
            showToast('A supplier with this name already exists', 'error');
            setSaving(false);
            return;
          }

          const { data: itemCount } = await supabase
            .from('master_inventory_items')
            .select('id', { count: 'exact', head: true })
            .eq('supplier', oldName);

          if (itemCount && (itemCount as any).count > 0) {
            const confirmed = confirm(
              `This supplier has ${(itemCount as any).count} item(s). Changing the name will update all associated items. Continue?`
            );

            if (!confirmed) {
              setSaving(false);
              return;
            }

            await supabase
              .from('master_inventory_items')
              .update({ supplier: supplierName })
              .eq('supplier', oldName);
          }
        }

        const { error: updateError } = await supabase
          .from('suppliers')
          .update({
            name: supplierName,
            contact: formData.contact.trim() || null,
            notes: formData.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', supplier.id);

        if (updateError) throw updateError;
        showToast('Supplier updated successfully', 'success');
      } else {
        const { data: existingSupplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('name', supplierName)
          .maybeSingle();

        if (existingSupplier) {
          showToast('A supplier with this name already exists', 'error');
          setSaving(false);
          return;
        }

        const { error: insertError } = await supabase
          .from('suppliers')
          .insert({
            name: supplierName,
            contact: formData.contact.trim() || null,
            notes: formData.notes.trim() || null,
            is_active: true,
          });

        if (insertError) throw insertError;
        showToast('Supplier added successfully', 'success');
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error saving supplier:', error);

      if (error.code === '23505') {
        showToast('Supplier name already exists', 'error');
      } else if (error.code === '42501') {
        showToast('Permission denied. Only Admins, Managers, and Owners can manage suppliers.', 'error');
      } else if (error.message) {
        showToast(`Error: ${error.message}`, 'error');
      } else {
        showToast('Failed to save supplier', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={supplier ? 'Edit Supplier' : 'Add New Supplier'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supplier Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Beauty Supply Co"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Information
          </label>
          <Input
            value={formData.contact}
            onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            placeholder="Phone or email (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes (optional)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Saving...' : supplier ? 'Update Supplier' : 'Add Supplier'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
