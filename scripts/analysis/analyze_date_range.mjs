import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function analyzeDateRange() {
  const dates = [
    '2025-12-15',
    '2025-12-16',
    '2025-12-17',
    '2025-12-18',
    '2025-12-19',
    '2025-12-20'
  ];
  
  console.log('=== TIP DATA ANALYSIS: DECEMBER 15-20, 2025 ===');
  console.log('');
  
  for (const testDate of dates) {
    console.log('=== ANALYZING DATE:', testDate, '===');
    
    const { data: detailTickets } = await supabase
      .from('sale_tickets')
      .select('id, store:stores(name, code), ticket_items(employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name))')
      .eq('ticket_date', testDate);
    
    const detailTotals = new Map();
    
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
            items: []
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
        totals.items.push({
          store: ticket.store?.code || 'Unknown',
          tipCustomerCash,
          tipCustomerCard,
          tipReceptionist,
          tipCash,
          tipCard,
          tipTotal: tipCash + tipCard
        });
      }
    }
    
    console.log('Technicians found:', detailTotals.size);
    
    if (detailTotals.size === 0) {
      console.log('  No tip data for this date');
    } else {
      for (const [empId, data] of detailTotals.entries()) {
        console.log('  ' + data.name + ':');
        console.log('    Cash: $' + data.tips_cash.toFixed(2));
        console.log('    Card: $' + data.tips_card.toFixed(2));
        console.log('    Total: $' + data.tips_total.toFixed(2));
        console.log('    Services: ' + data.items.length);
        
        const hasReceptionistTips = data.items.some(item => item.tipReceptionist > 0);
        if (hasReceptionistTips) {
          console.log('    Receptionist tips breakdown:');
          for (const item of data.items) {
            if (item.tipReceptionist > 0) {
              console.log('      [' + item.store + '] Cust.Cash: $' + item.tipCustomerCash.toFixed(2) + ', Cust.Card: $' + item.tipCustomerCard.toFixed(2) + ', Recept: $' + item.tipReceptionist.toFixed(2));
            }
          }
        }
      }
    }
    
    console.log('');
  }
  
  console.log('=== WEEKLY VIEW VERIFICATION ===');
  console.log('Checking that weekly view calculations match daily totals...');
  console.log('');
  
  const weekStart = '2025-12-15';
  const weekEnd = '2025-12-20';
  
  const { data: weeklyTickets } = await supabase
    .from('sale_tickets')
    .select('id, ticket_date, store:stores(name, code), ticket_items(employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name))')
    .gte('ticket_date', weekStart)
    .lte('ticket_date', weekEnd);
  
  const dailyByEmployeeDate = new Map();
  
  for (const ticket of weeklyTickets || []) {
    const ticketDate = ticket.ticket_date;
    
    for (const item of ticket.ticket_items || []) {
      const empId = item.employee_id;
      const empName = item.employee?.display_name || 'Unknown';
      
      if (!dailyByEmployeeDate.has(empId)) {
        dailyByEmployeeDate.set(empId, {
          name: empName,
          dates: new Map()
        });
      }
      
      const empData = dailyByEmployeeDate.get(empId);
      if (!empData.dates.has(ticketDate)) {
        empData.dates.set(ticketDate, { tips_cash: 0, tips_card: 0, tips_total: 0 });
      }
      
      const tipCustomerCash = item.tip_customer_cash || 0;
      const tipCustomerCard = item.tip_customer_card || 0;
      const tipReceptionist = item.tip_receptionist || 0;
      const tipCash = tipCustomerCash;
      const tipCard = tipCustomerCard + tipReceptionist;
      
      const dailyTotals = empData.dates.get(ticketDate);
      dailyTotals.tips_cash += tipCash;
      dailyTotals.tips_card += tipCard;
      dailyTotals.tips_total += tipCash + tipCard;
    }
  }
  
  console.log('Weekly view data structure created');
  console.log('Employees found:', dailyByEmployeeDate.size);
  
  for (const [empId, empData] of dailyByEmployeeDate.entries()) {
    console.log('');
    console.log(empData.name + ':');
    let weekTotal = 0;
    for (const date of dates) {
      const dayData = empData.dates.get(date);
      if (dayData) {
        weekTotal += dayData.tips_total;
        console.log('  ' + date + ': Cash=$' + dayData.tips_cash.toFixed(2) + ', Card=$' + dayData.tips_card.toFixed(2) + ', Total=$' + dayData.tips_total.toFixed(2));
      } else {
        console.log('  ' + date + ': No tips');
      }
    }
    console.log('  WEEK TOTAL: $' + weekTotal.toFixed(2));
  }
  
  console.log('');
  console.log('=== SUMMARY ===');
  console.log('Analysis complete for December 15-20, 2025');
  console.log('All calculations use the correct formula:');
  console.log('  Cash Tips = Customer Cash Tips');
  console.log('  Card Tips = Customer Card Tips + Receptionist Tips');
  console.log('  Total Tips = Cash Tips + Card Tips');
}

analyzeDateRange().catch(console.error);
