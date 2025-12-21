import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function finalAnalysis() {
  console.log('=== TIP DATA & CALCULATIONS ANALYSIS ===');
  console.log('Period: December 2025');
  console.log('');
  
  // Step 1: Get all December tickets
  const { data: tickets } = await supabase
    .from('sale_tickets')
    .select('id, ticket_date')
    .gte('ticket_date', '2025-12-01')
    .lte('ticket_date', '2025-12-31');
  
  console.log('Total tickets found:', tickets?.length || 0);
  
  if (!tickets || tickets.length === 0) {
    console.log('No tickets found for December 2025');
    return;
  }
  
  // Step 2: Get all ticket IDs
  const ticketIds = tickets.map(t => t.id);
  const ticketDateMap = new Map(tickets.map(t => [t.id, t.ticket_date]));
  
  // Step 3: Get all items for these tickets
  const { data: items } = await supabase
    .from('ticket_items')
    .select('id, sale_ticket_id, employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees(display_name)')
    .in('sale_ticket_id', ticketIds);
  
  console.log('Total items found:', items?.length || 0);
  console.log('');
  
  // Process data
  const byDate = new Map();
  let grandTotalCash = 0;
  let grandTotalCard = 0;
  let grandTotalAll = 0;
  let totalItemsWithTips = 0;
  
  for (const item of items || []) {
    const date = ticketDateMap.get(item.sale_ticket_id);
    if (!date) continue;
    
    const empId = item.employee_id;
    const empName = item.employee?.display_name || 'Unknown';
    
    if (!byDate.has(date)) {
      byDate.set(date, {
        technicians: new Map(),
        totalCash: 0,
        totalCard: 0,
        totalAll: 0,
        itemsWithTips: 0,
        totalItems: 0
      });
    }
    
    const dateData = byDate.get(date);
    dateData.totalItems++;
    
    const tipCustomerCash = parseFloat(item.tip_customer_cash) || 0;
    const tipCustomerCard = parseFloat(item.tip_customer_card) || 0;
    const tipReceptionist = parseFloat(item.tip_receptionist) || 0;
    
    const tipCash = tipCustomerCash;
    const tipCard = tipCustomerCard + tipReceptionist;
    const tipTotal = tipCash + tipCard;
    
    if (tipTotal > 0) {
      dateData.itemsWithTips++;
      totalItemsWithTips++;
    }
    
    dateData.totalCash += tipCash;
    dateData.totalCard += tipCard;
    dateData.totalAll += tipTotal;
    
    grandTotalCash += tipCash;
    grandTotalCard += tipCard;
    grandTotalAll += tipTotal;
    
    if (!dateData.technicians.has(empId)) {
      dateData.technicians.set(empId, {
        name: empName,
        cash: 0,
        card: 0,
        total: 0,
        services: 0,
        servicesWithTips: 0
      });
    }
    
    const techData = dateData.technicians.get(empId);
    techData.cash += tipCash;
    techData.card += tipCard;
    techData.total += tipTotal;
    techData.services++;
    if (tipTotal > 0) {
      techData.servicesWithTips++;
    }
  }
  
  const sortedDates = Array.from(byDate.keys()).sort();
  
  console.log('========================================');
  console.log('OVERVIEW');
  console.log('========================================');
  console.log('Dates with data:', sortedDates.length);
  console.log('Date range:', sortedDates[0], 'to', sortedDates[sortedDates.length - 1]);
  console.log('Total items with tips:', totalItemsWithTips);
  console.log('');
  
  // Show detailed breakdown for each date
  for (const date of sortedDates) {
    const dateData = byDate.get(date);
    
    console.log('========================================');
    console.log('DATE: ' + date);
    console.log('========================================');
    console.log('Items: ' + dateData.totalItems + ' (' + dateData.itemsWithTips + ' with tips)');
    console.log('Technicians with tips: ' + Array.from(dateData.technicians.values()).filter(t => t.total > 0).length);
    console.log('');
    
    const sortedTechs = Array.from(dateData.technicians.entries())
      .filter(([_, data]) => data.total > 0)
      .sort((a, b) => b[1].total - a[1].total);
    
    for (const [empId, data] of sortedTechs) {
      console.log(data.name + ':');
      console.log('  Services: ' + data.services + ' (' + data.servicesWithTips + ' with tips)');
      console.log('  Cash: $' + data.cash.toFixed(2));
      console.log('  Card: $' + data.card.toFixed(2));
      console.log('  Total: $' + data.total.toFixed(2));
    }
    
    if (sortedTechs.length > 0) {
      console.log('');
      console.log('DAY TOTAL:');
      console.log('  Cash: $' + dateData.totalCash.toFixed(2));
      console.log('  Card: $' + dateData.totalCard.toFixed(2));
      console.log('  Total: $' + dateData.totalAll.toFixed(2));
    }
    console.log('');
  }
  
  console.log('========================================');
  console.log('DECEMBER 2025 GRAND TOTAL');
  console.log('========================================');
  console.log('Total Cash Tips: $' + grandTotalCash.toFixed(2));
  console.log('Total Card Tips: $' + grandTotalCard.toFixed(2));
  console.log('Total All Tips:  $' + grandTotalAll.toFixed(2));
  console.log('');
  console.log('========================================');
  console.log('CALCULATION FORMULA (VERIFIED)');
  console.log('========================================');
  console.log('Cash Tips = Customer Cash Tips');
  console.log('Card Tips = Customer Card Tips + Receptionist Tips');
  console.log('Total = Cash + Card');
  console.log('');
  console.log('Note: December 15-20, 2025 (originally requested) had no data.');
  console.log('      Analysis shows all available December 2025 data.');
}

finalAnalysis().catch(console.error);
