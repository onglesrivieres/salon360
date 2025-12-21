import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function simpleCheck() {
  console.log('=== SIMPLE DATA CHECK ===');
  console.log('');
  
  // First, get count of tickets in December
  const { count: ticketCount } = await supabase
    .from('sale_tickets')
    .select('*', { count: 'exact', head: true })
    .gte('ticket_date', '2025-12-01')
    .lte('ticket_date', '2025-12-31');
  
  console.log('Tickets in December 2025:', ticketCount);
  
  // Get sample tickets
  const { data: sampleTickets } = await supabase
    .from('sale_tickets')
    .select('id, ticket_date')
    .gte('ticket_date', '2025-12-01')
    .lte('ticket_date', '2025-12-31')
    .limit(10);
  
  console.log('Sample ticket IDs:', sampleTickets?.map(t => t.id).slice(0, 3));
  console.log('');
  
  if (sampleTickets && sampleTickets.length > 0) {
    const ticketId = sampleTickets[0].id;
    console.log('Checking items for ticket:', ticketId);
    
    // Get items for this ticket
    const { data: items, error } = await supabase
      .from('ticket_items')
      .select('id, employee_id, tip_customer_cash, tip_customer_card, tip_receptionist')
      .eq('sale_ticket_id', ticketId);
    
    if (error) {
      console.log('Error:', error);
    } else {
      console.log('Items count:', items?.length);
      if (items && items.length > 0) {
        console.log('First item:', items[0]);
        console.log('  tip_customer_cash:', items[0].tip_customer_cash);
        console.log('  tip_customer_card:', items[0].tip_customer_card);
        console.log('  tip_receptionist:', items[0].tip_receptionist);
      }
    }
  }
  
  console.log('');
  console.log('=== CHECKING ALL ITEMS IN DECEMBER ===');
  
  // Get all items for December tickets
  const { data: allItems } = await supabase
    .from('ticket_items')
    .select(`
      id,
      tip_customer_cash,
      tip_customer_card,
      tip_receptionist,
      sale_ticket:sale_tickets!inner(ticket_date)
    `)
    .gte('sale_ticket.ticket_date', '2025-12-01')
    .lte('sale_ticket.ticket_date', '2025-12-31')
    .limit(100);
  
  console.log('Items found:', allItems?.length || 0);
  
  if (allItems && allItems.length > 0) {
    let itemsWithTips = 0;
    let totalTips = 0;
    
    for (const item of allItems) {
      const tipTotal = (parseFloat(item.tip_customer_cash) || 0) + 
                      (parseFloat(item.tip_customer_card) || 0) + 
                      (parseFloat(item.tip_receptionist) || 0);
      if (tipTotal > 0) {
        itemsWithTips++;
        totalTips += tipTotal;
      }
    }
    
    console.log('Items with tips > 0:', itemsWithTips);
    console.log('Total tips in sample:', '$' + totalTips.toFixed(2));
  }
}

simpleCheck().catch(console.error);
