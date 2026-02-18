import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { supabase, Resource, ResourceSubcategory, ResourceTab } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { ResourceModal } from '../components/ResourceModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  Plus,
  Search,
  FileText,
  ExternalLink,
  Edit2,
  Trash2,
  Image,
  RefreshCw,
  Settings,
  ChevronDown,
  CheckCircle,
  Check,
  Layers,
  X,
} from 'lucide-react';
import { getCategoryBadgeClasses } from '../lib/category-colors';
import { getResourceIcon, RESOURCE_ICON_OPTIONS } from '../lib/resource-icons';

export function ResourcesPage() {
  const { selectedStoreId, effectiveRole, session } = useAuth();
  const { showToast } = useToast();

  // Dynamic tabs state
  const [tabs, setTabs] = useState<ResourceTab[]>([]);
  const [activeTabSlug, setActiveTabSlug] = useState<string>('');
  const [unreadCountsByTab, setUnreadCountsByTab] = useState<Record<string, number>>({});
  const [readResourceIds, setReadResourceIds] = useState<Set<string>>(new Set());

  const [resources, setResources] = useState<Resource[]>([]);
  const [subcategories, setSubcategories] = useState<ResourceSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Category management modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Tab management modal
  const [showTabModal, setShowTabModal] = useState(false);

  // View modal state
  const [viewingResource, setViewingResource] = useState<Resource | null>(null);

  // Permission checks
  const canManage = effectiveRole && Permissions.resources.canCreate(effectiveRole);
  const canManageTabs = effectiveRole && Permissions.resources.canManageTabs(effectiveRole);

  // State for responsive tab dropdown
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement>(null);
  const currentTab = tabs.find(tab => tab.slug === activeTabSlug);

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

  // Fetch dynamic tabs
  const fetchTabs = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const { data, error } = await supabase
        .from('resource_tabs')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      const fetchedTabs = data || [];
      setTabs(fetchedTabs);

      // If current active tab not in fetched tabs, switch to first
      if (fetchedTabs.length > 0 && !fetchedTabs.some(t => t.slug === activeTabSlug)) {
        setActiveTabSlug(fetchedTabs[0].slug);
      }
    } catch (error: any) {
      console.error('Error fetching tabs:', error);
    }
  }, [selectedStoreId, activeTabSlug]);

  // Fetch unread counts per tab
  const fetchUnreadCounts = useCallback(async () => {
    if (!session?.employee_id || !selectedStoreId) return;
    try {
      const { data, error } = await supabase.rpc('get_unread_resources_count_by_tab', {
        p_employee_id: session.employee_id,
        p_store_id: selectedStoreId,
      });

      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((row: { tab_slug: string; unread_count: number }) => {
        counts[row.tab_slug] = row.unread_count;
      });
      setUnreadCountsByTab(counts);
    } catch (error: any) {
      console.error('Error fetching unread counts:', error);
    }
  }, [session?.employee_id, selectedStoreId]);

  // Fetch read status for current employee
  const fetchReadStatus = useCallback(async () => {
    if (!session?.employee_id || !selectedStoreId) return;
    try {
      const { data, error } = await supabase
        .from('resource_read_status')
        .select('resource_id')
        .eq('employee_id', session.employee_id)
        .eq('store_id', selectedStoreId);

      if (error) throw error;
      setReadResourceIds(new Set((data || []).map(r => r.resource_id)));
    } catch (error: any) {
      console.error('Error fetching read status:', error);
    }
  }, [session?.employee_id, selectedStoreId]);

  // Fetch resources
  async function fetchResources() {
    if (!selectedStoreId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources(data || []);
    } catch (error: any) {
      console.error('Error fetching resources:', error);
      showToast('Failed to load resources', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Fetch subcategories
  async function fetchSubcategories() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from('resource_categories')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setSubcategories(data || []);
    } catch (error: any) {
      console.error('Error fetching subcategories:', error);
    }
  }

  useEffect(() => {
    fetchTabs();
    fetchResources();
    fetchSubcategories();
    fetchReadStatus();
    fetchUnreadCounts();
  }, [selectedStoreId]);

  // Reset category filter when switching tabs
  useEffect(() => {
    setSelectedSubcategory(null);
  }, [activeTabSlug]);

  // Get subcategories for current tab
  const currentTabSubcategories = useMemo(() => {
    return subcategories
      .filter((c) => c.tab === activeTabSlug)
      .sort((a, b) => a.display_order - b.display_order);
  }, [subcategories, activeTabSlug]);

  // Filter resources by tab, subcategory, and search
  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      if (resource.category !== activeTabSlug) return false;

      if (selectedSubcategory !== null) {
        if (selectedSubcategory === '__uncategorized__') {
          if (resource.subcategory) return false;
        } else {
          if (resource.subcategory !== selectedSubcategory) return false;
        }
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = resource.title.toLowerCase().includes(query);
        const matchesDescription = resource.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) return false;
      }

      return true;
    });
  }, [resources, activeTabSlug, selectedSubcategory, searchQuery]);

  // Group resources by subcategory for display
  const groupedResources = useMemo(() => {
    if (selectedSubcategory !== null) {
      return [{ subcategory: null, resources: filteredResources }];
    }

    const groups: { subcategory: string | null; resources: Resource[] }[] = [];
    const categorized = new Map<string, Resource[]>();
    const uncategorized: Resource[] = [];

    filteredResources.forEach((resource) => {
      if (resource.subcategory) {
        const existing = categorized.get(resource.subcategory) || [];
        existing.push(resource);
        categorized.set(resource.subcategory, existing);
      } else {
        uncategorized.push(resource);
      }
    });

    const categoryOrder = new Map(
      currentTabSubcategories.map((c, i) => [c.name, i])
    );

    Array.from(categorized.entries())
      .sort(([a], [b]) => {
        const orderA = categoryOrder.get(a) ?? 999;
        const orderB = categoryOrder.get(b) ?? 999;
        return orderA - orderB;
      })
      .forEach(([subcategory, resources]) => {
        groups.push({ subcategory, resources });
      });

    if (uncategorized.length > 0) {
      groups.push({ subcategory: null, resources: uncategorized });
    }

    return groups;
  }, [filteredResources, selectedSubcategory, currentTabSubcategories]);

  // Count resources per tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    resources.forEach((resource) => {
      counts[resource.category] = (counts[resource.category] || 0) + 1;
    });
    return counts;
  }, [resources]);

  // Count resources per subcategory in current tab
  const subcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { __uncategorized__: 0 };
    resources
      .filter((r) => r.category === activeTabSlug)
      .forEach((resource) => {
        if (resource.subcategory) {
          counts[resource.subcategory] = (counts[resource.subcategory] || 0) + 1;
        } else {
          counts.__uncategorized__++;
        }
      });
    return counts;
  }, [resources, activeTabSlug]);

  // Get subcategory color
  function getSubcategoryColor(subcategoryName: string): string {
    const cat = subcategories.find((c) => c.name === subcategoryName);
    return cat?.color || 'blue';
  }

  // Handle add
  function handleAddResource() {
    setSelectedResource(null);
    setShowModal(true);
  }

  // Handle edit
  function handleEditResource(resource: Resource) {
    setSelectedResource(resource);
    setShowModal(true);
  }

  // Handle delete
  async function handleDeleteResource(resource: Resource) {
    if (!confirm(`Are you sure you want to delete "${resource.title}"?`)) {
      return;
    }

    setDeletingId(resource.id);
    try {
      const { error } = await supabase
        .from('resources')
        .update({
          is_active: false,
          updated_by: session?.employee_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resource.id);

      if (error) throw error;
      showToast('Resource deleted successfully', 'success');
      fetchResources();
      fetchUnreadCounts();
    } catch (error: any) {
      console.error('Error deleting resource:', error);
      showToast('Failed to delete resource', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  // Handle mark as read
  async function handleMarkAsRead(resourceId: string) {
    if (!session?.employee_id || !selectedStoreId) return;

    // Optimistic update
    setReadResourceIds(prev => new Set([...prev, resourceId]));

    try {
      const { error } = await supabase
        .from('resource_read_status')
        .upsert({
          employee_id: session.employee_id,
          resource_id: resourceId,
          store_id: selectedStoreId,
          read_at: new Date().toISOString(),
        }, {
          onConflict: 'employee_id,resource_id',
        });

      if (error) throw error;
      fetchUnreadCounts();
    } catch (error: any) {
      console.error('Error marking as read:', error);
      // Revert optimistic update
      setReadResourceIds(prev => {
        const next = new Set(prev);
        next.delete(resourceId);
        return next;
      });
      showToast('Failed to mark as read', 'error');
    }
  }

  // Handle modal close
  function handleModalClose() {
    setShowModal(false);
    setSelectedResource(null);
  }

  // Handle modal success
  function handleModalSuccess() {
    fetchResources();
    fetchUnreadCounts();
  }

  // No tabs empty state
  if (!loading && tabs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
        </div>
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-6">No tabs yet. Create your first tab to get started.</p>
          {canManageTabs && (
            <Button onClick={() => setShowTabModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Tab
            </Button>
          )}
        </div>
        {selectedStoreId && (
          <TabManagementModal
            isOpen={showTabModal}
            onClose={() => setShowTabModal(false)}
            storeId={selectedStoreId}
            tabs={tabs}
            onTabsChanged={() => { fetchTabs(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchTabs();
              fetchResources();
              fetchSubcategories();
              fetchReadStatus();
              fetchUnreadCounts();
            }}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canManageTabs && (
            <button
              onClick={() => setShowTabModal(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Manage Tabs"
            >
              <Layers className="w-5 h-5" />
            </button>
          )}
          {canManage && (
            <>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Manage Categories"
              >
                <Settings className="w-5 h-5" />
              </button>
              <Button onClick={handleAddResource} disabled={tabs.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                Add Resource
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dynamic Tabs */}
      <div className="border-b border-gray-200">
        {/* Mobile dropdown */}
        <div className="md:hidden p-2" ref={tabDropdownRef}>
          <div className="relative">
            <button
              onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
            >
              <div className="flex items-center gap-2">
                {currentTab && (() => {
                  const TabIcon = getResourceIcon(currentTab.icon_name);
                  return (
                    <>
                      <TabIcon className="w-4 h-4" />
                      <span>{currentTab.name}</span>
                      <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                        {tabCounts[currentTab.slug] || 0}
                      </span>
                      {(unreadCountsByTab[currentTab.slug] || 0) > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white font-bold">
                          {unreadCountsByTab[currentTab.slug]}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isTabDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {tabs.map((tab) => {
                  const isActive = activeTabSlug === tab.slug;
                  const TabIcon = getResourceIcon(tab.icon_name);
                  const unreadCount = unreadCountsByTab[tab.slug] || 0;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTabSlug(tab.slug); setIsTabDropdownOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <TabIcon className="w-4 h-4" />
                        <span>{tab.name}</span>
                        <span
                          className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                            isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tabCounts[tab.slug] || 0}
                        </span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white font-bold">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {isActive && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = getResourceIcon(tab.icon_name);
            const unreadCount = unreadCountsByTab[tab.slug] || 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabSlug(tab.slug)}
                className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTabSlug === tab.slug
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.name}</span>
                <span
                  className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                    activeTabSlug === tab.slug ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tabCounts[tab.slug] || 0}
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white font-bold min-w-[20px] text-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter Pills */}
      {currentTabSubcategories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedSubcategory(null)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              selectedSubcategory === null
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({resources.filter((r) => r.category === activeTabSlug).length})
          </button>
          {currentTabSubcategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setSelectedSubcategory(selectedSubcategory === cat.name ? null : cat.name)
              }
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                selectedSubcategory === cat.name
                  ? `${getCategoryBadgeClasses(cat.color)} border-current font-medium`
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat.name} ({subcategoryCounts[cat.name] || 0})
            </button>
          ))}
          {subcategoryCounts.__uncategorized__ > 0 && (
            <button
              onClick={() =>
                setSelectedSubcategory(
                  selectedSubcategory === '__uncategorized__' ? null : '__uncategorized__'
                )
              }
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                selectedSubcategory === '__uncategorized__'
                  ? 'bg-gray-200 text-gray-800 border-gray-400 font-medium'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Uncategorized ({subcategoryCounts.__uncategorized__})
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search resources..."
          className="pl-10"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            {searchQuery
              ? 'No resources match your search'
              : selectedSubcategory
              ? 'No resources in this category'
              : `No resources in this tab yet`}
          </p>
          {canManage && !searchQuery && (
            <Button onClick={handleAddResource} variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add First Resource
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedResources.map((group, idx) => (
            <div key={group.subcategory || `uncategorized-${idx}`}>
              {/* Group Header */}
              {selectedSubcategory === null && (
                <div className="flex items-center gap-2 mb-3">
                  {group.subcategory ? (
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full ${getCategoryBadgeClasses(
                        getSubcategoryColor(group.subcategory)
                      )}`}
                    >
                      {group.subcategory}
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-600">
                      Uncategorized
                    </span>
                  )}
                  <span className="text-sm text-gray-400">({group.resources.length})</span>
                </div>
              )}

              {/* Resource Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.resources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    canManage={canManage}
                    isUnread={!readResourceIds.has(resource.id)}
                    onView={() => setViewingResource(resource)}
                    onEdit={() => handleEditResource(resource)}
                    onDelete={() => handleDeleteResource(resource)}
                    isDeleting={deletingId === resource.id}
                    subcategoryColor={
                      resource.subcategory ? getSubcategoryColor(resource.subcategory) : null
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedStoreId && (
        <ResourceModal
          isOpen={showModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          resource={selectedResource}
          category={activeTabSlug}
          storeId={selectedStoreId}
          subcategories={currentTabSubcategories}
          onCategoriesChanged={fetchSubcategories}
        />
      )}

      {selectedStoreId && (
        <CategoryManagementModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          storeId={selectedStoreId}
          tab={activeTabSlug}
          categories={currentTabSubcategories}
          onCategoriesChanged={fetchSubcategories}
        />
      )}

      {selectedStoreId && (
        <TabManagementModal
          isOpen={showTabModal}
          onClose={() => setShowTabModal(false)}
          storeId={selectedStoreId}
          tabs={tabs}
          onTabsChanged={fetchTabs}
        />
      )}

      <ResourceViewModal
        isOpen={!!viewingResource}
        onClose={() => setViewingResource(null)}
        resource={viewingResource}
        subcategoryColor={viewingResource?.subcategory ? getSubcategoryColor(viewingResource.subcategory) : null}
        canManage={canManage}
        isRead={viewingResource ? readResourceIds.has(viewingResource.id) : false}
        onMarkAsRead={(id) => handleMarkAsRead(id)}
        onEdit={() => {
          if (viewingResource) {
            handleEditResource(viewingResource);
            setViewingResource(null);
          }
        }}
      />
    </div>
  );
}

// Resource Card Component
interface ResourceCardProps {
  resource: Resource;
  canManage: boolean | null | undefined;
  isUnread: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  subcategoryColor: string | null;
}

function ResourceCard({
  resource,
  canManage,
  isUnread,
  onView,
  onEdit,
  onDelete,
  isDeleting,
  subcategoryColor,
}: ResourceCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      onClick={onView}
      className={`bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative ${
        isUnread ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'
      }`}
    >
      {/* Unread indicator dot */}
      {isUnread && (
        <div className="absolute top-3 right-3 z-10 w-3 h-3 bg-blue-500 rounded-full ring-2 ring-white" />
      )}

      {/* Thumbnail */}
      <div className="relative w-full h-40 bg-gray-100">
        {resource.thumbnail_url && !imageError ? (
          <img
            src={resource.thumbnail_url}
            alt={resource.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Image className="w-16 h-16" />
          </div>
        )}
        {/* Subcategory badge on thumbnail */}
        {resource.subcategory && subcategoryColor && (
          <div className="absolute top-2 left-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryBadgeClasses(
                subcategoryColor
              )}`}
            >
              {resource.subcategory}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 mb-1 line-clamp-2" title={resource.title}>
          {resource.title}
        </h3>
        {resource.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2" title={resource.description}>
            {resource.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {resource.link_url && (
            <a
              href={resource.link_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Link
            </a>
          )}
          {canManage && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={isDeleting}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Resource View Modal
interface ResourceViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: Resource | null;
  subcategoryColor: string | null;
  canManage: boolean | null | undefined;
  isRead: boolean;
  onMarkAsRead: (id: string) => void;
  onEdit: () => void;
}

function ResourceViewModal({
  isOpen,
  onClose,
  resource,
  subcategoryColor,
  canManage,
  isRead,
  onMarkAsRead,
  onEdit,
}: ResourceViewModalProps) {
  const [imageError, setImageError] = useState(false);

  // Reset imageError when resource changes
  useEffect(() => {
    setImageError(false);
  }, [resource?.id]);

  if (!isOpen || !resource) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      {/* Modal container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Thumbnail (larger) */}
          <div className="relative w-full h-64 bg-gray-100 flex-shrink-0">
            {resource.thumbnail_url && !imageError ? (
              <img
                src={resource.thumbnail_url}
                alt={resource.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Image className="w-24 h-24" />
              </div>
            )}
            {/* Category badge */}
            {resource.subcategory && subcategoryColor && (
              <div className="absolute top-3 left-3">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${getCategoryBadgeClasses(
                    subcategoryColor
                  )}`}
                >
                  {resource.subcategory}
                </span>
              </div>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{resource.title}</h2>
            {resource.description && (
              <p className="text-gray-600 whitespace-pre-wrap">{resource.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
            {/* Mark as Read / Read button */}
            {isRead ? (
              <button
                disabled
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg font-medium cursor-default"
              >
                <Check className="w-4 h-4" />
                Read
              </button>
            ) : (
              <button
                onClick={() => onMarkAsRead(resource.id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                Mark as Read
              </button>
            )}
            {resource.link_url && (
              <a
                href={resource.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Link
              </a>
            )}
            {canManage && (
              <button
                onClick={onEdit}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Tab Management Modal
interface TabManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  tabs: ResourceTab[];
  onTabsChanged: () => void;
}

function TabManagementModal({
  isOpen,
  onClose,
  storeId,
  tabs,
  onTabsChanged,
}: TabManagementModalProps) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingIcon, setEditingIcon] = useState('FileText');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New tab state
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('FileText');
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .substring(0, 50);
  }

  async function handleCreate() {
    if (!newName.trim()) {
      showToast('Please enter a tab name', 'error');
      return;
    }

    const slug = generateSlug(newName);
    if (!slug) {
      showToast('Tab name must contain at least one alphanumeric character', 'error');
      return;
    }

    const exists = tabs.some((t) => t.slug === slug);
    if (exists) {
      showToast('A tab with this name already exists', 'error');
      return;
    }

    try {
      setCreating(true);
      const maxOrder = Math.max(0, ...tabs.map(t => t.display_order));

      const { error } = await supabase.from('resource_tabs').insert({
        store_id: storeId,
        name: newName.trim(),
        slug,
        icon_name: newIcon,
        display_order: maxOrder + 1,
        is_active: true,
      });

      if (error) {
        if (error.code === '23505') {
          showToast('A tab with this slug already exists', 'error');
        } else {
          throw error;
        }
        return;
      }

      showToast('Tab created successfully', 'success');
      setNewName('');
      setNewIcon('FileText');
      onTabsChanged();
    } catch (error: any) {
      console.error('Error creating tab:', error);
      showToast('Failed to create tab', 'error');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(tab: ResourceTab) {
    setEditingId(tab.id);
    setEditingName(tab.name);
    setEditingIcon(tab.icon_name);
  }

  async function handleSave(tabId: string) {
    if (!editingName.trim()) {
      showToast('Tab name cannot be empty', 'error');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('resource_tabs')
        .update({
          name: editingName.trim(),
          icon_name: editingIcon,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tabId);

      if (error) throw error;

      showToast('Tab updated successfully', 'success');
      setEditingId(null);
      onTabsChanged();
    } catch (error: any) {
      console.error('Error updating tab:', error);
      showToast('Failed to update tab', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tab: ResourceTab) {
    if (!confirm(`Delete this tab? Resources in it will become inaccessible until reassigned.`)) {
      return;
    }

    try {
      setDeletingId(tab.id);

      const { error } = await supabase
        .from('resource_tabs')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', tab.id);

      if (error) throw error;

      showToast('Tab deleted successfully', 'success');
      onTabsChanged();
    } catch (error: any) {
      console.error('Error deleting tab:', error);
      showToast('Failed to delete tab', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Manage Tabs</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Existing Tabs */}
          {tabs.length > 0 ? (
            <div className="space-y-2">
              {tabs.map((tab) => {
                const TabIcon = getResourceIcon(tab.icon_name);
                return (
                  <div
                    key={tab.id}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg"
                  >
                    {editingId === tab.id ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Tab name"
                          autoFocus
                        />
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Icon</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {RESOURCE_ICON_OPTIONS.map((opt) => {
                              const OptIcon = opt.icon;
                              return (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onClick={() => setEditingIcon(opt.name)}
                                  className={`p-1.5 rounded border transition-all ${
                                    editingIcon === opt.name
                                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                  }`}
                                  title={opt.label}
                                >
                                  <OptIcon className="w-4 h-4" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(tab.id)}
                            disabled={saving}
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <TabIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                          {tab.name}
                        </span>
                        <span className="text-xs text-gray-400">{tab.slug}</span>
                        <button
                          onClick={() => startEdit(tab)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tab)}
                          disabled={deletingId === tab.id}
                          className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              No tabs yet. Create one below.
            </p>
          )}

          {/* Add New Tab */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Add New Tab</h3>
            <div className="space-y-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tab name (e.g., Training Materials)"
              />
              <div>
                <label className="block text-xs text-gray-600 mb-1">Icon</label>
                <div className="flex gap-1.5 flex-wrap">
                  {RESOURCE_ICON_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setNewIcon(opt.name)}
                        className={`p-1.5 rounded border transition-all ${
                          newIcon === opt.name
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                        title={opt.label}
                      >
                        <OptIcon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              {newName.trim() && (
                <p className="text-xs text-gray-500">
                  Slug: <code className="bg-gray-100 px-1 rounded">{generateSlug(newName)}</code>
                </p>
              )}
              <Button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="w-full"
              >
                {creating ? 'Creating...' : 'Create Tab'}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// Category Management Modal
interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  tab: string;
  categories: ResourceSubcategory[];
  onCategoriesChanged: () => void;
}

function CategoryManagementModal({
  isOpen,
  onClose,
  storeId,
  tab,
  categories,
  onCategoriesChanged,
}: CategoryManagementModalProps) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('blue');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New category state
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  async function handleCreate() {
    if (!newName.trim()) {
      showToast('Please enter a category name', 'error');
      return;
    }

    const exists = categories.some((c) => c.name.toLowerCase() === newName.trim().toLowerCase());
    if (exists) {
      showToast('A category with this name already exists', 'error');
      return;
    }

    try {
      setCreating(true);

      const { data: maxOrderData } = await supabase
        .from('resource_categories')
        .select('display_order')
        .eq('store_id', storeId)
        .eq('tab', tab)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newDisplayOrder = (maxOrderData?.display_order ?? -1) + 1;

      const { error } = await supabase.from('resource_categories').insert({
        store_id: storeId,
        tab: tab,
        name: newName.trim(),
        color: newColor,
        display_order: newDisplayOrder,
        is_active: true,
      });

      if (error) throw error;

      showToast('Category created successfully', 'success');
      setNewName('');
      setNewColor('blue');
      onCategoriesChanged();
    } catch (error: any) {
      console.error('Error creating category:', error);
      showToast('Failed to create category', 'error');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(category: ResourceSubcategory) {
    setEditingId(category.id);
    setEditingName(category.name);
    setEditingColor(category.color);
  }

  async function handleSave(categoryId: string) {
    if (!editingName.trim()) {
      showToast('Category name cannot be empty', 'error');
      return;
    }

    const exists = categories.some(
      (c) => c.id !== categoryId && c.name.toLowerCase() === editingName.trim().toLowerCase()
    );
    if (exists) {
      showToast('A category with this name already exists', 'error');
      return;
    }

    try {
      setSaving(true);

      const oldCategory = categories.find((c) => c.id === categoryId);
      const oldName = oldCategory?.name;

      const { error } = await supabase
        .from('resource_categories')
        .update({
          name: editingName.trim(),
          color: editingColor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryId);

      if (error) throw error;

      // Update resources with the old category name to use the new name
      if (oldName && oldName !== editingName.trim()) {
        await supabase
          .from('resources')
          .update({ subcategory: editingName.trim() })
          .eq('store_id', storeId)
          .eq('subcategory', oldName);
      }

      showToast('Category updated successfully', 'success');
      setEditingId(null);
      onCategoriesChanged();
    } catch (error: any) {
      console.error('Error updating category:', error);
      showToast('Failed to update category', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: ResourceSubcategory) {
    if (
      !confirm(
        `Are you sure you want to delete "${category.name}"? Resources in this category will become uncategorized.`
      )
    ) {
      return;
    }

    try {
      setDeletingId(category.id);

      const { error } = await supabase
        .from('resource_categories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', category.id);

      if (error) throw error;

      await supabase
        .from('resources')
        .update({ subcategory: null })
        .eq('store_id', storeId)
        .eq('subcategory', category.name);

      showToast('Category deleted successfully', 'success');
      onCategoriesChanged();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      showToast('Failed to delete category', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Categories
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Existing Categories */}
          {categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg"
                >
                  {editingId === category.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        placeholder="Category name"
                        autoFocus
                      />
                      <div className="flex gap-1 flex-wrap">
                        {['pink', 'blue', 'purple', 'green', 'yellow'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setEditingColor(color)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${getCategoryBadgeClasses(color)} ${
                              editingColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSave(category.id)}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`flex-1 px-2 py-1 text-sm rounded ${getCategoryBadgeClasses(
                          category.color
                        )}`}
                      >
                        {category.name}
                      </span>
                      <button
                        onClick={() => startEdit(category)}
                        className="p-1 text-gray-400 hover:text-blue-600 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        disabled={deletingId === category.id}
                        className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              No categories yet. Create one below.
            </p>
          )}

          {/* Add New Category */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Add New Category</h3>
            <div className="space-y-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Category name"
              />
              <div className="flex gap-1 flex-wrap">
                {['pink', 'blue', 'purple', 'green', 'yellow'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${getCategoryBadgeClasses(color)} ${
                      newColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="w-full"
              >
                {creating ? 'Creating...' : 'Create Category'}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
