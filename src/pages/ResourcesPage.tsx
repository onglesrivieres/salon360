import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { supabase, Resource } from '../lib/supabase';
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
  RefreshCw
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Permission checks
  const canManage = effectiveRole && Permissions.resources.canCreate(effectiveRole);

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

  useEffect(() => {
    fetchResources();
  }, [selectedStoreId]);

  // Filter resources by tab and search
  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      // Filter by category (tab)
      if (resource.category !== activeTab) return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = resource.title.toLowerCase().includes(query);
        const matchesDescription = resource.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) return false;
      }

      return true;
    });
  }, [resources, activeTab, searchQuery]);

  // Count resources per tab
  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { sop: 0, employee_manual: 0 };
    resources.forEach(resource => {
      if (resource.category === 'sop') counts.sop++;
      else if (resource.category === 'employee_manual') counts.employee_manual++;
    });
    return counts;
  }, [resources]);

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
          updated_at: new Date().toISOString()
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
            onClick={fetchResources}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canManage && (
            <Button onClick={handleAddResource}>
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 overflow-x-auto">
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
              <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tabCounts[id]}
              </span>
            </button>
          ))}
        </div>
      </div>

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
              : `No ${activeTab === 'sop' ? 'SOPs' : 'employee manual items'} yet`
            }
          </p>
          {canManage && !searchQuery && (
            <Button onClick={handleAddResource} variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add First Resource
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              canManage={canManage}
              onEdit={() => handleEditResource(resource)}
              onDelete={() => handleDeleteResource(resource)}
              isDeleting={deletingId === resource.id}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedStoreId && (
        <ResourceModal
          isOpen={showModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          resource={selectedResource}
          category={activeTab}
          storeId={selectedStoreId}
        />
      )}
    </div>
  );
}

// Resource Card Component
interface ResourceCardProps {
  resource: Resource;
  canManage: boolean | null | undefined;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function ResourceCard({ resource, canManage, onEdit, onDelete, isDeleting }: ResourceCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
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
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Link
            </a>
          )}
          {canManage && (
            <>
              <button
                onClick={onEdit}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
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
