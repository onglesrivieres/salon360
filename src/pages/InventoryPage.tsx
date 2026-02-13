import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Edit2,
  Search,
  AlertTriangle,
  ArrowUpDown,
  ArrowLeftRight,
  PackagePlus,
  PackageMinus,
  CheckCircle,
  XCircle,
  Clock,
  LayoutGrid,
  Table2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
  Building2,
  Power,
  PowerOff,
  Eye,
  Calendar,
  FileEdit,
  Trash2,
  Download,
  Upload,
} from 'lucide-react';
import { supabase, InventoryItem, InventoryItemWithHierarchy, InventoryTransactionWithDetails, Supplier, InventoryPurchaseLotWithDetails, InventoryDistributionWithDetails } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { InventoryItemModal } from '../components/InventoryItemModal';
import { InventoryTransactionModal } from '../components/InventoryTransactionModal';
import { EmployeeDistributionModal } from '../components/EmployeeDistributionModal';
import { SupplierModal } from '../components/SupplierModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { CsvImportModal } from '../components/inventory/CsvImportModal';
import { formatDateTimeEST, formatDateEST } from '../lib/timezone';

type Tab = 'items' | 'transactions' | 'lots' | 'distributions' | 'suppliers';
type ViewMode = 'grid' | 'table';
type SortColumn = 'supplier' | 'brand' | 'name' | 'category' | 'quantity_on_hand' | 'reorder_level' | 'unit_cost' | 'total_value';
type SortDirection = 'asc' | 'desc';
type LotSortColumn = 'lot_number' | 'item_name' | 'quantity_remaining' | 'unit_cost' | 'purchase_date' | 'status';
type LotStatus = 'active' | 'depleted' | 'expired' | 'archived';
type DistributionSortColumn = 'distribution_number' | 'distribution_date' | 'item_name' | 'to_employee_name' | 'quantity' | 'status';
type DistributionStatus = 'pending' | 'acknowledged' | 'in_use' | 'returned' | 'consumed' | 'cancelled';

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
  const [transactionType, setTransactionType] = useState<'in' | 'out' | 'transfer' | undefined>(undefined);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [expandedMasterItems, setExpandedMasterItems] = useState<Set<string>>(new Set());
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [draftToEdit, setDraftToEdit] = useState<any>(null);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [purchaseUnits, setPurchaseUnits] = useState<Record<string, { unit_name: string; multiplier: number }>>({});
  const [subItemLotsMap, setSubItemLotsMap] = useState<Record<string, Array<{ id: string; lot_number: string; supplier_name: string | null; quantity_received: number; quantity_remaining: number }>>>({});
  const [itemOutTransfersMap, setItemOutTransfersMap] = useState<Record<string, Array<{
    id: string;
    transaction_number: string;
    transaction_type: 'out' | 'transfer';
    quantity: number;
    destination_store_name: string | null;
    created_at: string;
  }>>>({});
  const [itemDistributionsMap, setItemDistributionsMap] = useState<Record<string, Array<{
    id: string;
    quantity: number;
    to_employee_name: string;
    status: string;
    distribution_date: string;
  }>>>({});

  // State for responsive tab dropdown
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement>(null);

  // Lots tab state
  const [lots, setLots] = useState<InventoryPurchaseLotWithDetails[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotSearchQuery, setLotSearchQuery] = useState('');
  const [lotItemFilter, setLotItemFilter] = useState('');
  const [lotSupplierFilter, setLotSupplierFilter] = useState('');
  const [lotStatusFilter, setLotStatusFilter] = useState<LotStatus | ''>('');
  const [lotDateRangeStart, setLotDateRangeStart] = useState('');
  const [lotDateRangeEnd, setLotDateRangeEnd] = useState('');
  const [lotSortColumn, setLotSortColumn] = useState<LotSortColumn | null>('purchase_date');
  const [lotSortDirection, setLotSortDirection] = useState<SortDirection>('desc');
  const [expandedLotIds, setExpandedLotIds] = useState<Set<string>>(new Set());
  const [isLotFilterPanelOpen, setIsLotFilterPanelOpen] = useState(false);

  // Distributions tab state
  const [distributions, setDistributions] = useState<InventoryDistributionWithDetails[]>([]);
  const [distributionsLoading, setDistributionsLoading] = useState(false);
  const [distributionSearchQuery, setDistributionSearchQuery] = useState('');
  const [distributionEmployeeFilter, setDistributionEmployeeFilter] = useState('');
  const [distributionItemFilter, setDistributionItemFilter] = useState('');
  const [distributionStatusFilter, setDistributionStatusFilter] = useState<DistributionStatus | ''>('');
  const [distributionDateRangeStart, setDistributionDateRangeStart] = useState('');
  const [distributionDateRangeEnd, setDistributionDateRangeEnd] = useState('');
  const [distributionSortColumn, setDistributionSortColumn] = useState<DistributionSortColumn | null>('distribution_date');
  const [distributionSortDirection, setDistributionSortDirection] = useState<SortDirection>('desc');
  const [expandedDistributionIds, setExpandedDistributionIds] = useState<Set<string>>(new Set());
  const [isDistributionFilterPanelOpen, setIsDistributionFilterPanelOpen] = useState(false);

  const { showToast } = useToast();
  const { selectedStoreId, session, t } = useAuth();

  const canCreateItems = session?.role && Permissions.inventory.canCreateItems(session.role);
  const canEditItems = session?.role && Permissions.inventory.canEditItems(session.role);
  const canCreateTransactions =
    session?.role && Permissions.inventory.canCreateTransactions(session.role);
  const canDistribute = session?.role && Permissions.inventory.canDistribute(session.role);
  const canViewSuppliers = session?.role && Permissions.suppliers.canView(session.role);
  const canEditSuppliers = session?.role && Permissions.suppliers.canEdit(session.role);

  // Tab configuration for responsive dropdown
  const tabConfig: Array<{ key: Tab; label: string; icon: typeof Package; getCount?: () => number }> = [
    { key: 'items', label: t('inventory.items'), icon: Package, getCount: () => items.length },
    { key: 'transactions', label: t('inventory.transactions'), icon: ArrowUpDown, getCount: () => transactions.length },
    { key: 'lots', label: t('inventory.lots'), icon: PackagePlus },
    { key: 'distributions', label: t('inventory.distributions'), icon: PackageMinus },
    { key: 'suppliers', label: t('inventory.suppliers'), icon: Building2 },
  ];
  const visibleTabs = tabConfig.filter(tab => {
    if (['lots', 'distributions'].includes(tab.key)) return canDistribute;
    if (tab.key === 'suppliers') return canViewSuppliers;
    return true;
  });
  const currentTabConfig = tabConfig.find(tab => tab.key === activeTab);

  // Click-outside handler for tab dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) {
        setIsTabDropdownOpen(false);
      }
    }
    if (isTabDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTabDropdownOpen]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchItems();
      fetchTransactions();
      fetchSuppliers();
    }
  }, [selectedStoreId]);

  // Fetch lots when tab changes to 'lots' (lazy loading)
  useEffect(() => {
    if (activeTab === 'lots' && selectedStoreId && canDistribute && lots.length === 0) {
      fetchLots();
    }
  }, [activeTab, selectedStoreId, canDistribute]);

  // Fetch distributions when tab changes to 'distributions' (lazy loading)
  useEffect(() => {
    if (activeTab === 'distributions' && selectedStoreId && canDistribute && distributions.length === 0) {
      fetchDistributions();
    }
  }, [activeTab, selectedStoreId, canDistribute]);

  async function fetchItems() {
    if (!selectedStoreId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch items via store_inventory_levels JOIN inventory_items, default purchase units, lots, out/transfer txns, and distributions in parallel
      const [levelsResult, purchaseUnitsResult, lotsResult, outTransfersResult, distributionsResult] = await Promise.all([
        supabase
          .from('store_inventory_levels')
          .select('*, item:inventory_items!inner(*)')
          .eq('store_id', selectedStoreId)
          .eq('is_active', true)
          .order('created_at', { referencedTable: 'inventory_items' }),
        supabase
          .from('store_product_purchase_units')
          .select('item_id, unit_name, multiplier')
          .eq('store_id', selectedStoreId)
          .eq('is_default', true),
        supabase
          .from('inventory_purchase_lots')
          .select('id, lot_number, item_id, quantity_received, quantity_remaining, suppliers(name)')
          .eq('store_id', selectedStoreId)
          .in('status', ['active', 'expired', 'archived'])
          .order('purchase_date', { ascending: false }),
        supabase
          .from('inventory_transaction_items')
          .select('id, item_id, quantity, received_quantity, inventory_transactions!inner(id, transaction_number, transaction_type, store_id, status, created_at, destination_store:stores!inventory_transactions_destination_store_id_fkey(name))')
          .eq('inventory_transactions.store_id', selectedStoreId)
          .in('inventory_transactions.transaction_type', ['out', 'transfer'])
          .eq('inventory_transactions.status', 'approved'),
        supabase
          .from('inventory_distributions')
          .select('id, item_id, quantity, status, distribution_date, to_employee:employees!to_employee_id(display_name)')
          .eq('store_id', selectedStoreId)
          .not('status', 'in', '(cancelled,returned)')
      ]);

      if (levelsResult.error) throw levelsResult.error;

      // Build purchase units lookup
      const unitsLookup: Record<string, { unit_name: string; multiplier: number }> = {};
      if (purchaseUnitsResult.data) {
        for (const unit of purchaseUnitsResult.data) {
          unitsLookup[unit.item_id] = { unit_name: unit.unit_name, multiplier: unit.multiplier };
        }
      }
      setPurchaseUnits(unitsLookup);

      // Build lots lookup by item_id (for sub-item lot display)
      const lotsLookup: Record<string, Array<{ id: string; lot_number: string; supplier_name: string | null; quantity_received: number; quantity_remaining: number }>> = {};
      if (lotsResult.data) {
        for (const lot of lotsResult.data as any[]) {
          const entry = {
            id: lot.id,
            lot_number: lot.lot_number,
            supplier_name: lot.suppliers?.name || null,
            quantity_received: lot.quantity_received,
            quantity_remaining: lot.quantity_remaining,
          };
          if (!lotsLookup[lot.item_id]) {
            lotsLookup[lot.item_id] = [];
          }
          lotsLookup[lot.item_id].push(entry);
        }
      }
      setSubItemLotsMap(lotsLookup);

      // Build out/transfer transactions lookup by item_id
      const outTransfersLookup: Record<string, Array<{
        id: string;
        transaction_number: string;
        transaction_type: 'out' | 'transfer';
        quantity: number;
        destination_store_name: string | null;
        created_at: string;
      }>> = {};
      if (outTransfersResult.data) {
        for (const row of outTransfersResult.data as any[]) {
          const txn = row.inventory_transactions;
          const entry = {
            id: row.id,
            transaction_number: txn.transaction_number,
            transaction_type: txn.transaction_type as 'out' | 'transfer',
            quantity: row.received_quantity ?? row.quantity,
            destination_store_name: txn.destination_store?.name || null,
            created_at: txn.created_at,
          };
          if (!outTransfersLookup[row.item_id]) {
            outTransfersLookup[row.item_id] = [];
          }
          outTransfersLookup[row.item_id].push(entry);
        }
      }
      setItemOutTransfersMap(outTransfersLookup);

      // Build distributions lookup by item_id
      const distributionsLookup: Record<string, Array<{
        id: string;
        quantity: number;
        to_employee_name: string;
        status: string;
        distribution_date: string;
      }>> = {};
      if (distributionsResult.data) {
        for (const dist of distributionsResult.data as any[]) {
          const entry = {
            id: dist.id,
            quantity: dist.quantity,
            to_employee_name: dist.to_employee?.display_name || 'Unknown',
            status: dist.status,
            distribution_date: dist.distribution_date,
          };
          if (!distributionsLookup[dist.item_id]) {
            distributionsLookup[dist.item_id] = [];
          }
          distributionsLookup[dist.item_id].push(entry);
        }
      }
      setItemDistributionsMap(distributionsLookup);

      // Flatten store_inventory_levels + inventory_items into InventoryItem shape
      const flatItems = (levelsResult.data || []).map((level: any) => ({
        ...level.item,
        store_id: level.store_id,
        quantity_on_hand: level.quantity_on_hand,
        unit_cost: level.unit_cost,
        reorder_level: level.reorder_level,
        is_active: level.is_active,
      }));
      setItems(flatItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      showToast(t('inventory.failedToLoadItems'), 'error');
    } finally {
      setLoading(false);
    }
  }

  function toggleMasterItem(masterId: string) {
    setExpandedMasterItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(masterId)) {
        newSet.delete(masterId);
      } else {
        newSet.add(masterId);
      }
      return newSet;
    });
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
          recipient:employees!inventory_transactions_recipient_id_fkey(display_name),
          destination_store:stores!inventory_transactions_destination_store_id_fkey(name),
          source_store:stores!inventory_transactions_store_id_fkey(name)
        `
        )
        .or(`store_id.eq.${selectedStoreId},destination_store_id.eq.${selectedStoreId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const transactionsWithDetails = (data || []).map((t: any) => ({
        ...t,
        requested_by_name: t.requested_by?.display_name || '',
        recipient_name: t.recipient?.display_name || '',
        destination_store_name: t.destination_store?.name || '',
        source_store_name: t.source_store?.name || '',
      }));

      setTransactions(transactionsWithDetails);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showToast(t('inventory.failedToLoadTransactions'), 'error');
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
      showToast(t('inventory.failedToLoadSuppliers'), 'error');
    }
  }

  async function fetchLots() {
    if (!selectedStoreId) return;

    try {
      setLotsLoading(true);

      const { data, error } = await supabase
        .from('inventory_purchase_lots')
        .select(`
          *,
          inventory_items!item_id (
            id,
            name,
            category,
            unit,
            brand
          ),
          suppliers (
            id,
            name
          ),
          created_by:employees!created_by_id (
            display_name
          )
        `)
        .eq('store_id', selectedStoreId)
        .order('purchase_date', { ascending: false });

      if (error) throw error;

      // Map to InventoryPurchaseLotWithDetails
      const lotsWithDetails: InventoryPurchaseLotWithDetails[] = (data || []).map((lot: any) => ({
        ...lot,
        item_name: lot.inventory_items?.name || 'Unknown Item',
        item: lot.inventory_items,
        supplier_name: lot.suppliers?.name || null,
        created_by_name: lot.created_by?.display_name || null,
      }));

      setLots(lotsWithDetails);
    } catch (error) {
      console.error('Error fetching lots:', error);
      showToast(t('inventory.failedToLoadLots'), 'error');
    } finally {
      setLotsLoading(false);
    }
  }

  async function fetchDistributions() {
    if (!selectedStoreId) return;

    try {
      setDistributionsLoading(true);

      const { data, error } = await supabase
        .from('inventory_distributions')
        .select(`
          *,
          inventory_items!item_id (
            id,
            name,
            category,
            unit,
            brand
          ),
          inventory_purchase_lots!lot_id (
            lot_number
          ),
          to_employee:employees!to_employee_id (
            display_name
          ),
          from_employee:employees!from_employee_id (
            display_name
          ),
          distributed_by:employees!distributed_by_id (
            display_name
          ),
          manager_approved_by:employees!manager_approved_by_id (
            display_name
          )
        `)
        .eq('store_id', selectedStoreId)
        .order('distribution_date', { ascending: false });

      if (error) throw error;

      // Map to InventoryDistributionWithDetails
      const distributionsWithDetails: InventoryDistributionWithDetails[] = (data || []).map((dist: any) => ({
        ...dist,
        item_name: dist.inventory_items?.name || 'Unknown Item',
        lot_number: dist.inventory_purchase_lots?.lot_number || null,
        to_employee_name: dist.to_employee?.display_name || 'Unknown',
        from_employee_name: dist.from_employee?.display_name || null,
        distributed_by_name: dist.distributed_by?.display_name || null,
        manager_approved_by_name: dist.manager_approved_by?.display_name || null,
      }));

      setDistributions(distributionsWithDetails);
    } catch (error) {
      console.error('Error fetching distributions:', error);
      showToast(t('inventory.failedToLoadDistributions'), 'error');
    } finally {
      setDistributionsLoading(false);
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
      showToast(supplier.is_active ? t('inventory.supplierDeactivated') : t('inventory.supplierActivated'), 'success');
      fetchSuppliers();
    } catch (error) {
      console.error('Error updating supplier:', error);
      showToast(t('inventory.failedToLoadSuppliers'), 'error');
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

  function handleDownloadCsv() {
    const headers = ['name', 'brand', 'category', 'size', 'item_type', 'parent_name', 'quantity', 'unit_cost', 'reorder_level'];
    const parentNames = new Map(items.filter(i => i.is_master_item).map(i => [i.id, i.name]));

    function escapeCsvField(field: string): string {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    }

    const rows = items.map(item => {
      const itemType = item.is_master_item ? 'master' : item.parent_id ? 'sub' : 'standalone';
      const parentName = item.parent_id ? (parentNames.get(item.parent_id) || '') : '';
      return [
        escapeCsvField(item.name),
        escapeCsvField(item.brand || ''),
        escapeCsvField(item.category),
        escapeCsvField(item.size || ''),
        itemType,
        escapeCsvField(parentName),
        item.quantity_on_hand.toString(),
        item.unit_cost.toString(),
        item.reorder_level.toString(),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Inventory CSV downloaded', 'success');
  }

  function handleTransactionSuccess() {
    fetchTransactions();
    fetchItems();
    setDraftToEdit(null);
  }

  function handleDownloadTransactionTemplate() {
    const header = 'item_name,quantity,unit_cost,notes';
    const example = 'Example Item Name,10,3.50,Optional notes';
    const csv = header + '\n' + example + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_transaction_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleOpenInventoryIn() {
    setTransactionType('in');
    setShowTransactionModal(true);
  }

  function handleOpenTransfer() {
    setTransactionType('transfer');
    setShowTransactionModal(true);
  }

  function handleTransactionModalClose() {
    setShowTransactionModal(false);
    setTransactionType(undefined);
    setDraftToEdit(null);
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

  // Organize items into hierarchy
  const masterItems = items.filter(item => item.is_master_item);
  const subItems = items.filter(item => item.parent_id);
  const standaloneItems = items.filter(item => !item.is_master_item && !item.parent_id);

  // Build hierarchical items with sub-items attached
  const hierarchicalItems: InventoryItemWithHierarchy[] = masterItems.map(master => {
    const children = subItems.filter(sub => sub.parent_id === master.id);
    return {
      ...master,
      sub_items: children,
      total_sub_item_quantity: master.quantity_on_hand,
      has_low_stock_sub_items: master.quantity_on_hand <= master.reorder_level,
    };
  });

  // Standalone items displayed as flat rows (no hierarchy)
  const standaloneDisplayItems: InventoryItemWithHierarchy[] = standaloneItems.map(item => ({
    ...item,
    sub_items: [],
    total_sub_item_quantity: item.quantity_on_hand,
    has_low_stock_sub_items: item.quantity_on_hand <= item.reorder_level,
  }));

  const displayItems: InventoryItemWithHierarchy[] = [...hierarchicalItems, ...standaloneDisplayItems];

  const filteredItems = displayItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    const matchesSupplier = !supplierFilter || item.supplier === supplierFilter;
    const matchesBrand = !brandFilter || item.brand === brandFilter;

    // Low stock filter - all items use own quantity_on_hand
    const isLowStock = item.quantity_on_hand <= item.reorder_level;
    const matchesLowStock = !showLowStockOnly || isLowStock;

    return matchesSearch && matchesCategory && matchesSupplier && matchesBrand && matchesLowStock;
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

  // Lots filtering
  const filteredLots = lots.filter((lot) => {
    // Search filter - lot number or item name
    const matchesSearch = !lotSearchQuery ||
      lot.lot_number.toLowerCase().includes(lotSearchQuery.toLowerCase()) ||
      lot.item_name?.toLowerCase().includes(lotSearchQuery.toLowerCase());

    // Item filter
    const matchesItem = !lotItemFilter || lot.item_id === lotItemFilter;

    // Supplier filter
    const matchesSupplier = !lotSupplierFilter || lot.supplier_id === lotSupplierFilter;

    // Status filter
    const matchesStatus = !lotStatusFilter || lot.status === lotStatusFilter;

    // Date range filter
    let matchesDateRange = true;
    if (lotDateRangeStart && lot.purchase_date) {
      matchesDateRange = new Date(lot.purchase_date) >= new Date(lotDateRangeStart);
    }
    if (lotDateRangeEnd && lot.purchase_date && matchesDateRange) {
      matchesDateRange = new Date(lot.purchase_date) <= new Date(lotDateRangeEnd + 'T23:59:59');
    }

    return matchesSearch && matchesItem && matchesSupplier && matchesStatus && matchesDateRange;
  });

  // Lots sorting
  const sortedLots = lotSortColumn ? [...filteredLots].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (lotSortColumn) {
      case 'lot_number':
        aVal = a.lot_number;
        bVal = b.lot_number;
        break;
      case 'item_name':
        aVal = a.item_name || '';
        bVal = b.item_name || '';
        break;
      case 'quantity_remaining':
        aVal = a.quantity_remaining;
        bVal = b.quantity_remaining;
        break;
      case 'unit_cost':
        aVal = a.unit_cost;
        bVal = b.unit_cost;
        break;
      case 'purchase_date':
        aVal = new Date(a.purchase_date).getTime();
        bVal = new Date(b.purchase_date).getTime();
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      default:
        aVal = a.purchase_date;
        bVal = b.purchase_date;
    }

    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return lotSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return lotSortDirection === 'asc' ? 1 : -1;
    return 0;
  }) : filteredLots;

  // Calculate lot statistics
  const lotStats = {
    totalActiveLots: lots.filter(l => l.status === 'active').length,
    totalValue: lots
      .filter(l => l.status === 'active')
      .reduce((sum, lot) => sum + (lot.quantity_remaining * lot.unit_cost), 0),
    expiringLots: lots.filter(l => {
      if (!l.expiration_date || l.status !== 'active') return false;
      const daysUntilExpiry = Math.ceil(
        (new Date(l.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    }).length,
    lowQuantityLots: lots.filter(l =>
      l.status === 'active' && l.quantity_remaining <= l.quantity_received * 0.1
    ).length,
  };

  // Get unique items and suppliers from lots for filter dropdowns
  const lotItemOptions = Array.from(
    new Map(lots.map(l => [l.item_id, { id: l.item_id, name: l.item_name }])).values()
  ).filter(item => item.name).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const lotSupplierOptions = Array.from(
    new Map(
      lots.filter(l => l.supplier_id && l.supplier_name)
        .map(l => [l.supplier_id, { id: l.supplier_id!, name: l.supplier_name! }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Lot helper functions
  function handleLotSort(column: LotSortColumn) {
    if (lotSortColumn === column) {
      setLotSortDirection(lotSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLotSortColumn(column);
      setLotSortDirection('asc');
    }
  }

  function toggleLotExpand(lotId: string) {
    const newExpanded = new Set(expandedLotIds);
    if (newExpanded.has(lotId)) {
      newExpanded.delete(lotId);
    } else {
      newExpanded.add(lotId);
    }
    setExpandedLotIds(newExpanded);
  }

  function getLotActiveFilterCount(): number {
    let count = 0;
    if (lotItemFilter) count++;
    if (lotSupplierFilter) count++;
    if (lotStatusFilter) count++;
    if (lotDateRangeStart || lotDateRangeEnd) count++;
    return count;
  }

  function clearLotFilters() {
    setLotItemFilter('');
    setLotSupplierFilter('');
    setLotStatusFilter('');
    setLotDateRangeStart('');
    setLotDateRangeEnd('');
  }

  // Distributions filtering
  const filteredDistributions = distributions.filter((dist) => {
    // Search filter - distribution number or employee name
    const matchesSearch = !distributionSearchQuery ||
      dist.distribution_number.toLowerCase().includes(distributionSearchQuery.toLowerCase()) ||
      dist.to_employee_name?.toLowerCase().includes(distributionSearchQuery.toLowerCase()) ||
      dist.from_employee_name?.toLowerCase().includes(distributionSearchQuery.toLowerCase());

    // Employee filter (to_employee)
    const matchesEmployee = !distributionEmployeeFilter || dist.to_employee_id === distributionEmployeeFilter;

    // Item filter
    const matchesItem = !distributionItemFilter || dist.item_id === distributionItemFilter;

    // Status filter
    const matchesStatus = !distributionStatusFilter || dist.status === distributionStatusFilter;

    // Date range filter
    let matchesDateRange = true;
    if (distributionDateRangeStart && dist.distribution_date) {
      matchesDateRange = new Date(dist.distribution_date) >= new Date(distributionDateRangeStart);
    }
    if (distributionDateRangeEnd && dist.distribution_date && matchesDateRange) {
      matchesDateRange = new Date(dist.distribution_date) <= new Date(distributionDateRangeEnd + 'T23:59:59');
    }

    return matchesSearch && matchesEmployee && matchesItem && matchesStatus && matchesDateRange;
  });

  // Distributions sorting
  const sortedDistributions = distributionSortColumn ? [...filteredDistributions].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (distributionSortColumn) {
      case 'distribution_number':
        aVal = a.distribution_number;
        bVal = b.distribution_number;
        break;
      case 'distribution_date':
        aVal = new Date(a.distribution_date).getTime();
        bVal = new Date(b.distribution_date).getTime();
        break;
      case 'item_name':
        aVal = a.item_name || '';
        bVal = b.item_name || '';
        break;
      case 'to_employee_name':
        aVal = a.to_employee_name || '';
        bVal = b.to_employee_name || '';
        break;
      case 'quantity':
        aVal = a.quantity;
        bVal = b.quantity;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      default:
        aVal = a.distribution_date;
        bVal = b.distribution_date;
    }

    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return distributionSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return distributionSortDirection === 'asc' ? 1 : -1;
    return 0;
  }) : filteredDistributions;

  // Calculate distribution statistics
  const distributionStats = {
    totalDistributions: distributions.length,
    pendingAcknowledgment: distributions.filter(d => d.status === 'pending').length,
    currentlyInUse: distributions.filter(d => d.status === 'in_use').length,
    returnedThisMonth: distributions.filter(d => {
      if (d.status !== 'returned' || !d.actual_return_date) return false;
      const returnDate = new Date(d.actual_return_date);
      const now = new Date();
      return returnDate.getMonth() === now.getMonth() &&
             returnDate.getFullYear() === now.getFullYear();
    }).length,
  };

  // Get unique employees and items from distributions for filter dropdowns
  const distributionEmployeeOptions = Array.from(
    new Map(
      distributions.map(d => [d.to_employee_id, { id: d.to_employee_id, name: d.to_employee_name }])
    ).values()
  ).filter(emp => emp.name).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const distributionItemOptions = Array.from(
    new Map(distributions.map(d => [d.item_id, { id: d.item_id, name: d.item_name }])).values()
  ).filter(item => item.name).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Distribution helper functions
  function handleDistributionSort(column: DistributionSortColumn) {
    if (distributionSortColumn === column) {
      setDistributionSortDirection(distributionSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setDistributionSortColumn(column);
      setDistributionSortDirection('asc');
    }
  }

  function toggleDistributionExpand(distributionId: string) {
    const newExpanded = new Set(expandedDistributionIds);
    if (newExpanded.has(distributionId)) {
      newExpanded.delete(distributionId);
    } else {
      newExpanded.add(distributionId);
    }
    setExpandedDistributionIds(newExpanded);
  }

  function getDistributionActiveFilterCount(): number {
    let count = 0;
    if (distributionEmployeeFilter) count++;
    if (distributionItemFilter) count++;
    if (distributionStatusFilter) count++;
    if (distributionDateRangeStart || distributionDateRangeEnd) count++;
    return count;
  }

  function clearDistributionFilters() {
    setDistributionEmployeeFilter('');
    setDistributionItemFilter('');
    setDistributionStatusFilter('');
    setDistributionDateRangeStart('');
    setDistributionDateRangeEnd('');
  }

  function getDistributionStatusBadgeVariant(status: DistributionStatus): 'warning' | 'info' | 'success' | 'default' | 'danger' {
    switch (status) {
      case 'pending': return 'warning';
      case 'acknowledged': return 'info';
      case 'in_use': return 'success';
      case 'returned': return 'default';
      case 'consumed': return 'info';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  }

  const categories = Array.from(new Set(items.map((item) => item.category))).sort();
  const supplierNames = Array.from(new Set(items.map((item) => item.supplier).filter(Boolean))).sort();
  const brands = Array.from(new Set(items.map((item) => item.brand).filter(Boolean))).sort();
  // Low stock items - exclude master items (they don't have direct inventory)
  const lowStockItems = items.filter((item) => !item.is_master_item && item.quantity_on_hand <= item.reorder_level);

  if (!selectedStoreId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('inventory.noStoreSelected')}</h2>
          <p className="text-gray-500">{t('inventory.pleaseSelectStore')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('inventory.title')}</h1>
        <p className="text-gray-600">{t('common.trackAndManage')}</p>
      </div>

      {lowStockItems.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
              showLowStockOnly
                ? 'bg-amber-600 text-white'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            {showLowStockOnly ? t('common.showAll') : t('common.view')}
          </button>
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-900">{t('common.lowStockAlert')}</p>
            <p className="text-sm text-amber-700">
              {lowStockItems.length} {t('common.itemsBelowReorder')}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 border-b border-gray-200">
        {/* Mobile dropdown - visible on screens < md */}
        <div className="md:hidden p-2" ref={tabDropdownRef}>
          <div className="relative">
            <button
              onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
            >
              <div className="flex items-center gap-2">
                {currentTabConfig && (
                  <>
                    <currentTabConfig.icon className="w-4 h-4" />
                    <span>
                      {currentTabConfig.label}
                      {currentTabConfig.getCount && ` (${currentTabConfig.getCount()})`}
                    </span>
                  </>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isTabDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => { setActiveTab(tab.key); setIsTabDropdownOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>
                          {tab.label}
                          {tab.getCount && ` (${tab.getCount()})`}
                        </span>
                      </div>
                      {isActive && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop tabs - visible on screens >= md */}
        <div className="hidden md:flex gap-4 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>
                    {tab.label}
                    {tab.getCount && ` (${tab.getCount()})`}
                  </span>
                </div>
              </button>
            );
          })}
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
                <div className="flex gap-2 ml-auto flex-wrap">
                  <Button variant="secondary" onClick={handleDownloadCsv}>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                  </Button>
                  <Button variant="secondary" onClick={() => setShowCsvImportModal(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>
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
                        <Badge variant="default">{item.category}</Badge>
                        <Badge variant="default">{item.supplier}</Badge>
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
                        Qty (Store)
                        {sortColumn === 'quantity_on_hand' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-1">
                        Qty (Lot)
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
                    const hierarchyItem = item as InventoryItemWithHierarchy;
                    const isMasterItem = item.is_master_item;
                    const isExpanded = expandedMasterItems.has(item.id);
                    const isLowStock = item.quantity_on_hand <= item.reorder_level;
                    const isStandalone = !item.is_master_item && !item.parent_id;
                    const standaloneLots = isStandalone ? (subItemLotsMap[item.id] || []) : [];
                    const standaloneOutTxns = isStandalone ? (itemOutTransfersMap[item.id] || []) : [];
                    const standaloneDists = isStandalone ? (itemDistributionsMap[item.id] || []) : [];
                    const isExpandable = isMasterItem || (isStandalone && (standaloneLots.length > 0 || standaloneOutTxns.length > 0 || standaloneDists.length > 0));

                    // For master items, use aggregated values
                    const displayQty = isMasterItem
                      ? hierarchyItem.total_sub_item_quantity || 0
                      : item.quantity_on_hand;
                    const totalValue = displayQty * item.unit_cost;

                    // Calculate lot quantity using default purchase unit
                    const defaultUnit = purchaseUnits[item.id];
                    const lotQty = defaultUnit
                      ? (displayQty / defaultUnit.multiplier).toFixed(1)
                      : null;

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`hover:bg-gray-50 ${isLowStock ? 'bg-amber-50' : ''} ${isExpandable ? 'cursor-pointer' : ''}`}
                          onClick={() => isExpandable && toggleMasterItem(item.id)}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {isExpandable && (
                                <span className="text-gray-400">
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </span>
                              )}
                              <span className={isMasterItem ? 'font-semibold' : ''}>
                                {item.name}
                              </span>
                              {isMasterItem && hierarchyItem.sub_items && (
                                <Badge variant="default" className="text-xs">
                                  {hierarchyItem.sub_items.length} variants
                                </Badge>
                              )}
                              {isStandalone && standaloneLots.length > 0 && (
                                <Badge variant="default" className="text-xs">
                                  {standaloneLots.length} lots
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <Badge variant="default">{item.category}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {isMasterItem ? '-' : item.supplier}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {isMasterItem ? '-' : (item.brand || '-')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={item.description}>
                            {item.description || '-'}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${isLowStock ? 'text-amber-600' : 'text-gray-900'}`}>
                            {displayQty} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {lotQty ? `${lotQty} ${defaultUnit?.unit_name || ''}` : '-'}
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
                                onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Sub-items for expanded master items */}
                        {isMasterItem && isExpanded && hierarchyItem.sub_items?.map((subItem) => {
                          const subItemLots = subItemLotsMap[subItem.id] || [];
                          return (
                            <React.Fragment key={subItem.id}>
                              <tr
                                className="bg-gray-50/50 hover:bg-gray-100"
                              >
                                <td className="px-4 py-2 text-sm text-gray-700 pl-10">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                                    {subItem.color_code && <span className="font-medium">{subItem.color_code}</span>}
                                    {subItem.size && <span className="text-gray-500">({subItem.size})</span>}
                                    {!subItem.color_code && !subItem.size && <span>{subItem.name}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-sm text-center text-gray-500">-</td>
                                <td className="px-4 py-2 text-sm text-gray-600">{subItem.supplier}</td>
                                <td className="px-4 py-2 text-sm text-gray-600">{subItem.brand || '-'}</td>
                                <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">{subItem.description || '-'}</td>
                                <td className="px-4 py-2 text-sm text-right text-gray-500">-</td>
                                <td className="px-4 py-2 text-sm text-right text-gray-500">-</td>
                                <td className="px-4 py-2 text-sm text-right text-gray-500">-</td>
                                <td className="px-4 py-2 text-sm text-right text-gray-600">
                                  ${subItem.unit_cost.toFixed(2)}
                                </td>
                                <td className="px-4 py-2 text-sm text-right text-gray-500">-</td>
                                <td className="px-4 py-2 text-sm text-center">
                                  {canEditItems && (
                                    <button
                                      onClick={() => handleEditItem(subItem)}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {subItemLots.map((lot) => (
                                <tr key={lot.id} className="bg-blue-50/30">
                                  <td colSpan={2} className="pl-16 pr-4 py-1.5 text-xs text-blue-700">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1 h-1 bg-blue-400 rounded-full" />
                                      <span className="font-mono">{lot.lot_number}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-1.5 text-xs text-gray-500">{lot.supplier_name || '-'}</td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5 text-xs text-right text-blue-700 font-medium">{lot.quantity_remaining}</td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5"></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                        {/* Stock breakdown for expanded standalone items */}
                        {isStandalone && isExpanded && (
                          <>
                            {/* Lot rows (positive - blue) */}
                            {standaloneLots.map((lot) => (
                              <tr key={`lot-${lot.id}`} className="bg-blue-50/30">
                                <td colSpan={2} className="pl-10 pr-4 py-1.5 text-xs text-blue-700">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1 h-1 bg-blue-400 rounded-full" />
                                    <span className="font-mono">{lot.lot_number}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-1.5 text-xs text-gray-500">{lot.supplier_name || '-'}</td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5 text-xs text-right text-blue-700 font-medium">+{lot.quantity_received}</td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                              </tr>
                            ))}
                            {/* Out/Transfer rows (negative - red) */}
                            {standaloneOutTxns.map((txn) => (
                              <tr key={`txn-${txn.id}`} className="bg-red-50/30">
                                <td colSpan={2} className="pl-10 pr-4 py-1.5 text-xs text-red-600">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1 h-1 bg-red-400 rounded-full" />
                                    <span className="font-mono">{txn.transaction_number}</span>
                                    <span className="text-red-500">
                                      {txn.transaction_type === 'transfer' ? `→ ${txn.destination_store_name}` : 'OUT'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-1.5 text-xs text-gray-500">{formatDateEST(txn.created_at)}</td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5 text-xs text-right text-red-600 font-medium">-{txn.quantity}</td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                              </tr>
                            ))}
                            {/* Distribution rows (negative - amber) */}
                            {standaloneDists.map((dist) => (
                              <tr key={`dist-${dist.id}`} className="bg-amber-50/30">
                                <td colSpan={2} className="pl-10 pr-4 py-1.5 text-xs text-amber-600">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1 h-1 bg-amber-400 rounded-full" />
                                    <span>Distribution</span>
                                    <span className="text-amber-500">→ {dist.to_employee_name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-1.5 text-xs text-gray-500">{formatDateEST(dist.distribution_date)}</td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5 text-xs text-right text-amber-600 font-medium">-{dist.quantity}</td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                                <td className="px-4 py-1.5"></td>
                              </tr>
                            ))}
                          </>
                        )}
                      </React.Fragment>
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
                          <option value="draft">Draft</option>
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
                <Button variant="secondary" onClick={handleDownloadTransactionTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  CSV Template
                </Button>
                <Button
                  onClick={handleOpenInventoryIn}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <PackagePlus className="w-4 h-4 mr-2" />
                  Inventory In
                </Button>
                <Button
                  onClick={handleOpenTransfer}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  {t('inventory.storeToStore')}
                </Button>
                {canDistribute && (
                  <Button
                    onClick={() => setShowDistributionModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white"
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
                  onClick={async () => {
                    if (transaction.status === 'draft') {
                      // Fetch full draft data (header + items) and open in edit mode
                      try {
                        const { data: itemsData, error: itemsError } = await supabase
                          .from('inventory_transaction_items')
                          .select('*')
                          .eq('transaction_id', transaction.id);

                        if (itemsError) throw itemsError;

                        const txn = transaction as any;
                        setDraftToEdit({
                          id: transaction.id,
                          transaction_type: transaction.transaction_type,
                          supplier_id: txn.supplier_id || undefined,
                          recipient_id: transaction.recipient_id || undefined,
                          destination_store_id: transaction.destination_store_id || undefined,
                          invoice_reference: txn.invoice_reference || undefined,
                          notes: transaction.notes || '',
                          items: (itemsData || []).map((item: any) => ({
                            item_id: item.item_id,
                            purchase_unit_id: item.purchase_unit_id || undefined,
                            purchase_quantity: item.purchase_quantity || undefined,
                            purchase_unit_price: item.purchase_unit_price || undefined,
                            quantity: item.quantity,
                            unit_cost: item.unit_cost,
                            notes: item.notes || '',
                          })),
                        });
                        setTransactionType(transaction.transaction_type);
                        setShowTransactionModal(true);
                      } catch (error) {
                        console.error('Error loading draft:', error);
                        showToast('Failed to load draft', 'error');
                      }
                    } else {
                      setSelectedTransactionId(transaction.id);
                      setShowTransactionDetailModal(true);
                    }
                  }}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      {transaction.transaction_type === 'in' ? (
                        <div className="p-2 bg-green-50 rounded-lg">
                          <PackagePlus className="w-5 h-5 text-green-600" />
                        </div>
                      ) : transaction.transaction_type === 'transfer' ? (
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <ArrowLeftRight className="w-5 h-5 text-purple-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-orange-50 rounded-lg">
                          <PackageMinus className="w-5 h-5 text-orange-600" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {transaction.status === 'draft'
                              ? 'Draft'
                              : transaction.transaction_number}
                          </span>
                          <Badge
                            variant={
                              transaction.transaction_type === 'in' ? 'success' :
                              transaction.transaction_type === 'transfer' ? 'info' : 'default'
                            }
                          >
                            {transaction.transaction_type === 'transfer' ? t('inventory.transfer').toUpperCase() : transaction.transaction_type.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {transaction.transaction_type === 'transfer' ? (
                            transaction.store_id === selectedStoreId ? (
                              <>
                                {t('inventory.transfer')} → {transaction.destination_store_name}
                              </>
                            ) : (
                              <>
                                {t('inventory.transfer')} ← {transaction.source_store_name}
                              </>
                            )
                          ) : (
                            <>
                              Requested by {transaction.requested_by_name}
                              {transaction.recipient_name && ` → ${transaction.recipient_name}`}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:ml-auto">
                      {transaction.status === 'draft' && (
                        <Badge variant="default" className="flex items-center gap-1">
                          <FileEdit className="w-3 h-3" />
                          Draft
                        </Badge>
                      )}
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
                        <Badge variant="danger" className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </Badge>
                      )}
                      {transaction.status === 'draft' && transaction.requested_by_id === session?.employee_id && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm('Delete this draft?')) return;
                            try {
                              const { error } = await supabase.rpc('delete_draft_transaction', {
                                p_transaction_id: transaction.id,
                                p_employee_id: session?.employee_id,
                              });
                              if (error) throw error;
                              showToast('Draft deleted', 'success');
                              fetchTransactions();
                            } catch (error: any) {
                              console.error('Error deleting draft:', error);
                              showToast('Failed to delete draft', 'error');
                            }
                          }}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="Delete draft"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        <div>
          {/* Summary Stats Cards */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <PackagePlus className="w-4 h-4" />
                <span className="text-sm">Active Lots</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{lotStats.totalActiveLots}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-sm">Total Value</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">${lotStats.totalValue.toFixed(2)}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Expiring Soon</span>
              </div>
              <p className={`text-2xl font-bold ${lotStats.expiringLots > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {lotStats.expiringLots}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Low Quantity</span>
              </div>
              <p className={`text-2xl font-bold ${lotStats.lowQuantityLots > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {lotStats.lowQuantityLots}
              </p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={lotSearchQuery}
                onChange={(e) => setLotSearchQuery(e.target.value)}
                placeholder="Search by lot number or item name..."
                className="pl-10"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setIsLotFilterPanelOpen(!isLotFilterPanelOpen)}
                className={`px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 ${
                  getLotActiveFilterCount() > 0
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {getLotActiveFilterCount() > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                    {getLotActiveFilterCount()}
                  </span>
                )}
              </button>

              {isLotFilterPanelOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsLotFilterPanelOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                        <button
                          onClick={() => setIsLotFilterPanelOpen(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Item</label>
                        <select
                          value={lotItemFilter}
                          onChange={(e) => setLotItemFilter(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Items</option>
                          {lotItemOptions.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
                        <select
                          value={lotSupplierFilter}
                          onChange={(e) => setLotSupplierFilter(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Suppliers</option>
                          {lotSupplierOptions.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={lotStatusFilter}
                          onChange={(e) => setLotStatusFilter(e.target.value as LotStatus | '')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Status</option>
                          <option value="active">Active</option>
                          <option value="depleted">Depleted</option>
                          <option value="expired">Expired</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                          <input
                            type="date"
                            value={lotDateRangeStart}
                            onChange={(e) => setLotDateRangeStart(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                          <input
                            type="date"
                            value={lotDateRangeEnd}
                            onChange={(e) => setLotDateRangeEnd(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {getLotActiveFilterCount() > 0 && (
                        <button
                          onClick={clearLotFilters}
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

            <Button
              variant="secondary"
              onClick={() => fetchLots()}
              className="whitespace-nowrap"
            >
              Refresh
            </Button>
          </div>

          {/* Lots Table */}
          {lotsLoading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2">Loading purchase lots...</p>
            </div>
          ) : sortedLots.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
              <PackagePlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>
                {lotSearchQuery || getLotActiveFilterCount() > 0
                  ? 'No lots match your filters'
                  : 'No purchase lots yet'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                      {/* Expand column */}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleLotSort('lot_number')}
                    >
                      <div className="flex items-center gap-1">
                        Lot Number
                        {lotSortColumn === 'lot_number' && (
                          lotSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleLotSort('item_name')}
                    >
                      <div className="flex items-center gap-1">
                        Item
                        {lotSortColumn === 'item_name' && (
                          lotSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleLotSort('quantity_remaining')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Qty Remaining
                        {lotSortColumn === 'quantity_remaining' && (
                          lotSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Qty Received
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleLotSort('unit_cost')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Unit Cost
                        {lotSortColumn === 'unit_cost' && (
                          lotSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Lot Value
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleLotSort('purchase_date')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Purchase Date
                        {lotSortColumn === 'purchase_date' && (
                          lotSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleLotSort('status')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Status
                        {lotSortColumn === 'status' && (
                          lotSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedLots.map((lot) => {
                    const isExpanded = expandedLotIds.has(lot.id);
                    const lotValue = lot.quantity_remaining * lot.unit_cost;
                    const isLowQuantity = lot.quantity_remaining <= lot.quantity_received * 0.1 && lot.status === 'active';

                    // Calculate days until expiration
                    let daysUntilExpiry: number | null = null;
                    let isExpiringSoon = false;
                    if (lot.expiration_date && lot.status === 'active') {
                      daysUntilExpiry = Math.ceil(
                        (new Date(lot.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30;
                    }

                    return (
                      <React.Fragment key={lot.id}>
                        <tr
                          className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : ''} ${isLowQuantity ? 'bg-amber-50' : ''}`}
                          onClick={() => toggleLotExpand(lot.id)}
                        >
                          <td className="px-2 py-3 text-center">
                            <ChevronRight
                              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-600' : ''}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            {lot.lot_number}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{lot.item_name}</p>
                              {lot.item?.brand && (
                                <p className="text-xs text-gray-500">{lot.item.brand}</p>
                              )}
                            </div>
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${isLowQuantity ? 'text-amber-600' : 'text-gray-900'}`}>
                            {lot.quantity_remaining} {lot.item?.unit || ''}
                            {isLowQuantity && (
                              <AlertTriangle className="w-3 h-3 inline ml-1 text-amber-500" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {lot.quantity_received} {lot.item?.unit || ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            ${lot.unit_cost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            ${lotValue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">
                            {formatDateEST(lot.purchase_date)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={
                                lot.status === 'active' ? 'success' :
                                lot.status === 'depleted' ? 'default' :
                                lot.status === 'expired' ? 'danger' :
                                'warning'
                              }
                            >
                              {lot.status}
                            </Badge>
                            {isExpiringSoon && (
                              <div className="mt-1">
                                <Badge variant="warning">
                                  Expires in {daysUntilExpiry}d
                                </Badge>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Expanded row with lot details */}
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={9} className="px-0 py-0">
                              <div className="border-t border-gray-200 overflow-hidden">
                                <div className="px-6 py-4">
                                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Lot Details</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-500">Batch Number</p>
                                      <p className="font-medium text-gray-900">{lot.batch_number || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Invoice Reference</p>
                                      <p className="font-medium text-gray-900">{lot.invoice_reference || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Supplier</p>
                                      <p className="font-medium text-gray-900">{lot.supplier_name || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Expiration Date</p>
                                      <p className={`font-medium ${isExpiringSoon ? 'text-amber-600' : 'text-gray-900'}`}>
                                        {lot.expiration_date ? formatDateEST(lot.expiration_date) : '-'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Created By</p>
                                      <p className="font-medium text-gray-900">{lot.created_by_name || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Created At</p>
                                      <p className="font-medium text-gray-900">{formatDateTimeEST(lot.created_at)}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-gray-500">Notes</p>
                                      <p className="font-medium text-gray-900">{lot.notes || '-'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'distributions' && (
        <div>
          {/* Summary Stats Cards */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <PackageMinus className="w-4 h-4" />
                <span className="text-sm">Total Distributions</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{distributionStats.totalDistributions}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Pending Acknowledgment</span>
              </div>
              <p className={`text-2xl font-bold ${distributionStats.pendingAcknowledgment > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {distributionStats.pendingAcknowledgment}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Currently In Use</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{distributionStats.currentlyInUse}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-sm">Returned This Month</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{distributionStats.returnedThisMonth}</p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={distributionSearchQuery}
                onChange={(e) => setDistributionSearchQuery(e.target.value)}
                placeholder="Search by distribution number or employee name..."
                className="pl-10"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setIsDistributionFilterPanelOpen(!isDistributionFilterPanelOpen)}
                className={`px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 ${
                  getDistributionActiveFilterCount() > 0
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {getDistributionActiveFilterCount() > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                    {getDistributionActiveFilterCount()}
                  </span>
                )}
              </button>

              {isDistributionFilterPanelOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDistributionFilterPanelOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                        <button
                          onClick={() => setIsDistributionFilterPanelOpen(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Employee (To)</label>
                        <select
                          value={distributionEmployeeFilter}
                          onChange={(e) => setDistributionEmployeeFilter(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Employees</option>
                          {distributionEmployeeOptions.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Item</label>
                        <select
                          value={distributionItemFilter}
                          onChange={(e) => setDistributionItemFilter(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Items</option>
                          {distributionItemOptions.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={distributionStatusFilter}
                          onChange={(e) => setDistributionStatusFilter(e.target.value as DistributionStatus | '')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Status</option>
                          <option value="pending">Pending</option>
                          <option value="acknowledged">Acknowledged</option>
                          <option value="in_use">In Use</option>
                          <option value="returned">Returned</option>
                          <option value="consumed">Consumed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                          <input
                            type="date"
                            value={distributionDateRangeStart}
                            onChange={(e) => setDistributionDateRangeStart(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                          <input
                            type="date"
                            value={distributionDateRangeEnd}
                            onChange={(e) => setDistributionDateRangeEnd(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {getDistributionActiveFilterCount() > 0 && (
                        <button
                          onClick={clearDistributionFilters}
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

            <Button
              variant="secondary"
              onClick={() => fetchDistributions()}
              className="whitespace-nowrap"
            >
              Refresh
            </Button>
          </div>

          {/* Distributions Table */}
          {distributionsLoading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2">Loading distributions...</p>
            </div>
          ) : sortedDistributions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
              <PackageMinus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>
                {distributionSearchQuery || getDistributionActiveFilterCount() > 0
                  ? 'No distributions match your filters'
                  : 'No distributions yet'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                      {/* Expand column */}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleDistributionSort('distribution_number')}
                    >
                      <div className="flex items-center gap-1">
                        Distribution #
                        {distributionSortColumn === 'distribution_number' && (
                          distributionSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleDistributionSort('distribution_date')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Date
                        {distributionSortColumn === 'distribution_date' && (
                          distributionSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleDistributionSort('item_name')}
                    >
                      <div className="flex items-center gap-1">
                        Item
                        {distributionSortColumn === 'item_name' && (
                          distributionSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Lot #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      From
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleDistributionSort('to_employee_name')}
                    >
                      <div className="flex items-center gap-1">
                        To
                        {distributionSortColumn === 'to_employee_name' && (
                          distributionSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleDistributionSort('quantity')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Qty
                        {distributionSortColumn === 'quantity' && (
                          distributionSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleDistributionSort('status')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Status
                        {distributionSortColumn === 'status' && (
                          distributionSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDistributions.map((dist) => {
                    const isExpanded = expandedDistributionIds.has(dist.id);
                    const totalValue = dist.quantity * dist.unit_cost;

                    return (
                      <React.Fragment key={dist.id}>
                        <tr
                          className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : ''}`}
                          onClick={() => toggleDistributionExpand(dist.id)}
                        >
                          <td className="px-2 py-3 text-center">
                            <ChevronRight
                              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-600' : ''}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            {dist.distribution_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">
                            {formatDateEST(dist.distribution_date)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{dist.item_name}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">
                            {dist.lot_number || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {dist.from_type === 'store' ? (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                Store
                              </span>
                            ) : (
                              dist.from_employee_name || '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {dist.to_employee_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {dist.quantity}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant={getDistributionStatusBadgeVariant(dist.status as DistributionStatus)}>
                                {dist.status.replace('_', ' ')}
                              </Badge>
                              {dist.status !== 'cancelled' && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  dist.manager_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {dist.manager_approved ? 'Mgr Approved' : 'Mgr Pending'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded row with distribution details */}
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={9} className="px-0 py-0">
                              <div className="border-t border-gray-200 overflow-hidden">
                                <div className="px-6 py-4">
                                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Distribution Details</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-500">Unit Cost</p>
                                      <p className="font-medium text-gray-900">${dist.unit_cost.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Total Value</p>
                                      <p className="font-medium text-gray-900">${totalValue.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Expected Return</p>
                                      <p className="font-medium text-gray-900">
                                        {dist.expected_return_date ? formatDateEST(dist.expected_return_date) : '-'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Actual Return</p>
                                      <p className="font-medium text-gray-900">
                                        {dist.actual_return_date ? formatDateEST(dist.actual_return_date) : '-'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Distributed By</p>
                                      <p className="font-medium text-gray-900">{dist.distributed_by_name || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Acknowledged At</p>
                                      <p className="font-medium text-gray-900">
                                        {dist.acknowledged_at ? formatDateTimeEST(dist.acknowledged_at) : '-'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Manager Approved</p>
                                      <p className="font-medium text-gray-900">
                                        {dist.manager_approved
                                          ? `${dist.manager_approved_by_name || 'Unknown'} — ${dist.manager_approved_at ? formatDateTimeEST(dist.manager_approved_at) : ''}`
                                          : '-'}
                                      </p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-gray-500">Condition Notes</p>
                                      <p className="font-medium text-gray-900">{dist.condition_notes || '-'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                            <Badge variant={supplier.is_active ? 'success' : 'default'}>
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
        draftTransaction={draftToEdit}
      />

      <EmployeeDistributionModal
        isOpen={showDistributionModal}
        onClose={() => setShowDistributionModal(false)}
        onSuccess={() => {
          fetchItems();
          fetchTransactions();
          if (activeTab === 'distributions') {
            fetchDistributions();
          }
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

      <CsvImportModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        onSuccess={handleItemSuccess}
      />
    </div>
  );
}
