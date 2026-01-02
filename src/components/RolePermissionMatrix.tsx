import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, RotateCcw, ChevronDown, ChevronRight, Loader2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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

const ALL_ROLES: Role[] = ['Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Spa Expert', 'Cashier'];

const ROLE_COLORS: Record<Role, string> = {
  'Admin': 'bg-purple-100 text-purple-800 border-purple-200',
  'Owner': 'bg-red-100 text-red-800 border-red-200',
  'Manager': 'bg-blue-100 text-blue-800 border-blue-200',
  'Supervisor': 'bg-green-100 text-green-800 border-green-200',
  'Receptionist': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Technician': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Spa Expert': 'bg-pink-100 text-pink-800 border-pink-200',
  'Cashier': 'bg-orange-100 text-orange-800 border-orange-200'
};

export function RolePermissionMatrix({ onPermissionChange }: RolePermissionMatrixProps) {
  const { employee, storeId } = useAuth();
  const [allPermissions, setAllPermissions] = useState<RolePermissions>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set()); // Track which cells are saving
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(Object.keys(getPermissionsByModule())));
  const [hasChanges, setHasChanges] = useState(false);

  const groupedPermissions = getPermissionsByModule();

  useEffect(() => {
    loadAllPermissions();
  }, [storeId]);

  const loadAllPermissions = async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      // Load permissions for all roles in parallel
      const promises = ALL_ROLES.map(async (role) => {
        const { data, error } = await supabase.rpc('get_role_permissions', {
          p_store_id: storeId,
          p_role_name: role
        });

        if (error) throw error;

        const permMap = new Map<string, PermissionState>();
        (data || []).forEach((perm: any) => {
          permMap.set(perm.permission_key, {
            permission_key: perm.permission_key,
            is_enabled: perm.is_enabled,
            is_default: perm.is_enabled === true && !perm.updated_at,
            updated_at: perm.updated_at
          });
        });

        return { role, permMap };
      });

      const results = await Promise.all(promises);

      const rolePermissions = new Map<Role, Map<string, PermissionState>>();
      results.forEach(({ role, permMap }) => {
        rolePermissions.set(role, permMap);
      });

      setAllPermissions(rolePermissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (role: Role, permissionKey: string, currentValue: boolean) => {
    if (!storeId || !employee) return;

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
        p_store_id: storeId,
        p_role_name: role,
        p_permission_key: permissionKey,
        p_is_enabled: newValue,
        p_employee_id: employee.id
      });

      if (error) throw error;

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
    if (!storeId || !employee) return;
    if (!confirm(`${enable ? 'Enable' : 'Disable'} all permissions for ${role}? This will update all permissions at once.`)) return;

    setSaving(prev => new Set(prev).add(`role-${role}`));

    try {
      const allPermKeys = Object.values(groupedPermissions).flat().map(p => p.key);

      for (const permKey of allPermKeys) {
        await supabase.rpc('update_role_permission', {
          p_store_id: storeId,
          p_role_name: role,
          p_permission_key: permKey,
          p_is_enabled: enable,
          p_employee_id: employee.id
        });
      }

      await loadAllPermissions();
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
    if (!storeId || !employee) return;
    if (!confirm(`Reset all ${role} permissions to defaults? This cannot be undone.`)) return;

    setSaving(prev => new Set(prev).add(`role-${role}`));

    try {
      const { error } = await supabase.rpc('reset_role_permissions_to_default', {
        p_store_id: storeId,
        p_role_name: role,
        p_employee_id: employee.id
      });

      if (error) throw error;

      await loadAllPermissions();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mr-3" />
        <div className="text-gray-500">Loading permissions for all roles...</div>
      </div>
    );
  }

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
                        {filtered.map((perm, idx) => (
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
