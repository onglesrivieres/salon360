import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function findTipData() {
  console.log('=== FINDING DATES WITH TIP DATA ===');
  console.log('');
  
  const { data: tickets } = await supabase
    .from('sale_tickets')
    .select('ticket_date, store:stores(name, code), ticket_items(tip_customer_cash, tip_customer_card, tip_receptionist)')
    .order('ticket_date', { ascending: false })
    .limit(100);
  
  const dateStats = new Map();
  
  for (const ticket of tickets || []) {
    const date = ticket.ticket_date;
    const storeName = ticket.store?.name || 'Unknown';
    
    if (!dateStats.has(date)) {
      dateStats.set(date, { stores: new Set(), totalTips: 0, ticketCount: 0 });
    }
    
    const stats = dateStats.get(date);
    stats.stores.add(storeName);
    stats.ticketCount++;
    
    for (const item of ticket.ticket_items || []) {
      const tips = (item.tip_customer_cash || 0) + (item.tip_customer_card || 0) + (item.tip_receptionist || 0);
      stats.totalTips += tips;
    }
  }
  
  console.log('Recent dates with tip data:');
  const sortedDates = Array.from(dateStats.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 15);
  
  for (const [date, stats] of sortedDates) {
    if (stats.totalTips > 0) {
      console.log(date + ': ' + stats.ticketCount + ' tickets, $' + stats.totalTips.toFixed(2) + ' tips, Stores: ' + Array.from(stats.stores).join(', '));
    }
  }
}

findTipData().catch(console.error);
