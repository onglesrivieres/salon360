import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Role } from '../lib/permissions';

interface PermissionData {
  permission_key: string;
  module_name: string;
  action_name: string;
  display_name: string;
  description: string;
  is_critical: boolean;
  is_enabled: boolean;
  updated_at?: string;
}

interface PermissionsContextType {
  permissions: Map<string, Map<string, boolean>>;
  isLoading: boolean;
  error: string | null;
  refreshPermissions: () => Promise<void>;
  checkPermission: (role: Role[] | Role, permissionKey: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const CACHE_KEY = 'role_permissions_cache';
const CACHE_VERSION_KEY = 'permissions_cache_version';
const CURRENT_CACHE_VERSION = '1.0';

interface PermissionsProviderProps {
  children: ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const { employee, storeId } = useAuth();
  const [permissions, setPermissions] = useState<Map<string, Map<string, boolean>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromCache = (): Map<string, Map<string, boolean>> | null => {
    try {
      const cacheVersion = sessionStorage.getItem(CACHE_VERSION_KEY);
      if (cacheVersion !== CURRENT_CACHE_VERSION) {
        sessionStorage.removeItem(CACHE_KEY);
        sessionStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
        return null;
      }

      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      const result = new Map<string, Map<string, boolean>>();

      Object.entries(parsed).forEach(([role, perms]) => {
        result.set(role, new Map(Object.entries(perms as Record<string, boolean>)));
      });

      return result;
    } catch (err) {
      console.error('Error loading permissions from cache:', err);
      return null;
    }
  };

  const saveToCache = (perms: Map<string, Map<string, boolean>>) => {
    try {
      const obj: Record<string, Record<string, boolean>> = {};

      perms.forEach((rolePerms, role) => {
        obj[role] = {};
        rolePerms.forEach((enabled, key) => {
          obj[role][key] = enabled;
        });
      });

      sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
      sessionStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
    } catch (err) {
      console.error('Error saving permissions to cache:', err);
    }
  };

  const loadPermissionsFromDatabase = async (): Promise<Map<string, Map<string, boolean>>> => {
    if (!storeId) {
      throw new Error('No store ID available');
    }

    const roles: Role[] = ['Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Spa Expert', 'Cashier'];
    const result = new Map<string, Map<string, boolean>>();

    for (const role of roles) {
      const { data, error: fetchError } = await supabase
        .rpc('get_role_permissions', {
          p_store_id: storeId,
          p_role_name: role
        });

      if (fetchError) {
        console.error(`Error fetching permissions for role ${role}:`, fetchError);
        continue;
      }

      const rolePerms = new Map<string, boolean>();
      (data as PermissionData[] || []).forEach((perm) => {
        rolePerms.set(perm.permission_key, perm.is_enabled);
      });

      result.set(role, rolePerms);
    }

    return result;
  };

  const refreshPermissions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const perms = await loadPermissionsFromDatabase();
      setPermissions(perms);
      saveToCache(perms);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load permissions';
      setError(errorMessage);
      console.error('Error refreshing permissions:', err);

      const cached = loadFromCache();
      if (cached) {
        setPermissions(cached);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermission = (role: Role[] | Role, permissionKey: string): boolean => {
    const roles = Array.isArray(role) ? role : [role];

    for (const r of roles) {
      const rolePerms = permissions.get(r);
      if (rolePerms && rolePerms.has(permissionKey)) {
        const enabled = rolePerms.get(permissionKey);
        if (enabled) return true;
      }
    }

    return false;
  };

  useEffect(() => {
    if (!employee || !storeId) {
      setIsLoading(false);
      return;
    }

    const cached = loadFromCache();
    if (cached && cached.size > 0) {
      setPermissions(cached);
      setIsLoading(false);
    } else {
      refreshPermissions();
    }
  }, [employee?.id, storeId]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        isLoading,
        error,
        refreshPermissions,
        checkPermission
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
