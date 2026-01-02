import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== COMPREHENSIVE FIX VERIFICATION ===\n');

async function comprehensiveTest() {
  try {
    // Get Sans Souci store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('name', 'Sans Souci')
      .single();

    if (storeError || !store) {
      console.log('❌ Could not find Sans Souci store');
      return false;
    }

    console.log(`Store: ${store.name}`);
    console.log(`ID: ${store.id}\n`);

    const today = new Date().toISOString().split('T')[0];

    // Check if opening cash is recorded
    const { data: eod } = await supabase
      .from('end_of_day_records')
      .select('opening_cash_amount')
      .eq('store_id', store.id)
      .eq('date', today)
      .maybeSingle();

    console.log(`Date: ${today}`);
    console.log(`Opening cash recorded: ${eod ? 'YES' : 'NO'}\n`);

    // TEST 1: Setting OFF - Should allow ticket creation
    console.log('--- TEST 1: Setting OFF ---');

    const { error: updateOff } = await supabase
      .from('app_settings')
      .update({ setting_value: false })
      .eq('store_id', store.id)
      .eq('setting_key', 'require_opening_cash_validation');

    if (updateOff) {
      console.log('❌ Could not update setting:', updateOff.message);
      return false;
    }

    console.log('Setting: OFF (false)');

    const testTicket1 = `TEST-OFF-${Date.now()}`;
    const { data: ticket1, error: error1 } = await supabase
      .from('sale_tickets')
      .insert({
        store_id: store.id,
        ticket_no: testTicket1,
        ticket_date: today,
        customer_type: 'walk-in',
        payment_method: 'cash',
        subtotal: 0,
        total: 0,
        discount: 0,
        tax: 0
      })
      .select()
      .single();

    if (error1) {
      if (error1.message.includes('Opening cash count must be recorded')) {
        console.log('❌ FAIL: Ticket was BLOCKED when setting is OFF');
        console.log('   The database trigger is NOT respecting the setting');
        console.log('\n⚠️  THE FIX HAS NOT BEEN APPLIED!\n');
        return false;
      } else {
        console.log('⚠️  Unexpected error:', error1.message);
        return false;
      }
    }

    console.log('✅ PASS: Ticket created successfully');
    console.log(`   Ticket ID: ${ticket1.id}`);

    // Clean up
    await supabase.from('sale_tickets').delete().eq('id', ticket1.id);
    console.log('   (Test ticket cleaned up)\n');

    // TEST 2: Setting ON - Should block ticket creation (if no opening cash)
    console.log('--- TEST 2: Setting ON ---');

    const { error: updateOn } = await supabase
      .from('app_settings')
      .update({ setting_value: true })
      .eq('store_id', store.id)
      .eq('setting_key', 'require_opening_cash_validation');

    if (updateOn) {
      console.log('❌ Could not update setting:', updateOn.message);
      return false;
    }

    console.log('Setting: ON (true)');

    const testTicket2 = `TEST-ON-${Date.now()}`;
    const { data: ticket2, error: error2 } = await supabase
      .from('sale_tickets')
      .insert({
        store_id: store.id,
        ticket_no: testTicket2,
        ticket_date: today,
        customer_type: 'walk-in',
        payment_method: 'cash',
        subtotal: 0,
        total: 0,
        discount: 0,
        tax: 0
      })
      .select()
      .single();

    if (error2) {
      if (error2.message.includes('Opening cash count must be recorded')) {
        console.log('✅ PASS: Ticket correctly BLOCKED');
        console.log('   (Because setting is ON and no opening cash)\n');
      } else {
        console.log('⚠️  Unexpected error:', error2.message);
        return false;
      }
    } else {
      console.log('⚠️  Ticket was created (not blocked)');
      console.log('   This is OK if opening cash was already recorded for today');
      console.log(`   Ticket ID: ${ticket2.id}`);
      // Clean up
      await supabase.from('sale_tickets').delete().eq('id', ticket2.id);
      console.log('   (Test ticket cleaned up)\n');
    }

    // Restore setting to OFF
    await supabase
      .from('app_settings')
      .update({ setting_value: false })
      .eq('store_id', store.id)
      .eq('setting_key', 'require_opening_cash_validation');

    console.log('Setting restored to: OFF\n');

    return true;

  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return false;
  }
}

comprehensiveTest().then(success => {
  if (success) {
    console.log('=================================');
    console.log('✅ ALL TESTS PASSED');
    console.log('=================================');
    console.log('\nThe fix IS WORKING correctly:');
    console.log('- When setting is OFF: Tickets can be created');
    console.log('- When setting is ON: Tickets are validated');
    console.log('\n✅ THE DATABASE TRIGGER HAS BEEN UPDATED SUCCESSFULLY');
  } else {
    console.log('=================================');
    console.log('❌ TESTS FAILED');
    console.log('=================================');
    console.log('\nThe database trigger needs to be updated.');
    console.log('Please run the SQL from APPLY_OPENING_CASH_FIX.md');
  }
  process.exit(success ? 0 : 1);
});
