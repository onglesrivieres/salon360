import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function analyzeSettings() {
  console.log('=== ANALYZING APP SETTINGS ACROSS STORES ===\n');

  // Get all active stores
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, name')
    .eq('active', true)
    .order('name');

  if (storesError) {
    console.error('Error fetching stores:', storesError);
    return;
  }

  console.log('Active Stores:');
  stores.forEach(store => console.log(`  - ${store.name} (${store.id})`));
  console.log('');

  // Count settings per store
  console.log('=== SETTINGS COUNT PER STORE ===');
  for (const store of stores) {
    const { count, error } = await supabase
      .from('app_settings')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store.id);

    if (error) {
      console.error(`Error counting settings for ${store.name}:`, error);
    } else {
      console.log(`${store.name}: ${count} settings`);
    }
  }
  console.log('');

  // Get reference store (Ongles Rivieres)
  const referenceStore = stores.find(s => s.name === 'Ongles Rivieres');
  const sansSouciStore = stores.find(s => s.name === 'Sans Souci');

  if (!referenceStore) {
    console.error('Could not find Ongles Rivieres store');
    return;
  }

  if (!sansSouciStore) {
    console.error('Could not find Sans Souci store');
    return;
  }

  // Get all settings from reference store
  const { data: referenceSettings, error: refError } = await supabase
    .from('app_settings')
    .select('setting_key, category, display_name, description, default_value, is_critical, requires_restart, dependencies, display_order, help_text')
    .eq('store_id', referenceStore.id)
    .order('category, display_order, setting_key');

  if (refError) {
    console.error('Error fetching reference settings:', refError);
    return;
  }

  // Get all settings from Sans Souci
  const { data: sansSouciSettings, error: ssError } = await supabase
    .from('app_settings')
    .select('setting_key')
    .eq('store_id', sansSouciStore.id);

  if (ssError) {
    console.error('Error fetching Sans Souci settings:', ssError);
    return;
  }

  const sansSouciKeys = new Set(sansSouciSettings.map(s => s.setting_key));

  // Find missing settings
  const missingSettings = referenceSettings.filter(s => !sansSouciKeys.has(s.setting_key));

  console.log('=== MISSING SETTINGS IN SANS SOUCI ===');
  console.log(`Total missing: ${missingSettings.length}`);
  console.log('');

  // Group by category
  const byCategory = {};
  missingSettings.forEach(setting => {
    if (!byCategory[setting.category]) {
      byCategory[setting.category] = [];
    }
    byCategory[setting.category].push(setting);
  });

  // Display by category
  for (const [category, settings] of Object.entries(byCategory).sort()) {
    console.log(`\n=== ${category} (${settings.length} settings) ===`);
    settings.forEach(s => {
      console.log(`\nKey: ${s.setting_key}`);
      console.log(`  Display Name: ${s.display_name}`);
      console.log(`  Description: ${s.description}`);
      console.log(`  Default: ${JSON.stringify(s.default_value)}`);
      console.log(`  Critical: ${s.is_critical}`);
      console.log(`  Requires Restart: ${s.requires_restart}`);
      if (s.dependencies && s.dependencies.length > 0) {
        console.log(`  Dependencies: ${JSON.stringify(s.dependencies)}`);
      }
      console.log(`  Display Order: ${s.display_order}`);
      if (s.help_text) {
        console.log(`  Help: ${s.help_text}`);
      }
    });
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`Reference Store (${referenceStore.name}): ${referenceSettings.length} settings`);
  console.log(`Sans Souci Store: ${sansSouciSettings.length} settings`);
  console.log(`Missing Settings: ${missingSettings.length}`);
  console.log('');
  console.log('Categories with missing settings:');
  Object.entries(byCategory).sort().forEach(([cat, settings]) => {
    console.log(`  ${cat}: ${settings.length} missing`);
  });

  // Store the missing settings data for migration creation
  console.log('\n\n=== STORE IDs FOR MIGRATION ===');
  console.log(`Sans Souci ID: ${sansSouciStore.id}`);
  console.log(`Ongles Rivieres ID: ${referenceStore.id}`);
}

analyzeSettings().catch(console.error);
