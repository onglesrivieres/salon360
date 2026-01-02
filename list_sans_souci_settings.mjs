import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function listSettings() {
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('name', 'Sans Souci')
    .limit(1);

  const sansSouciId = stores[0].id;

  // Get all settings
  const { data: settings } = await supabase
    .from('app_settings')
    .select('id, setting_key, category, display_name')
    .eq('store_id', sansSouciId)
    .order('setting_key');

  console.log(`=== ALL SANS SOUCI SETTINGS (${settings.length} total) ===\n`);

  // Group by category
  const byCategory = {};
  settings.forEach(s => {
    if (!byCategory[s.category]) {
      byCategory[s.category] = [];
    }
    byCategory[s.category].push(s);
  });

  Object.entries(byCategory).sort().forEach(([cat, items]) => {
    console.log(`\n${cat} (${items.length}):`);
    items.forEach(s => {
      console.log(`  - ${s.setting_key}`);
    });
  });

  // Show the specific old settings
  console.log('\n\n=== CHECKING FOR OLD SETTING NAMES ===');
  const oldKeys = [
    'admin_review_rejected_tickets',
    'auto_approve_after_48_hours',
    'enable_ticket_approval_system',
    'require_opening_cash_validation',
    'show_queue_button_in_header'
  ];

  oldKeys.forEach(key => {
    const found = settings.find(s => s.setting_key === key);
    if (found) {
      console.log(`✓ FOUND: ${key} (ID: ${found.id})`);
    } else {
      console.log(`✗ NOT FOUND: ${key}`);
    }
  });

  // Show potential duplicates
  console.log('\n\n=== CHECKING FOR NEW SETTING NAMES ===');
  const newKeys = [
    'require_admin_review_rejected',
    'auto_approve_after_deadline',
    'enable_ticket_approvals',
    'require_opening_cash',
    'show_queue_in_header'
  ];

  newKeys.forEach(key => {
    const found = settings.find(s => s.setting_key === key);
    if (found) {
      console.log(`✓ FOUND: ${key} (ID: ${found.id})`);
    } else {
      console.log(`✗ NOT FOUND: ${key}`);
    }
  });
}

listSettings().catch(console.error);
