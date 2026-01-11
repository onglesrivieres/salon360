import { useState, useEffect } from 'react';
import { Plus, Search, UserCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useClients } from '../hooks/useClients';
import { useClientMutations } from '../hooks/useClientMutations';
import { ClientWithStats } from '../lib/supabase';
import { Permissions } from '../lib/permissions';
import { ClientsTable } from '../components/clients/ClientsTable';
import { ClientEditorModal } from '../components/clients/ClientEditorModal';
import { ClientDetailsModal } from '../components/clients/ClientDetailsModal';

type FilterTab = 'all' | 'active' | 'blacklisted';

export function ClientsPage() {
  const { session, selectedStoreId } = useAuth();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithStats | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { clients, isLoading, error, totalCount, refetch } = useClients(selectedStoreId, {
    search: debouncedSearch,
    blacklistedOnly: filterTab === 'blacklisted',
  });

  const { blacklistClient, unblacklistClient, deleteClient, isLoading: mutating } = useClientMutations();

  const canCreate = session?.role_permission && Permissions.clients.canCreate(session.role_permission);
  const canBlacklist = session?.role_permission && Permissions.clients.canBlacklist(session.role_permission);
  const canDelete = session?.role_permission && Permissions.clients.canDelete(session.role_permission);
  const canViewFullPhone = session?.role_permission && Permissions.clients.canViewFullPhone(session.role_permission);

  // Filter clients based on tab (active means not blacklisted)
  const filteredClients = filterTab === 'active'
    ? clients.filter(c => !c.is_blacklisted)
    : clients;

  const handleAddClient = () => {
    setEditingClient(null);
    setShowEditorModal(true);
  };

  const handleEditClient = (client: ClientWithStats) => {
    setEditingClient(client);
    setShowEditorModal(true);
  };

  const handleViewDetails = (client: ClientWithStats) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };

  const handleBlacklistToggle = async (client: ClientWithStats, reason?: string) => {
    if (!session?.employee_id) return;

    if (client.is_blacklisted) {
      const result = await unblacklistClient(client.id);
      if (result.success) {
        showToast('Client removed from blacklist', 'success');
        refetch();
      } else {
        showToast(result.error || 'Failed to update client', 'error');
      }
    } else {
      if (!reason) return;
      const result = await blacklistClient(client.id, {
        reason,
        blacklisted_by: session.employee_id,
      });
      if (result.success) {
        showToast('Client blacklisted', 'success');
        refetch();
      } else {
        showToast(result.error || 'Failed to blacklist client', 'error');
      }
    }
  };

  const handleDeleteClient = async (client: ClientWithStats) => {
    const result = await deleteClient(client.id);
    if (result.success) {
      showToast('Client deleted', 'success');
      refetch();
    } else {
      showToast(result.error || 'Failed to delete client', 'error');
    }
  };

  const handleEditorSuccess = () => {
    setShowEditorModal(false);
    setEditingClient(null);
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCircle className="w-6 h-6" />
            Clients
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCount} {totalCount === 1 ? 'client' : 'clients'} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {canCreate && (
            <button
              onClick={handleAddClient}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Client
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['all', 'active', 'blacklisted'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filterTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab === 'all' && 'All'}
              {tab === 'active' && 'Active'}
              {tab === 'blacklisted' && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Blacklisted
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Clients Table */}
      <ClientsTable
        clients={filteredClients}
        isLoading={isLoading}
        onViewDetails={handleViewDetails}
        canViewFullPhone={canViewFullPhone}
      />

      {/* Editor Modal */}
      {selectedStoreId && (
        <ClientEditorModal
          isOpen={showEditorModal}
          onClose={() => {
            setShowEditorModal(false);
            setEditingClient(null);
          }}
          onSuccess={handleEditorSuccess}
          storeId={selectedStoreId}
          client={editingClient}
          employeeId={session?.employee_id}
          canBlacklist={canBlacklist}
          canDelete={canDelete}
          onDelete={(client) => {
            handleDeleteClient(client);
            setShowEditorModal(false);
            setEditingClient(null);
          }}
        />
      )}

      {/* Details Modal */}
      {selectedClient && (
        <ClientDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedClient(null);
          }}
          client={selectedClient}
          onEdit={() => {
            setShowDetailsModal(false);
            handleEditClient(selectedClient);
          }}
          canViewFullPhone={canViewFullPhone}
        />
      )}
    </div>
  );
}
