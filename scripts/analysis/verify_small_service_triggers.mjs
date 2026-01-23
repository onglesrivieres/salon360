/**
 * Verify Small Service Trigger Functions
 *
 * Run with: node scripts/analysis/verify_small_service_triggers.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Verifying Small Service Trigger Functions\n');

  // Check trigger functions via pg_proc
  const { data: functions, error } = await supabase
    .from('pg_proc')
    .select('proname, prosrc')
    .in('proname', [
      'trigger_mark_technician_busy',
      'trigger_mark_technician_busy_on_update',
      'trigger_mark_technicians_available',
      'mark_technician_busy_smart',
      'handle_ticket_close_smart',
      'is_last_in_ready_queue'
    ]);

  if (error) {
    console.log('Cannot query pg_proc directly (expected with anon key)');
    console.log('Checking function behavior instead...\n');

    // Alternative: Check if functions are callable
    const testFunctions = [
      { name: 'mark_technician_busy_smart', params: { p_employee_id: '00000000-0000-0000-0000-000000000000', p_ticket_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'handle_ticket_close_smart', params: { p_ticket_id: '00000000-0000-0000-0000-000000000000' } },
      { name: 'is_last_in_ready_queue', params: { p_employee_id: '00000000-0000-0000-0000-000000000000', p_store_id: '00000000-0000-0000-0000-000000000000' } }
    ];

    for (const fn of testFunctions) {
      const { error: fnError } = await supabase.rpc(fn.name, fn.params);
      if (fnError && fnError.message.includes('does not exist')) {
        console.log(`❌ ${fn.name} - NOT FOUND`);
      } else {
        console.log(`✅ ${fn.name} - EXISTS (callable)`);
      }
    }

    return;
  }

  // If we can read pg_proc
  console.log('Functions found:');
  for (const fn of functions || []) {
    console.log(`\n--- ${fn.proname} ---`);
    console.log(fn.prosrc.substring(0, 500) + '...');
  }
}

main().catch(console.error);
