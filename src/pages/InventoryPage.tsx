import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Edit2,
  Search,
  AlertTriangle,
  ArrowUpDown,
  PackagePlus,
  PackageMinus,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { supabase, InventoryItem, InventoryTransactionWithDetails, StoreInventoryWithDetails } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { InventoryItemModal } from '../components/InventoryItemModal';
import { InventoryTransactionModal } from '../components/InventoryTransactionModal';
import { formatDateTimeEST } from '../lib/timezone';

type Tab = 'items' | 'transactions';

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();

  const canCreateItems = session?.role && Permissions.inventory.canCreateItems(session.role);
  const canEditItems = session?.role && Permissions.inventory.canEditItems(session.role);
  const canCreateTransactions =
    session?.role && Permissions.inventory.canCreateTransactions(session.role);

  useEffect(() => {
    if (selectedStoreId) {
      fetchItems();
      fetchTransactions();
    }
  }, [selectedStoreId]);

  async function fetchItems() {
    if (!selectedStoreId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('store_inventory_stock')
        .select(`
          *,
          item:master_inventory_items (
            id,
            code,
            name,
            description,
            category,
            unit,
            unit_cost,
            reorder_level,
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
          code: stock.item.code,
          name: stock.item.name,
          description: stock.item.description,
          category: stock.item.category,
          unit: stock.item.unit,
          quantity_on_hand: stock.quantity_on_hand,
          reorder_level: stock.reorder_level_override ?? stock.item.reorder_level,
          unit_cost: stock.unit_cost_override ?? stock.item.unit_cost,
          is_active: stock.item.is_active,
          created_at: stock.created_at,
          updated_at: stock.updated_at,
          master_item_id: stock.item.id,
        }));

      setItems(mappedItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      showToast('Failed to load inventory items', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTransactions() {
    if (!selectedStoreId) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(
          `
          *,
          requested_by:employees!inventory_transactions_requested_by_id_fkey(display_name),
          recipient:employees!inventory_transactions_recipient_id_fkey(display_name)
        `
        )
        .eq('store_id', selectedStoreId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const transactionsWithDetails = (data || []).map((t: any) => ({
        ...t,
        requested_by_name: t.requested_by?.display_name || '',
        recipient_name: t.recipient?.display_name || '',
      }));

      setTransactions(transactionsWithDetails);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showToast('Failed to load transactions', 'error');
    }
  }

  function handleEditItem(item: InventoryItem) {
    setSelectedItem(item);
    setShowItemModal(true);
  }

  function handleAddItem() {
    setSelectedItem(null);
    setShowItemModal(true);
  }

  function handleItemModalClose() {
    setShowItemModal(false);
    setSelectedItem(null);
  }

  function handleItemSuccess() {
    fetchItems();
  }

  function handleTransactionSuccess() {
    fetchTransactions();
    fetchItems();
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredTransactions = transactions.filter((t) => {
    if (!statusFilter) return true;
    return t.status === statusFilter;
  });

  const categories = Array.from(new Set(items.map((item) => item.category))).sort();
  const lowStockItems = items.filter((item) => item.quantity_on_hand <= item.reorder_level);

  if (!selectedStoreId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Store Selected</h2>
          <p className="text-gray-500">Please select a store to view inventory</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Inventory Management</h1>
        <p className="text-gray-600">Track and manage store inventory items and transactions</p>
      </div>

      {lowStockItems.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Low Stock Alert</p>
            <p className="text-sm text-amber-700">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder
              level
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'items'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span>Items ({items.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'transactions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              <span>Transactions ({transactions.length})</span>
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'items' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="pl-10"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
            {canCreateItems && (
              <Button onClick={handleAddItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery || categoryFilter ? 'No items match your filters' : 'No items yet'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const isLowStock = item.quantity_on_hand <= item.reorder_level;
                const totalValue = item.quantity_on_hand * item.unit_cost;

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <Package className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                            <p className="text-sm text-gray-500">{item.code}</p>
                          </div>
                        </div>
                      </div>
                      {canEditItems && (
                        <button
                          onClick={() => handleEditItem(item)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{item.category}</Badge>
                        {isLowStock && (
                          <Badge variant="warning" className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-gray-500">On Hand</p>
                          <p
                            className={`font-semibold ${isLowStock ? 'text-amber-600' : 'text-gray-900'}`}
                          >
                            {item.quantity_on_hand} {item.unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Reorder Level</p>
                          <p className="font-semibold text-gray-900">
                            {item.reorder_level} {item.unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Unit Cost</p>
                          <p className="font-semibold text-gray-900">${item.unit_cost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total Value</p>
                          <p className="font-semibold text-gray-900">${totalValue.toFixed(2)}</p>
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-gray-600 text-xs pt-2 border-t border-gray-100">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
            {canCreateTransactions && (
              <Button onClick={() => setShowTransactionModal(true)} className="ml-auto">
                <Plus className="w-4 h-4 mr-2" />
                New Transaction
              </Button>
            )}
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {statusFilter ? 'No transactions match your filter' : 'No transactions yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      {transaction.transaction_type === 'in' ? (
                        <div className="p-2 bg-green-50 rounded-lg">
                          <PackagePlus className="w-5 h-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-orange-50 rounded-lg">
                          <PackageMinus className="w-5 h-5 text-orange-600" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {transaction.transaction_number}
                          </span>
                          <Badge
                            variant={
                              transaction.transaction_type === 'in' ? 'success' : 'default'
                            }
                          >
                            {transaction.transaction_type.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          Requested by {transaction.requested_by_name}
                          {transaction.recipient_name && ` → ${transaction.recipient_name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:ml-auto">
                      {transaction.status === 'pending' && (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                      )}
                      {transaction.status === 'approved' && (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Approved
                        </Badge>
                      )}
                      {transaction.status === 'rejected' && (
                        <Badge variant="error" className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </Badge>
                      )}
                      <span className="text-sm text-gray-500">
                        {formatDateTimeEST(transaction.created_at)}
                      </span>
                    </div>
                  </div>

                  {transaction.notes && (
                    <p className="text-sm text-gray-600 mt-2 pl-14">{transaction.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <InventoryItemModal
        isOpen={showItemModal}
        onClose={handleItemModalClose}
        item={selectedItem}
        onSuccess={handleItemSuccess}
      />

      <InventoryTransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSuccess={handleTransactionSuccess}
      />
    </div>
  );
}
