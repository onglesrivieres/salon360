import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Search } from 'lucide-react';
import { supabase, Service } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const { showToast } = useToast();
  const { session } = useAuth();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    base_price: '',
    duration_min: '30',
    category: "Faux d'Ongles",
    active: true,
  });

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    let filtered = services;

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterActive !== 'all') {
      filtered = filtered.filter((s) => s.active === (filterActive === 'active'));
    }

    setFilteredServices(filtered);
  }, [services, searchTerm, filterActive]);

  async function fetchServices() {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('code');

      if (error) throw error;
      const fetchedServices = data || [];
      setServices(fetchedServices);
      setFilteredServices(fetchedServices);
    } catch (error) {
      showToast('Failed to load services', 'error');
    } finally {
      setLoading(false);
    }
  }

  function openDrawer(service?: Service) {
    if (!session || !session.role || !Permissions.services.canEdit(session.role)) {
      showToast('You do not have permission to edit services', 'error');
      return;
    }
    if (service) {
      setEditingService(service);
      setFormData({
        code: service.code,
        name: service.name,
        base_price: service.base_price.toString(),
        duration_min: service.duration_min.toString(),
        category: service.category,
        active: service.active,
      });
    } else {
      setEditingService(null);
      setFormData({
        code: '',
        name: '',
        base_price: '',
        duration_min: '30',
        category: "Faux d'Ongles",
        active: true,
      });
    }
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingService(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!session || !session.role || !Permissions.services.canEdit(session.role)) {
      showToast('You do not have permission to save services', 'error');
      return;
    }

    if (!formData.code || !formData.name || !formData.base_price) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const serviceData = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        base_price: parseFloat(formData.base_price),
        duration_min: parseInt(formData.duration_min),
        category: formData.category,
        active: formData.active,
        updated_at: new Date().toISOString(),
      };

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);

        if (error) throw error;
        showToast('Service updated successfully', 'success');
      } else {
        const { error } = await supabase.from('services').insert([serviceData]);

        if (error) throw error;
        showToast('Service created successfully', 'success');
      }

      await fetchServices();
      closeDrawer();
    } catch (error: any) {
      if (error.code === '23505') {
        showToast('Service code already exists', 'error');
      } else {
        showToast('Failed to save service', 'error');
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Services</h2>
        {session && session.role && Permissions.services.canCreate(session.role) && (
          <Button size="sm" onClick={() => openDrawer()}>
            <Plus className="w-3 h-3 mr-1" />
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
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            options={[
              { value: 'all', label: 'All Services' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
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
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
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
                    ${service.base_price.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                    {service.duration_min} min
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge variant={service.active ? 'success' : 'default'}>
                      {service.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {session && session.role && Permissions.services.canEdit(session.role) ? (
                      <button
                        onClick={() => openDrawer(service)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">View Only</span>
                    )}
                  </td>
                </tr>
              ))}
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
        title={editingService ? 'Edit Service' : 'Add Service'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Service Code *"
            value={formData.code}
            onChange={(e) =>
              setFormData({ ...formData, code: e.target.value.toUpperCase() })
            }
            placeholder="e.g., MANIC"
            disabled={!!editingService}
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
            label="Base Price *"
            type="number"
            step="0.01"
            min="0"
            value={formData.base_price}
            onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
            placeholder="0.00"
            required
          />
          <Input
            label="Duration (minutes)"
            type="number"
            min="1"
            value={formData.duration_min}
            onChange={(e) =>
              setFormData({ ...formData, duration_min: e.target.value })
            }
          />
          <Select
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            options={[
              { value: "Faux d'Ongles", label: "Faux d'Ongles" },
              { value: 'Soins des Mains', label: 'Soins des Mains' },
              { value: 'Soins des Pieds', label: 'Soins des Pieds' },
            ]}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="active" className="text-sm text-gray-700">
              Active
            </label>
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
