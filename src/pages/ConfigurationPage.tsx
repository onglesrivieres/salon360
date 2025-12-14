import React, { useState, useEffect } from 'react';
import { Settings, AlertCircle, Search, RefreshCw, Copy, CheckCircle2, Loader2, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CriticalSettingConfirmationModal } from '../components/CriticalSettingConfirmationModal';
import { SettingsDependencyIndicator } from '../components/SettingsDependencyIndicator';
import { ConfigurationWizard } from '../components/ConfigurationWizard';

interface AppSetting {
  id: string;
  store_id: string;
  setting_key: string;
  setting_value: boolean;
  category: string;
  display_name: string;
  description: string;
  default_value: boolean;
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

export function ConfigurationPage() {
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();

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
    newValue: boolean;
  } | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [hasConfiguration, setHasConfiguration] = useState(false);

  const canManageSettings = session?.role?.includes('Owner') || session?.role?.includes('Admin');

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
      setHasConfiguration(data);

      if (!data) {
        setShowWizard(true);
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
      showToast('Failed to load settings', 'error');
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
      showToast('You do not have permission to change settings', 'error');
      return;
    }

    if (setting.is_critical) {
      setPendingChange({ setting, newValue });
      setShowConfirmModal(true);
    } else {
      updateSetting(setting, newValue);
    }
  }

  async function updateSetting(setting: AppSetting, newValue: boolean) {
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

      showToast(
        `${setting.display_name} ${newValue ? 'enabled' : 'disabled'}`,
        'success'
      );

      if (setting.requires_restart) {
        showToast(
          'This change requires a page refresh to take effect',
          'info'
        );
      }

      await validateConfiguration();
    } catch (error) {
      console.error('Error updating setting:', error);
      showToast('Failed to update setting', 'error');
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
          <p className="text-gray-600">Please select a store to view configuration</p>
        </div>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">You do not have permission to view or modify store configuration</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Store Configuration</h2>
            <p className="text-sm text-gray-600">{storeName}</p>
          </div>
          <Button
            onClick={loadSettings}
            variant="ghost"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {validationIssues.length > 0 && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-900 mb-2">
                  Configuration Issues Found
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

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
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
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      ) : Object.keys(settingsByCategory).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No settings found matching your filters</p>
          <Button onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setShowCriticalOnly(false); }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
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
                            {setting.display_name}
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {showWizard && (
        <ConfigurationWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onComplete={() => {
            setShowWizard(false);
            loadSettings();
          }}
          storeId={selectedStoreId}
          storeName={storeName}
        />
      )}
    </div>
  );
}
