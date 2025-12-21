import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

const onglesRivieresId = '090391d3-0899-4947-8735-c0bfe8dbe0e4';
const weekStart = '2025-12-15';
const weekEnd = '2025-12-21';

console.log('Fetching weekly data for Ongles Rivieres (OR)...');
console.log(`Week: ${weekStart} to ${weekEnd}\n`);

const { data: tickets, error } = await supabase
  .from('sale_tickets')
  .select(`
    id,
    ticket_date,
    store_id,
    store:stores!sale_tickets_store_id_fkey(id, name, code),
    ticket_items (
      id,
      employee_id,
      tip_customer_cash,
      tip_customer_card,
      tip_receptionist,
      employee:employees!ticket_items_employee_id_fkey(
        id,
        display_name
      )
    )
  `)
  .gte('ticket_date', weekStart)
  .lte('ticket_date', weekEnd)
  .eq('store_id', onglesRivieresId);

if (error) {
  console.error('Error fetching data:', error);
  process.exit(1);
}

console.log(`Total tickets: ${tickets?.length || 0}\n`);

// Group data by technician -> date
const dataMap = new Map();

for (const ticket of tickets || []) {
  const ticketDate = ticket.ticket_date;
  const storeCode = ticket.store?.code || '';

  for (const item of ticket.ticket_items || []) {
    const techId = item.employee_id;
    const technician = item.employee;

    if (!technician) continue;

    if (!dataMap.has(techId)) {
      dataMap.set(techId, {
        name: technician.display_name,
        dates: new Map()
      });
    }

    const techData = dataMap.get(techId);
    if (!techData.dates.has(ticketDate)) {
      techData.dates.set(ticketDate, {
        tips_cash: 0,
        tips_card: 0,
        tips_total: 0
      });
    }

    const dateData = techData.dates.get(ticketDate);
    const tipCustomerCash = item.tip_customer_cash || 0;
    const tipCustomerCard = item.tip_customer_card || 0;
    const tipReceptionist = item.tip_receptionist || 0;
    const tipCash = tipCustomerCash;
    const tipCard = tipCustomerCard + tipReceptionist;
    const tipTotal = tipCash + tipCard;

    dateData.tips_cash += tipCash;
    dateData.tips_card += tipCard;
    dateData.tips_total += tipTotal;
  }
}

console.log('=== WEEKLY TIP BREAKDOWN BY TECHNICIAN ===\n');

for (const [techId, techData] of dataMap.entries()) {
  console.log(`\n${techData.name}:`);

  let weeklyTotal = 0;
  const dates = ['2025-12-15', '2025-12-16', '2025-12-17', '2025-12-18', '2025-12-19', '2025-12-20', '2025-12-21'];

  for (const date of dates) {
    const dayData = techData.dates.get(date);
    if (dayData) {
      console.log(`  ${date}: $${dayData.tips_total.toFixed(2)} (Cash: $${dayData.tips_cash.toFixed(2)}, Card: $${dayData.tips_card.toFixed(2)})`);
      weeklyTotal += dayData.tips_total;
    } else {
      console.log(`  ${date}: $0.00`);
    }
  }

  console.log(`  ---`);
  console.log(`  Weekly Total: $${weeklyTotal.toFixed(2)}`);
}

console.log('\n=== VERIFICATION COMPLETE ===');
