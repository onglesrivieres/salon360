import React, { useState, useEffect } from 'react';
import { Plus, Search, Store as StoreIcon, Archive, Calculator } from 'lucide-react';
import { supabase, StoreServiceWithDetails } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NumericInput } from '../components/ui/NumericInput';
import { Select } from '../components/ui/Select';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';

type ServiceStatus = 'active' | 'inactive' | 'archived';

export function ServicesPage() {
  const [services, setServices] = useState<StoreServiceWithDetails[]>([]);
  const [filteredServices, setFilteredServices] = useState<StoreServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ServiceStatus>('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<StoreServiceWithDetails | null>(null);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    price: '',
    duration_min: '30',
    category: 'Extensions des Ongles',
    status: 'active' as ServiceStatus,
  });

  const [averageDuration, setAverageDuration] = useState<{
    average_duration: number | null;
    sample_count: number;
  } | null>(null);
  const [fetchingAverage, setFetchingAverage] = useState(false);

  useEffect(() => {
    if (selectedStoreId) {
      fetchServices();
    }
  }, [selectedStoreId]);

  useEffect(() => {
    let filtered = services;

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((s) => getServiceStatus(s) === filterStatus);
    }

    setFilteredServices(filtered);
  }, [services, searchTerm, filterStatus]);

  function getServiceStatus(service: StoreServiceWithDetails): ServiceStatus {
    if (service.archived) return 'archived';
    if (service.active) return 'active';
    return 'inactive';
  }

  async function fetchServices() {
    if (!selectedStoreId) {
      showToast('Please select a store first', 'error');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_services_by_popularity', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;
      const fetchedServices = data || [];
      setServices(fetchedServices);
      setFilteredServices(fetchedServices);
    } catch (error) {
      console.error('Error fetching services:', error);
      showToast('Failed to load services', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAverageDuration(storeServiceId: string) {
    try {
      setFetchingAverage(true);
      const { data, error } = await supabase.rpc('calculate_service_average_duration', {
        p_store_service_id: storeServiceId,
      });

      if (error) throw error;

      if (data) {
        setAverageDuration(data);

        if (data.average_duration !== null) {
          showToast(`The average duration is ${data.average_duration} minutes`, 'success');
        } else if (data.sample_count > 0) {
          showToast('Not enough data to calculate average duration', 'info');
        } else {
          showToast('No historical data available', 'info');
        }
      }
    } catch (error) {
      console.error('Error fetching average duration:', error);
      showToast('Failed to calculate average duration', 'error');
    } finally {
      setFetchingAverage(false);
    }
  }

  function handleAcceptSuggestedDuration() {
    if (averageDuration?.average_duration) {
      setFormData((prev) => ({
        ...prev,
        duration_min: averageDuration.average_duration.toString(),
      }));
      showToast('Duration updated to suggested value', 'success');
    }
  }

  function handleCalculateAverage() {
    if (editingService?.store_service_id) {
      fetchAverageDuration(editingService.store_service_id);
    }
  }

  function openDrawerForNew() {
    if (!session || !session.role || !Permissions.services.canCreate(session.role)) {
      showToast('You do not have permission to create services', 'error');
      return;
    }
    setEditingService(null);
    setAverageDuration(null);
    setFormData({
      code: '',
      name: '',
      price: '',
      duration_min: '30',
      category: 'Extensions des Ongles',
      status: 'active',
    });
    setIsDrawerOpen(true);
  }

  function openDrawerForEdit(service: StoreServiceWithDetails) {
    if (!session || !session.role || !Permissions.services.canEdit(session.role)) {
      showToast('You do not have permission to edit services', 'error');
      return;
    }
    setEditingService(service);
    setAverageDuration(null);
    setFormData({
      code: service.code,
      name: service.name,
      price: service.price.toString(),
      duration_min: service.duration_min.toString(),
      category: service.category,
      status: getServiceStatus(service),
    });
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingService(null);
    setAverageDuration(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!session || !session.role) {
      showToast('You must be logged in', 'error');
      return;
    }

    if (!selectedStoreId) {
      showToast('No store selected', 'error');
      return;
    }

    if (!formData.code || !formData.name || !formData.price || !formData.duration_min) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      if (editingService) {
        if (!Permissions.services.canEdit(session.role)) {
          showToast('You do not have permission to edit services', 'error');
          return;
        }

        // Check if code is being changed and if it conflicts with another service in the store
        if (formData.code.toUpperCase() !== editingService.code.toUpperCase()) {
          const { data: existingService, error: checkError } = await supabase
            .from('store_services')
            .select('id')
            .eq('store_id', selectedStoreId)
            .eq('code', formData.code.toUpperCase())
            .neq('id', editingService.store_service_id)
            .maybeSingle();

          if (checkError) throw checkError;

          if (existingService) {
            showToast('This service code already exists in your store', 'error');
            return;
          }
        }

        const updateData = {
          code: formData.code.toUpperCase(),
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          duration_min: parseInt(formData.duration_min),
          active: formData.status === 'active',
          archived: formData.status === 'archived',
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('store_services')
          .update(updateData)
          .eq('id', editingService.store_service_id);

        if (error) throw error;
        showToast('Service updated successfully', 'success');
      } else {
        if (!Permissions.services.canCreate(session.role)) {
          showToast('You do not have permission to create services', 'error');
          return;
        }

        // Check if code already exists in this store
        const { data: existingService, error: checkError } = await supabase
          .from('store_services')
          .select('id')
          .eq('store_id', selectedStoreId)
          .eq('code', formData.code.toUpperCase())
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingService) {
          showToast('This service code already exists in your store', 'error');
          return;
        }

        // First, find or create the global service to get service_id
        const { data: serviceId, error: globalServiceError } = await supabase
          .rpc('find_or_create_global_service', {
            p_code: formData.code.toUpperCase(),
            p_name: formData.name,
            p_category: formData.category,
            p_base_price: parseFloat(formData.price),
            p_duration_min: parseInt(formData.duration_min)
          });

        if (globalServiceError) throw globalServiceError;

        // Then insert into store_services with the service_id
        const { error: storeServiceError } = await supabase
          .from('store_services')
          .insert({
            store_id: selectedStoreId,
            service_id: serviceId,
            code: formData.code.toUpperCase(),
            name: formData.name,
            category: formData.category,
            base_price: parseFloat(formData.price),
            price: parseFloat(formData.price),
            duration_min: parseInt(formData.duration_min),
            active: formData.status === 'active',
            archived: formData.status === 'archived',
          });

        if (storeServiceError) {
          if (storeServiceError.code === '23505') {
            showToast('This service code already exists in your store', 'error');
          } else {
            throw storeServiceError;
          }
          return;
        }

        showToast('Service created successfully', 'success');
      }

      await fetchServices();
      closeDrawer();
    } catch (error: any) {
      console.error('Error saving service:', error);
      showToast(error.message || 'Failed to save service', 'error');
    }
  }

  function getBadgeVariant(status: ServiceStatus): 'success' | 'warning' | 'default' {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'archived':
        return 'default';
    }
  }

  function getStatusLabel(status: ServiceStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'archived':
        return 'Archived';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading services...</div>
      </div>
    );
  }

  if (!selectedStoreId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <StoreIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Please select a store to manage services</p>
        </div>
      </div>
    );
  }

  const canManage = session?.role && Permissions.services.canCreate(session.role);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Store Services</h2>
          <p className="text-xs text-gray-600 mt-1">
            Manage pricing and availability for this store's services
          </p>
        </div>
        {canManage && (
          <Button onClick={openDrawerForNew} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Service
          </Button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-2 border-b border-gray-200 flex gap-2">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            options={[
              { value: 'all', label: 'All Services' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
              { value: 'archived', label: 'Archived Only' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServices.map((service) => {
                const status = getServiceStatus(service);
                return (
                  <tr
                    key={service.store_service_id}
                    onClick={() => openDrawerForEdit(service)}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      status === 'archived' ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                      {service.code}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {service.name}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {service.category}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      ${service.price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {service.duration_min} min
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant={getBadgeVariant(status)}>
                        {getStatusLabel(status)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No services found</p>
          </div>
        )}
      </div>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={editingService ? 'Edit Store Service' : 'Add New Service'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-800">
              {editingService
                ? 'All changes only affect this store. Other stores are not impacted.'
                : 'Creating a new service for your store. All fields are fully customizable.'}
            </p>
          </div>

          <Input
            label="Service Code *"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g., MANI-001"
            required
          />
          <Input
            label="Service Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Classic Manicure"
            required
          />
          <Input
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="e.g., Extensions des Ongles"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
            <NumericInput
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Duration (minutes) *
                </label>
                <button
                  type="button"
                  onClick={handleCalculateAverage}
                  disabled={!editingService || fetchingAverage}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                    !editingService || fetchingAverage
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Calculator className="w-3 h-3" />
                  {fetchingAverage ? 'Calculating...' : 'Calculate'}
                </button>
              </div>
              <NumericInput
                min="1"
                step="1"
                value={formData.duration_min}
                onChange={(e) =>
                  setFormData({ ...formData, duration_min: e.target.value })
                }
                required
              />
            </div>
            {!fetchingAverage && averageDuration && averageDuration.average_duration !== null && (
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Suggested Duration: {averageDuration.average_duration} minutes
                    </p>
                    <p className="text-xs text-blue-700">
                      Based on {averageDuration.sample_count} completed service{averageDuration.sample_count !== 1 ? 's' : ''} from historical data
                    </p>
                  </div>
                  {formData.duration_min !== averageDuration.average_duration.toString() && (
                    <button
                      type="button"
                      onClick={handleAcceptSuggestedDuration}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      Use Suggested
                    </button>
                  )}
                </div>
                {formData.duration_min === averageDuration.average_duration.toString() && (
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    Currently using suggested duration
                  </p>
                )}
              </div>
            )}
            {!fetchingAverage && averageDuration && averageDuration.average_duration === null && averageDuration.sample_count > 0 && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  Only {averageDuration.sample_count} completed service{averageDuration.sample_count !== 1 ? 's' : ''} found. Minimum 5 required to calculate average duration.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Status *
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={formData.status === 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ServiceStatus })}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Active</span> - Available for new tickets
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={formData.status === 'inactive'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ServiceStatus })}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Inactive</span> - Temporarily unavailable
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="archived"
                  checked={formData.status === 'archived'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ServiceStatus })}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Archived</span> - Permanently removed from use
                </span>
              </label>
            </div>
            {formData.status === 'archived' && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                <p className="text-xs text-yellow-800">
                  <Archive className="w-3 h-3 inline mr-1" />
                  Archived services are hidden from ticket creation but preserve ticket history.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button type="submit">
              {editingService ? 'Update Service' : 'Create Service'}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
