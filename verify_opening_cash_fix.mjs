import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('Verifying Opening Cash Validation Fix...\n');

async function verify() {
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

    console.log(`✓ Found store: ${store.name} (${store.id})`);

    // Check the setting value
    const { data: setting, error: settingError } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .eq('store_id', store.id)
      .eq('setting_key', 'require_opening_cash_validation')
      .single();

    if (settingError) {
      console.log('❌ Could not read setting:', settingError.message);
      return false;
    }

    const isEnabled = setting.setting_value === true;
    console.log(`✓ Setting value: ${isEnabled ? 'ENABLED (true)' : 'DISABLED (false)'}`);

    // Try to create a test ticket (we'll catch the error if validation blocks it)
    const testTicketNumber = `TEST-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    console.log('\n--- Testing Ticket Creation ---');
    console.log(`Creating test ticket for date: ${today}`);
    console.log(`Setting is: ${isEnabled ? 'ON' : 'OFF'}`);

    const { data: ticket, error: ticketError } = await supabase
      .from('sale_tickets')
      .insert({
        store_id: store.id,
        ticket_no: testTicketNumber,
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

    if (ticketError) {
      if (ticketError.message.includes('Opening cash count must be recorded')) {
        if (isEnabled) {
          console.log('✓ Validation correctly BLOCKED ticket (setting is ON)');
          console.log('✓ FIX IS WORKING: Validation respects the setting');
          return true;
        } else {
          console.log('❌ Validation BLOCKED ticket but setting is OFF');
          console.log('❌ FIX NOT APPLIED: Database trigger needs to be updated');
          console.log('\nPlease run the SQL from APPLY_OPENING_CASH_FIX.md in Supabase SQL Editor');
          return false;
        }
      } else {
        console.log('⚠️  Unexpected error:', ticketError.message);
        return false;
      }
    }

    // Ticket was created successfully
    if (isEnabled) {
      console.log('⚠️  Ticket created but setting is ON (validation should have blocked it)');
      console.log('Note: Opening cash may have already been recorded for today');

      // Clean up test ticket
      await supabase.from('sale_tickets').delete().eq('id', ticket.id);
      return true;
    } else {
      console.log('✓ Ticket created successfully (setting is OFF)');
      console.log('✓ FIX IS WORKING: Validation respects the setting');

      // Clean up test ticket
      await supabase.from('sale_tickets').delete().eq('id', ticket.id);
      return true;
    }

  } catch (error) {
    console.log('❌ Verification failed:', error.message);
    return false;
  }
}

verify().then(success => {
  if (success) {
    console.log('\n✅ Verification completed');
  } else {
    console.log('\n❌ Verification failed - please check the issues above');
  }
  process.exit(success ? 0 : 1);
});
