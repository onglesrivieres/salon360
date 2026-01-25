import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { supabase, Resource, ResourceSubcategory } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { ResourceModal } from '../components/ResourceModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  Plus,
  Search,
  FileText,
  BookOpen,
  ExternalLink,
  Edit2,
  Trash2,
  Image,
  RefreshCw,
  Settings,
  ChevronDown,
  CheckCircle
} from 'lucide-react';
import { getCategoryBadgeClasses } from '../lib/category-colors';

type Tab = 'sop' | 'employee_manual';

const TAB_CONFIG: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'sop', label: 'Standard Operating Procedures', icon: FileText },
  { id: 'employee_manual', label: 'Employee Manual', icon: BookOpen },
];

export function ResourcesPage() {
  const { selectedStoreId, effectiveRole, session } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('sop');
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

  // View modal state
  const [viewingResource, setViewingResource] = useState<Resource | null>(null);

  // Permission checks
  const canManage = effectiveRole && Permissions.resources.canCreate(effectiveRole);

  // State for responsive tab dropdown
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement>(null);
  const currentTab = TAB_CONFIG.find(tab => tab.id === activeTab);

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
      // Don't show error toast for this, as the table might not exist yet
    }
  }

  useEffect(() => {
    fetchResources();
    fetchSubcategories();
  }, [selectedStoreId]);

  // Reset category filter when switching tabs
  useEffect(() => {
    setSelectedSubcategory(null);
  }, [activeTab]);

  // Get subcategories for current tab
  const currentTabSubcategories = useMemo(() => {
    return subcategories
      .filter((c) => c.tab === activeTab)
      .sort((a, b) => a.display_order - b.display_order);
  }, [subcategories, activeTab]);

  // Filter resources by tab, subcategory, and search
  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      // Filter by category (tab)
      if (resource.category !== activeTab) return false;

      // Filter by subcategory if selected
      if (selectedSubcategory !== null) {
        if (selectedSubcategory === '__uncategorized__') {
          if (resource.subcategory) return false;
        } else {
          if (resource.subcategory !== selectedSubcategory) return false;
        }
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = resource.title.toLowerCase().includes(query);
        const matchesDescription = resource.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) return false;
      }

      return true;
    });
  }, [resources, activeTab, selectedSubcategory, searchQuery]);

  // Group resources by subcategory for display
  const groupedResources = useMemo(() => {
    // If a specific subcategory is selected, don't group
    if (selectedSubcategory !== null) {
      return [{ subcategory: null, resources: filteredResources }];
    }

    // Group by subcategory
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

    // Sort categories by their display_order
    const categoryOrder = new Map(
      currentTabSubcategories.map((c, i) => [c.name, i])
    );

    // Add categorized groups in order
    Array.from(categorized.entries())
      .sort(([a], [b]) => {
        const orderA = categoryOrder.get(a) ?? 999;
        const orderB = categoryOrder.get(b) ?? 999;
        return orderA - orderB;
      })
      .forEach(([subcategory, resources]) => {
        groups.push({ subcategory, resources });
      });

    // Add uncategorized at the end if there are any
    if (uncategorized.length > 0) {
      groups.push({ subcategory: null, resources: uncategorized });
    }

    return groups;
  }, [filteredResources, selectedSubcategory, currentTabSubcategories]);

  // Count resources per tab
  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { sop: 0, employee_manual: 0 };
    resources.forEach((resource) => {
      if (resource.category === 'sop') counts.sop++;
      else if (resource.category === 'employee_manual') counts.employee_manual++;
    });
    return counts;
  }, [resources]);

  // Count resources per subcategory in current tab
  const subcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { __uncategorized__: 0 };
    resources
      .filter((r) => r.category === activeTab)
      .forEach((resource) => {
        if (resource.subcategory) {
          counts[resource.subcategory] = (counts[resource.subcategory] || 0) + 1;
        } else {
          counts.__uncategorized__++;
        }
      });
    return counts;
  }, [resources, activeTab]);

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
    } catch (error: any) {
      console.error('Error deleting resource:', error);
      showToast('Failed to delete resource', 'error');
    } finally {
      setDeletingId(null);
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
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchResources();
              fetchSubcategories();
            }}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Manage Categories"
              >
                <Settings className="w-5 h-5" />
              </button>
              <Button onClick={handleAddResource}>
                <Plus className="w-4 h-4 mr-2" />
                Add Resource
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        {/* Mobile dropdown - visible on screens < md */}
        <div className="md:hidden p-2" ref={tabDropdownRef}>
          <div className="relative">
            <button
              onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
            >
              <div className="flex items-center gap-2">
                {currentTab && (
                  <>
                    <currentTab.icon className="w-4 h-4" />
                    <span>{currentTab.label}</span>
                    <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                      {tabCounts[currentTab.id]}
                    </span>
                  </>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isTabDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => { setActiveTab(id); setIsTabDropdownOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                        <span
                          className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                            isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tabCounts[id]}
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
        <div className="hidden md:flex gap-0 overflow-x-auto">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              <span
                className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tabCounts[id]}
              </span>
            </button>
          ))}
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
            All ({resources.filter((r) => r.category === activeTab).length})
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
              : `No ${activeTab === 'sop' ? 'SOPs' : 'employee manual items'} yet`}
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

      {/* Resource Modal */}
      {selectedStoreId && (
        <ResourceModal
          isOpen={showModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          resource={selectedResource}
          category={activeTab}
          storeId={selectedStoreId}
          subcategories={currentTabSubcategories}
          onCategoriesChanged={fetchSubcategories}
        />
      )}

      {/* Category Management Modal */}
      {selectedStoreId && (
        <CategoryManagementModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          storeId={selectedStoreId}
          tab={activeTab}
          categories={currentTabSubcategories}
          onCategoriesChanged={fetchSubcategories}
        />
      )}

      {/* Resource View Modal */}
      <ResourceViewModal
        isOpen={!!viewingResource}
        onClose={() => setViewingResource(null)}
        resource={viewingResource}
        subcategoryColor={viewingResource?.subcategory ? getSubcategoryColor(viewingResource.subcategory) : null}
        canManage={canManage}
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
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  subcategoryColor: string | null;
}

function ResourceCard({
  resource,
  canManage,
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
      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
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
  onEdit: () => void;
}

function ResourceViewModal({
  isOpen,
  onClose,
  resource,
  subcategoryColor,
  canManage,
  onEdit,
}: ResourceViewModalProps) {
  const [imageError, setImageError] = useState(false);

  // Reset imageError when resource changes
  useEffect(() => {
    setImageError(false);
  }, [resource?.id]);

  if (!isOpen || !resource) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
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
    </div>,
    document.body
  );
}

// Category Management Modal
interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  tab: Tab;
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

      // Soft delete the category
      const { error } = await supabase
        .from('resource_categories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', category.id);

      if (error) throw error;

      // Clear subcategory from resources
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

  const tabLabel = tab === 'sop' ? 'SOP' : 'Employee Manual';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage {tabLabel} Categories
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
