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
  LayoutGrid,
  Table2,
  ChevronUp,
  ChevronDown,
  Filter,
  X,
  Building2,
  Power,
  PowerOff,
} from 'lucide-react';
import { supabase, InventoryItem, InventoryTransactionWithDetails, StoreInventoryWithDetails, Supplier } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { InventoryItemModal } from '../components/InventoryItemModal';
import { InventoryTransactionModal } from '../components/InventoryTransactionModal';
import { EmployeeDistributionModal } from '../components/EmployeeDistributionModal';
import { SupplierModal } from '../components/SupplierModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { formatDateTimeEST } from '../lib/timezone';

type Tab = 'items' | 'transactions' | 'lots' | 'distributions' | 'suppliers';
type ViewMode = 'grid' | 'table';
type SortColumn = 'supplier' | 'brand' | 'name' | 'category' | 'quantity_on_hand' | 'reorder_level' | 'unit_cost' | 'total_value';
type SortDirection = 'asc' | 'desc';

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showTransactionDetailModal, setShowTransactionDetailModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'in' | 'out' | undefined>(undefined);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();

  const canCreateItems = session?.role && Permissions.inventory.canCreateItems(session.role);
  const canEditItems = session?.role && Permissions.inventory.canEditItems(session.role);
  const canCreateTransactions =
    session?.role && Permissions.inventory.canCreateTransactions(session.role);
  const canDistribute = session?.role && Permissions.inventory.canDistribute(session.role);
  const canViewSuppliers = session?.role && Permissions.suppliers.canView(session.role);
  const canEditSuppliers = session?.role && Permissions.suppliers.canEdit(session.role);

  useEffect(() => {
    if (selectedStoreId) {
      fetchItems();
      fetchTransactions();
      fetchSuppliers();
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

  async function fetchSuppliers() {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      showToast('Failed to load suppliers', 'error');
    }
  }

  async function handleToggleSupplier(supplier: Supplier) {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          is_active: !supplier.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplier.id);

      if (error) throw error;
      showToast(`Supplier ${supplier.is_active ? 'deactivated' : 'activated'} successfully`, 'success');
      fetchSuppliers();
    } catch (error) {
      console.error('Error updating supplier:', error);
      showToast('Failed to update supplier', 'error');
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

  function handleOpenInventoryIn() {
    setTransactionType('in');
    setShowTransactionModal(true);
  }

  function handleOpenInventoryOut() {
    setTransactionType('out');
    setShowTransactionModal(true);
  }

  function handleTransactionModalClose() {
    setShowTransactionModal(false);
    setTransactionType(undefined);
  }

  function toggleViewMode(mode: ViewMode) {
    setViewMode(mode);
  }

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function getActiveFilterCount(): number {
    let count = 0;
    if (categoryFilter) count++;
    if (supplierFilter) count++;
    if (brandFilter) count++;
    if (activeTab === 'transactions' && statusFilter) count++;
    return count;
  }

  function clearAllFilters(): void {
    setCategoryFilter('');
    setSupplierFilter('');
    setBrandFilter('');
    setStatusFilter('');
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    const matchesSupplier = !supplierFilter || item.supplier === supplierFilter;
    const matchesBrand = !brandFilter || item.brand === brandFilter;
    return matchesSearch && matchesCategory && matchesSupplier && matchesBrand;
  });

  const sortedItems = sortColumn ? [...filteredItems].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (sortColumn === 'total_value') {
      aVal = a.quantity_on_hand * a.unit_cost;
      bVal = b.quantity_on_hand * b.unit_cost;
    } else {
      aVal = a[sortColumn];
      bVal = b[sortColumn];
    }

    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }) : filteredItems;

  const filteredTransactions = transactions.filter((t) => {
    if (!statusFilter) return true;
    return t.status === statusFilter;
  });

  const categories = Array.from(new Set(items.map((item) => item.category))).sort();
  const supplierNames = Array.from(new Set(items.map((item) => item.supplier).filter(Boolean))).sort();
  const brands = Array.from(new Set(items.map((item) => item.brand).filter(Boolean))).sort();
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
        <div className="flex gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
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
          {canDistribute && (
            <>
              <button
                onClick={() => setActiveTab('lots')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'lots'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <PackagePlus className="w-4 h-4" />
                  <span>Lots</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('distributions')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'distributions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <PackageMinus className="w-4 h-4" />
                  <span>Distributions</span>
                </div>
              </button>
            </>
          )}
          {canViewSuppliers && (
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'suppliers'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Suppliers</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'items' && (
        <div>
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items..."
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                  className={`px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 ${
                    getActiveFilterCount() > 0
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  {getActiveFilterCount() > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                      {getActiveFilterCount()}
                    </span>
                  )}
                </button>

                {isFilterPanelOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsFilterPanelOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                          <button
                            onClick={() => setIsFilterPanelOpen(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Category
                          </label>
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Supplier
                          </label>
                          <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">All Suppliers</option>
                            {supplierNames.map((supplier) => (
                              <option key={supplier} value={supplier}>
                                {supplier}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Brand
                          </label>
                          <select
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">All Brands</option>
                            {brands.map((brand) => (
                              <option key={brand} value={brand}>
                                {brand}
                              </option>
                            ))}
                          </select>
                        </div>

                        {getActiveFilterCount() > 0 && (
                          <button
                            onClick={clearAllFilters}
                            className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            Clear All Filters
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex gap-1 border border-gray-300 rounded-lg p-1">
                <button
                  onClick={() => toggleViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleViewMode('table')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Table view"
                >
                  <Table2 className="w-4 h-4" />
                </button>
              </div>
              {canCreateItems && (
                <Button onClick={handleAddItem} className="ml-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : sortedItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery || categoryFilter || supplierFilter || brandFilter ? 'No items match your filters' : 'No items yet'}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedItems.map((item) => {
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
                            {item.brand && (
                              <p className="text-xs text-gray-500 mt-0.5">Brand: {item.brand}</p>
                            )}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{item.category}</Badge>
                        <Badge variant="secondary">{item.supplier}</Badge>
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
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Name
                        {sortColumn === 'name' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Category
                        {sortColumn === 'category' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('supplier')}
                    >
                      <div className="flex items-center gap-1">
                        Supplier
                        {sortColumn === 'supplier' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('brand')}
                    >
                      <div className="flex items-center gap-1">
                        Brand
                        {sortColumn === 'brand' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('quantity_on_hand')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Qty On Hand
                        {sortColumn === 'quantity_on_hand' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('reorder_level')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Reorder
                        {sortColumn === 'reorder_level' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('unit_cost')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Unit Cost
                        {sortColumn === 'unit_cost' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_value')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total Value
                        {sortColumn === 'total_value' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedItems.map((item) => {
                    const isLowStock = item.quantity_on_hand <= item.reorder_level;
                    const totalValue = item.quantity_on_hand * item.unit_cost;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50 ${isLowStock ? 'bg-amber-50' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <Badge variant="secondary">{item.category}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.supplier}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.brand || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={item.description}>
                          {item.description || '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${isLowStock ? 'text-amber-600' : 'text-gray-900'}`}>
                          {item.quantity_on_hand} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {item.reorder_level} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          ${item.unit_cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          ${totalValue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {canEditItems && (
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <button
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                className={`px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 ${
                  getActiveFilterCount() > 0
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {getActiveFilterCount() > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                    {getActiveFilterCount()}
                  </span>
                )}
              </button>

              {isFilterPanelOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsFilterPanelOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                        <button
                          onClick={() => setIsFilterPanelOpen(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Status</option>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>

                      {getActiveFilterCount() > 0 && (
                        <button
                          onClick={clearAllFilters}
                          className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {canCreateTransactions && (
              <div className="flex gap-2 ml-auto flex-wrap">
                <Button
                  onClick={handleOpenInventoryIn}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <PackagePlus className="w-4 h-4 mr-2" />
                  Inventory In
                </Button>
                <Button
                  onClick={handleOpenInventoryOut}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <PackageMinus className="w-4 h-4 mr-2" />
                  Inventory Out
                </Button>
                {canDistribute && (
                  <Button
                    onClick={() => setShowDistributionModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <PackagePlus className="w-4 h-4 mr-2" />
                    Distribute to Employee
                  </Button>
                )}
              </div>
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
                  onClick={() => {
                    setSelectedTransactionId(transaction.id);
                    setShowTransactionDetailModal(true);
                  }}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
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

      {activeTab === 'lots' && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <PackagePlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Purchase Lots</h3>
          <p className="text-gray-500 mb-4">
            View all purchase lots with FIFO cost tracking
          </p>
          <p className="text-sm text-gray-400">
            Full lot tracking interface coming soon
          </p>
        </div>
      )}

      {activeTab === 'distributions' && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <PackageMinus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Employee Distributions</h3>
          <p className="text-gray-500 mb-4">
            View distribution history and chain of custody
          </p>
          <p className="text-sm text-gray-400">
            Full distribution tracking interface coming soon
          </p>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search suppliers..."
                className="pl-10"
              />
            </div>
            {canEditSuppliers && (
              <Button
                onClick={() => {
                  setSelectedSupplier(null);
                  setShowSupplierModal(true);
                }}
                className="whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Supplier
              </Button>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-500">Loading suppliers...</p>
              </div>
            ) : suppliers.filter((s) =>
                s.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchQuery ? 'No suppliers found' : 'No suppliers yet'}
                </h3>
                <p className="text-gray-500">
                  {searchQuery
                    ? 'Try adjusting your search'
                    : 'Add your first supplier to get started'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {suppliers
                      .filter((s) =>
                        s.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((supplier) => (
                        <tr key={supplier.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {supplier.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {supplier.contact || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 max-w-xs truncate">
                              {supplier.notes || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={supplier.is_active ? 'success' : 'secondary'}>
                              {supplier.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              {canEditSuppliers && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedSupplier(supplier);
                                      setShowSupplierModal(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleSupplier(supplier)}
                                    className={`${
                                      supplier.is_active
                                        ? 'text-red-600 hover:text-red-900'
                                        : 'text-green-600 hover:text-green-900'
                                    }`}
                                    title={supplier.is_active ? 'Deactivate' : 'Activate'}
                                  >
                                    {supplier.is_active ? (
                                      <PowerOff className="w-4 h-4" />
                                    ) : (
                                      <Power className="w-4 h-4" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
        onClose={handleTransactionModalClose}
        onSuccess={handleTransactionSuccess}
        initialTransactionType={transactionType}
      />

      <EmployeeDistributionModal
        isOpen={showDistributionModal}
        onClose={() => setShowDistributionModal(false)}
        onSuccess={() => {
          fetchItems();
          fetchTransactions();
        }}
      />

      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => {
          setShowSupplierModal(false);
          setSelectedSupplier(null);
        }}
        onSuccess={() => {
          fetchSuppliers();
        }}
        supplier={selectedSupplier}
      />

      <TransactionDetailModal
        isOpen={showTransactionDetailModal}
        onClose={() => {
          setShowTransactionDetailModal(false);
          setSelectedTransactionId(null);
        }}
        transactionId={selectedTransactionId || ''}
      />
    </div>
  );
}
