import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function compareSettings() {
  // Get all stores
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('active', true)
    .order('name');

  const sansSouci = stores.find(s => s.name === 'Sans Souci');
  const rivieres = stores.find(s => s.name === 'Ongles Rivieres');

  // Get all settings for both stores
  const { data: ssSettings } = await supabase
    .from('app_settings')
    .select('setting_key, category')
    .eq('store_id', sansSouci.id)
    .order('setting_key');

  const { data: rivSettings } = await supabase
    .from('app_settings')
    .select('setting_key, category')
    .eq('store_id', rivieres.id)
    .order('setting_key');

  const ssKeys = new Set(ssSettings.map(s => s.setting_key));
  const rivKeys = new Set(rivSettings.map(s => s.setting_key));

  console.log('=== SETTINGS COMPARISON ===\n');
  console.log(`Sans Souci: ${ssSettings.length} settings`);
  console.log(`Ongles Rivieres: ${rivSettings.length} settings\n`);

  // Find settings in Sans Souci but not in Rivieres
  const onlyInSS = ssSettings.filter(s => !rivKeys.has(s.setting_key));

  if (onlyInSS.length > 0) {
    console.log(`=== Settings ONLY in Sans Souci (${onlyInSS.length}) ===`);
    onlyInSS.forEach(s => {
      console.log(`  - ${s.setting_key} (${s.category})`);
    });
    console.log('');
  }

  // Find settings in Rivieres but not in Sans Souci
  const onlyInRiv = rivSettings.filter(s => !ssKeys.has(s.setting_key));

  if (onlyInRiv.length > 0) {
    console.log(`=== Settings ONLY in Ongles Rivieres (${onlyInRiv.length}) ===`);
    onlyInRiv.forEach(s => {
      console.log(`  - ${s.setting_key} (${s.category})`);
    });
    console.log('');
  }

  // Check for duplicates in Sans Souci
  const ssKeyCount = {};
  ssSettings.forEach(s => {
    ssKeyCount[s.setting_key] = (ssKeyCount[s.setting_key] || 0) + 1;
  });

  const duplicates = Object.entries(ssKeyCount).filter(([key, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`=== DUPLICATES in Sans Souci (${duplicates.length}) ===`);
    duplicates.forEach(([key, count]) => {
      console.log(`  - ${key}: ${count} copies`);
    });
  } else {
    console.log('No duplicates found in Sans Souci.');
  }
}

compareSettings().catch(console.error);
