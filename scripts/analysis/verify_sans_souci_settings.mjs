import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function verifySettings() {
  console.log('=== SANS SOUCI SETTINGS VERIFICATION ===\n');

  // Get stores
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('active', true)
    .order('name');

  const sansSouci = stores.find(s => s.name === 'Sans Souci');
  const rivieres = stores.find(s => s.name === 'Ongles Rivieres');

  // Get settings for both stores
  const { data: ssSettings } = await supabase
    .from('app_settings')
    .select('setting_key, category')
    .eq('store_id', sansSouci.id);

  const { data: rivSettings } = await supabase
    .from('app_settings')
    .select('setting_key, category')
    .eq('store_id', rivieres.id);

  // Create maps for quick lookup
  const ssMap = new Set(ssSettings.map(s => s.setting_key));
  const rivMap = new Set(rivSettings.map(s => s.setting_key));

  // Define the standard/new settings that should exist
  const standardSettings = [
    'auto_approve_after_deadline',
    'enable_cash_approvals',
    'enable_inventory_approvals',
    'enable_ticket_approvals',
    'require_admin_review_rejected',
    'show_approval_notifications',
    'enable_employee_inventory',
    'enable_tip_pairing',
    'show_attendance_in_profiles',
    'show_tip_details',
    'show_tip_details_to_technicians',
    'enable_tip_pairing_mode',
    'show_attendance_on_home_page',
    'enable_employee_distribution',
    'enable_product_preferences',
    'track_purchase_lots',
    'enable_inventory_module',
    'show_google_ratings',
    'show_opening_cash_banner',
    'show_version_notifications',
    'enable_realtime_refresh',
    'show_pending_approval_badge',
    'allow_discounts',
    'enable_addons',
    'enable_card_payments',
    'enable_cash_payments',
    'enable_gift_card_payments',
    'enable_mixed_payments',
    'enable_mixed_payment_methods',
    'allow_ticket_discounts',
    'auto_checkout_at_closing',
    'enable_realtime_queue',
    'filter_by_weekly_schedule',
    'show_queue_in_header',
    'enable_attendance_export',
    'enable_insights_dashboard',
    'show_completion_time_analysis',
    'show_detailed_tip_breakdown',
    'track_service_popularity',
    'enable_audit_logging',
    'allow_self_service_tickets',
    'enable_completion_tracking',
    'require_checkin_for_tickets',
    'require_customer_name',
    'require_customer_phone',
    'require_opening_cash',
    'show_ticket_activity_log',
    'require_customer_name_on_tickets',
    'require_customer_phone_on_tickets',
    'require_employee_checkin_before_tickets',
    'enable_ticket_notes',
    'show_ticket_timer_warnings'
  ];

  // Check if Sans Souci has all standard settings
  console.log('Checking for all standard settings in Sans Souci...\n');

  let allPresent = true;
  let missingCount = 0;
  const missing = [];

  standardSettings.forEach(key => {
    if (!ssMap.has(key)) {
      allPresent = false;
      missingCount++;
      missing.push(key);
    }
  });

  if (allPresent) {
    console.log('✅ SUCCESS: All 52 standard settings are present in Sans Souci!\n');
  } else {
    console.log(`❌ MISSING: ${missingCount} standard settings not found:`);
    missing.forEach(key => console.log(`  - ${key}`));
    console.log('');
  }

  // Check for legacy duplicates
  const legacySettings = [
    'admin_review_rejected_tickets',
    'auto_approve_after_48_hours',
    'enable_ticket_approval_system',
    'require_opening_cash_validation',
    'show_queue_button_in_header'
  ];

  const legacyPresent = legacySettings.filter(key => ssMap.has(key));

  if (legacyPresent.length > 0) {
    console.log(`⚠️  LEGACY DUPLICATES: ${legacyPresent.length} old settings still present (harmless):`);
    legacyPresent.forEach(key => console.log(`  - ${key}`));
    console.log('');
  }

  // Final summary
  console.log('=== FINAL SUMMARY ===');
  console.log(`Sans Souci Total Settings: ${ssSettings.length}`);
  console.log(`Standard Settings Present: ${standardSettings.filter(k => ssMap.has(k)).length} / ${standardSettings.length}`);
  console.log(`Legacy Duplicates: ${legacyPresent.length}`);
  console.log('');

  // Functional status
  if (allPresent) {
    console.log('✅ FUNCTIONAL STATUS: Sans Souci is FULLY OPERATIONAL');
    console.log('All required settings are in place. Store is ready for use.');
    if (legacyPresent.length > 0) {
      console.log('\nNote: Legacy duplicates are harmless and can be ignored.');
      console.log('They can be removed with admin privileges if desired.');
    }
  } else {
    console.log('❌ FUNCTIONAL STATUS: Additional settings needed');
    console.log(`Missing ${missingCount} required settings.`);
  }

  // Compare categories
  console.log('\n=== CATEGORY COVERAGE ===');
  const ssCategories = new Set(ssSettings.map(s => s.category));
  const rivCategories = new Set(rivSettings.map(s => s.category));

  console.log('Sans Souci Categories:', Array.from(ssCategories).sort().join(', '));
  console.log('\nOngles Rivieres Categories:', Array.from(rivCategories).sort().join(', '));

  const missingCategories = Array.from(rivCategories).filter(c => !ssCategories.has(c));
  if (missingCategories.length > 0) {
    console.log('\n⚠️  Missing Categories in Sans Souci:', missingCategories.join(', '));
  } else {
    console.log('\n✅ All categories present in Sans Souci');
  }
}

verifySettings().catch(console.error);
