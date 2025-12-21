import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function checkAvailableDates() {
  console.log('=== CHECKING AVAILABLE TIP DATA DATES ===');
  console.log('');
  
  const { data: tickets, error } = await supabase
    .from('sale_tickets')
    .select('ticket_date, ticket_items!inner(tip_customer_cash, tip_customer_card, tip_receptionist)')
    .order('ticket_date', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const dateSet = new Set();
  const dateSummary = new Map();
  
  for (const ticket of tickets || []) {
    dateSet.add(ticket.ticket_date);
    
    if (!dateSummary.has(ticket.ticket_date)) {
      dateSummary.set(ticket.ticket_date, {
        ticketCount: 0,
        totalTips: 0
      });
    }
    
    const summary = dateSummary.get(ticket.ticket_date);
    summary.ticketCount += 1;
    
    for (const item of ticket.ticket_items || []) {
      const tipTotal = (item.tip_customer_cash || 0) + (item.tip_customer_card || 0) + (item.tip_receptionist || 0);
      summary.totalTips += tipTotal;
    }
  }
  
  const sortedDates = Array.from(dateSet).sort().reverse();
  
  console.log('Found tip data for', sortedDates.length, 'dates');
  console.log('');
  console.log('Most recent 20 dates with tip data:');
  
  for (const date of sortedDates.slice(0, 20)) {
    const summary = dateSummary.get(date);
    console.log('  ' + date + ': ' + summary.ticketCount + ' tickets, $' + summary.totalTips.toFixed(2) + ' in tips');
  }
  
  if (sortedDates.length > 0) {
    console.log('');
    console.log('Latest date with data:', sortedDates[0]);
    console.log('Oldest date checked:', sortedDates[sortedDates.length - 1]);
  }
}

checkAvailableDates().catch(console.error);
