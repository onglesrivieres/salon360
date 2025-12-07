import React, { useState, useEffect } from 'react';
import { X, Filter, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Badge } from './ui/Badge';
import { useToast } from './ui/Toast';
import { supabase, InventoryItem, ItemTransactionHistory } from '../lib/supabase';
import { formatDateTimeEST } from '../lib/timezone';

interface ItemTransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem;
  onViewTransactionDetail: (transactionId: string) => void;
}

type SortField = 'created_at' | 'quantity' | 'purchase_unit_price';
type SortDirection = 'asc' | 'desc';

export function ItemTransactionHistoryModal({
  isOpen,
  onClose,
  item,
  onViewTransactionDetail,
}: ItemTransactionHistoryModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<ItemTransactionHistory[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<ItemTransactionHistory[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | '7days' | '30days'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && item) {
      fetchTransactions();
    }
  }, [isOpen, item]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [transactions, typeFilter, statusFilter, dateRangeFilter, sortField, sortDirection, searchQuery]);

  async function fetchTransactions() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory_transaction_items')
        .select(`
          id,
          transaction_id,
          quantity,
          unit_cost,
          notes,
          purchase_quantity,
          purchase_unit_price,
          inventory_transactions!inner (
            id,
            transaction_number,
            transaction_type,
            status,
            created_at
          ),
          store_product_purchase_units (
            unit_name,
            unit_multiplier
          )
        `)
        .eq('item_id', item.id)
        .order('created_at', { foreignTable: 'inventory_transactions', ascending: false });

      if (error) throw error;

      const formattedData: ItemTransactionHistory[] = (data || []).map((item: any) => ({
        transaction_id: item.transaction_id,
        transaction_number: item.inventory_transactions.transaction_number,
        transaction_type: item.inventory_transactions.transaction_type,
        status: item.inventory_transactions.status,
        created_at: item.inventory_transactions.created_at,
        purchase_unit_name: item.store_product_purchase_units?.unit_name || 'N/A',
        purchase_quantity: item.purchase_quantity || 0,
        purchase_unit_price: item.purchase_unit_price || 0,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        notes: item.notes || '',
      }));

      setTransactions(formattedData);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      showToast('Failed to load transaction history', 'error');
    } finally {
      setLoading(false);
    }
  }

  function applyFiltersAndSort() {
    let filtered = [...transactions];

    if (typeFilter !== 'all') {
      filtered = filtered.filter((t) => t.transaction_type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    if (dateRangeFilter !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      if (dateRangeFilter === '7days') {
        cutoffDate.setDate(now.getDate() - 7);
      } else if (dateRangeFilter === '30days') {
        cutoffDate.setDate(now.getDate() - 30);
      }
      filtered = filtered.filter((t) => new Date(t.created_at) >= cutoffDate);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.transaction_number.toLowerCase().includes(query) ||
          t.notes.toLowerCase().includes(query) ||
          t.purchase_unit_name.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'purchase_unit_price':
          aValue = a.purchase_unit_price;
          bValue = b.purchase_unit_price;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredTransactions(filtered);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  function clearFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
    setDateRangeFilter('all');
    setSearchQuery('');
  }

  const activeFilterCount = [
    typeFilter !== 'all',
    statusFilter !== 'all',
    dateRangeFilter !== 'all',
    searchQuery.trim() !== '',
  ].filter(Boolean).length;

  const totalIn = filteredTransactions
    .filter((t) => t.transaction_type === 'in')
    .reduce((sum, t) => sum + t.purchase_quantity, 0);

  const totalOut = filteredTransactions
    .filter((t) => t.transaction_type === 'out')
    .reduce((sum, t) => sum + t.quantity, 0);

  function getStatusBadgeVariant(status: string): 'warning' | 'success' | 'error' {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'warning';
    }
  }

  function getTypeBadgeVariant(type: string): 'success' | 'warning' {
    return type === 'in' ? 'success' : 'warning';
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Transaction History: ${item.name}`} size="xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[300px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by transaction number, notes, or unit..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
              <option value="all">All Types</option>
              <option value="in">Stock In</option>
              <option value="out">Stock Out</option>
            </Select>

            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>

            <Select value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value as any)}>
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </Select>

            {activeFilterCount > 0 && (
              <Button variant="secondary" onClick={clearFilters} className="flex items-center gap-1">
                <Filter className="w-4 h-4" />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Transactions</p>
            <p className="text-2xl font-semibold text-gray-900">{filteredTransactions.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Stock In</p>
            <p className="text-2xl font-semibold text-green-600">+{totalIn}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Stock Out</p>
            <p className="text-2xl font-semibold text-orange-600">-{totalOut}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {transactions.length === 0
                ? 'No transactions found for this item'
                : 'No transactions match the current filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortField === 'created_at' &&
                        (sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Transaction #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Purchase Unit
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Quantity
                      {sortField === 'quantity' &&
                        (sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('purchase_unit_price')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Unit Price
                      {sortField === 'purchase_unit_price' &&
                        (sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr
                    key={transaction.transaction_id}
                    onClick={() => onViewTransactionDetail(transaction.transaction_id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDateTimeEST(transaction.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">
                      {transaction.transaction_number}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getTypeBadgeVariant(transaction.transaction_type)}>
                        {transaction.transaction_type === 'in' ? 'IN' : 'OUT'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(transaction.status)}>
                        {transaction.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{transaction.purchase_unit_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {transaction.transaction_type === 'in'
                        ? transaction.purchase_quantity
                        : transaction.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {transaction.transaction_type === 'in' && transaction.purchase_unit_price > 0
                        ? `$${transaction.purchase_unit_price.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {transaction.transaction_type === 'in' && transaction.purchase_unit_price > 0
                        ? `$${(transaction.purchase_quantity * transaction.purchase_unit_price).toFixed(2)}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
