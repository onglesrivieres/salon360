import React, { useState, useEffect } from 'react';
import { Plus, Search, Store as StoreIcon, Archive, Calculator, X, Check, ChevronUp, ChevronDown, Settings, Pencil, Trash2 } from 'lucide-react';
import { supabase, StoreServiceWithDetails, StoreServiceCategory } from '../lib/supabase';
import { CATEGORY_COLORS, getCategoryBadgeClasses, CategoryColorKey } from '../lib/category-colors';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NumericInput } from '../components/ui/NumericInput';
import { Select } from '../components/ui/Select';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';

type ServiceStatus = 'active' | 'inactive' | 'archived';
type SortColumn = 'code' | 'name' | 'category' | 'price' | 'duration_min' | 'status';
type SortDirection = 'asc' | 'desc';

export function ServicesPage() {
  const [services, setServices] = useState<StoreServiceWithDetails[]>([]);
  const [filteredServices, setFilteredServices] = useState<StoreServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ServiceStatus>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<StoreServiceWithDetails | null>(null);
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  // Category modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState<CategoryColorKey>('pink');
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<StoreServiceCategory | null>(null);

  // Category dropdown state
  const [categories, setCategories] = useState<StoreServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    price: '',
    duration_min: '30',
    category: 'Extensions des Ongles',
    status: 'active' as ServiceStatus,
    requires_photos: false,
  });

  const [averageDuration, setAverageDuration] = useState<{
    average_duration: number | null;
    sample_count: number;
  } | null>(null);
  const [fetchingAverage, setFetchingAverage] = useState(false);

  useEffect(() => {
    if (selectedStoreId) {
      fetchServices();
      fetchCategories();
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

    if (filterCategory !== 'all') {
      filtered = filtered.filter((s) => s.category === filterCategory);
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;

        if (sortColumn === 'status') {
          aVal = getServiceStatus(a);
          bVal = getServiceStatus(b);
        } else if (sortColumn === 'price' || sortColumn === 'duration_min') {
          aVal = a[sortColumn];
          bVal = b[sortColumn];
        } else {
          aVal = a[sortColumn]?.toLowerCase() || '';
          bVal = b[sortColumn]?.toLowerCase() || '';
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredServices(filtered);
  }, [services, searchTerm, filterStatus, filterCategory, sortColumn, sortDirection]);

  function getServiceStatus(service: StoreServiceWithDetails): ServiceStatus {
    if (service.archived) return 'archived';
    if (service.active) return 'active';
    return 'inactive';
  }

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function getCategoryColor(categoryName: string): string {
    const category = categories.find((c) => c.name === categoryName);
    return category?.color || 'pink';
  }

  function getServiceCountByCategory(categoryName: string): number {
    return services.filter(s => s.category === categoryName).length;
  }

  function openCategoryModal() {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('pink');
    setIsCategoryModalOpen(true);
  }

  function startEditCategory(category: StoreServiceCategory) {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryColor((category.color as CategoryColorKey) || 'pink');
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('pink');
  }

  async function handleSaveCategoryEdit(categoryId: string, originalName: string) {
    if (!selectedStoreId) return;

    const trimmedName = editCategoryName.trim();
    if (!trimmedName) {
      showToast('Category name cannot be empty', 'error');
      return;
    }

    const existingCategory = categories.find(
      (cat) => cat.id !== categoryId && cat.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCategory) {
      showToast('A category with this name already exists', 'error');
      return;
    }

    try {
      setSavingCategoryEdit(true);

      const { error: updateError } = await supabase
        .from('store_service_categories')
        .update({
          name: trimmedName,
          color: editCategoryColor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryId);

      if (updateError) throw updateError;

      if (trimmedName !== originalName) {
        await supabase
          .from('store_services')
          .update({ category: trimmedName })
          .eq('store_id', selectedStoreId)
          .eq('category', originalName);
      }

      await fetchCategories();
      await fetchServices();
      setEditingCategoryId(null);
      showToast('Category updated successfully', 'success');
    } catch (error: any) {
      console.error('Error updating category:', error);
      showToast(error.message || 'Failed to update category', 'error');
    } finally {
      setSavingCategoryEdit(false);
    }
  }

  async function handleAddNewCategoryInModal() {
    if (!selectedStoreId) return;

    const trimmedName = editCategoryName.trim();
    if (!trimmedName) {
      showToast('Category name cannot be empty', 'error');
      return;
    }

    const existingCategory = categories.find(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCategory) {
      showToast('A category with this name already exists', 'error');
      return;
    }

    try {
      setSavingCategoryEdit(true);

      const { error } = await supabase
        .from('store_service_categories')
        .insert({
          store_id: selectedStoreId,
          name: trimmedName,
          color: editCategoryColor,
          display_order: categories.length,
          is_active: true,
        });

      if (error) throw error;

      await fetchCategories();
      setEditCategoryName('');
      setEditCategoryColor('pink');
      showToast('Category created successfully', 'success');
    } catch (error: any) {
      console.error('Error creating category:', error);
      showToast(error.message || 'Failed to create category', 'error');
    } finally {
      setSavingCategoryEdit(false);
    }
  }

  function openDeleteCategoryModal(category: StoreServiceCategory) {
    setDeletingCategory(category);
    setDeleteCategoryModalOpen(true);
  }

  async function handleDeleteCategory() {
    if (!deletingCategory || !selectedStoreId) return;

    try {
      setSavingCategoryEdit(true);

      // Move services to uncategorized
      await supabase
        .from('store_services')
        .update({ category: '' })
        .eq('store_id', selectedStoreId)
        .eq('category', deletingCategory.name);

      // Delete the category
      const { error } = await supabase
        .from('store_service_categories')
        .delete()
        .eq('id', deletingCategory.id);

      if (error) throw error;

      await fetchCategories();
      await fetchServices();
      setDeleteCategoryModalOpen(false);
      setDeletingCategory(null);
      showToast('Category deleted successfully', 'success');
    } catch (error: any) {
      console.error('Error deleting category:', error);
      showToast(error.message || 'Failed to delete category', 'error');
    } finally {
      setSavingCategoryEdit(false);
    }
  }

  async function handleMoveCategory(categoryId: string, direction: 'up' | 'down') {
    const currentIndex = categories.findIndex(c => c.id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    try {
      setSavingCategoryEdit(true);

      const currentCategory = categories[currentIndex];
      const swapCategory = categories[newIndex];

      // Swap display_order values
      await supabase
        .from('store_service_categories')
        .update({ display_order: newIndex })
        .eq('id', currentCategory.id);

      await supabase
        .from('store_service_categories')
        .update({ display_order: currentIndex })
        .eq('id', swapCategory.id);

      await fetchCategories();
    } catch (error: any) {
      console.error('Error reordering category:', error);
      showToast('Failed to reorder category', 'error');
    } finally {
      setSavingCategoryEdit(false);
    }
  }

  async function fetchServices() {
    if (!selectedStoreId) {
      showToast('Please select a store first', 'error');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_services_by_popularity', {
        p_store_id: selectedStoreId,
        p_include_all: true,
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

  async function fetchCategories() {
    if (!selectedStoreId) return;

    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from('store_service_categories')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      showToast('Failed to load categories', 'error');
    } finally {
      setLoadingCategories(false);
    }
  }

  function handleCategoryDropdownChange(value: string) {
    if (value === '__add_new__') {
      setIsAddingCategory(true);
      setNewCategoryName('');
    } else {
      setFormData({ ...formData, category: value });
      setIsAddingCategory(false);
    }
  }

  async function handleSaveNewCategory() {
    if (!selectedStoreId) {
      showToast('No store selected', 'error');
      return;
    }

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      showToast('Category name cannot be empty', 'error');
      return;
    }

    // Check for duplicate (case-insensitive)
    const existingCategory = categories.find(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCategory) {
      // Use existing category instead of creating duplicate
      setFormData({ ...formData, category: existingCategory.name });
      setIsAddingCategory(false);
      setNewCategoryName('');
      showToast(`Using existing category: ${existingCategory.name}`, 'info');
      return;
    }

    try {
      setSavingCategory(true);

      const { data, error } = await supabase
        .from('store_service_categories')
        .insert({
          store_id: selectedStoreId,
          name: trimmedName,
          display_order: categories.length,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation - category already exists
          showToast('A category with this name already exists', 'error');
          return;
        }
        throw error;
      }

      // Update categories list and select the new category
      setCategories((prev) => [...prev, data]);
      setFormData({ ...formData, category: data.name });
      setIsAddingCategory(false);
      setNewCategoryName('');
      showToast('Category created successfully', 'success');
    } catch (error: any) {
      console.error('Error creating category:', error);
      showToast(error.message || 'Failed to create category', 'error');
    } finally {
      setSavingCategory(false);
    }
  }

  function handleCancelAddCategory() {
    setIsAddingCategory(false);
    setNewCategoryName('');
    // Reset to empty if no category was previously selected
    if (!formData.category || formData.category === '__add_new__') {
      setFormData({ ...formData, category: '' });
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
    setIsAddingCategory(false);
    setNewCategoryName('');
    setFormData({
      code: '',
      name: '',
      price: '',
      duration_min: '30',
      category: '',
      status: 'active',
      requires_photos: false,
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
    setIsAddingCategory(false);
    setNewCategoryName('');
    setFormData({
      code: service.code,
      name: service.name,
      price: service.price.toString(),
      duration_min: service.duration_min.toString(),
      category: service.category,
      status: getServiceStatus(service),
      requires_photos: service.requires_photos || false,
    });
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingService(null);
    setAverageDuration(null);
    setIsAddingCategory(false);
    setNewCategoryName('');
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
          requires_photos: formData.requires_photos,
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
            requires_photos: formData.requires_photos,
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
          <div className="flex gap-2">
            <Button onClick={openCategoryModal} size="sm" variant="ghost">
              <Settings className="w-4 h-4 mr-1" />
              Manage Categories
            </Button>
            <Button onClick={openDrawerForNew} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Service
            </Button>
          </div>
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
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </Select>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            options={[
              { value: 'all', label: 'All Status' },
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
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1">
                    Code
                    {sortColumn === 'code' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
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
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-1">
                    Category
                    {sortColumn === 'category' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center gap-1">
                    Price
                    {sortColumn === 'price' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('duration_min')}
                >
                  <div className="flex items-center gap-1">
                    Duration
                    {sortColumn === 'duration_min' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortColumn === 'status' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
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
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeClasses(getCategoryColor(service.category))}`}
                      >
                        {service.category}
                      </span>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            {isAddingCategory ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter new category name"
                    autoFocus
                    disabled={savingCategory}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSaveNewCategory}
                    disabled={savingCategory || !newCategoryName.trim()}
                    className="text-green-600 hover:text-green-700 p-2 disabled:text-gray-400 disabled:cursor-not-allowed"
                    title="Save"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddCategory}
                    disabled={savingCategory}
                    className="text-gray-600 hover:text-gray-700 p-2"
                    title="Cancel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {categories.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Existing: {categories.map((c) => c.name).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <Select
                value={formData.category}
                onChange={(e) => handleCategoryDropdownChange(e.target.value)}
                disabled={loadingCategories}
              >
                <option value="">Select Category</option>
                <option value="__add_new__" className="text-blue-600 font-medium">
                  + Add New Category
                </option>
                {categories.length > 0 && (
                  <option disabled>──────────</option>
                )}
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
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
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requires_photos}
                onChange={(e) => setFormData({ ...formData, requires_photos: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Require photos & notes</span>
                <p className="text-xs text-gray-500">When enabled, new tickets with this service require at least 2 photos and notes</p>
              </div>
            </label>
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

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setIsCategoryModalOpen(false)}
            />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Manage Service Categories</h3>
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Category List */}
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No categories yet. Add one below.</p>
                ) : (
                  categories.map((category, index) => (
                    <div
                      key={category.id}
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
                    >
                      {editingCategoryId === category.id ? (
                        <>
                          <Input
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            placeholder="Category name"
                            className="flex-1"
                            disabled={savingCategoryEdit}
                          />
                          <div className="flex gap-1">
                            {CATEGORY_COLORS.map((color) => (
                              <button
                                key={color.key}
                                type="button"
                                onClick={() => setEditCategoryColor(color.key)}
                                className={`w-6 h-6 rounded-full ${color.bgClass} border-2 ${
                                  editCategoryColor === color.key
                                    ? 'ring-2 ring-offset-1 ring-blue-500'
                                    : 'border-transparent'
                                }`}
                                title={color.label}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveCategoryEdit(category.id, category.name)}
                            disabled={savingCategoryEdit || !editCategoryName.trim()}
                            className="text-green-600 hover:text-green-700 p-1 disabled:text-gray-400"
                            title="Save"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditCategory}
                            disabled={savingCategoryEdit}
                            className="text-gray-600 hover:text-gray-700 p-1"
                            title="Cancel"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCategoryBadgeClasses(category.color || 'pink')}`}
                          >
                            {category.name}
                          </span>
                          <div className="flex-1" />
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(category.id, 'up')}
                            disabled={index === 0 || savingCategoryEdit}
                            className={`p-1 ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Move up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(category.id, 'down')}
                            disabled={index === categories.length - 1 || savingCategoryEdit}
                            className={`p-1 ${index === categories.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Move down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditCategory(category)}
                            className="text-gray-500 hover:text-gray-700 p-1"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteCategoryModal(category)}
                            className="text-gray-500 hover:text-red-600 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add New Category */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Add New Category</p>
                <div className="flex items-center gap-3">
                  <Input
                    value={editingCategoryId ? '' : editCategoryName}
                    onChange={(e) => {
                      if (!editingCategoryId) setEditCategoryName(e.target.value);
                    }}
                    placeholder="New category name"
                    className="flex-1"
                    disabled={savingCategoryEdit || !!editingCategoryId}
                  />
                  <div className="flex gap-1">
                    {CATEGORY_COLORS.map((color) => (
                      <button
                        key={color.key}
                        type="button"
                        onClick={() => {
                          if (!editingCategoryId) setEditCategoryColor(color.key);
                        }}
                        disabled={!!editingCategoryId}
                        className={`w-6 h-6 rounded-full ${color.bgClass} border-2 ${
                          !editingCategoryId && editCategoryColor === color.key
                            ? 'ring-2 ring-offset-1 ring-blue-500'
                            : 'border-transparent'
                        } ${editingCategoryId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={color.label}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddNewCategoryInModal}
                    disabled={savingCategoryEdit || !editCategoryName.trim() || !!editingCategoryId}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
                <Button variant="ghost" onClick={() => setIsCategoryModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      <Modal
        isOpen={deleteCategoryModalOpen}
        onClose={() => {
          setDeleteCategoryModalOpen(false);
          setDeletingCategory(null);
        }}
        title="Delete Category"
        onConfirm={handleDeleteCategory}
        confirmText={savingCategoryEdit ? 'Deleting...' : 'Delete'}
        confirmVariant="danger"
        cancelText="Cancel"
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>"{deletingCategory?.name}"</strong>?
        </p>
        {deletingCategory && getServiceCountByCategory(deletingCategory.name) > 0 && (
          <p className="text-gray-600 mt-2">
            {getServiceCountByCategory(deletingCategory.name)} service(s) will be moved to uncategorized.
          </p>
        )}
      </Modal>
    </div>
  );
}
