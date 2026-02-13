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
type SortColumn = 'name' | 'phone_number' | 'last_visit' | 'total_visits' | 'status';
type SortDirection = 'asc' | 'desc';

export function ClientsPage() {
  const { session, selectedStoreId, t } = useAuth();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>('last_visit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterTab, sortColumn, sortDirection]);

  const { clients, isLoading, error, totalCount, refetch } = useClients(selectedStoreId, {
    search: debouncedSearch,
    blacklistedOnly: filterTab === 'blacklisted',
  });

  const { deleteClient, isLoading: _mutating } = useClientMutations();

  const canCreate = session?.role_permission && Permissions.clients.canCreate(session.role_permission);
  const canBlacklist = session?.role_permission && Permissions.clients.canBlacklist(session.role_permission);
  const canDelete = session?.role_permission && Permissions.clients.canDelete(session.role_permission);
  const canViewFullPhone = session?.role_permission && Permissions.clients.canViewFullPhone(session.role_permission);

  // Filter clients based on tab (active means not blacklisted)
  const filteredClients = filterTab === 'active'
    ? clients.filter(c => !c.is_blacklisted)
    : clients;

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  // Sort clients by selected column and direction
  const sortedClients = [...filteredClients].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortColumn) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'phone_number':
        aVal = a.phone_number || '';
        bVal = b.phone_number || '';
        break;
      case 'last_visit':
        // Clients without visits always go to the end regardless of direction
        if (!a.last_visit && !b.last_visit) return 0;
        if (!a.last_visit) return 1;
        if (!b.last_visit) return -1;
        aVal = a.last_visit;
        bVal = b.last_visit;
        break;
      case 'total_visits':
        aVal = a.total_visits || 0;
        bVal = b.total_visits || 0;
        break;
      case 'status':
        aVal = a.is_blacklisted ? 1 : 0;
        bVal = b.is_blacklisted ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClients = sortedClients.slice(startIndex, endIndex);

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

  const handleDeleteClient = async (client: ClientWithStats) => {
    const result = await deleteClient(client.id);
    if (result.success) {
      showToast(t('clients.clientDeleted'), 'success');
      refetch();
    } else {
      showToast(result.error || t('clients.failedToDelete'), 'error');
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
            {t('clients.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCount} {t('clients.clientsTotal')}
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
              {t('clients.addClient')}
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
            placeholder={t('clients.searchPlaceholder')}
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
              {tab === 'all' && t('clients.all')}
              {tab === 'active' && t('clients.active')}
              {tab === 'blacklisted' && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('clients.blacklisted')}
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
        clients={paginatedClients}
        isLoading={isLoading}
        onViewDetails={handleViewDetails}
        canViewFullPhone={canViewFullPhone}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={(column) => handleSort(column as SortColumn)}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedClients.length)} of {sortedClients.length} clients
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

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
