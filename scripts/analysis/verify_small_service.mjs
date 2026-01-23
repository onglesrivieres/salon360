/**
 * Verify Small Service Rules in Queue Management
 *
 * Run with: node scripts/analysis/verify_small_service.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCheck(name, query, validator) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CHECK: ${name}`);
  console.log('='.repeat(60));

  const { data, error } = await supabase.rpc('exec_sql', { sql: query }).single();

  if (error) {
    // Try direct query if RPC not available
    const result = await supabase.from('_placeholder').select('*').limit(0);
    console.log('⚠️  Cannot run arbitrary SQL via RPC. Using alternative methods...');
    return false;
  }

  return validator(data);
}

async function main() {
  console.log('🔍 Verifying Small Service Rules in Queue Management\n');
  console.log('Supabase URL:', supabaseUrl);

  let allPassed = true;

  // Check 1: Verify threshold setting exists
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 1: Small Service Threshold Setting');
  console.log('='.repeat(60));

  const { data: thresholdData, error: thresholdError } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'small_service_threshold');

  if (thresholdError) {
    console.log('❌ Error querying threshold:', thresholdError.message);
    allPassed = false;
  } else if (thresholdData.length === 0) {
    console.log('⚠️  No threshold setting found - will use default of $30');
  } else {
    console.log('✅ Threshold settings found:');
    thresholdData.forEach(row => {
      console.log(`   Store threshold: $${row.setting_value}`);
    });
  }

  // Check 2: Verify queue status constraint allows small_service
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 2: Queue Status Values in Use');
  console.log('='.repeat(60));

  const { data: queueData, error: queueError } = await supabase
    .from('technician_ready_queue')
    .select('status')
    .limit(100);

  if (queueError) {
    console.log('❌ Error querying queue:', queueError.message);
    allPassed = false;
  } else {
    const statuses = [...new Set(queueData.map(r => r.status))];
    console.log('✅ Current queue statuses in use:', statuses.join(', ') || '(empty queue)');

    // Try to check if small_service is allowed by looking at any with that status
    const hasSmallService = statuses.includes('small_service');
    if (hasSmallService) {
      console.log('✅ small_service status is being used');
    } else {
      console.log('ℹ️  No technicians currently in small_service status (this is normal if no small services active)');
    }
  }

  // Check 3: Test calling the small service functions
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 3: Small Service Functions');
  console.log('='.repeat(60));

  // Test get_small_service_threshold
  const { data: storeData } = await supabase
    .from('stores')
    .select('id')
    .limit(1)
    .single();

  if (storeData) {
    const { data: thresholdResult, error: thresholdFnError } = await supabase
      .rpc('get_small_service_threshold', { p_store_id: storeData.id });

    if (thresholdFnError) {
      console.log('❌ get_small_service_threshold function error:', thresholdFnError.message);
      if (thresholdFnError.message.includes('does not exist')) {
        console.log('   ⚠️  Function may not be deployed!');
        allPassed = false;
      }
    } else {
      console.log(`✅ get_small_service_threshold works - returns: $${thresholdResult}`);
    }

    // Test calculate_ticket_total with a recent ticket
    const { data: ticketData } = await supabase
      .from('sale_tickets')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (ticketData) {
      const { data: totalResult, error: totalFnError } = await supabase
        .rpc('calculate_ticket_total', { p_ticket_id: ticketData.id });

      if (totalFnError) {
        console.log('❌ calculate_ticket_total function error:', totalFnError.message);
        if (totalFnError.message.includes('does not exist')) {
          console.log('   ⚠️  Function may not be deployed!');
          allPassed = false;
        }
      } else {
        console.log(`✅ calculate_ticket_total works - sample ticket total: $${totalResult}`);
      }
    }
  }

  // Check 4: Verify get_sorted_technicians_for_store returns small_service status
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 4: Queue Display Function');
  console.log('='.repeat(60));

  if (storeData) {
    const today = new Date().toISOString().split('T')[0];
    const { data: sortedTechs, error: sortedError } = await supabase
      .rpc('get_sorted_technicians_for_store', {
        p_store_id: storeData.id,
        p_date: today
      });

    if (sortedError) {
      console.log('❌ get_sorted_technicians_for_store error:', sortedError.message);
      allPassed = false;
    } else {
      console.log(`✅ get_sorted_technicians_for_store works - returned ${sortedTechs?.length || 0} technicians`);

      // Check if any have small_service status
      const smallServiceTechs = sortedTechs?.filter(t => t.queue_status === 'small_service') || [];
      if (smallServiceTechs.length > 0) {
        console.log(`   Found ${smallServiceTechs.length} technician(s) in small_service status`);
      }

      // Check status distribution
      const statusCounts = {};
      (sortedTechs || []).forEach(t => {
        statusCounts[t.queue_status] = (statusCounts[t.queue_status] || 0) + 1;
      });
      console.log('   Status distribution:', statusCounts);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  if (allPassed) {
    console.log('✅ All small service functions appear to be deployed and working!');
  } else {
    console.log('❌ Some checks failed - see above for details');
  }

  console.log('\nNote: To verify triggers, you would need to:');
  console.log('1. Create a ticket with total < threshold');
  console.log('2. Assign it to the LAST technician in the queue');
  console.log('3. Verify they get small_service (yellow) status');
  console.log('4. Complete the ticket and verify they return to ready status');
}

main().catch(console.error);
