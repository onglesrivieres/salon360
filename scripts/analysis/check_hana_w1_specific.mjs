import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function checkHanaW1() {
  console.log('===== HANA W1 TIPS ANALYSIS =====');
  console.log('');
  console.log('Week boundaries:');
  console.log('  App definition (W1): Dec 30, 2025 (Mon) - Jan 5, 2026 (Sun)');
  console.log('  User requested: Dec 29, 2025 (Sun) - Jan 4, 2026 (Sat)');
  console.log('');

  // Find Hana employee
  const { data: hanaEmployee } = await supabase
    .from('employees')
    .select('id, display_name')
    .ilike('display_name', '%hana%')
    .single();

  if (!hanaEmployee) {
    console.log('Hana not found');
    return;
  }

  // Find Ongles Maily store
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, code')
    .ilike('name', '%Ongles Maily%')
    .single();

  if (!store) {
    console.log('Store not found');
    return;
  }

  // Check Dec 29 separately
  console.log('1. CHECKING DEC 29, 2025 (SUNDAY):');
  const { data: dec29Items } = await supabase
    .from('ticket_items')
    .select(`
      id,
      tip_customer_cash,
      tip_customer_card,
      tip_receptionist,
      sale_ticket:sale_tickets (
        ticket_no,
        ticket_date,
        store_id
      )
    `)
    .eq('employee_id', hanaEmployee.id)
    .eq('sale_ticket.ticket_date', '2025-12-29')
    .eq('sale_ticket.store_id', store.id);

  let dec29Total = 0;
  if (dec29Items && dec29Items.length > 0) {
    for (const item of dec29Items) {
      const tipCash = parseFloat(item.tip_customer_cash) || 0;
      const tipCard = parseFloat(item.tip_customer_card) || 0;
      const tipReceptionist = parseFloat(item.tip_receptionist) || 0;
      const itemTotal = tipCash + tipCard + tipReceptionist;
      if (itemTotal > 0) {
        dec29Total += itemTotal;
        console.log(`  ${item.sale_ticket.ticket_no}: $${itemTotal.toFixed(2)}`);
      }
    }
  }
  console.log(`  Dec 29 Total: $${dec29Total.toFixed(2)}`);
  console.log('');

  // Get Dec 30 - Jan 4 (from the script output)
  console.log('2. DEC 30, 2025 - JAN 4, 2026 (from previous query):');
  console.log('  From investigate_missing_tips.mjs output: $220.00');
  console.log('');

  console.log('3. JAN 5, 2026 CHECK:');
  const { data: jan5Items } = await supabase
    .from('ticket_items')
    .select(`
      id,
      tip_customer_cash,
      tip_customer_card,
      tip_receptionist,
      sale_ticket:sale_tickets (
        ticket_no,
        ticket_date,
        store_id
      )
    `)
    .eq('employee_id', hanaEmployee.id)
    .eq('sale_ticket.ticket_date', '2026-01-05')
    .eq('sale_ticket.store_id', store.id);

  let jan5Total = 0;
  if (jan5Items && jan5Items.length > 0) {
    for (const item of jan5Items) {
      const tipCash = parseFloat(item.tip_customer_cash) || 0;
      const tipCard = parseFloat(item.tip_customer_card) || 0;
      const tipReceptionist = parseFloat(item.tip_receptionist) || 0;
      const itemTotal = tipCash + tipCard + tipReceptionist;
      if (itemTotal > 0) {
        jan5Total += itemTotal;
        console.log(`  ${item.sale_ticket.ticket_no}: $${itemTotal.toFixed(2)}`);
      }
    }
  }
  console.log(`  Jan 5 Total: $${jan5Total.toFixed(2)}`);
  console.log('');

  console.log('4. SUMMARY:');
  console.log(`  Dec 29 (Sun): $${dec29Total.toFixed(2)}`);
  console.log(`  Dec 30 - Jan 4 (Mon-Sat): $220.00`);
  console.log(`  Jan 5 (Sun): $${jan5Total.toFixed(2)}`);
  console.log('');
  
  const userRequestedTotal = dec29Total + 220.00;
  const appW1Total = 220.00 + jan5Total;

  console.log('COMPARISON:');
  console.log(`  User requested (Dec 29 - Jan 4): $${userRequestedTotal.toFixed(2)}`);
  console.log(`  App W1 definition (Dec 30 - Jan 5): $${appW1Total.toFixed(2)}`);
  console.log(`  Expected from app: $260.00`);
  console.log('');
  
  const appDiff = (260 - appW1Total).toFixed(2);
  const userDiff = (260 - userRequestedTotal).toFixed(2);
  
  console.log(`  Difference (app W1): $${appDiff}`);
  console.log(`  Difference (user requested): $${userDiff}`);
}

checkHanaW1().catch(console.error);
