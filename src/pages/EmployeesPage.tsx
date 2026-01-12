import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase, Employee, Store, WeeklySchedule } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { MultiSelect } from '../components/ui/MultiSelect';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { resetPIN } from '../lib/auth';
import { Permissions } from '../lib/permissions';
import { getDefaultSchedule, getThreeLetterDayName, formatScheduleDisplay } from '../lib/schedule-utils';

function abbreviateStoreName(storeCode: string): string {
  const codeMap: Record<string, string> = {
    'OM': 'M',
    'OC': 'C',
    'OR': 'R',
  };
  return codeMap[storeCode.toUpperCase()] || storeCode.substring(0, 1).toUpperCase();
}

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [employeeStoresMap, setEmployeeStoresMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmployee, setResetEmployee] = useState<Employee | null>(null);
  const [tempPIN, setTempPIN] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const { showToast } = useToast();
  const { session, selectedStoreId, t } = useAuth();

  const [formData, setFormData] = useState({
    display_name: '',
    role: ['Technician'] as Employee['role'],
    status: 'Active' as Employee['status'],
    pay_type: 'hourly' as 'hourly' | 'daily' | 'commission',
    store_ids: [] as string[],
    notes: '',
    tip_report_show_details: true,
    tip_paired_enabled: true,
    attendance_display: true,
    count_ot: true,
    weekly_schedule: getDefaultSchedule(),
  });

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [selectedStoreId]);

  useEffect(() => {
    let filtered = employees;

    if (selectedStoreId) {
      filtered = filtered.filter((e) => {
        const assignedStores = employeeStoresMap[e.id] || [];
        return assignedStores.length === 0 || assignedStores.includes(selectedStoreId);
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (e) =>
          e.display_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((e) => e.status === filterStatus);
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter((e) => e.role.includes(filterRole as any));
    }

    // Sort by: 1st display_name (A-Z), 2nd status (Active before Inactive)
    filtered.sort((a, b) => {
      // First compare by display_name
      const nameCompare = a.display_name.localeCompare(b.display_name);
      if (nameCompare !== 0) return nameCompare;
      // If names are equal, Active comes before Inactive
      if (a.status === 'Active' && b.status === 'Inactive') return -1;
      if (a.status === 'Inactive' && b.status === 'Active') return 1;
      return 0;
    });

    setFilteredEmployees(filtered);
  }, [employees, searchTerm, filterStatus, filterRole, selectedStoreId, employeeStoresMap]);

  async function fetchStores() {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      showToast(t('messages.failed'), 'error');
    }
  }

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('display_name');

      if (error) throw error;

      let allEmployees = data || [];

      // Check logged-in user's role
      const isOwnerOrAdmin = session?.role.includes('Owner') || session?.role.includes('Admin');
      const isManager = session?.role.includes('Manager');

      if (isOwnerOrAdmin) {
        // Admin/Owner can see all employees
        // No filtering needed
      } else if (isManager) {
        // Manager can only see employees with roles: Supervisor, Receptionist, Technician, Cashier
        // Exclude employees who have Admin, Owner, or Manager roles
        allEmployees = allEmployees.filter(emp => {
          const hasRestrictedRole = emp.role.some((r: string) => ['Admin', 'Owner', 'Manager'].includes(r));
          return !hasRestrictedRole;
        });
      }

      const { data: employeeStoresData } = await supabase
        .from('employee_stores')
        .select('employee_id, store_id');

      const storesMap: Record<string, string[]> = {};
      employeeStoresData?.forEach(es => {
        if (!storesMap[es.employee_id]) {
          storesMap[es.employee_id] = [];
        }
        storesMap[es.employee_id].push(es.store_id);
      });

      setEmployeeStoresMap(storesMap);

      setEmployees(allEmployees);
      setFilteredEmployees(allEmployees);
    } catch (error) {
      showToast(t('messages.failed'), 'error');
    } finally {
      setLoading(false);
    }
  }

  function openDrawer(employee?: Employee) {
    if (employee) {
      setEditingEmployee(employee);
      const storeIds = employeeStoresMap[employee.id] || [];
      setFormData({
        display_name: employee.display_name,
        role: employee.role,
        status: employee.status,
        pay_type: employee.pay_type || 'hourly',
        store_ids: storeIds,
        notes: employee.notes,
        tip_report_show_details: employee.tip_report_show_details ?? true,
        tip_paired_enabled: employee.tip_paired_enabled ?? true,
        attendance_display: employee.attendance_display ?? true,
        count_ot: employee.count_ot ?? true,
        weekly_schedule: employee.weekly_schedule || getDefaultSchedule(),
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        display_name: '',
        role: ['Technician'],
        status: 'Active',
        pay_type: 'hourly',
        store_ids: [],
        notes: '',
        tip_report_show_details: true,
        tip_paired_enabled: true,
        attendance_display: true,
        count_ot: true,
        weekly_schedule: getDefaultSchedule(),
      });
    }
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingEmployee(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.display_name) {
      showToast(t('forms.required'), 'error');
      return;
    }

    // Owner cannot edit Admin employees
    if (editingEmployee && !Permissions.employees.canEditEmployee(session?.role || [], editingEmployee.role)) {
      showToast(t('messages.permissionDenied') || 'You do not have permission to edit this employee', 'error');
      return;
    }

    try {
      let rolePermission: 'Technician' | 'Receptionist' | 'Supervisor';

      if (formData.role.includes('Supervisor')) {
        rolePermission = 'Supervisor';
      } else if (formData.role.includes('Receptionist') || formData.role.includes('Manager') || formData.role.includes('Owner')) {
        rolePermission = 'Receptionist';
      } else {
        rolePermission = 'Technician';
      }

      const employeeData = {
        display_name: formData.display_name,
        legal_name: formData.display_name,
        role: formData.role,
        role_permission: rolePermission,
        status: formData.status,
        pay_type: formData.pay_type,
        notes: formData.notes,
        tip_report_show_details: formData.tip_report_show_details,
        tip_paired_enabled: formData.tip_paired_enabled,
        attendance_display: formData.attendance_display,
        count_ot: formData.count_ot,
        weekly_schedule: formData.weekly_schedule,
        updated_at: new Date().toISOString(),
      };

      let employeeId: string;

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        employeeId = editingEmployee.id;

        await supabase
          .from('employee_stores')
          .delete()
          .eq('employee_id', employeeId);
      } else {
        const { data: newEmployee, error } = await supabase
          .from('employees')
          .insert([employeeData])
          .select('id')
          .single();

        if (error) throw error;
        if (!newEmployee) throw new Error('Failed to create employee');
        employeeId = newEmployee.id;
      }

      if (formData.store_ids.length > 0) {
        const employeeStoreRecords = formData.store_ids.map(storeId => ({
          employee_id: employeeId,
          store_id: storeId,
        }));

        const { error: storesError } = await supabase
          .from('employee_stores')
          .insert(employeeStoreRecords);

        if (storesError) throw storesError;
      }

      showToast(
        editingEmployee ? t('messages.saved') : t('messages.saved'),
        'success'
      );

      await fetchEmployees();
      closeDrawer();
    } catch (error) {
      showToast(t('messages.failed'), 'error');
    }
  }

  async function handleResetPIN(employee: Employee) {
    if (!session || !Permissions.employees.canResetPIN(session.role)) {
      showToast('You do not have permission to reset PINs', 'error');
      return;
    }

    // Check target-aware permission
    if (!Permissions.employees.canResetEmployeePIN(session.role, employee.role)) {
      showToast(t('messages.permissionDenied') || 'You do not have permission to reset this employee\'s PIN', 'error');
      return;
    }

    try {
      const result = await resetPIN(employee.id);
      if (result.success) {
        setTempPIN(result.tempPIN);
        setResetEmployee(employee);
        setResetModalOpen(true);
        showToast(t('emp.pinReset'), 'success');
      } else {
        showToast(result.error || 'Failed to reset PIN', 'error');
      }
    } catch (error) {
      showToast('Failed to reset PIN', 'error');
    }
  }

  async function handleDeleteEmployee() {
    if (!deletingEmployee || !session || !Permissions.employees.canDelete(session.role)) {
      showToast('You do not have permission to delete employees', 'error');
      return;
    }

    // Owner cannot delete Admin employees
    if (!Permissions.employees.canDeleteEmployee(session.role, deletingEmployee.role)) {
      showToast(t('messages.permissionDenied') || 'You do not have permission to delete this employee', 'error');
      return;
    }

    try {
      // First delete employee store assignments
      await supabase
        .from('employee_stores')
        .delete()
        .eq('employee_id', deletingEmployee.id);

      // Then delete the employee
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', deletingEmployee.id);

      if (error) throw error;

      showToast('Employee deleted successfully', 'success');
      setDeleteModalOpen(false);
      setDeletingEmployee(null);
      closeDrawer();
      await fetchEmployees();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      showToast('Failed to delete employee', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('messages.loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{t('emp.title')}</h2>
        <Button size="sm" onClick={() => openDrawer()}>
          <Plus className="w-3 h-3 mr-1" />
          {t('actions.add')}
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-2 border-b border-gray-200 flex gap-2">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={t('actions.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'Active', label: t('emp.active') },
              { value: 'Inactive', label: t('emp.inactive') },
            ]}
          />
          <Select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={(() => {
              const isOwnerOrAdmin = session?.role.includes('Owner') || session?.role.includes('Admin');
              const baseOptions = [
                { value: 'all', label: 'All Roles' },
                { value: 'Technician', label: t('emp.technician') },
                { value: 'Receptionist', label: t('emp.receptionist') },
                { value: 'Supervisor', label: t('emp.supervisor') },
                { value: 'Cashier', label: t('emp.cashier') },
              ];
              if (isOwnerOrAdmin) {
                return [
                  ...baseOptions,
                  { value: 'Manager', label: t('emp.manager') },
                  { value: 'Owner', label: t('emp.owner') },
                  { value: 'Admin', label: t('emp.admin') },
                ];
              }
              return baseOptions;
            })()}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('emp.displayName')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('emp.role')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('emp.status')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('emp.assignedStores')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => {
                const assignedStores = employeeStoresMap[employee.id] || [];
                const storeNames = assignedStores
                  .map(storeId => {
                    const code = stores.find(s => s.id === storeId)?.code;
                    return code ? abbreviateStoreName(code) : null;
                  })
                  .filter(Boolean)
                  .join(', ');

                return (
                  <tr
                    key={employee.id}
                    onClick={() => openDrawer(employee)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                      {employee.display_name}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900">
                      <div className="flex flex-wrap gap-1">
                        {employee.role.map((r) => (
                          <Badge key={r} variant="default">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant={employee.status === 'Active' ? 'success' : 'danger'}>
                        {employee.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {assignedStores.length === 0 ? (
                        <span className="text-gray-400 italic">All stores</span>
                      ) : (
                        <span>{storeNames}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      <span className="font-mono">{formatScheduleDisplay(employee.weekly_schedule)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No employees found</p>
          </div>
        )}
      </div>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={editingEmployee ? t('actions.edit') : t('actions.add')}
        headerActions={
          <div className="flex items-center gap-2">
            {editingEmployee && session && Permissions.employees.canDelete(session.role) &&
             Permissions.employees.canDeleteEmployee(session.role, editingEmployee.role) && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeletingEmployee(editingEmployee);
                  setDeleteModalOpen(true);
                }}
              >
                Delete
              </Button>
            )}
            {(!editingEmployee || (session && Permissions.employees.canEditEmployee(session.role, editingEmployee.role))) && (
              <Button type="submit" size="sm" form="employee-form">
                {editingEmployee ? t('actions.save') : t('actions.add')}
              </Button>
            )}
          </div>
        }
      >
        <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
          {editingEmployee && session && !Permissions.employees.canEditEmployee(session.role, editingEmployee.role) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">View Only</span>
              </div>
              <p className="text-xs text-yellow-700 mt-1">
                You do not have permission to edit this employee.
              </p>
            </div>
          )}
          <Input
            label={`${t('emp.displayName')} *`}
            value={formData.display_name}
            onChange={(e) =>
              setFormData({ ...formData, display_name: e.target.value })
            }
            required
          />
          <MultiSelect
            label={`${t('emp.role')} *`}
            value={formData.role}
            onChange={(values) =>
              setFormData({
                ...formData,
                role: values as Employee['role'],
              })
            }
            options={(() => {
              const isAdmin = session?.role.includes('Admin');
              const isOwner = session?.role.includes('Owner') && !isAdmin;
              const isManager = session?.role.includes('Manager') && !isOwner && !isAdmin;

              // Manager can only assign lower-level roles
              if (isManager) {
                return [
                  { value: 'Technician', label: t('emp.technician') },
                  { value: 'Receptionist', label: t('emp.receptionist') },
                  { value: 'Cashier', label: t('emp.cashier') },
                  { value: 'Supervisor', label: t('emp.supervisor') },
                ];
              }

              // Base roles for Owner (includes Manager)
              const baseRoles = [
                { value: 'Technician', label: t('emp.technician') },
                { value: 'Receptionist', label: t('emp.receptionist') },
                { value: 'Cashier', label: t('emp.cashier') },
                { value: 'Supervisor', label: t('emp.supervisor') },
                { value: 'Manager', label: t('emp.manager') },
              ];

              if (isAdmin) {
                // Admin can assign ALL roles including Admin and Owner
                return [
                  ...baseRoles,
                  { value: 'Owner', label: t('emp.owner') },
                  { value: 'Admin', label: t('emp.admin') },
                ];
              } else if (isOwner) {
                // Owner can assign all roles EXCEPT Admin
                return [
                  ...baseRoles,
                  { value: 'Owner', label: t('emp.owner') },
                ];
              }
              return baseRoles;
            })()}
            placeholder="Select roles"
          />
          <Select
            label={`${t('emp.status')} *`}
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as Employee['status'],
              })
            }
            options={[
              { value: 'Active', label: t('emp.active') },
              { value: 'Inactive', label: t('emp.inactive') },
            ]}
          />
          {session && session.role && (session.role.includes('Owner') || session.role.includes('Manager')) && (
            <Select
              label="Pay Type *"
              value={formData.pay_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  pay_type: e.target.value as 'hourly' | 'daily' | 'commission',
                })
              }
              options={[
                { value: 'hourly', label: 'Hourly' },
                { value: 'daily', label: 'Daily' },
                { value: 'commission', label: 'Commission' },
              ]}
            />
          )}
          {session && session.role && (session.role.includes('Owner') || session.role.includes('Manager')) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weekly Schedule *
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Select the days this employee is scheduled to work
              </p>
              <div className="grid grid-cols-7 gap-2">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        weekly_schedule: {
                          ...formData.weekly_schedule,
                          [day]: {
                            ...formData.weekly_schedule[day],
                            is_working: !formData.weekly_schedule[day].is_working,
                          },
                        },
                      });
                    }}
                    className={`py-1.5 px-1 rounded-lg font-medium transition-all ${
                      formData.weekly_schedule[day].is_working
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] leading-tight">{getThreeLetterDayName(day)}</span>
                      {formData.weekly_schedule[day].is_working && (
                        <span className="text-[10px]">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <MultiSelect
            label={t('emp.assignedStores')}
            value={formData.store_ids}
            onChange={(values) =>
              setFormData({
                ...formData,
                store_ids: values,
              })
            }
            options={stores.map(store => ({
              value: store.id,
              label: `${store.name} (${store.code})`
            }))}
            placeholder="Select stores (No stores = No access)"
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              id="tip_report_show_details"
              checked={formData.tip_report_show_details}
              onChange={(e) => setFormData({ ...formData, tip_report_show_details: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="tip_report_show_details" className="ml-2 text-sm font-medium text-gray-700">
              Tip Report: Detail
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="tip_paired_enabled"
              checked={formData.tip_paired_enabled}
              onChange={(e) => setFormData({ ...formData, tip_paired_enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="tip_paired_enabled" className="ml-2 text-sm font-medium text-gray-700">
              Tip Paired
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="attendance_display"
              checked={formData.attendance_display}
              onChange={(e) => setFormData({ ...formData, attendance_display: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="attendance_display" className="ml-2 text-sm font-medium text-gray-700">
              Attendance Display
            </label>
          </div>
          {formData.pay_type === 'hourly' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="count_ot"
                checked={formData.count_ot}
                onChange={(e) => setFormData({ ...formData, count_ot: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="count_ot" className="ml-2 text-sm font-medium text-gray-700">
                Count OT
              </label>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tickets.notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {editingEmployee && session && Permissions.employees.canResetPIN(session.role) &&
           Permissions.employees.canResetEmployeePIN(session.role, editingEmployee.role) && (
            <div>
              <button
                type="button"
                onClick={() => handleResetPIN(editingEmployee)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                Change PIN
              </button>
            </div>
          )}
        </form>
      </Drawer>

      <Modal
        isOpen={resetModalOpen}
        onClose={() => {
          setResetModalOpen(false);
          setTempPIN('');
          setResetEmployee(null);
        }}
        title={t('emp.resetPIN')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            PIN has been reset for <strong>{resetEmployee?.display_name}</strong>
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-800 mb-2 font-medium">{t('emp.tempPIN')}:</p>
            <p className="text-3xl font-bold text-blue-900 text-center tracking-wider">
              {tempPIN}
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Please provide this temporary PIN to the employee. They will be able to use it to log in.
          </p>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setResetModalOpen(false);
                setTempPIN('');
                setResetEmployee(null);
              }}
            >
              {t('actions.close')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingEmployee(null);
        }}
        title="Delete Employee"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 mb-1">
                Warning: This action cannot be undone
              </p>
              <p className="text-sm text-red-700">
                You are about to permanently delete <strong>{deletingEmployee?.display_name}</strong> from the system.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeletingEmployee(null);
              }}
              className="flex-1"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteEmployee}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
