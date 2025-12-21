import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function checkRawData() {
  console.log('=== CHECKING RAW DATA STRUCTURE ===');
  console.log('');
  
  // Check tickets
  const { data: tickets } = await supabase
    .from('sale_tickets')
    .select('id, ticket_date')
    .eq('ticket_date', '2025-12-10')
    .limit(5);
  
  console.log('Sample tickets for 2025-12-10:');
  console.log(tickets);
  console.log('');
  
  if (tickets && tickets.length > 0) {
    const ticketId = tickets[0].id;
    console.log('Checking ticket items for ticket:', ticketId);
    
    const { data: items } = await supabase
      .from('ticket_items')
      .select('*')
      .eq('sale_ticket_id', ticketId);
    
    console.log('Items:', items);
    console.log('');
  }
  
  // Check directly for any ticket items with tips
  const { data: itemsWithTips } = await supabase
    .from('ticket_items')
    .select('id, sale_ticket_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name)')
    .gte('tip_customer_cash', 0.01)
    .limit(5);
  
  console.log('Sample items with customer cash tips > 0:');
  console.log(itemsWithTips);
  console.log('');
  
  const { data: itemsWithCardTips } = await supabase
    .from('ticket_items')
    .select('id, sale_ticket_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name)')
    .gte('tip_customer_card', 0.01)
    .limit(5);
  
  console.log('Sample items with customer card tips > 0:');
  console.log(itemsWithCardTips);
  console.log('');
  
  const { data: itemsWithRecepTips } = await supabase
    .from('ticket_items')
    .select('id, sale_ticket_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name)')
    .gte('tip_receptionist', 0.01)
    .limit(5);
  
  console.log('Sample items with receptionist tips > 0:');
  console.log(itemsWithRecepTips);
}

checkRawData().catch(console.error);
