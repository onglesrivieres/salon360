import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Search, RotateCcw, ChevronDown, ChevronRight, Loader2, CheckSquare, Square, AlertCircle, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissionsCache } from '../contexts/PermissionsCacheContext';
import { Role } from '../lib/permissions';
import { getPermissionsByModule, moduleDisplayNames, PermissionMetadata } from '../lib/permission-metadata';
import { Button } from './ui/Button';

interface RolePermissionMatrixProps {
  onPermissionChange?: () => void;
}

interface PermissionState {
  permission_key: string;
  is_enabled: boolean;
  is_default: boolean;
  updated_at?: string;
}

type RolePermissions = Map<Role, Map<string, PermissionState>>;

const ALL_ROLES: Role[] = ['Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Cashier'];
const PERMISSIONS_PER_PAGE = 10;

const ROLE_COLORS: Record<Role, string> = {
  'Admin': 'bg-purple-100 text-purple-800 border-purple-200',
  'Owner': 'bg-red-100 text-red-800 border-red-200',
  'Manager': 'bg-blue-100 text-blue-800 border-blue-200',
  'Supervisor': 'bg-green-100 text-green-800 border-green-200',
  'Receptionist': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Technician': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Cashier': 'bg-orange-100 text-orange-800 border-orange-200'
};

