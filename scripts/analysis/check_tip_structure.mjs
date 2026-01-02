import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function checkStructure() {
  console.log('=== CHECKING TIP DATA STRUCTURE ===');
  console.log('');
  
  const { data, error } = await supabase
    .from('sale_tickets')
    .select('id, ticket_date, ticket_items(id, tip_customer_cash, tip_customer_card, tip_receptionist, employee_id)')
    .eq('ticket_date', '2025-12-20')
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Found', data?.length || 0, 'tickets');
  console.log('');
  
  if (data && data.length > 0) {
    for (let i = 0; i < Math.min(3, data.length); i++) {
      const ticket = data[i];
      console.log('Ticket', i + 1, ':', ticket.id);
      console.log('  Date:', ticket.ticket_date);
      console.log('  Items:', ticket.ticket_items?.length || 0);
      
      if (ticket.ticket_items && ticket.ticket_items.length > 0) {
        for (const item of ticket.ticket_items) {
          console.log('    Item:', item.id);
          console.log('      Employee ID:', item.employee_id);
          console.log('      Tip Customer Cash:', item.tip_customer_cash);
          console.log('      Tip Customer Card:', item.tip_customer_card);
          console.log('      Tip Receptionist:', item.tip_receptionist);
        }
      }
      console.log('');
    }
  } else {
    console.log('No tickets found for 2025-12-20');
  }
  
  console.log('Checking recent tickets with any tips...');
  const { data: recentTips } = await supabase
    .from('ticket_items')
    .select('id, tip_customer_cash, tip_customer_card, tip_receptionist, employee_id, sale_tickets!inner(ticket_date)')
    .or('tip_customer_cash.gt.0,tip_customer_card.gt.0,tip_receptionist.gt.0')
    .order('sale_tickets(ticket_date)', { ascending: false })
    .limit(10);
  
  console.log('');
  console.log('Recent tips from ticket_items:');
  if (recentTips && recentTips.length > 0) {
    for (const item of recentTips.slice(0, 5)) {
      console.log('  Date:', item.sale_tickets?.ticket_date);
      console.log('  Employee ID:', item.employee_id);
      console.log('  Tips: Cash=$' + (item.tip_customer_cash || 0) + ', Card=$' + (item.tip_customer_card || 0) + ', Recept=$' + (item.tip_receptionist || 0));
      console.log('');
    }
  } else {
    console.log('  No recent tips found');
  }
}

checkStructure().catch(console.error);
