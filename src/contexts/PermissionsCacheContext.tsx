import React, { createContext, useContext, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Role } from '../lib/permissions';

interface PermissionState {
  permission_key: string;
  is_enabled: boolean;
  is_default: boolean;
  updated_at?: string;
}

type RolePermissions = Map<Role, Map<string, PermissionState>>;

interface CacheEntry {
  data: RolePermissions;
  timestamp: number;
  storeId: string;
}

interface PermissionsCacheContextType {
  getCachedPermissions: (storeId: string) => RolePermissions | null;
  loadPermissions: (storeId: string, forceRefresh?: boolean) => Promise<RolePermissions>;
  invalidateCache: (storeId?: string) => void;
  updateCacheEntry: (storeId: string, role: Role, permissionKey: string, state: PermissionState) => void;
}

const PermissionsCacheContext = createContext<PermissionsCacheContextType | undefined>(undefined);

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ALL_ROLES: Role[] = ['Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Cashier'];

export function PermissionsCacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const loadingRef = useRef<Map<string, Promise<RolePermissions>>>(new Map());

  const isCacheValid = useCallback((entry: CacheEntry): boolean => {
    return Date.now() - entry.timestamp < CACHE_TTL;
  }, []);

  const getCachedPermissions = useCallback((storeId: string): RolePermissions | null => {
    const entry = cacheRef.current.get(storeId);
    if (entry && isCacheValid(entry)) {
      return entry.data;
    }
    return null;
  }, [isCacheValid]);

  const loadPermissions = useCallback(async (storeId: string, forceRefresh = false): Promise<RolePermissions> => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh) {
      const cached = getCachedPermissions(storeId);
      if (cached) {
        return cached;
      }
    }

    // Check if there's already a loading request for this store
    const existingLoad = loadingRef.current.get(storeId);
    if (existingLoad) {
      return existingLoad;
    }

    // Create new loading promise
    const loadPromise = (async () => {
      try {
        // Try to use the optimized bulk query function first
        const { data: bulkData, error: bulkError } = await supabase.rpc('get_all_roles_permissions', {
          p_store_id: storeId
        });

        // If the new function exists and works, use it
        if (!bulkError && bulkData) {
          const rolePermissions = new Map<Role, Map<string, PermissionState>>();

          // Parse the JSONB response
          ALL_ROLES.forEach((role) => {
            const roleData = bulkData[role];
            if (roleData && Array.isArray(roleData)) {
              const permMap = new Map<string, PermissionState>();
              roleData.forEach((perm: any) => {
                permMap.set(perm.permission_key, {
                  permission_key: perm.permission_key,
                  is_enabled: perm.is_enabled,
                  is_default: perm.is_enabled === true && !perm.updated_at,
                  updated_at: perm.updated_at
                });
              });
              rolePermissions.set(role, permMap);
            }
          });

          // Cache the result (ref mutation, no re-render)
          cacheRef.current.set(storeId, {
            data: rolePermissions,
            timestamp: Date.now(),
            storeId
          });

          return rolePermissions;
        }

        // Fallback: Load permissions for all roles in parallel (old method)
        console.log('Using fallback permission loading method');
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

        // Cache the result (ref mutation, no re-render)
        cacheRef.current.set(storeId, {
          data: rolePermissions,
          timestamp: Date.now(),
          storeId
        });

        return rolePermissions;
      } catch (error) {
        console.error('Error loading permissions:', error);
        throw error;
      } finally {
        loadingRef.current.delete(storeId);
      }
    })();

    // Store the promise to prevent duplicate requests
    loadingRef.current.set(storeId, loadPromise);

    return loadPromise;
  }, [getCachedPermissions]);

  const invalidateCache = useCallback((storeId?: string) => {
    if (storeId) {
      cacheRef.current.delete(storeId);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  const updateCacheEntry = useCallback((storeId: string, role: Role, permissionKey: string, state: PermissionState) => {
    const entry = cacheRef.current.get(storeId);
    if (entry) {
      const rolePerms = entry.data.get(role);
      if (rolePerms) {
        rolePerms.set(permissionKey, state);
      }
    }
  }, []);

  return (
    <PermissionsCacheContext.Provider
      value={{
        getCachedPermissions,
        loadPermissions,
        invalidateCache,
        updateCacheEntry
      }}
    >
      {children}
    </PermissionsCacheContext.Provider>
  );
}

export function usePermissionsCache() {
  const context = useContext(PermissionsCacheContext);
  if (context === undefined) {
    throw new Error('usePermissionsCache must be used within a PermissionsCacheProvider');
  }
  return context;
}
