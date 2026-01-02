import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function applyCleanup() {
  console.log('=== REMOVING DUPLICATE SETTINGS FROM SANS SOUCI ===\n');

  // Get Sans Souci ID
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .eq('name', 'Sans Souci')
    .limit(1);

  if (!stores || stores.length === 0) {
    console.error('Sans Souci store not found');
    return;
  }

  const sansSouciId = stores[0].id;

  // Count before
  const { count: beforeCount } = await supabase
    .from('app_settings')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', sansSouciId);

  console.log(`Sans Souci currently has ${beforeCount} settings\n`);

  // Get the IDs of settings to remove
  const { data: toDelete } = await supabase
    .from('app_settings')
    .select('id, setting_key')
    .eq('store_id', sansSouciId)
    .in('setting_key', [
      'admin_review_rejected_tickets',
      'auto_approve_after_48_hours',
      'enable_ticket_approval_system',
      'require_opening_cash_validation',
      'show_queue_button_in_header'
    ]);

  if (!toDelete || toDelete.length === 0) {
    console.log('No duplicate settings found to remove.');
    return;
  }

  console.log(`Found ${toDelete.length} duplicate settings to remove:`);
  toDelete.forEach(s => console.log(`  - ${s.setting_key}`));
  console.log('');

  // Delete each one individually
  let successCount = 0;
  for (const setting of toDelete) {
    const { error } = await supabase
      .from('app_settings')
      .delete()
      .eq('id', setting.id);

    if (error) {
      console.error(`✗ Failed to delete ${setting.setting_key}:`, error.message);
    } else {
      console.log(`✓ Deleted ${setting.setting_key}`);
      successCount++;
    }
  }

  console.log(`\n${successCount} out of ${toDelete.length} settings removed\n`);

  // Count after
  const { count: afterCount } = await supabase
    .from('app_settings')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', sansSouciId);

  console.log('=== RESULT ===');
  console.log(`Before: ${beforeCount} settings`);
  console.log(`After: ${afterCount} settings`);
  console.log(`Expected: 56 settings\n`);

  // Show all stores
  console.log('=== ALL STORES ===');
  const { data: allStores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('active', true)
    .order('name');

  for (const store of allStores) {
    const { count } = await supabase
      .from('app_settings')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store.id);

    const status = count === 56 ? '✓' : '✗';
    console.log(`${status} ${store.name}: ${count} settings`);
  }
}

applyCleanup().catch(console.error);
