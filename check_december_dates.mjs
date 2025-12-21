import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function checkDecemberDates() {
  console.log('=== CHECKING DECEMBER 2025 TIP DATA ===');
  console.log('');
  
  const { data: allDates, error } = await supabase
    .from('sale_tickets')
    .select('ticket_date')
    .gte('ticket_date', '2025-12-01')
    .lte('ticket_date', '2025-12-31')
    .order('ticket_date', { ascending: true });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const dateSet = new Set(allDates.map(d => d.ticket_date));
  const sortedDates = Array.from(dateSet).sort();
  
  console.log('Dates with ticket data in December 2025:');
  for (const date of sortedDates) {
    console.log('  ' + date);
  }
  
  console.log('');
  console.log('Total dates with data:', sortedDates.length);
  
  const requestedDates = ['2025-12-15', '2025-12-16', '2025-12-17', '2025-12-18', '2025-12-19', '2025-12-20'];
  console.log('');
  console.log('Status of requested dates (Dec 15-20):');
  for (const date of requestedDates) {
    console.log('  ' + date + ': ' + (dateSet.has(date) ? 'HAS DATA' : 'NO DATA'));
  }
}

checkDecemberDates().catch(console.error);
