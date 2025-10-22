import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthSession, getSession, saveSession, clearSession, updateLastActivity } from '../lib/auth';
import { Locale, getDeviceLocale, translations } from '../lib/i18n';

type TranslationKey = keyof typeof translations.en;
type NestedTranslation = typeof translations.en[TranslationKey];

export type DeviceMode = 'iphone' | 'ipad';

interface AuthContextType {
  session: AuthSession | null;
  selectedStoreId: string | null;
  locale: Locale;
  deviceMode: DeviceMode;
  login: (session: AuthSession) => void;
  logout: () => void;
  selectStore: (storeId: string) => void;
  clearStore: () => void;
  setLocale: (locale: Locale) => void;
  setDeviceMode: (mode: DeviceMode) => void;
  t: (key: string) => string;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCALE_KEY = 'salon360_locale';
const DEVICE_MODE_KEY = 'salon360_device_mode';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<Locale>('en');
  const [deviceMode, setDeviceModeState] = useState<DeviceMode>('iphone');
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(() => {
    const currentSession = getSession();
    setSession(currentSession);
    if (!currentSession && session) {
      window.location.reload();
    }
  }, [session]);

  useEffect(() => {
    const currentSession = getSession();
    setSession(currentSession);

    const savedStoreId = sessionStorage.getItem('selected_store_id');
    if (savedStoreId) {
      setSelectedStoreId(savedStoreId);
    }

    const savedLocale = localStorage.getItem(LOCALE_KEY) as Locale;
    if (savedLocale && ['en', 'fr', 'vi'].includes(savedLocale)) {
      setLocaleState(savedLocale);
    } else {
      const deviceLocale = getDeviceLocale();
      setLocaleState(deviceLocale);
      localStorage.setItem(LOCALE_KEY, deviceLocale);
    }

    const savedDeviceMode = localStorage.getItem(DEVICE_MODE_KEY) as DeviceMode;
    if (savedDeviceMode && ['iphone', 'ipad'].includes(savedDeviceMode)) {
      setDeviceModeState(savedDeviceMode);
    } else {
      setDeviceModeState('iphone');
      localStorage.setItem(DEVICE_MODE_KEY, 'iphone');
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      if (session) {
        updateLastActivity();
      }
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    const interval = setInterval(checkSession, 60000);

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [session, checkSession]);

  const login = (newSession: AuthSession) => {
    saveSession(newSession);
    setSession(newSession);
    sessionStorage.removeItem('selected_store_id');
    setSelectedStoreId(null);
  };

  const logout = () => {
    clearSession();
    sessionStorage.removeItem('selected_store_id');
    sessionStorage.removeItem('welcome_shown');
    setSession(null);
    setSelectedStoreId(null);
  };

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_KEY, newLocale);
  };

  const setDeviceMode = (mode: DeviceMode) => {
    setDeviceModeState(mode);
    localStorage.setItem(DEVICE_MODE_KEY, mode);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[locale];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  };

  const selectStore = (storeId: string) => {
    sessionStorage.setItem('selected_store_id', storeId);
    setSelectedStoreId(storeId);
  };

  const clearStore = () => {
    sessionStorage.removeItem('selected_store_id');
    setSelectedStoreId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, selectedStoreId, locale, deviceMode, login, logout, selectStore, clearStore, setLocale, setDeviceMode, t, isAuthenticated: !!session }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
