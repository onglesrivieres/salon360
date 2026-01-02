import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function cleanupDuplicates() {
  console.log('=== CLEANING UP DUPLICATE SANS SOUCI SETTINGS ===\n');

  // Get Sans Souci store ID
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('name', 'Sans Souci')
    .limit(1);

  if (!stores || stores.length === 0) {
    console.error('Sans Souci store not found');
    return;
  }

  const sansSouciId = stores[0].id;
  console.log(`Sans Souci Store ID: ${sansSouciId}\n`);

  // Old settings to remove (these are duplicates with different names)
  const oldSettingsToRemove = [
    'admin_review_rejected_tickets',      // replaced by: require_admin_review_rejected
    'auto_approve_after_48_hours',        // replaced by: auto_approve_after_deadline
    'enable_ticket_approval_system',      // replaced by: enable_ticket_approvals
    'require_opening_cash_validation',    // replaced by: require_opening_cash
    'show_queue_button_in_header'         // replaced by: show_queue_in_header
  ];

  console.log('Removing old/duplicate settings:');
  oldSettingsToRemove.forEach(key => console.log(`  - ${key}`));
  console.log('');

  // Delete the old settings
  const { data, error } = await supabase
    .from('app_settings')
    .delete()
    .eq('store_id', sansSouciId)
    .in('setting_key', oldSettingsToRemove)
    .select('setting_key');

  if (error) {
    console.error('Error removing old settings:', error);
    return;
  }

  console.log(`✓ Successfully removed ${data.length} duplicate settings\n`);

  // Verify final count
  const { count: finalCount } = await supabase
    .from('app_settings')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', sansSouciId);

  console.log('=== FINAL RESULT ===');
  console.log(`Sans Souci now has ${finalCount} settings (expected: 56)\n`);

  // Show all stores for comparison
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

cleanupDuplicates().catch(console.error);
