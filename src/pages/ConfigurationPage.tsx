import React, { useState, useEffect, useRef } from 'react';
import { Settings, AlertCircle, Search, RefreshCw, Copy, CheckCircle2, CheckCircle, Loader2, AlertTriangle, Shield, UserCog, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { NumericInput } from '../components/ui/NumericInput';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../lib/supabase';
import { CriticalSettingConfirmationModal } from '../components/CriticalSettingConfirmationModal';
import { SettingsDependencyIndicator } from '../components/SettingsDependencyIndicator';
import { RolePermissionMatrix } from '../components/RolePermissionMatrix';
import { StoreHoursEditor } from '../components/StoreHoursEditor';
import { LogoUploadField } from '../components/LogoUploadField';
import { StorageConfigSection } from '../components/StorageConfigSection';

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

interface ValidationIssue {
  type: string;
  setting: string;
  requires?: string;
  message: string;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}, ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  }
}

function getDynamicDisplayName(setting: AppSetting, allSettings: AppSetting[]): string {
  if (setting.setting_key === 'auto_approve_after_48_hours') {
    const managerMinutesSetting = allSettings.find(s => s.setting_key === 'auto_approval_minutes_manager');
    if (managerMinutesSetting && typeof managerMinutesSetting.setting_value === 'number') {
      const timeStr = formatMinutes(managerMinutesSetting.setting_value);
      return `Auto-Approve After ${timeStr.charAt(0).toUpperCase() + timeStr.slice(1)}`;
    }
  }
  return setting.display_name;
}