export function RolePermissionMatrix({ onPermissionChange }: RolePermissionMatrixProps) {
  const { session, selectedStoreId } = useAuth();
  const { getCachedPermissions, loadPermissions, invalidateCache } = usePermissionsCache();
  const [allPermissions, setAllPermissions] = useState<RolePermissions>(new Map());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(Object.keys(getPermissionsByModule())));
  const [hasChanges, setHasChanges] = useState(false);
  const [currentPages, setCurrentPages] = useState<Map<string, number>>(new Map());

  const groupedPermissions = getPermissionsByModule();

  const loadAllPermissionsWithCache = useCallback(async () => {
    if (!selectedStoreId) {
      console.log('[Permissions] No storeId available, skipping load');
      return;
    }

    console.log('[Permissions] Loading permissions for store:', selectedStoreId);
    setLoadError(null);

    // Try to get cached data first (stale-while-revalidate pattern)
    const cached = getCachedPermissions(selectedStoreId);
    console.log('[Permissions] Cache check:', cached ? `Found ${cached.size} roles` : 'No cache');

    if (cached && cached.size > 0) {
      console.log('[Permissions] Using cached data');
      setAllPermissions(cached);
      setLoading(false);

      // Refresh in background
      setIsRefreshing(true);
      try {
        console.log('[Permissions] Refreshing in background');
        const fresh = await loadPermissions(selectedStoreId, true);
        console.log('[Permissions] Fresh data loaded:', fresh.size, 'roles');
        setAllPermissions(fresh);
      } catch (error) {
        console.error('[Permissions] Error refreshing permissions:', error);
      } finally {
        setIsRefreshing(false);
      }
      return;
    }

    // No cache, show loading state
    setLoading(true);
    try {
      console.log('[Permissions] No cache, loading from database');
      const permissions = await loadPermissions(selectedStoreId);
      console.log('[Permissions] Loaded from database:', permissions.size, 'roles');

      if (!permissions || permissions.size === 0) {
        console.warn('[Permissions] No permissions loaded - empty result');
        setLoadError('No permissions data found. Please contact support.');
      } else {
        setAllPermissions(permissions);
      }
    } catch (error) {
      console.error('[Permissions] Error loading permissions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load permissions';
      setLoadError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, getCachedPermissions, loadPermissions]);

  useEffect(() => {
    loadAllPermissionsWithCache();
  }, [loadAllPermissionsWithCache]);

  useEffect(() => {
    setCurrentPages(new Map());
  }, [searchTerm]);

  const togglePermission = async (role: Role, permissionKey: string, currentValue: boolean) => {
    if (!selectedStoreId || !session) return;

    const cellKey = `${role}-${permissionKey}`;
    setSaving(prev => new Set(prev).add(cellKey));

    const newValue = !currentValue;

    // Optimistic update
    setAllPermissions(prev => {
      const next = new Map(prev);
      const rolePerms = new Map(next.get(role) || new Map());
      rolePerms.set(permissionKey, {
        permission_key: permissionKey,
        is_enabled: newValue,
        is_default: false,
        updated_at: new Date().toISOString()
      });
      next.set(role, rolePerms);
      return next;
    });

    setHasChanges(true);

    try {
      const { error } = await supabase.rpc('update_role_permission', {
        p_store_id: selectedStoreId,
        p_role_name: role,
        p_permission_key: permissionKey,
        p_is_enabled: newValue,
        p_employee_id: session.employee_id
      });

      if (error) throw error;

      invalidateCache(selectedStoreId || undefined);
      onPermissionChange?.();
    } catch (error) {
      console.error('Error updating permission:', error);

      // Revert on error
      setAllPermissions(prev => {
        const next = new Map(prev);
        const rolePerms = new Map(next.get(role) || new Map());
        rolePerms.set(permissionKey, {
          permission_key: permissionKey,
          is_enabled: currentValue,
          is_default: false
        });
        next.set(role, rolePerms);
        return next;
      });
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  };

  const toggleAllForRole = async (role: Role, enable: boolean) => {
    if (!selectedStoreId || !session) return;
    if (!confirm(`${enable ? 'Enable' : 'Disable'} all permissions for ${role}? This will update all permissions at once.`)) return;

    setSaving(prev => new Set(prev).add(`role-${role}`));

    try {
      const allPermKeys = Object.values(groupedPermissions).flat().map(p => p.key);

      for (const permKey of allPermKeys) {
        await supabase.rpc('update_role_permission', {
          p_store_id: selectedStoreId,
          p_role_name: role,
          p_permission_key: permKey,
          p_is_enabled: enable,
          p_employee_id: session.employee_id
        });
      }

      invalidateCache(selectedStoreId || undefined);
      await loadAllPermissionsWithCache();
      setHasChanges(true);
      onPermissionChange?.();
    } catch (error) {
      console.error('Error updating role permissions:', error);
      alert('Failed to update permissions');
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(`role-${role}`);
        return next;
      });
    }
  };

  const resetRoleToDefaults = async (role: Role) => {
    if (!selectedStoreId || !session) return;
    if (!confirm(`Reset all ${role} permissions to defaults? This cannot be undone.`)) return;

    setSaving(prev => new Set(prev).add(`role-${role}`));

    try {
      const { error } = await supabase.rpc('reset_role_permissions_to_default', {
        p_store_id: selectedStoreId,
        p_role_name: role,
        p_employee_id: session.employee_id
      });

      if (error) throw error;

      invalidateCache(selectedStoreId || undefined);
      await loadAllPermissionsWithCache();
      setHasChanges(false);
      onPermissionChange?.();
    } catch (error) {
      console.error('Error resetting permissions:', error);
      alert('Failed to reset permissions');
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(`role-${role}`);
        return next;
      });
    }
  };

  const toggleModule = (module: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
        resetPaginationForModule(module);
      }
      return next;
    });
  };

  const filterPermissions = (perms: PermissionMetadata[]) => {
    if (!searchTerm) return perms;
    const term = searchTerm.toLowerCase();
    return perms.filter(
      perm =>
        perm.displayName.toLowerCase().includes(term) ||
        perm.description.toLowerCase().includes(term) ||
        perm.action.toLowerCase().includes(term) ||
        perm.key.toLowerCase().includes(term)
    );
  };

  const getPermissionState = (role: Role, permissionKey: string): PermissionState | undefined => {
    return allPermissions.get(role)?.get(permissionKey);
  };

  const isPermissionEnabled = (role: Role, permissionKey: string): boolean => {
    return getPermissionState(role, permissionKey)?.is_enabled ?? true;
  };

  const isPermissionModified = (role: Role, permissionKey: string): boolean => {
    const state = getPermissionState(role, permissionKey);
    return state ? !state.is_default : false;
  };

  const isCellSaving = (role: Role, permissionKey: string): boolean => {
    return saving.has(`${role}-${permissionKey}`);
  };

  const isRoleSaving = (role: Role): boolean => {
    return saving.has(`role-${role}`);
  };

  const getCurrentPage = (module: string): number => {
    return currentPages.get(module) ?? 1;
  };

  const getTotalPages = (module: string, filteredPerms: PermissionMetadata[]): number => {
    return Math.ceil(filteredPerms.length / PERMISSIONS_PER_PAGE);
  };

  const getPaginatedPermissions = (module: string, filteredPerms: PermissionMetadata[]): PermissionMetadata[] => {
    const currentPage = getCurrentPage(module);
    const startIndex = (currentPage - 1) * PERMISSIONS_PER_PAGE;
    const endIndex = startIndex + PERMISSIONS_PER_PAGE;
    return filteredPerms.slice(startIndex, endIndex);
  };

  const handlePageChange = (module: string, newPage: number, totalPages: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPages(prev => {
      const next = new Map(prev);
      next.set(module, newPage);
      return next;
    });
  };

  const resetPaginationForModule = (module: string) => {
    setCurrentPages(prev => {
      const next = new Map(prev);
      next.set(module, 1);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mr-3" />
        <div className="text-gray-500">Loading permissions for all roles...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-2">Failed to Load Permissions</h3>
              <p className="text-sm text-red-800 mb-4">{loadError}</p>
              <Button
                variant="primary"
                onClick={() => {
                  setLoadError(null);
                  loadAllPermissionsWithCache();
                }}
              >
                Retry Loading
              </Button>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2 text-sm">Troubleshooting Tips:</h4>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Check your internet connection</li>
            <li>Verify the database migration has been applied</li>
            <li>Try refreshing the page</li>
            <li>Check the browser console for detailed error messages</li>
          </ul>
        </div>
      </div>
    );
  }

  if (allPermissions.size === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-2">No Permissions Found</h3>
            <p className="text-sm text-yellow-800 mb-4">
              No permission data is available for this store. The permissions system may need to be initialized.
            </p>
            <Button
              variant="primary"
              onClick={() => loadAllPermissionsWithCache()}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showRefreshIndicator = isRefreshing && allPermissions.size > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {showRefreshIndicator && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Refreshing...</span>
          </div>
        )}
      </div>

      {hasChanges && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Changes will take effect after users log out and back in
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {Object.entries(groupedPermissions).map(([module, modulePerms]) => {
            const filtered = filterPermissions(modulePerms);
            if (filtered.length === 0) return null;

            const isExpanded = expandedModules.has(module);
            const paginated = getPaginatedPermissions(module, filtered);
            const currentPage = getCurrentPage(module);
            const totalPages = getTotalPages(module, filtered);
            const startIndex = (currentPage - 1) * PERMISSIONS_PER_PAGE;
            const endIndex = Math.min(startIndex + PERMISSIONS_PER_PAGE, filtered.length);

            return (
              <div key={module} className="border-b border-gray-200 last:border-b-0">
                {/* Module Header */}
                <div
                  className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 z-10"
                  onClick={() => toggleModule(module)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    )}
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {moduleDisplayNames[module] || module}
                    </h3>
                    <span className="text-sm text-gray-500">
                      ({filtered.length} permission{filtered.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                {/* Permission Table */}
                {isExpanded && (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[300px]">
                              Permission
                            </th>
                            {ALL_ROLES.map((role) => (
                              <th
                                key={role}
                                className={`px-3 py-3 text-center text-xs font-medium uppercase tracking-wider border-r border-gray-200 last:border-r-0 min-w-[120px] ${ROLE_COLORS[role]}`}
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <span className="font-semibold">{role}</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAllForRole(role, true);
                                      }}
                                      disabled={isRoleSaving(role)}
                                      className="text-xs px-2 py-1 bg-white rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                                      title={`Enable all ${role} permissions`}
                                    >
                                      All
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        resetRoleToDefaults(role);
                                      }}
                                      disabled={isRoleSaving(role)}
                                      className="text-xs px-2 py-1 bg-white rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                                      title={`Reset ${role} to defaults`}
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.map((perm, idx) => (
                            <tr
                              key={perm.key}
                              className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              }`}
                            >
                              <td className="sticky left-0 bg-inherit px-4 py-3 border-r border-gray-200">
                                <div className="flex items-start gap-2">
                                  {perm.isCritical && (
                                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 text-sm">
                                      {perm.displayName}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-0.5">
                                      {perm.description}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {ALL_ROLES.map((role) => {
                                const isEnabled = isPermissionEnabled(role, perm.key);
                                const isModified = isPermissionModified(role, perm.key);
                                const isSaving = isCellSaving(role, perm.key);

                                return (
                                  <td
                                    key={`${role}-${perm.key}`}
                                    className="px-3 py-3 text-center border-r border-gray-100 last:border-r-0"
                                  >
                                    <div className="flex items-center justify-center">
                                      {isSaving ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                      ) : (
                                        <button
                                          onClick={() => togglePermission(role, perm.key, isEnabled)}
                                          disabled={isRoleSaving(role)}
                                          className={`relative group ${isModified ? 'ring-2 ring-blue-400 ring-offset-1 rounded' : ''}`}
                                          title={`${isEnabled ? 'Disable' : 'Enable'} ${perm.displayName} for ${role}${isModified ? ' (Modified)' : ''}`}
                                        >
                                          {isEnabled ? (
                                            <CheckSquare className="w-6 h-6 text-green-600 hover:text-green-700 transition-colors" />
                                          ) : (
                                            <Square className="w-6 h-6 text-gray-400 hover:text-gray-600 transition-colors" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing {startIndex + 1}-{endIndex} of {filtered.length} permissions
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePageChange(module, 1, totalPages)}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="First page"
                          >
                            First
                          </button>
                          <button
                            onClick={() => handlePageChange(module, currentPage - 1, totalPages)}
                            disabled={currentPage === 1}
                            className="p-1 border border-gray-300 rounded hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Previous page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-medium text-gray-700 px-3">
                            Page {currentPage} of {totalPages}
                          </span>
                          <button
                            onClick={() => handlePageChange(module, currentPage + 1, totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1 border border-gray-300 rounded hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Next page"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePageChange(module, totalPages, totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Last page"
                          >
                            Last
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-green-600" />
            <span>Enabled</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="w-4 h-4 text-gray-400" />
            <span>Disabled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 rounded" />
            <span>Modified from default</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <span>Critical permission</span>
          </div>
        </div>
      </div>
    </div>
  );
}
