import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, Search, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../lib/permissions';
import { getPermissionsByModule, moduleDisplayNames, PermissionMetadata } from '../lib/permission-metadata';
import { Button } from './ui/Button';

interface RolePermissionMatrixProps {
  role: Role;
  onPermissionChange?: () => void;
}

interface PermissionState {
  permission_key: string;
  is_enabled: boolean;
  is_default: boolean;
  updated_at?: string;
}

export function RolePermissionMatrix({ role, onPermissionChange }: RolePermissionMatrixProps) {
  const { employee, storeId } = useAuth();
  const [permissions, setPermissions] = useState<Map<string, PermissionState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const groupedPermissions = getPermissionsByModule();

  useEffect(() => {
    loadPermissions();
  }, [role, storeId]);

  const loadPermissions = async () => {
    if (!storeId) return;

    setLoading(true);
    try {
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

      setPermissions(permMap);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (permissionKey: string, currentValue: boolean) => {
    if (!storeId || !employee) return;

    const newValue = !currentValue;

    setPermissions(prev => {
      const next = new Map(prev);
      next.set(permissionKey, {
        permission_key: permissionKey,
        is_enabled: newValue,
        is_default: false,
        updated_at: new Date().toISOString()
      });
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
      setPermissions(prev => {
        const next = new Map(prev);
        next.set(permissionKey, {
          permission_key: permissionKey,
          is_enabled: currentValue,
          is_default: false
        });
        return next;
      });
    }
  };

  const resetToDefaults = async () => {
    if (!storeId || !employee) return;
    if (!confirm(`Reset all ${role} permissions to defaults? This cannot be undone.`)) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc('reset_role_permissions_to_default', {
        p_store_id: storeId,
        p_role_name: role,
        p_employee_id: employee.id
      });

      if (error) throw error;

      await loadPermissions();
      setHasChanges(false);
      onPermissionChange?.();
    } catch (error) {
      console.error('Error resetting permissions:', error);
      alert('Failed to reset permissions');
    } finally {
      setSaving(false);
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

  const toggleAllInModule = async (module: string, enable: boolean) => {
    if (!storeId || !employee) return;

    const modulePerms = groupedPermissions[module] || [];
    setSaving(true);

    try {
      for (const perm of modulePerms) {
        await supabase.rpc('update_role_permission', {
          p_store_id: storeId,
          p_role_name: role,
          p_permission_key: perm.key,
          p_is_enabled: enable,
          p_employee_id: employee.id
        });
      }

      await loadPermissions();
      setHasChanges(true);
      onPermissionChange?.();
    } catch (error) {
      console.error('Error updating module permissions:', error);
      alert('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const getModuleStats = (module: string) => {
    const modulePerms = groupedPermissions[module] || [];
    const enabled = modulePerms.filter(perm => permissions.get(perm.key)?.is_enabled).length;
    return { total: modulePerms.length, enabled };
  };

  const filterPermissions = (perms: PermissionMetadata[]) => {
    if (!searchTerm) return perms;
    const term = searchTerm.toLowerCase();
    return perms.filter(
      perm =>
        perm.displayName.toLowerCase().includes(term) ||
        perm.description.toLowerCase().includes(term) ||
        perm.action.toLowerCase().includes(term)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading permissions...</div>
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
        <Button
          variant="secondary"
          onClick={resetToDefaults}
          disabled={saving}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>

      {hasChanges && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Changes will take effect after users log out and back in
        </div>
      )}

      <div className="space-y-2">
        {Object.entries(groupedPermissions).map(([module, modulePerms]) => {
          const filtered = filterPermissions(modulePerms);
          if (filtered.length === 0) return null;

          const isExpanded = expandedModules.has(module);
          const stats = getModuleStats(module);

          return (
            <div key={module} className="border border-gray-200 rounded-lg overflow-hidden">
              <div
                className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleModule(module)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <h3 className="font-medium text-gray-900">
                    {moduleDisplayNames[module] || module}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {stats.enabled}/{stats.total} enabled
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAllInModule(module, true);
                    }}
                    disabled={saving}
                    className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAllInModule(module, false);
                    }}
                    disabled={saving}
                    className="text-xs text-gray-600 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                  >
                    Disable All
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="divide-y divide-gray-200">
                  {filtered.map((perm) => {
                    const state = permissions.get(perm.key);
                    const isEnabled = state?.is_enabled ?? true;
                    const isDefault = state?.is_default ?? true;

                    return (
                      <div
                        key={perm.key}
                        className="px-4 py-3 flex items-start gap-4 hover:bg-gray-50 transition-colors"
                      >
                        <button
                          onClick={() => togglePermission(perm.key, isEnabled)}
                          disabled={saving}
                          className={`flex-shrink-0 w-12 h-6 rounded-full transition-colors relative ${
                            isEnabled ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              isEnabled ? 'transform translate-x-6' : ''
                            }`}
                          />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{perm.displayName}</h4>
                            {perm.isCritical && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <AlertTriangle className="w-3 h-3" />
                                Critical
                              </span>
                            )}
                            {!isDefault && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Modified
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{perm.description}</p>
                          <p className="text-xs text-gray-400 mt-1">Key: {perm.key}</p>
                        </div>

                        <div className="flex-shrink-0">
                          {isEnabled ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <X className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
