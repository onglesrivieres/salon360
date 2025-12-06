import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from './ui/Toast';
import { supabase } from '../lib/supabase';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (supplierName: string) => void;
}

function generateCodePrefix(name: string): string {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  let prefix = cleaned.slice(0, 4);

  if (prefix.length < 4) {
    prefix = prefix.padEnd(4, 'X');
  }

  return prefix;
}

export function SupplierModal({ isOpen, onClose, onSuccess }: SupplierModalProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    notes: '',
  });

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
      let codePrefix = generateCodePrefix(supplierName);

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

      let attempts = 0;
      const maxAttempts = 10;
      let supplierCreated = false;

      while (attempts < maxAttempts && !supplierCreated) {
        const { data: existingPrefix } = await supabase
          .from('suppliers')
          .select('id')
          .eq('code_prefix', codePrefix)
          .maybeSingle();

        if (!existingPrefix) {
          const { error: insertError } = await supabase
            .from('suppliers')
            .insert({
              name: supplierName,
              code_prefix: codePrefix,
              is_active: true,
            });

          if (insertError) {
            if (insertError.code === '23505') {
              attempts++;
              const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
              codePrefix = (supplierName.slice(0, 2) + randomSuffix).toUpperCase().padEnd(4, 'X');
              continue;
            }
            throw insertError;
          }

          supplierCreated = true;
          showToast('Supplier added successfully', 'success');
          onSuccess(supplierName);
          handleClose();
        } else {
          attempts++;
          const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
          codePrefix = (supplierName.slice(0, 2) + randomSuffix).toUpperCase().padEnd(4, 'X');
        }
      }

      if (!supplierCreated) {
        throw new Error('Failed to generate unique code prefix after multiple attempts');
      }
    } catch (error: any) {
      console.error('Error creating supplier:', error);

      if (error.code === '23505') {
        showToast('Supplier name already exists', 'error');
      } else if (error.code === '42501') {
        showToast('Permission denied. Only Managers and Owners can add suppliers.', 'error');
      } else if (error.message) {
        showToast(`Error: ${error.message}`, 'error');
      } else {
        showToast('Failed to add supplier', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  const codePreview = formData.name.trim()
    ? generateCodePrefix(formData.name)
    : '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Supplier" size="md">
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

        {codePreview && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code Prefix (Auto-generated)
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm text-gray-700">
              {codePreview}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This prefix will be used to generate item codes for this supplier
            </p>
          </div>
        )}

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
            {saving ? 'Adding...' : 'Add Supplier'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