export function ConfigurationPage() {
  const { showToast } = useToast();
  const { selectedStoreId, session, t } = useAuth();
  const { getStorageConfig, getSettingString, refreshSettings } = useSettings();

  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [filteredSettings, setFilteredSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    setting: AppSetting;
    newValue: boolean | string | number;
  } | null>(null);

  const [storeName, setStoreName] = useState('');
  const [hasConfiguration, setHasConfiguration] = useState(false);

  const [activeTab, setActiveTab] = useState<'settings' | 'permissions'>('settings');

  const canManageSettings = session?.role?.includes('Owner') || session?.role?.includes('Admin');

  // State for responsive tab dropdown
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement>(null);

  // Tab configuration
  const tabConfig: Array<{ key: 'settings' | 'permissions'; label: string; icon: typeof Settings }> = [
    { key: 'settings', label: t('config.appSettings'), icon: Settings },
    { key: 'permissions', label: t('config.rolePermissions'), icon: UserCog },
  ];
  const currentTab = tabConfig.find(tab => tab.key === activeTab);

  // Click-outside handler for tab dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) {
        setIsTabDropdownOpen(false);
      }
    }
    if (isTabDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTabDropdownOpen]);

  useEffect(() => {
    if (selectedStoreId) {
      loadSettings();
      checkConfiguration();
      loadStoreName();
    }
  }, [selectedStoreId]);

  useEffect(() => {
    filterSettings();
  }, [settings, searchQuery, selectedCategory, showCriticalOnly]);

  async function loadStoreName() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from('stores')
        .select('name')
        .eq('id', selectedStoreId)
        .single();

      if (error) throw error;
      setStoreName(data.name);
    } catch (error) {
      console.error('Error loading store name:', error);
    }
  }

  async function checkConfiguration() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase.rpc('store_has_configuration', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;

      if (!data) {
        // Auto-initialize with 'full' preset instead of showing wizard
        const { error: initError } = await supabase.rpc('initialize_store_settings', {
          p_store_id: selectedStoreId,
          p_preset: 'full',
        });

        if (initError) {
          console.error('Error auto-initializing settings:', initError);
        } else {
          setHasConfiguration(true);
          loadSettings();
        }
      } else {
        setHasConfiguration(true);
      }
    } catch (error) {
      console.error('Error checking configuration:', error);
    }
  }

  async function loadSettings() {
    if (!selectedStoreId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('store_id', selectedStoreId)
        .order('category')
        .order('display_order');

      if (error) throw error;

      setSettings(data || []);
      await validateConfiguration();
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast(t('config.failedToLoad'), 'error');
    } finally {
      setIsLoading(false);
    }
  }

  async function validateConfiguration() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase.rpc('validate_store_configuration', {
        p_store_id: selectedStoreId,
      });

      if (error) throw error;
      setValidationIssues(data?.issues || []);
    } catch (error) {
      console.error('Error validating configuration:', error);
    }
  }

  function filterSettings() {
    let filtered = settings;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.display_name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.setting_key.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }

    if (showCriticalOnly) {
      filtered = filtered.filter((s) => s.is_critical);
    }

    setFilteredSettings(filtered);
  }

  function handleToggleClick(setting: AppSetting, newValue: boolean) {
    if (!canManageSettings) {
      showToast(t('config.noPermissionChange'), 'error');
      return;
    }

    if (setting.is_critical) {
      setPendingChange({ setting, newValue });
      setShowConfirmModal(true);
    } else {
      updateSetting(setting, newValue);
    }
  }

  function handleNumericChange(setting: AppSetting, newValue: number) {
    if (!canManageSettings) {
      showToast(t('config.noPermissionChange'), 'error');
      return;
    }

    // Validate range for auto_approval_minutes and auto_approval_minutes_manager
    if (setting.setting_key === 'auto_approval_minutes' || setting.setting_key === 'auto_approval_minutes_manager') {
      if (newValue < 10 || newValue > 10080) {
        showToast(t('config.valueBetweenMinutes'), 'error');
        return;
      }
    }

    // Validate range for violation_min_votes_required
    if (setting.setting_key === 'violation_min_votes_required') {
      if (newValue < 1 || newValue > 10) {
        showToast(t('config.valueBetweenVotes'), 'error');
        return;
      }
    }

    // Validate range for small_service_threshold
    if (setting.setting_key === 'small_service_threshold') {
      if (newValue < 0 || newValue > 500) {
        showToast(t('config.valueBetweenDollars'), 'error');
        return;
      }
    }

    if (setting.is_critical) {
      setPendingChange({ setting, newValue });
      setShowConfirmModal(true);
    } else {
      updateSetting(setting, newValue);
    }
  }

  function handleStringChange(setting: AppSetting, newValue: string) {
    if (!canManageSettings) {
      showToast(t('config.noPermissionChange'), 'error');
      return;
    }

    if (setting.is_critical) {
      setPendingChange({ setting, newValue });
      setShowConfirmModal(true);
    } else {
      updateSetting(setting, newValue);
    }
  }

  async function updateSetting(setting: AppSetting, newValue: boolean | string | number) {
    try {
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({
          setting_value: newValue,
          updated_by: session?.employee_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', setting.id);

      if (updateError) throw updateError;

      const { error: auditError } = await supabase
        .from('app_settings_audit')
        .insert({
          store_id: setting.store_id,
          setting_key: setting.setting_key,
          old_value: setting.setting_value,
          new_value: newValue,
          changed_by: session?.employee_id,
          is_critical: setting.is_critical,
        });

      if (auditError) throw auditError;

      setSettings((prev) =>
        prev.map((s) => (s.id === setting.id ? { ...s, setting_value: newValue } : s))
      );

      // Refresh SettingsContext to sync with updated values
      await refreshSettings();

      showToast(
        `${setting.display_name} ${newValue ? 'enabled' : 'disabled'}`,
        'success'
      );

      if (setting.requires_restart) {
        showToast(
          t('config.refreshRequired'),
          'info'
        );
      }

      await validateConfiguration();
    } catch (error) {
      console.error('Error updating setting:', error);
      showToast(t('config.failedToUpdate'), 'error');
    }
  }

  function handleConfirmChange() {
    if (pendingChange) {
      updateSetting(pendingChange.setting, pendingChange.newValue);
      setPendingChange(null);
      setShowConfirmModal(false);
    }
  }

  const categories = Array.from(new Set(settings.map((s) => s.category))).sort();
  const settingsByCategory = filteredSettings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, AppSetting[]>);

  const settingsMap = new Map(
    settings.map((s) => [s.setting_key, { display_name: s.display_name, setting_value: s.setting_value }])
  );

  if (!selectedStoreId) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">{t('config.pleaseSelectStore')}</p>
        </div>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{t('config.noPermission')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t('config.title')}</h2>
            <p className="text-sm text-gray-600">{storeName}</p>
          </div>
          <Button
            onClick={loadSettings}
            variant="ghost"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('config.refresh')}
          </Button>
        </div>

        <div className="mb-6 border-b border-gray-200">
          {/* Mobile dropdown - visible on screens < md */}
          <div className="md:hidden p-2" ref={tabDropdownRef}>
            <div className="relative">
              <button
                onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
              >
                <div className="flex items-center gap-2">
                  {currentTab && (
                    <>
                      <currentTab.icon className="w-4 h-4" />
                      <span>{currentTab.label}</span>
                    </>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isTabDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {tabConfig.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setIsTabDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </div>
                        {isActive && <CheckCircle className="w-4 h-4 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Desktop tabs - visible on screens >= md */}
          <div className="hidden md:flex gap-2">
            {tabConfig.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4 inline mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'settings' && validationIssues.length > 0 && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-900 mb-2">
                  {t('config.configIssuesFound')}
                </h3>
                <ul className="space-y-1">
                  {validationIssues.map((issue, i) => (
                    <li key={i} className="text-sm text-orange-800">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('config.searchSettings')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowCriticalOnly(!showCriticalOnly)}
              className={`px-4 py-2 border rounded-lg transition-colors ${
                showCriticalOnly
                  ? 'bg-orange-100 border-orange-300 text-orange-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Critical Only
            </button>
          </div>
        )}
      </div>

      {activeTab === 'permissions' && (
        <RolePermissionMatrix onPermissionChange={() => {
          showToast('Permissions updated. Changes will take effect after users log out and back in.', 'success');
        }} />
      )}

      {activeTab === 'settings' && isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      ) : activeTab === 'settings' && Object.keys(settingsByCategory).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No settings found matching your filters</p>
          <Button onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setShowCriticalOnly(false); }}>
            Clear Filters
          </Button>
        </div>
      ) : activeTab === 'settings' ? (
        <div className="space-y-6">
          <StoreHoursEditor storeId={selectedStoreId} />
          {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
            category === 'Storage' ? (
              <div key={category} className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">{category}</h3>
                </div>
                <div className="p-6">
                  <StorageConfigSection
                    storeId={selectedStoreId}
                    r2AccountId={getSettingString('r2_account_id', '')}
                    r2AccessKeyId={getSettingString('r2_access_key_id', '')}
                    r2SecretAccessKey={getSettingString('r2_secret_access_key', '')}
                    r2BucketName={getSettingString('r2_bucket_name', '')}
                    r2PublicUrl={getSettingString('r2_public_url', '')}
                    onSettingChange={async (key, value) => {
                      const setting = categorySettings.find((s) => s.setting_key === key);
                      if (setting) {
                        await handleStringChange(setting, value);
                      }
                    }}
                    disabled={!canManageSettings}
                  />
                </div>
              </div>
            ) :
            <div key={category} className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">{category}</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {categorySettings.map((setting) => (
                  <div key={setting.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">
                            {getDynamicDisplayName(setting, settings)}
                          </h4>
                          {setting.is_critical && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                              Critical
                            </span>
                          )}
                          {setting.requires_restart && (
                            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                              Requires Restart
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {setting.description}
                        </p>
                        {setting.help_text && (
                          <p className="text-xs text-gray-500 italic">
                            {setting.help_text}
                          </p>
                        )}
                        <SettingsDependencyIndicator
                          dependencies={setting.dependencies || []}
                          allSettings={settingsMap}
                          isEnabled={setting.setting_value}
                        />
                      </div>
                      {setting.setting_key === 'store_timezone' ? (
                        <select
                          value={setting.setting_value as string}
                          onChange={(e) => handleStringChange(setting, e.target.value)}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                        >
                          <optgroup label="US Timezones">
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="America/Chicago">Central Time (CT)</option>
                            <option value="America/Denver">Mountain Time (MT)</option>
                            <option value="America/Phoenix">Mountain Time - Arizona (no DST)</option>
                            <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            <option value="America/Anchorage">Alaska Time (AKT)</option>
                            <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                          </optgroup>
                          <optgroup label="Other North American">
                            <option value="America/Toronto">Toronto (ET)</option>
                            <option value="America/Vancouver">Vancouver (PT)</option>
                            <option value="America/Mexico_City">Mexico City</option>
                          </optgroup>
                        </select>
                      ) : setting.setting_key === 'app_name' ? (
                        <input
                          type="text"
                          value={setting.setting_value as string}
                          onChange={(e) => handleStringChange(setting, e.target.value)}
                          maxLength={50}
                          className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Enter app name"
                        />
                      ) : setting.setting_key === 'app_logo_url' ? (
                        <LogoUploadField
                          currentLogoUrl={setting.setting_value as string}
                          storeId={selectedStoreId}
                          onLogoChange={(url) => handleStringChange(setting, url)}
                          disabled={!canManageSettings}
                          storageConfig={getStorageConfig()}
                        />
                      ) : typeof setting.setting_value === 'number' ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <NumericInput
                              value={setting.setting_value.toString()}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                if (!isNaN(value)) {
                                  handleNumericChange(setting, value);
                                }
                              }}
                              min={
                                (setting.setting_key === 'auto_approval_minutes' || setting.setting_key === 'auto_approval_minutes_manager') ? 10 :
                                setting.setting_key === 'violation_min_votes_required' ? 1 :
                                setting.setting_key === 'small_service_threshold' ? 0 : undefined
                              }
                              max={
                                (setting.setting_key === 'auto_approval_minutes' || setting.setting_key === 'auto_approval_minutes_manager') ? 10080 :
                                setting.setting_key === 'violation_min_votes_required' ? 10 :
                                setting.setting_key === 'small_service_threshold' ? 500 : undefined
                              }
                              step="1"
                              className="w-28 px-3 py-2"
                            />
                            <span className="text-sm text-gray-600">
                              {setting.setting_key === 'violation_min_votes_required' ? 'votes' :
                               setting.setting_key === 'small_service_threshold' ? 'dollars' : 'minutes'}
                            </span>
                          </div>
                          {(setting.setting_key === 'auto_approval_minutes' || setting.setting_key === 'auto_approval_minutes_manager') && (
                            <>
                              <span className="text-xs text-gray-500">
                                {formatMinutes(setting.setting_value as number)}
                              </span>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {[
                                  { label: '30m', value: 30 },
                                  { label: '1h', value: 60 },
                                  { label: '24h', value: 1440 },
                                  { label: '48h', value: 2880 },
                                  { label: '3d', value: 4320 },
                                  { label: '7d', value: 10080 },
                                ].map((preset) => (
                                  <button
                                    key={preset.value}
                                    onClick={() => handleNumericChange(setting, preset.value)}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${
                                      setting.setting_value === preset.value
                                        ? 'bg-blue-100 text-blue-700 font-medium'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                          {setting.setting_key === 'violation_min_votes_required' && (
                            <div className="flex flex-wrap gap-1 justify-end">
                              {[
                                { label: '2', value: 2 },
                                { label: '3', value: 3 },
                                { label: '4', value: 4 },
                                { label: '5', value: 5 },
                              ].map((preset) => (
                                <button
                                  key={preset.value}
                                  onClick={() => handleNumericChange(setting, preset.value)}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${
                                    setting.setting_value === preset.value
                                      ? 'bg-blue-100 text-blue-700 font-medium'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {setting.setting_key === 'small_service_threshold' && (
                            <div className="flex flex-wrap gap-1 justify-end">
                              {[
                                { label: '$20', value: 20 },
                                { label: '$25', value: 25 },
                                { label: '$30', value: 30 },
                                { label: '$40', value: 40 },
                                { label: '$50', value: 50 },
                              ].map((preset) => (
                                <button
                                  key={preset.value}
                                  onClick={() => handleNumericChange(setting, preset.value)}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${
                                    setting.setting_value === preset.value
                                      ? 'bg-blue-100 text-blue-700 font-medium'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleToggleClick(setting, !setting.setting_value)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            setting.setting_value ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              setting.setting_value ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {pendingChange && (
        <CriticalSettingConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setPendingChange(null);
          }}
          onConfirm={handleConfirmChange}
          settingName={pendingChange.setting.display_name}
          settingDescription={pendingChange.setting.description}
          helpText={pendingChange.setting.help_text}
          requiresRestart={pendingChange.setting.requires_restart}
          currentValue={pendingChange.setting.setting_value}
          newValue={pendingChange.newValue}
        />
      )}
    </div>
  );
}
