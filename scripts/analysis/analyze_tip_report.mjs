import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function analyzeTipData() {
  const testDate = '2025-12-20';
  
  console.log('=== ANALYZING TIP REPORT DATA DISCREPANCY ===');
  console.log('Test Date:', testDate);
  console.log('');
  
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, code')
    .eq('name', 'Ongles Rivieres')
    .single();
  
  if (!stores) {
    console.log('Store not found');
    return;
  }
  
  console.log('Store:', stores.name, '(' + stores.code + ')');
  console.log('');
  
  console.log('=== DETAIL GRID CALCULATION (Single Day) ===');
  
  const { data: detailTickets } = await supabase
    .from('sale_tickets')
    .select('id, ticket_items(employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name))')
    .eq('store_id', stores.id)
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
  
  console.log('Detail Grid Totals (for ' + testDate + '):');
  for (const [empId, data] of detailTotals.entries()) {
    console.log('  ' + data.name + ':');
    console.log('    Cash: $' + data.tips_cash.toFixed(2));
    console.log('    Card: $' + data.tips_card.toFixed(2));
    console.log('    Total: $' + data.tips_total.toFixed(2));
  }
  console.log('');
  
  console.log('=== WEEKLY VIEW CALCULATION (Week Range) ===');
  
  const weekStart = getWeekStartDate(testDate);
  const weekDates = getWeekDates(weekStart);
  const weekEnd = weekDates[weekDates.length - 1];
  
  console.log('Week Range: ' + weekStart + ' to ' + weekEnd);
  console.log('Week Dates:', weekDates.join(', '));
  console.log('');
  
  const { data: weeklyTickets } = await supabase
    .from('sale_tickets')
    .select('id, ticket_date, ticket_items(employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name))')
    .eq('store_id', stores.id)
    .gte('ticket_date', weekStart)
    .lte('ticket_date', weekEnd);
  
  const weeklyByEmployee = new Map();
  const dailyByEmployee = new Map();
  
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
        dailyByEmployee.set(empId, new Map());
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
      
      const dailyMap = dailyByEmployee.get(empId);
      if (!dailyMap.has(ticketDate)) {
        dailyMap.set(ticketDate, { tips_cash: 0, tips_card: 0, tips_total: 0 });
      }
      const dailyTotals = dailyMap.get(ticketDate);
      dailyTotals.tips_cash += tipCash;
      dailyTotals.tips_card += tipCard;
      dailyTotals.tips_total += tipCash + tipCard;
    }
  }
  
  console.log('Weekly View Totals (for entire week):');
  for (const [empId, data] of weeklyByEmployee.entries()) {
    console.log('  ' + data.name + ':');
    console.log('    Cash: $' + data.tips_cash.toFixed(2));
    console.log('    Card: $' + data.tips_card.toFixed(2));
    console.log('    Total: $' + data.tips_total.toFixed(2));
  }
  console.log('');
  
  console.log('=== DAILY BREAKDOWN IN WEEKLY VIEW ===');
  for (const [empId, dailyMap] of dailyByEmployee.entries()) {
    const empName = weeklyByEmployee.get(empId).name;
    console.log(empName + ':');
    for (const date of weekDates) {
      const dayData = dailyMap.get(date);
      if (dayData) {
        console.log('  ' + date + ': Cash=$' + dayData.tips_cash.toFixed(2) + ', Card=$' + dayData.tips_card.toFixed(2) + ', Total=$' + dayData.tips_total.toFixed(2));
      } else {
        console.log('  ' + date + ': No tips');
      }
    }
    console.log('');
  }
  
  console.log('=== COMPARISON: DETAIL vs WEEKLY for ' + testDate + ' ===');
  console.log('');
  for (const [empId, detailData] of detailTotals.entries()) {
    const dailyMap = dailyByEmployee.get(empId);
    const weeklyDayData = dailyMap ? dailyMap.get(testDate) : null;
    
    console.log(detailData.name + ':');
    console.log('  Detail Grid Total: $' + detailData.tips_total.toFixed(2));
    console.log('  Weekly View (day cell): $' + (weeklyDayData ? weeklyDayData.tips_total.toFixed(2) : '0.00'));
    console.log('  Weekly View (Total column): $' + weeklyByEmployee.get(empId).tips_total.toFixed(2));
    console.log('  MATCH: ' + (detailData.tips_total === weeklyDayData?.tips_total ? 'YES' : 'NO'));
    console.log('');
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
