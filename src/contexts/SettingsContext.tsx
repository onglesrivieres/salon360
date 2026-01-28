import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { setCurrentTimezone } from '../lib/timezone';
import type { StorageConfig } from '../lib/storage';

interface SettingsContextType {
  settings: Map<string, boolean | string | number>;
  globalSettings: Map<string, boolean | string | number>;
  isLoading: boolean;
  isGlobalLoading: boolean;
  timezone: string;
  getSetting: (key: string, defaultValue?: boolean | string | number) => boolean | string | number;
  getGlobalSetting: (key: string, defaultValue?: boolean | string | number) => boolean | string | number;
  getSettingBoolean: (key: string, defaultValue?: boolean) => boolean;
  getSettingNumber: (key: string, defaultValue?: number) => number;
  getSettingString: (key: string, defaultValue?: string) => string;
  getGlobalSettingString: (key: string, defaultValue?: string) => string;
  getAppName: () => string;
  getAppLogoUrl: () => string;
  getR2PublicUrl: () => string;
  isR2Configured: () => boolean;
  getStorageConfig: () => StorageConfig | null;
  refreshSettings: () => Promise<void>;
  refreshGlobalSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { selectedStoreId } = useAuth();
  const [settings, setSettings] = useState<Map<string, boolean | string | number>>(new Map());
  const [globalSettings, setGlobalSettings] = useState<Map<string, boolean | string | number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  const [timezone, setTimezone] = useState<string>('America/New_York');

  const globalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const storeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load global settings on mount (no store dependency)
  useEffect(() => {
    loadGlobalSettings();
    subscribeToGlobalSettings();

    return () => {
      if (globalChannelRef.current) {
        supabase.removeChannel(globalChannelRef.current);
      }
    };
  }, []);

  // Load store settings when store changes
  useEffect(() => {
    if (selectedStoreId) {
      loadSettings();
      subscribeToSettings();
    } else {
      setSettings(new Map());
      setIsLoading(false);
    }

    return () => {
      if (storeChannelRef.current) {
        supabase.removeChannel(storeChannelRef.current);
      }
    };
  }, [selectedStoreId]);

  async function loadGlobalSettings() {
    setIsGlobalLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_global_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      const globalMap = new Map<string, boolean | string | number>();

      data?.forEach((setting) => {
        let value: boolean | string | number = setting.setting_value;

        // Handle edge cases where value might be wrapped
        if (typeof value === 'object' && value !== null) {
          if ('value' in value) {
            value = (value as any).value;
          }
        }

        globalMap.set(setting.setting_key, value);
      });

      setGlobalSettings(globalMap);
    } catch (error) {
      console.error('Error loading global settings:', error);
    } finally {
      setIsGlobalLoading(false);
    }
  }

  function subscribeToGlobalSettings() {
    globalChannelRef.current = supabase
      .channel('global-settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_global_settings',
        },
        () => {
          loadGlobalSettings();
        }
      )
      .subscribe();
  }

  async function loadSettings() {
    if (!selectedStoreId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('store_id', selectedStoreId);

      if (error) throw error;

      const settingsMap = new Map<string, boolean | string | number>();
      let storeTimezone = 'America/New_York';

      data?.forEach((setting) => {
        // The setting_value comes from JSONB, so it's already the correct type
        // Supabase client automatically parses JSONB to JavaScript types
        let value: boolean | string | number = setting.setting_value;

        // Handle edge cases where value might be wrapped
        if (typeof value === 'object' && value !== null) {
          // If it's an object with a value property, unwrap it
          if ('value' in value) {
            value = (value as any).value;
          }
        }

        settingsMap.set(setting.setting_key, value);

        // Extract timezone setting
        if (setting.setting_key === 'timezone' && typeof value === 'string') {
          storeTimezone = value;
        }
      });

      setSettings(settingsMap);
      setTimezone(storeTimezone);
      setCurrentTimezone(storeTimezone);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function subscribeToSettings() {
    if (!selectedStoreId) return;

    storeChannelRef.current = supabase
      .channel(`settings-${selectedStoreId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: `store_id=eq.${selectedStoreId}`,
        },
        () => {
          loadSettings();
        }
      )
      .subscribe();
  }

  function getSetting(key: string, defaultValue: boolean | string | number = false): boolean | string | number {
    if (settings.has(key)) {
      return settings.get(key)!;
    }
    return defaultValue;
  }

  function getGlobalSetting(key: string, defaultValue: boolean | string | number = false): boolean | string | number {
    if (globalSettings.has(key)) {
      return globalSettings.get(key)!;
    }
    return defaultValue;
  }

  function getSettingBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = getSetting(key, defaultValue);
    // Handle string "true"/"false" values (from incorrect migrations)
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  }

  function getSettingNumber(key: string, defaultValue: number = 0): number {
    const value = getSetting(key, defaultValue);
    return typeof value === 'number' ? value : defaultValue;
  }

  function getSettingString(key: string, defaultValue: string = ''): string {
    const value = getSetting(key, defaultValue);
    return typeof value === 'string' ? value : defaultValue;
  }

  function getGlobalSettingString(key: string, defaultValue: string = ''): string {
    const value = getGlobalSetting(key, defaultValue);
    return typeof value === 'string' ? value : defaultValue;
  }

  // Branding settings are now global
  function getAppName(): string {
    return getGlobalSettingString('app_name', 'Salon360');
  }

  function getAppLogoUrl(): string {
    return getGlobalSettingString('app_logo_url', '');
  }

  // Storage settings are now global
  function getR2PublicUrl(): string {
    return getGlobalSettingString('r2_public_url', '');
  }

  function isR2Configured(): boolean {
    const accountId = getGlobalSettingString('r2_account_id', '');
    const accessKeyId = getGlobalSettingString('r2_access_key_id', '');
    const secretAccessKey = getGlobalSettingString('r2_secret_access_key', '');
    const bucketName = getGlobalSettingString('r2_bucket_name', '');
    const publicUrl = getGlobalSettingString('r2_public_url', '');

    return !!(accountId && accessKeyId && secretAccessKey && bucketName && publicUrl);
  }

  function getStorageConfig(): StorageConfig | null {
    if (!isR2Configured()) {
      // R2 is not configured - return null
      return null;
    }

    return {
      // Use selectedStoreId if available, otherwise use 'global' for path organization
      storeId: selectedStoreId || 'global',
      r2Config: {
        accountId: getGlobalSettingString('r2_account_id', ''),
        accessKeyId: getGlobalSettingString('r2_access_key_id', ''),
        secretAccessKey: getGlobalSettingString('r2_secret_access_key', ''),
        bucketName: getGlobalSettingString('r2_bucket_name', ''),
        publicUrl: getR2PublicUrl(),
      },
    };
  }

  async function refreshSettings() {
    await loadSettings();
  }

  async function refreshGlobalSettings() {
    await loadGlobalSettings();
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        globalSettings,
        isLoading,
        isGlobalLoading,
        timezone,
        getSetting,
        getGlobalSetting,
        getSettingBoolean,
        getSettingNumber,
        getSettingString,
        getGlobalSettingString,
        getAppName,
        getAppLogoUrl,
        getR2PublicUrl,
        isR2Configured,
        getStorageConfig,
        refreshSettings,
        refreshGlobalSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
