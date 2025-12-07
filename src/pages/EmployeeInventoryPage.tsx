import React, { useState, useEffect } from 'react';
import { Package, User, DollarSign, Calendar, Search, TrendingDown, ChevronRight } from 'lucide-react';
import { supabase, EmployeeInventoryWithDetails, Technician, EmployeeInventoryLotDetail } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { formatDateTimeEST } from '../lib/timezone';

export function EmployeeInventoryPage() {
  const [inventory, setInventory] = useState<EmployeeInventoryWithDetails[]>([]);
  const [employees, setEmployees] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();

  const canViewAll = session?.role && Permissions.inventory.canViewEmployeeInventory(session.role);
  const canViewOwn = session?.role && Permissions.inventory.canViewOwnInventory(session.role);

  useEffect(() => {
    if (selectedStoreId) {
      if (canViewAll) {
        fetchEmployees();
      } else if (canViewOwn && session?.employee_id) {
        setSelectedEmployeeId(session.employee_id);
      }
    }
  }, [selectedStoreId, canViewAll, canViewOwn, session?.employee_id]);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployeeInventory(selectedEmployeeId);
    } else {
      setInventory([]);
    }
  }, [selectedEmployeeId]);

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
      showToast('Failed to load employees', 'error');
    }
  }

  async function fetchEmployeeInventory(employeeId: string) {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_employee_inventory', {
        p_employee_id: employeeId,
      });

      if (error) throw error;

      const inventoryData = data || [];

      const { data: lotsData, error: lotsError } = await supabase
        .from('employee_inventory_lots')
        .select(`
          id,
          lot_id,
          quantity,
          unit_cost,
          distributed_date,
          master_item_id,
          inventory_purchase_lots!inner (
            lot_number,
            purchase_date,
            invoice_reference,
            status,
            quantity_received,
            suppliers (
              name
            )
          )
        `)
        .eq('employee_id', employeeId)
        .order('distributed_date', { ascending: false });

      if (lotsError) throw lotsError;

      const lotsMap = new Map<string, EmployeeInventoryLotDetail[]>();
      (lotsData || []).forEach((lot: any) => {
        const itemId = lot.master_item_id;
        if (!lotsMap.has(itemId)) {
          lotsMap.set(itemId, []);
        }
        lotsMap.get(itemId)!.push({
          id: lot.id,
          lot_id: lot.lot_id,
          lot_number: lot.inventory_purchase_lots.lot_number,
          quantity: lot.quantity,
          unit_cost: lot.unit_cost,
          distributed_date: lot.distributed_date,
          purchase_date: lot.inventory_purchase_lots.purchase_date,
          invoice_reference: lot.inventory_purchase_lots.invoice_reference,
          supplier_name: lot.inventory_purchase_lots.suppliers?.name,
          status: lot.inventory_purchase_lots.status,
          quantity_received: lot.inventory_purchase_lots.quantity_received,
        });
      });

      const enrichedInventory = inventoryData.map((item: EmployeeInventoryWithDetails) => ({
        ...item,
        lots: lotsMap.get(item.item_id || item.master_item_id) || [],
      }));

      setInventory(enrichedInventory);
    } catch (error) {
      console.error('Error fetching employee inventory:', error);
      showToast('Failed to load employee inventory', 'error');
    } finally {
      setLoading(false);
    }
  }

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInventory = filteredInventory.slice(startIndex, endIndex);

  const totalValue = inventory.reduce((sum, item) => sum + (item.total_value || 0), 0);
  const totalItems = inventory.length;
  const totalQuantity = inventory.reduce((sum, item) => sum + (item.quantity_on_hand || 0), 0);

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  const toggleExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItemIds);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItemIds(newExpanded);
  };

  useEffect(() => {
    setCurrentPage(1);
    setExpandedItemIds(new Set());
  }, [searchQuery, selectedEmployeeId]);

  if (!selectedStoreId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Store Selected</h2>
          <p className="text-gray-500">Please select a store to view employee inventory</p>
        </div>
      </div>
    );
  }

  if (!canViewOwn && !canViewAll) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h2>
          <p className="text-gray-500">You do not have permission to view employee inventory</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Employee Inventory</h1>
        <p className="text-gray-600">
          Track individual employee inventory holdings and accountability
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Package className="w-4 h-4" />
            <span className="text-sm">Total Items</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">Total Quantity</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalQuantity.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Total Value</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalValue.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <User className="w-4 h-4" />
            <span className="text-sm">Employee</span>
          </div>
          <p className="text-lg font-semibold text-gray-900 truncate">
            {selectedEmployee?.display_name || 'Select Employee'}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        {canViewAll && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Employee
            </label>
            <Select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              <option value="">Choose an employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.display_name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {!selectedEmployeeId ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>Select an employee to view their inventory</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredInventory.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>
            {searchQuery
              ? 'No items match your search'
              : 'This employee has no inventory assigned'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-12">

                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Avg Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Lots
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Last Audit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedInventory.map((item) => {
                    const isExpanded = expandedItemIds.has(item.id);
                    const hasLots = item.lots && item.lots.length > 0;
                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : ''}`}
                          onClick={() => hasLots && toggleExpand(item.id)}
                        >
                          <td className="px-2 py-3 text-center">
                            {hasLots ? (
                              <ChevronRight
                                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-600' : ''}`}
                              />
                            ) : (
                              <div className="w-5 h-5" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                                <p className="text-xs text-gray-500">{item.item_code}</p>
                              </div>
                              {item.lot_count && item.lot_count > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.lot_count} {item.lot_count === 1 ? 'lot' : 'lots'}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary">{item.category}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900">
                            {item.quantity_on_hand?.toFixed(2)} {item.item_unit}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900">
                            <span className="text-xs text-gray-500 mr-1">Avg</span>
                            ${item.average_cost?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                            ${item.total_value?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {item.lot_count || 0}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500">
                            {item.last_audit_date ? (
                              <div>
                                <p>{formatDateTimeEST(item.last_audit_date)}</p>
                                {item.last_audit_variance !== undefined && item.last_audit_variance !== 0 && (
                                  <p
                                    className={`font-medium ${
                                      item.last_audit_variance < 0 ? 'text-red-600' : 'text-green-600'
                                    }`}
                                  >
                                    {item.last_audit_variance > 0 ? '+' : ''}
                                    {item.last_audit_variance}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">Never</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="px-0 py-0">
                              <div className="border-t border-gray-200 overflow-hidden">
                                {hasLots ? (
                                  <div className="px-6 py-4">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Lot Details</h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-100 border-b border-gray-300">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                              Lot Number
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">
                                              Distributed
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">
                                              Qty
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">
                                              Unit Cost
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase">
                                              Value
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">
                                              Purchase Date
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                              Invoice Ref
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                              Supplier
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">
                                              Status
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {item.lots?.map((lot) => (
                                            <tr key={lot.id} className="hover:bg-gray-100">
                                              <td className="px-3 py-2 text-left font-mono text-xs text-gray-900">
                                                {lot.lot_number}
                                              </td>
                                              <td className="px-3 py-2 text-center text-xs text-gray-600">
                                                {new Date(lot.distributed_date).toLocaleDateString()}
                                              </td>
                                              <td className="px-3 py-2 text-right text-xs text-gray-900">
                                                {lot.quantity.toFixed(2)}
                                              </td>
                                              <td className="px-3 py-2 text-right text-xs text-gray-900">
                                                ${lot.unit_cost.toFixed(2)}
                                              </td>
                                              <td className="px-3 py-2 text-right text-xs font-semibold text-gray-900">
                                                ${(lot.quantity * lot.unit_cost).toFixed(2)}
                                              </td>
                                              <td className="px-3 py-2 text-center text-xs text-gray-600">
                                                {new Date(lot.purchase_date).toLocaleDateString()}
                                              </td>
                                              <td className="px-3 py-2 text-left text-xs text-gray-600">
                                                {lot.invoice_reference || '-'}
                                              </td>
                                              <td className="px-3 py-2 text-left text-xs text-gray-600">
                                                {lot.supplier_name || '-'}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <Badge
                                                  variant={lot.status === 'active' ? 'success' : 'secondary'}
                                                  className="text-xs"
                                                >
                                                  {lot.status}
                                                </Badge>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="px-6 py-4 text-center text-sm text-gray-500">
                                    No lot data available
                                  </div>
                                )}
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
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredInventory.length)} of {filteredInventory.length} items
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
