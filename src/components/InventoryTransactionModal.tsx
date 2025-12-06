import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, PackagePlus, Check } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import { supabase, InventoryItem, Technician, PurchaseUnit, Supplier } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { InventoryItemModal } from './InventoryItemModal';
import { UNITS } from '../lib/inventory-constants';

interface InventoryTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialTransactionType?: 'in' | 'out';
}

interface TransactionItemForm {
  item_id: string;
  purchase_unit_id: string;
  purchase_quantity: string;
  purchase_unit_price: string;
  quantity: string;
  total_cost: string;
  unit_cost: string;
  notes: string;
  // Per-item purchase unit form state
  isAddingPurchaseUnit: boolean;
  newPurchaseUnitName: string;
  newPurchaseUnitMultiplier: string;
  isCustomPurchaseUnit: boolean;
  customPurchaseUnitName: string;
}

export function InventoryTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  initialTransactionType,
}: InventoryTransactionModalProps) {
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();
  const [saving, setSaving] = useState(false);
  const [transactionType, setTransactionType] = useState<'in' | 'out'>(initialTransactionType || 'in');
  const [supplierId, setSupplierId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransactionItemForm[]>([
    {
      item_id: '',
      purchase_unit_id: '',
      purchase_quantity: '',
      purchase_unit_price: '',
      quantity: '',
      total_cost: '',
      unit_cost: '',
      notes: '',
      isAddingPurchaseUnit: false,
      newPurchaseUnitName: '',
      newPurchaseUnitMultiplier: '',
      isCustomPurchaseUnit: false,
      customPurchaseUnitName: ''
    },
  ]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<Technician[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseUnits, setPurchaseUnits] = useState<Record<string, PurchaseUnit[]>>({});
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  useEffect(() => {
    if (isOpen && selectedStoreId) {
      fetchInventoryItems();
      fetchEmployees();
      fetchSuppliers();
    }
  }, [isOpen, selectedStoreId]);

  useEffect(() => {
    setItems([{
      item_id: '',
      purchase_unit_id: '',
      purchase_quantity: '',
      purchase_unit_price: '',
      quantity: '',
      total_cost: '',
      unit_cost: '',
      notes: '',
      isAddingPurchaseUnit: false,
      newPurchaseUnitName: '',
      newPurchaseUnitMultiplier: '',
      isCustomPurchaseUnit: false,
      customPurchaseUnitName: ''
    }]);
    setRecipientId('');
    setSupplierId('');
    setInvoiceReference('');
    setNotes('');
    setTransactionType(initialTransactionType || 'in');
  }, [isOpen, initialTransactionType]);

  async function fetchInventoryItems() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from('store_inventory_stock')
        .select(`
          *,
          item:master_inventory_items (
            id,
            name,
            description,
            category,
            unit,
            unit_cost,
            reorder_level,
            brand,
            supplier,
            is_active
          )
        `)
        .eq('store_id', selectedStoreId)
        .order('created_at');

      if (error) throw error;

      const mappedItems = (data || [])
        .filter((stock: any) => stock.item?.is_active)
        .map((stock: any) => ({
          id: stock.id,
          store_id: stock.store_id,
          name: stock.item.name,
          description: stock.item.description,
          category: stock.item.category,
          unit: stock.item.unit,
          quantity_on_hand: stock.quantity_on_hand,
          reorder_level: stock.reorder_level_override ?? stock.item.reorder_level,
          unit_cost: stock.unit_cost_override ?? stock.item.unit_cost,
          brand: stock.item.brand,
          supplier: stock.item.supplier,
          is_active: stock.item.is_active,
          created_at: stock.created_at,
          updated_at: stock.updated_at,
          master_item_id: stock.item.id,
        }));

      setInventoryItems(mappedItems);
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

  async function fetchSuppliers() {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }

  async function fetchPurchaseUnitsForItem(masterItemId: string) {
    if (!selectedStoreId || !masterItemId) return [];

    try {
      const { data, error } = await supabase
        .from('store_product_purchase_units')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('master_item_id', masterItemId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching purchase units:', error);
      return [];
    }
  }

  async function getLastUsedPurchaseUnit(masterItemId: string) {
    if (!selectedStoreId || !masterItemId) return null;

    try {
      const { data, error } = await supabase
        .from('store_product_preferences')
        .select('last_used_purchase_unit_id, last_purchase_cost')
        .eq('store_id', selectedStoreId)
        .eq('master_item_id', masterItemId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching last used purchase unit:', error);
      return null;
    }
  }

  function handleItemDropdownChange(index: number, value: string) {
    if (value === '__add_new__') {
      setShowAddItemModal(true);
    } else {
      handleItemChange(index, 'item_id', value);
    }
  }

  function handleItemAdded() {
    fetchInventoryItems();
    setShowAddItemModal(false);
  }

  function handlePurchaseUnitDropdownChange(index: number, value: string) {
    if (value === '__add_new__') {
      const newItems = [...items];
      newItems[index].isAddingPurchaseUnit = true;
      newItems[index].newPurchaseUnitName = '';
      newItems[index].newPurchaseUnitMultiplier = '';
      newItems[index].isCustomPurchaseUnit = false;
      newItems[index].customPurchaseUnitName = '';
      setItems(newItems);
    } else {
      handleItemChange(index, 'purchase_unit_id', value);
    }
  }

  async function handleAddPurchaseUnit(index: number) {
    const item = items[index];
    if (!item.item_id || !selectedStoreId) {
      showToast('Please select an item first', 'error');
      return;
    }

    const unitName = item.isCustomPurchaseUnit ? item.customPurchaseUnitName.trim() : item.newPurchaseUnitName.trim();

    if (!unitName || !item.newPurchaseUnitMultiplier) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    const multiplier = parseFloat(item.newPurchaseUnitMultiplier);
    if (multiplier <= 0) {
      showToast('Multiplier must be greater than zero', 'error');
      return;
    }

    try {
      const invItem = inventoryItems.find(i => i.id === item.item_id);
      if (!invItem?.master_item_id) {
        showToast('Item does not have a master item ID', 'error');
        return;
      }

      const existingUnits = purchaseUnits[invItem.master_item_id] || [];
      const isFirstUnit = existingUnits.length === 0;

      const { data, error } = await supabase
        .from('store_product_purchase_units')
        .insert({
          store_id: selectedStoreId,
          master_item_id: invItem.master_item_id,
          unit_name: unitName,
          multiplier,
          is_default: isFirstUnit,
          display_order: existingUnits.length,
        })
        .select()
        .single();

      if (error) throw error;

      showToast('Purchase unit added successfully', 'success');

      const updatedUnits = await fetchPurchaseUnitsForItem(invItem.master_item_id);
      setPurchaseUnits(prev => ({ ...prev, [invItem.master_item_id!]: updatedUnits }));

      const newItems = [...items];
      newItems[index].purchase_unit_id = data.id;
      newItems[index].isAddingPurchaseUnit = false;
      newItems[index].newPurchaseUnitName = '';
      newItems[index].newPurchaseUnitMultiplier = '';
      newItems[index].isCustomPurchaseUnit = false;
      newItems[index].customPurchaseUnitName = '';

      // Recalculate quantity, total_cost, and unit_cost now that we have a valid purchase unit
      const purchaseQty = parseFloat(newItems[index].purchase_quantity) || 0;
      const purchasePrice = parseFloat(newItems[index].purchase_unit_price) || 0;
      const stockUnits = purchaseQty * multiplier;

      newItems[index].quantity = stockUnits.toString();

      if (purchaseQty > 0 && purchasePrice >= 0) {
        const totalCost = purchasePrice * purchaseQty;
        newItems[index].total_cost = totalCost.toFixed(2);

        if (stockUnits > 0) {
          newItems[index].unit_cost = (totalCost / stockUnits).toFixed(2);
        }
      }

      setItems(newItems);
    } catch (error: any) {
      console.error('Error adding purchase unit:', error);
      if (error.code === '23505') {
        showToast('A purchase unit with this name already exists', 'error');
      } else {
        showToast('Failed to add purchase unit', 'error');
      }
    }
  }

  function cancelAddPurchaseUnit(index: number) {
    const newItems = [...items];
    newItems[index].isAddingPurchaseUnit = false;
    newItems[index].purchase_unit_id = '';
    newItems[index].newPurchaseUnitName = '';
    newItems[index].newPurchaseUnitMultiplier = '';
    newItems[index].isCustomPurchaseUnit = false;
    newItems[index].customPurchaseUnitName = '';
    setItems(newItems);
  }

  function handleAddItem() {
    setItems([...items, {
      item_id: '',
      purchase_unit_id: '',
      purchase_quantity: '',
      purchase_unit_price: '',
      quantity: '',
      total_cost: '',
      unit_cost: '',
      notes: '',
      isAddingPurchaseUnit: false,
      newPurchaseUnitName: '',
      newPurchaseUnitMultiplier: '',
      isCustomPurchaseUnit: false,
      customPurchaseUnitName: ''
    }]);
  }

  function handleRemoveItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  async function handleItemChange(index: number, field: keyof TransactionItemForm, value: string) {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === 'item_id' && value) {
      const item = inventoryItems.find((i) => i.id === value);
      if (item && item.master_item_id) {
        const units = await fetchPurchaseUnitsForItem(item.master_item_id);
        setPurchaseUnits(prev => ({ ...prev, [item.master_item_id!]: units }));

        if (transactionType === 'in') {
          newItems[index].unit_cost = item.unit_cost.toString();

          // Always auto-open "add new purchase unit" mode for every item
          newItems[index].purchase_unit_id = '__add_new__';
          newItems[index].isAddingPurchaseUnit = true;
          newItems[index].newPurchaseUnitName = '';
          newItems[index].newPurchaseUnitMultiplier = '';
          newItems[index].isCustomPurchaseUnit = false;
          newItems[index].customPurchaseUnitName = '';
        } else {
          newItems[index].unit_cost = item.unit_cost.toString();
        }
      }
    }

    if (transactionType === 'in') {
      const item = newItems[index];

      // Check if we're in "adding purchase unit" mode with temporary values
      let multiplier: number | null = null;

      if (item.isAddingPurchaseUnit && item.newPurchaseUnitMultiplier) {
        // Use temporary multiplier from the form
        multiplier = parseFloat(item.newPurchaseUnitMultiplier);
      } else if (item.purchase_unit_id && item.purchase_unit_id !== '__add_new__') {
        // Use saved purchase unit multiplier
        const purchaseUnit = Object.values(purchaseUnits).flat().find(u => u.id === item.purchase_unit_id);
        if (purchaseUnit) {
          multiplier = purchaseUnit.multiplier;
        }
      }

      // Calculate quantity, total_cost, and unit_cost if we have a valid multiplier
      if (multiplier && multiplier > 0) {
        const purchaseQty = parseFloat(item.purchase_quantity) || 0;
        const purchasePrice = parseFloat(item.purchase_unit_price) || 0;
        const stockUnits = purchaseQty * multiplier;

        newItems[index].quantity = stockUnits.toString();

        if (purchaseQty > 0 && purchasePrice >= 0) {
          const totalCost = purchasePrice * purchaseQty;
          newItems[index].total_cost = totalCost.toFixed(2);

          if (stockUnits > 0) {
            newItems[index].unit_cost = (totalCost / stockUnits).toFixed(2);
          }
        }
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

    // Track newly saved purchase units locally to avoid state sync issues
    const savedPurchaseUnits = new Map<number, { id: string; multiplier: number }>();
    let updatedItems = [...items];

    // Auto-save pending purchase units for IN transactions
    if (transactionType === 'in') {
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item.isAddingPurchaseUnit && item.item_id) {
          const unitName = item.isCustomPurchaseUnit ? item.customPurchaseUnitName.trim() : item.newPurchaseUnitName.trim();

          if (!unitName) {
            showToast(`Item ${index + 1}: Please enter a purchase unit name or cancel the purchase unit form`, 'error');
            return;
          }

          if (!item.newPurchaseUnitMultiplier) {
            showToast(`Item ${index + 1}: Please enter the purchase unit multiplier (quantity)`, 'error');
            return;
          }

          const multiplier = parseFloat(item.newPurchaseUnitMultiplier);
          if (multiplier <= 0) {
            showToast(`Item ${index + 1}: Multiplier must be greater than zero`, 'error');
            return;
          }

          try {
            const invItem = inventoryItems.find(i => i.id === item.item_id);
            if (!invItem?.master_item_id) {
              showToast(`Item ${index + 1}: Item does not have a master item ID`, 'error');
              return;
            }

            const existingUnits = purchaseUnits[invItem.master_item_id] || [];
            const isFirstUnit = existingUnits.length === 0;

            const { data, error } = await supabase
              .from('store_product_purchase_units')
              .insert({
                store_id: selectedStoreId,
                master_item_id: invItem.master_item_id,
                unit_name: unitName,
                multiplier,
                is_default: isFirstUnit,
                display_order: existingUnits.length,
              })
              .select()
              .single();

            if (error) {
              if (error.code === '23505') {
                showToast(`Item ${index + 1}: A purchase unit with this name already exists`, 'error');
              } else {
                console.error(`Error saving purchase unit for item ${index + 1}:`, error);
                showToast(`Item ${index + 1}: Failed to save purchase unit - ${error.message}`, 'error');
              }
              return;
            }

            // Store locally for immediate use
            savedPurchaseUnits.set(index, { id: data.id, multiplier: data.multiplier });

            // Update the item in the local array
            updatedItems[index] = {
              ...updatedItems[index],
              purchase_unit_id: data.id,
              isAddingPurchaseUnit: false,
            };

            // Update purchase units cache
            const updatedUnits = await fetchPurchaseUnitsForItem(invItem.master_item_id);
            setPurchaseUnits(prev => ({ ...prev, [invItem.master_item_id!]: updatedUnits }));
          } catch (error: any) {
            console.error('Error auto-saving purchase unit:', error);
            showToast(`Item ${index + 1}: Failed to save purchase unit - ${error.message || 'Unknown error'}`, 'error');
            return;
          }
        }
      }

      // Update state with all saved purchase units at once
      setItems(updatedItems);
    }

    // Use updatedItems instead of items to ensure we have the latest purchase_unit_id values
    const validItems = updatedItems.filter((item) => item.item_id && parseFloat(item.quantity) > 0);
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
        supplier_id: transactionType === 'in' && supplierId ? supplierId : null,
        invoice_reference: transactionType === 'in' && invoiceReference ? invoiceReference.trim() : null,
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

      const itemsData = validItems.map((item, validItemIndex) => {
        const inventoryItem = inventoryItems.find((i) => i.id === item.item_id);

        // Find the original index to look up in savedPurchaseUnits
        const originalIndex = updatedItems.findIndex(ui => ui === item);

        // First check locally saved purchase units, then fall back to cache
        let purchaseUnit = null;
        if (item.purchase_unit_id) {
          // Check if this was just saved (in savedPurchaseUnits map)
          const savedUnit = savedPurchaseUnits.get(originalIndex);
          if (savedUnit && savedUnit.id === item.purchase_unit_id) {
            purchaseUnit = savedUnit;
          } else {
            // Fall back to cache
            purchaseUnit = Object.values(purchaseUnits).flat().find(u => u.id === item.purchase_unit_id);
          }
        }

        const itemData = {
          transaction_id: transaction.id,
          item_id: item.item_id,
          master_item_id: inventoryItem?.master_item_id || item.item_id,
          quantity: parseFloat(item.quantity),
          unit_cost: parseFloat(item.unit_cost) || 0,
          purchase_unit_id: transactionType === 'in' ? item.purchase_unit_id || null : null,
          purchase_quantity: transactionType === 'in' && item.purchase_quantity ? parseFloat(item.purchase_quantity) : null,
          purchase_unit_price: transactionType === 'in' && item.purchase_unit_price ? parseFloat(item.purchase_unit_price) : null,
          purchase_unit_multiplier: transactionType === 'in' && purchaseUnit ? purchaseUnit.multiplier : null,
          notes: item.notes.trim(),
          created_at: new Date().toISOString(),
        };

        return itemData;
      });

      const { error: itemsError } = await supabase
        .from('inventory_transaction_items')
        .insert(itemsData);

      if (itemsError) throw itemsError;

      if (transactionType === 'in' && session?.employee_id) {
        for (const item of validItems) {
          const inventoryItem = inventoryItems.find((i) => i.id === item.item_id);
          if (item.purchase_unit_id && inventoryItem?.master_item_id) {
            await supabase.rpc('update_product_preference', {
              p_store_id: selectedStoreId,
              p_master_item_id: inventoryItem.master_item_id,
              p_purchase_unit_id: item.purchase_unit_id,
              p_unit_cost: parseFloat(item.unit_cost) || 0,
              p_employee_id: session.employee_id
            });
          }
        }
      }

      showToast(
        `Transaction ${transactionNumber} created and sent for approval`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating transaction:', error);

      // Provide detailed error message
      let errorMessage = 'Failed to create transaction';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      if (error.details) {
        console.error('Error details:', error.details);
      }
      if (error.hint) {
        console.error('Error hint:', error.hint);
      }

      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  }

  function getAvailableStock(itemId: string): number {
    const item = inventoryItems.find((i) => i.id === itemId);
    return item?.quantity_on_hand || 0;
  }

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Inventory Transaction"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {!initialTransactionType && (
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
          )}

          {transactionType === 'in' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <Select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select Supplier (Optional)</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

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

        {transactionType === 'in' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice/PO Reference
            </label>
            <Input
              value={invoiceReference}
              onChange={(e) => setInvoiceReference(e.target.value)}
              placeholder="e.g., INV-2024-001 or PO-1234"
            />
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Items</h4>
            <Button type="button" onClick={handleAddItem} size="sm" variant="secondary">
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {items.map((item, index) => {
              const invItem = inventoryItems.find(i => i.id === item.item_id);
              const itemPurchaseUnits = invItem?.master_item_id ? purchaseUnits[invItem.master_item_id] || [] : [];
              const selectedPurchaseUnit = itemPurchaseUnits.find(u => u.id === item.purchase_unit_id);

              const selectedSupplier = suppliers.find(s => s.id === supplierId);
              const filteredInventoryItems = transactionType === 'in' && selectedSupplier
                ? inventoryItems.filter(invItem =>
                    invItem.supplier?.toLowerCase() === selectedSupplier.name.toLowerCase()
                  )
                : inventoryItems;

              return (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded-lg space-y-3"
                >
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Item {index === 0 && <span className="text-red-500">*</span>}
                      </label>
                      <Select
                        value={item.item_id}
                        onChange={(e) => handleItemDropdownChange(index, e.target.value)}
                        required={index === 0}
                        className="text-sm"
                      >
                        <option value="">Select Item</option>
                        <option value="__add_new__" className="text-blue-600 font-medium">
                          + Add New Item
                        </option>
                        {filteredInventoryItems.length > 0 && (
                          <option disabled>──────────</option>
                        )}
                        {filteredInventoryItems.map((invItem) => (
                          <option key={invItem.id} value={invItem.id}>
                            {invItem.name}{invItem.brand ? ` - ${invItem.brand}` : ''}
                          </option>
                        ))}
                      </Select>
                      {item.item_id && transactionType === 'out' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Available: {getAvailableStock(item.item_id)}
                        </p>
                      )}
                    </div>

                    {transactionType === 'in' && item.item_id && (
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Purchase Unit {index === 0 && <span className="text-red-500">*</span>}
                        </label>
                        {item.isAddingPurchaseUnit ? (
                          <div className="space-y-1">
                            <div className="flex gap-1">
                              <Select
                                value={item.isCustomPurchaseUnit ? '__custom__' : item.newPurchaseUnitName}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const newItems = [...items];
                                  if (value === '__custom__') {
                                    newItems[index].isCustomPurchaseUnit = true;
                                    newItems[index].newPurchaseUnitName = '';
                                  } else {
                                    newItems[index].isCustomPurchaseUnit = false;
                                    newItems[index].customPurchaseUnitName = '';
                                    newItems[index].newPurchaseUnitName = value;
                                  }
                                  setItems(newItems);
                                }}
                                className="text-sm flex-1"
                                autoFocus
                              >
                                <option value="">Select Unit Type</option>
                                {UNITS.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit}
                                  </option>
                                ))}
                                <option disabled>──────────</option>
                                <option value="__custom__" className="text-blue-600 font-medium">
                                  Custom
                                </option>
                              </Select>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={item.newPurchaseUnitMultiplier}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].newPurchaseUnitMultiplier = e.target.value;
                                  setItems(newItems);
                                }}
                                placeholder="Qty"
                                className="text-sm w-20"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddPurchaseUnit(index)}
                                className="text-green-600 hover:text-green-700 p-1"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelAddPurchaseUnit(index)}
                                className="text-gray-600 hover:text-gray-700 p-1"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            {item.isCustomPurchaseUnit && (
                              <Input
                                type="text"
                                value={item.customPurchaseUnitName}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].customPurchaseUnitName = e.target.value;
                                  setItems(newItems);
                                }}
                                placeholder="Enter custom unit name (e.g., Pack of 6)"
                                className="text-sm"
                              />
                            )}
                          </div>
                        ) : (
                          <Select
                            value={item.purchase_unit_id}
                            onChange={(e) => handlePurchaseUnitDropdownChange(index, e.target.value)}
                            required={index === 0}
                            className="text-sm"
                          >
                            <option value="">Select Unit</option>
                            <option value="__add_new__" className="text-blue-600 font-medium">
                              + Add New Purchase Unit
                            </option>
                            {itemPurchaseUnits.length > 0 && (
                              <option disabled>──────────</option>
                            )}
                            {itemPurchaseUnits.map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.unit_name} (x{unit.multiplier})
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    )}

                    {transactionType === 'in' && item.item_id && (
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Qty {index === 0 && <span className="text-red-500">*</span>}
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.purchase_quantity}
                          onChange={(e) => handleItemChange(index, 'purchase_quantity', e.target.value)}
                          placeholder="0"
                          required={index === 0}
                          className="text-sm"
                        />
                      </div>
                    )}

                    {transactionType === 'in' && item.item_id && (
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Purchase Unit Price ($)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.purchase_unit_price}
                          onChange={(e) => handleItemChange(index, 'purchase_unit_price', e.target.value)}
                          placeholder="0.00"
                          className="text-sm"
                        />
                      </div>
                    )}

                    {transactionType === 'out' && (
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
                    )}

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

                  {transactionType === 'in' && item.item_id && item.purchase_quantity && (selectedPurchaseUnit || (item.isAddingPurchaseUnit && item.newPurchaseUnitMultiplier)) && (
                    <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                      <span className="font-medium">Conversion:</span>
                      {' '}{item.purchase_quantity} {selectedPurchaseUnit ? selectedPurchaseUnit.unit_name : (item.isCustomPurchaseUnit ? item.customPurchaseUnitName || 'unit' : item.newPurchaseUnitName || 'unit')}
                      {item.purchase_unit_price && ` × $${item.purchase_unit_price}`}
                      {item.total_cost && ` = $${item.total_cost} total`}
                      {item.quantity && ` (${item.quantity} stock units`}
                      {item.unit_cost && ` @ $${item.unit_cost} each)`}
                    </div>
                  )}

                  {transactionType === 'out' && (
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span>Total Transaction Value:</span>
            <span className="text-lg text-blue-600">${calculateTotalValue().toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional transaction notes"
            rows={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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

    <InventoryItemModal
      isOpen={showAddItemModal}
      onClose={() => setShowAddItemModal(false)}
      onSuccess={handleItemAdded}
    />
    </>
  );
}
