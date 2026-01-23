import React, { useState, useEffect } from 'react';
import { X, PackagePlus, AlertCircle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { NumericInput } from './ui/NumericInput';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import { supabase, InventoryItem, Technician } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface EmployeeDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EmployeeDistributionModal({
  isOpen,
  onClose,
  onSuccess,
}: EmployeeDistributionModalProps) {
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();
  const [saving, setSaving] = useState(false);
  const [itemId, setItemId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<Technician[]>([]);
  const [availableQuantity, setAvailableQuantity] = useState(0);

  useEffect(() => {
    if (isOpen && selectedStoreId) {
      fetchInventoryItems();
      fetchEmployees();
    }
  }, [isOpen, selectedStoreId]);

  useEffect(() => {
    if (itemId) {
      const item = inventoryItems.find((i) => i.id === itemId);
      setAvailableQuantity(item?.quantity_on_hand || 0);
    } else {
      setAvailableQuantity(0);
    }
  }, [itemId, inventoryItems]);

  useEffect(() => {
    setItemId('');
    setEmployeeId('');
    setQuantity('');
    setNotes('');
    setAvailableQuantity(0);
  }, [isOpen]);

  async function fetchInventoryItems() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('is_active', true)
        .gt('quantity_on_hand', 0)
        .order('created_at');

      if (error) throw error;

      setInventoryItems(data || []);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    }
  }

  async function fetchEmployees() {
    if (!selectedStoreId) return;

    try {
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, display_name, role, status')
        .eq('status', 'Active')
        .order('display_name');

      if (employeesError) throw employeesError;

      const { data: employeeStoresData, error: storesError } = await supabase
        .from('employee_stores')
        .select('employee_id, store_id')
        .eq('store_id', selectedStoreId);

      if (storesError) throw storesError;

      const employeeIdsInStore = new Set(
        employeeStoresData?.map((es) => es.employee_id) || []
      );

      const filteredEmployees = (employeesData || []).filter((emp: Technician) =>
        employeeIdsInStore.has(emp.id)
      );

      setEmployees(filteredEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedStoreId || !session?.employee_id) {
      showToast('Missing required data', 'error');
      return;
    }

    if (!itemId || !employeeId || !quantity) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    const qty = parseFloat(quantity);
    if (qty <= 0) {
      showToast('Quantity must be greater than zero', 'error');
      return;
    }

    if (qty > availableQuantity) {
      showToast(`Insufficient quantity. Available: ${availableQuantity}`, 'error');
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase.rpc('distribute_to_employee', {
        p_store_id: selectedStoreId,
        p_item_id: itemId,
        p_to_employee_id: employeeId,
        p_quantity: qty,
        p_distributed_by_id: session.employee_id,
        p_notes: notes.trim(),
      });

      if (error) throw error;

      const result = data as any;
      if (result && result.success) {
        showToast(
          `Successfully distributed ${qty} units to employee`,
          'success'
        );
        onSuccess();
        onClose();
      } else {
        throw new Error('Distribution failed');
      }
    } catch (error: any) {
      console.error('Error distributing inventory:', error);
      if (error.message?.includes('Insufficient inventory')) {
        showToast(error.message, 'error');
      } else {
        showToast('Failed to distribute inventory', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedItem = inventoryItems.find((i) => i.id === itemId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Distribute to Employee"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Distribution uses FIFO costing</p>
            <p className="text-xs mt-1">
              Items will be allocated from oldest purchase lots first for accurate cost tracking.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Inventory Item <span className="text-red-500">*</span>
          </label>
          <Select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            required
          >
            <option value="">Select Item</option>
            {inventoryItems
              .filter(item => !item.is_master_item)  // Exclude master items
              .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} (Available: {item.quantity_on_hand} {item.unit})
              </option>
            ))}
          </Select>
          {selectedItem && (
            <p className="text-xs text-gray-500 mt-1">
              Category: {selectedItem.category} | Available: {availableQuantity} {selectedItem.unit}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Employee <span className="text-red-500">*</span>
          </label>
          <Select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
          >
            <option value="">Select Employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.display_name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity <span className="text-red-500">*</span>
          </label>
          <NumericInput
            step="0.01"
            min="0.01"
            max={availableQuantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            required
          />
          {selectedItem && (
            <p className="text-xs text-gray-500 mt-1">
              Unit: {selectedItem.unit} | Max: {availableQuantity}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this distribution"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving} className="flex-1">
            <PackagePlus className="w-4 h-4 mr-2" />
            {saving ? 'Distributing...' : 'Distribute to Employee'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Distribution creates an audit trail and updates employee inventory
        </p>
      </form>
    </Modal>
  );
}
