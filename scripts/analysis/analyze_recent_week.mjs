import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function analyzeRecentWeek() {
  const dates = [
    '2025-12-08',
    '2025-12-09',
    '2025-12-10',
    '2025-12-11',
    '2025-12-12'
  ];
  
  console.log('=== TIP DATA ANALYSIS: DECEMBER 8-12, 2025 ===');
  console.log('(Most recent dates with complete data)');
  console.log('');
  
  const grandTotalByDate = new Map();
  
  for (const testDate of dates) {
    console.log('=== DATE:', testDate, '===');
    
    const { data: detailTickets } = await supabase
      .from('sale_tickets')
      .select('id, store:stores(name, code), ticket_items(employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name))')
      .eq('ticket_date', testDate);
    
    const detailTotals = new Map();
    let dateTotalCash = 0;
    let dateTotalCard = 0;
    let dateTotalAll = 0;
    
    for (const ticket of detailTickets || []) {
      for (const item of ticket.ticket_items || []) {
        const empId = item.employee_id;
        const empName = item.employee?.display_name || 'Unknown';
        
        if (!detailTotals.has(empId)) {
          detailTotals.set(empId, {
            name: empName,
            tips_cash: 0,
            tips_card: 0,
            tips_total: 0,
            services: 0
          });
        }
        
        const tipCustomerCash = item.tip_customer_cash || 0;
        const tipCustomerCard = item.tip_customer_card || 0;
        const tipReceptionist = item.tip_receptionist || 0;
        const tipCash = tipCustomerCash;
        const tipCard = tipCustomerCard + tipReceptionist;
        
        const totals = detailTotals.get(empId);
        totals.tips_cash += tipCash;
        totals.tips_card += tipCard;
        totals.tips_total += tipCash + tipCard;
        totals.services += 1;
        
        dateTotalCash += tipCash;
        dateTotalCard += tipCard;
        dateTotalAll += tipCash + tipCard;
      }
    }
    
    grandTotalByDate.set(testDate, {
      cash: dateTotalCash,
      card: dateTotalCard,
      total: dateTotalAll
    });
    
    console.log('Technicians:', detailTotals.size);
    
    if (detailTotals.size === 0) {
      console.log('  No tip data');
    } else {
      const sortedTechs = Array.from(detailTotals.entries())
        .sort((a, b) => a[1].name.localeCompare(b[1].name));
      
      for (const [empId, data] of sortedTechs) {
        console.log('  ' + data.name + ':');
        console.log('    Services: ' + data.services);
        console.log('    Cash: $' + data.tips_cash.toFixed(2));
        console.log('    Card: $' + data.tips_card.toFixed(2));
        console.log('    Total: $' + data.tips_total.toFixed(2));
      }
      
      console.log('  ---');
      console.log('  Day Total: Cash=$' + dateTotalCash.toFixed(2) + ', Card=$' + dateTotalCard.toFixed(2) + ', Total=$' + dateTotalAll.toFixed(2));
    }
    
    console.log('');
  }
  
  console.log('=== PERIOD SUMMARY ===');
  console.log('');
  let periodCash = 0;
  let periodCard = 0;
  let periodTotal = 0;
  
  for (const [date, totals] of grandTotalByDate.entries()) {
    console.log(date + ': Cash=$' + totals.cash.toFixed(2) + ', Card=$' + totals.card.toFixed(2) + ', Total=$' + totals.total.toFixed(2));
    periodCash += totals.cash;
    periodCard += totals.card;
    periodTotal += totals.total;
  }
  
  console.log('');
  console.log('PERIOD TOTALS (Dec 8-12):');
  console.log('  Cash: $' + periodCash.toFixed(2));
  console.log('  Card: $' + periodCard.toFixed(2));
  console.log('  Total: $' + periodTotal.toFixed(2));
  console.log('');
  console.log('Calculation Formula:');
  console.log('  Cash Tips = Customer Cash Tips');
  console.log('  Card Tips = Customer Card Tips + Receptionist Tips');
  console.log('  Total = Cash + Card');
}

analyzeRecentWeek().catch(console.error);
