import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { setCurrentTimezone } from '../lib/timezone';
import type { StorageConfig } from '../lib/storage';

interface AppSetting {
  id: string;
  store_id: string;
  setting_key: string;
  setting_value: boolean | string | number;
  category: string;
  display_name: string;
  description: string;
  default_value: boolean | string | number;
  is_critical: boolean;
  requires_restart: boolean;
  dependencies: Array<{ key: string; type: string; label: string }>;
  display_order: number;
  help_text: string;
  updated_at: string;
}

interface SettingsContextType {
  settings: Map<string, boolean | string | number>;
  isLoading: boolean;
  timezone: string;
  getSetting: (key: string, defaultValue?: boolean | string | number) => boolean | string | number;
  getSettingBoolean: (key: string, defaultValue?: boolean) => boolean;
  getSettingNumber: (key: string, defaultValue?: number) => number;
  getSettingString: (key: string, defaultValue?: string) => string;
  getAppName: () => string;
  getAppLogoUrl: () => string;
  getR2PublicUrl: () => string;
  isR2Configured: () => boolean;
  getStorageConfig: () => StorageConfig | null;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { selectedStoreId } = useAuth();
  const [settings, setSettings] = useState<Map<string, boolean | string | number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [timezone, setTimezone] = useState<string>('America/New_York');

  useEffect(() => {
    if (selectedStoreId) {
      loadSettings();
      subscribeToSettings();
    }

    return () => {
      supabase.removeAllChannels();
    };
  }, [selectedStoreId]);

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
        if (setting.setting_key === 'store_timezone' && typeof value === 'string') {
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

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function getSetting(key: string, defaultValue: boolean | string | number = false): boolean | string | number {
    if (settings.has(key)) {
      return settings.get(key)!;
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

  function getAppName(): string {
    return getSettingString('app_name', 'Salon360');
  }

  function getAppLogoUrl(): string {
    return getSettingString('app_logo_url', '');
  }

  function getR2PublicUrl(): string {
    return getSettingString('r2_public_url', '');
  }

  function isR2Configured(): boolean {
    const accountId = getSettingString('r2_account_id', '');
    const accessKeyId = getSettingString('r2_access_key_id', '');
    const secretAccessKey = getSettingString('r2_secret_access_key', '');
    const bucketName = getSettingString('r2_bucket_name', '');
    const publicUrl = getSettingString('r2_public_url', '');

    return !!(accountId && accessKeyId && secretAccessKey && bucketName && publicUrl);
  }

  function getStorageConfig(): StorageConfig | null {
    if (!selectedStoreId) return null;

    if (!isR2Configured()) {
      // R2 is not configured - return null
      return null;
    }

    return {
      storeId: selectedStoreId,
      r2Config: {
        accountId: getSettingString('r2_account_id', ''),
        accessKeyId: getSettingString('r2_access_key_id', ''),
        secretAccessKey: getSettingString('r2_secret_access_key', ''),
        bucketName: getSettingString('r2_bucket_name', ''),
        publicUrl: getR2PublicUrl(),
      },
    };
  }

  async function refreshSettings() {
    await loadSettings();
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        timezone,
        getSetting,
        getSettingBoolean,
        getSettingNumber,
        getSettingString,
        getAppName,
        getAppLogoUrl,
        getR2PublicUrl,
        isR2Configured,
        getStorageConfig,
        refreshSettings,
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
