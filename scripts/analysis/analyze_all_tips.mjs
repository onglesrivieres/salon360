import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function analyzeTipData() {
  const testDate = '2025-12-20';
  const weekStart = getWeekStartDate(testDate);
  const weekDates = getWeekDates(weekStart);
  const weekEnd = weekDates[weekDates.length - 1];
  
  console.log('=== TIP REPORT DATA ANALYSIS ===');
  console.log('Selected Date:', testDate);
  console.log('Week Range:', weekStart, 'to', weekEnd);
  console.log('');
  
  console.log('=== METHOD 1: DETAIL GRID (Single Day Query) ===');
  
  const { data: detailTickets } = await supabase
    .from('sale_tickets')
    .select('id, store:stores(name), ticket_items(employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name))')
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
    }
  }
  
  console.log('Found', detailTotals.size, 'technicians with tips on', testDate);
  for (const [empId, data] of Array.from(detailTotals.entries()).slice(0, 5)) {
    console.log('  ' + data.name + ': Cash=$' + data.tips_cash.toFixed(2) + ', Card=$' + data.tips_card.toFixed(2) + ', Total=$' + data.tips_total.toFixed(2));
  }
  console.log('');
  
  console.log('=== METHOD 2: WEEKLY VIEW (Week Range Query) ===');
  
  const { data: weeklyTickets } = await supabase
    .from('sale_tickets')
    .select('id, ticket_date, store:stores(name), ticket_items(employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name))')
    .gte('ticket_date', weekStart)
    .lte('ticket_date', weekEnd);
  
  const weeklyByEmployee = new Map();
  const dailyByEmployeeDate = new Map();
  
  for (const ticket of weeklyTickets || []) {
    const ticketDate = ticket.ticket_date;
    
    for (const item of ticket.ticket_items || []) {
      const empId = item.employee_id;
      const empName = item.employee?.display_name || 'Unknown';
      
      if (!weeklyByEmployee.has(empId)) {
        weeklyByEmployee.set(empId, {
          name: empName,
          tips_cash: 0,
          tips_card: 0,
          tips_total: 0,
        });
        dailyByEmployeeDate.set(empId, new Map());
      }
      
      const tipCustomerCash = item.tip_customer_cash || 0;
      const tipCustomerCard = item.tip_customer_card || 0;
      const tipReceptionist = item.tip_receptionist || 0;
      const tipCash = tipCustomerCash;
      const tipCard = tipCustomerCard + tipReceptionist;
      
      const weeklyTotals = weeklyByEmployee.get(empId);
      weeklyTotals.tips_cash += tipCash;
      weeklyTotals.tips_card += tipCard;
      weeklyTotals.tips_total += tipCash + tipCard;
      
      const dailyMap = dailyByEmployeeDate.get(empId);
      if (!dailyMap.has(ticketDate)) {
        dailyMap.set(ticketDate, { tips_cash: 0, tips_card: 0, tips_total: 0 });
      }
      const dailyTotals = dailyMap.get(ticketDate);
      dailyTotals.tips_cash += tipCash;
      dailyTotals.tips_card += tipCard;
      dailyTotals.tips_total += tipCash + tipCard;
    }
  }
  
  console.log('Found', weeklyByEmployee.size, 'technicians with tips during week');
  for (const [empId, data] of Array.from(weeklyByEmployee.entries()).slice(0, 5)) {
    console.log('  ' + data.name + ': Cash=$' + data.tips_cash.toFixed(2) + ', Card=$' + data.tips_card.toFixed(2) + ', Total=$' + data.tips_total.toFixed(2) + ' (WEEKLY TOTAL)');
  }
  console.log('');
  
  console.log('=== COMPARISON FOR', testDate, '===');
  console.log('');
  
  let allMatch = true;
  const allEmployees = new Set([...detailTotals.keys(), ...weeklyByEmployee.keys()]);
  
  for (const empId of Array.from(allEmployees).slice(0, 5)) {
    const detailData = detailTotals.get(empId);
    const dailyMap = dailyByEmployeeDate.get(empId);
    const weeklyDayData = dailyMap ? dailyMap.get(testDate) : null;
    const weeklyTotal = weeklyByEmployee.get(empId);
    
    const name = detailData?.name || weeklyTotal?.name || 'Unknown';
    
    console.log(name + ':');
    console.log('  Detail Grid (single day)   : $' + (detailData ? detailData.tips_total.toFixed(2) : '0.00'));
    console.log('  Weekly View day cell        : $' + (weeklyDayData ? weeklyDayData.tips_total.toFixed(2) : '0.00'));
    console.log('  Weekly View Total column    : $' + (weeklyTotal ? weeklyTotal.tips_total.toFixed(2) : '0.00'));
    
    const dayMatch = (detailData?.tips_total || 0) === (weeklyDayData?.tips_total || 0);
    console.log('  Day cells match             : ' + (dayMatch ? 'YES' : 'NO'));
    
    if (!dayMatch) {
      allMatch = false;
      console.log('  DISCREPANCY DETAILS:');
      console.log('    Detail Cash: $' + (detailData?.tips_cash || 0).toFixed(2) + ', Card: $' + (detailData?.tips_card || 0).toFixed(2));
      console.log('    Weekly Cash: $' + (weeklyDayData?.tips_cash || 0).toFixed(2) + ', Card: $' + (weeklyDayData?.tips_card || 0).toFixed(2));
    }
    console.log('');
  }
  
  console.log('=== SUMMARY ===');
  if (allMatch) {
    console.log('RESULT: Daily cells match between Detail Grid and Weekly View');
    console.log('');
    console.log('NOTE: The Weekly View Total column shows the SUM of all 7 days,');
    console.log('      which is different from a single day in Detail Grid.');
    console.log('      This is BY DESIGN and not a bug.');
  } else {
    console.log('RESULT: DISCREPANCY FOUND between Detail Grid and Weekly View day cells');
    console.log('This indicates a data calculation issue that needs to be fixed.');
  }
}

function getWeekStartDate(date) {
  const d = new Date(date + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getWeekDates(startDate) {
  const dates = [];
  const d = new Date(startDate + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

analyzeTipData().catch(console.error);
