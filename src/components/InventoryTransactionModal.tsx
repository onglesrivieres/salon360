import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, PackagePlus } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import { supabase, InventoryItem, Technician } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface InventoryTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TransactionItemForm {
  item_id: string;
  quantity: string;
  unit_cost: string;
  notes: string;
}

export function InventoryTransactionModal({
  isOpen,
  onClose,
  onSuccess,
}: InventoryTransactionModalProps) {
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();
  const [saving, setSaving] = useState(false);
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in');
  const [recipientId, setRecipientId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransactionItemForm[]>([
    { item_id: '', quantity: '', unit_cost: '', notes: '' },
  ]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<Technician[]>([]);

  useEffect(() => {
    if (isOpen && selectedStoreId) {
      fetchInventoryItems();
      fetchEmployees();
    }
  }, [isOpen, selectedStoreId]);

  useEffect(() => {
    setItems([{ item_id: '', quantity: '', unit_cost: '', notes: '' }]);
    setRecipientId('');
    setNotes('');
    setTransactionType('in');
  }, [isOpen]);

  async function fetchInventoryItems() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('is_active', true)
        .order('name');

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

  function handleAddItem() {
    setItems([...items, { item_id: '', quantity: '', unit_cost: '', notes: '' }]);
  }

  function handleRemoveItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  function handleItemChange(index: number, field: keyof TransactionItemForm, value: string) {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === 'item_id' && value) {
      const item = inventoryItems.find((i) => i.id === value);
      if (item) {
        newItems[index].unit_cost = item.unit_cost.toString();
      }
    }

    setItems(newItems);
  }

  function calculateTotalValue(): number {
    return items.reduce((total, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.unit_cost) || 0;
      return total + qty * cost;
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedStoreId || !session?.employee_id) {
      showToast('Missing required data', 'error');
      return;
    }

    if (transactionType === 'out' && !recipientId) {
      showToast('Please select a recipient for OUT transaction', 'error');
      return;
    }

    const validItems = items.filter((item) => item.item_id && parseFloat(item.quantity) > 0);
    if (validItems.length === 0) {
      showToast('Please add at least one item with quantity', 'error');
      return;
    }

    if (transactionType === 'out') {
      for (const item of validItems) {
        const inventoryItem = inventoryItems.find((i) => i.id === item.item_id);
        if (inventoryItem && parseFloat(item.quantity) > inventoryItem.quantity_on_hand) {
          showToast(
            `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity_on_hand}`,
            'error'
          );
          return;
        }
      }
    }

    try {
      setSaving(true);

      const { data: transactionNumber } = await supabase.rpc(
        'generate_inventory_transaction_number',
        {
          p_transaction_type: transactionType,
          p_store_id: selectedStoreId,
        }
      );

      const transactionData = {
        store_id: selectedStoreId,
        transaction_type: transactionType,
        transaction_number: transactionNumber,
        requested_by_id: session.employee_id,
        recipient_id: transactionType === 'out' ? recipientId : null,
        notes: notes.trim(),
        status: 'pending',
        requires_manager_approval: true,
        requires_recipient_approval: transactionType === 'out',
        manager_approved: false,
        recipient_approved: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: transaction, error: transactionError } = await supabase
        .from('inventory_transactions')
        .insert(transactionData)
        .select()
        .single();

      if (transactionError) throw transactionError;

      const itemsData = validItems.map((item) => ({
        transaction_id: transaction.id,
        item_id: item.item_id,
        quantity: parseFloat(item.quantity),
        unit_cost: parseFloat(item.unit_cost) || 0,
        notes: item.notes.trim(),
        created_at: new Date().toISOString(),
      }));

      const { error: itemsError } = await supabase
        .from('inventory_transaction_items')
        .insert(itemsData);

      if (itemsError) throw itemsError;

      showToast(
        `Transaction ${transactionNumber} created and sent for approval`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      showToast('Failed to create transaction', 'error');
    } finally {
      setSaving(false);
    }
  }

  function getAvailableStock(itemId: string): number {
    const item = inventoryItems.find((i) => i.id === itemId);
    return item?.quantity_on_hand || 0;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Inventory Transaction"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <Select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as 'in' | 'out')}
            >
              <option value="in">IN - Receiving Items</option>
              <option value="out">OUT - Giving to Employee</option>
            </Select>
          </div>

          {transactionType === 'out' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient <span className="text-red-500">*</span>
              </label>
              <Select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
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
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional transaction notes"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Items</h4>
            <Button type="button" onClick={handleAddItem} size="sm" variant="secondary">
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg"
              >
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Item {index === 0 && <span className="text-red-500">*</span>}
                  </label>
                  <Select
                    value={item.item_id}
                    onChange={(e) => handleItemChange(index, 'item_id', e.target.value)}
                    required={index === 0}
                    className="text-sm"
                  >
                    <option value="">Select Item</option>
                    {inventoryItems.map((invItem) => (
                      <option key={invItem.id} value={invItem.id}>
                        {invItem.code} - {invItem.name}
                      </option>
                    ))}
                  </Select>
                  {item.item_id && transactionType === 'out' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {getAvailableStock(item.item_id)}
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity {index === 0 && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    placeholder="0"
                    required={index === 0}
                    className="text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit Cost
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unit_cost}
                    onChange={(e) => handleItemChange(index, 'unit_cost', e.target.value)}
                    placeholder="0.00"
                    className="text-sm"
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <Input
                    value={item.notes}
                    onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                    placeholder="Optional"
                    className="text-sm"
                  />
                </div>

                <div className="col-span-1 pt-6">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span>Total Transaction Value:</span>
            <span className="text-lg text-blue-600">${calculateTotalValue().toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Creating...' : 'Create Transaction'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          This transaction will require manager approval
          {transactionType === 'out' && ' and recipient approval'} before inventory is updated.
        </p>
      </form>
    </Modal>
  );
}
