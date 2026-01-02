import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function fullDecemberAnalysis() {
  console.log('=== COMPREHENSIVE TIP DATA ANALYSIS ===');
  console.log('Period: December 1-31, 2025');
  console.log('');
  
  // Get all ticket items with tips in December
  const { data: allItems } = await supabase
    .from('ticket_items')
    .select(`
      id,
      tip_customer_cash,
      tip_customer_card,
      tip_receptionist,
      employee_id,
      employee:employees(display_name),
      sale_ticket:sale_tickets!inner(id, ticket_date, store_id, store:stores(name, code))
    `)
    .gte('sale_ticket.ticket_date', '2025-12-01')
    .lte('sale_ticket.ticket_date', '2025-12-31');
  
  console.log('Total items processed:', allItems?.length || 0);
  console.log('');
  
  const byDate = new Map();
  let grandTotalCash = 0;
  let grandTotalCard = 0;
  let grandTotalAll = 0;
  
  for (const item of allItems || []) {
    const date = item.sale_ticket.ticket_date;
    const empId = item.employee_id;
    const empName = item.employee?.display_name || 'Unknown';
    
    if (!byDate.has(date)) {
      byDate.set(date, {
        technicians: new Map(),
        totalCash: 0,
        totalCard: 0,
        totalAll: 0,
        itemsWithTips: 0
      });
    }
    
    const dateData = byDate.get(date);
    
    const tipCustomerCash = parseFloat(item.tip_customer_cash) || 0;
    const tipCustomerCard = parseFloat(item.tip_customer_card) || 0;
    const tipReceptionist = parseFloat(item.tip_receptionist) || 0;
    
    const tipCash = tipCustomerCash;
    const tipCard = tipCustomerCard + tipReceptionist;
    const tipTotal = tipCash + tipCard;
    
    if (tipTotal > 0) {
      dateData.itemsWithTips++;
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
  
  console.log('DATES WITH DATA:', sortedDates.length);
  console.log(sortedDates.join(', '));
  console.log('');
  console.log('========================================');
  console.log('');
  
  for (const date of sortedDates) {
    const dateData = byDate.get(date);
    console.log('=== ' + date + ' ===');
    console.log('Items with tips: ' + dateData.itemsWithTips);
    console.log('Technicians: ' + dateData.technicians.size);
    console.log('');
    
    const sortedTechs = Array.from(dateData.technicians.entries())
      .filter(([_, data]) => data.total > 0)
      .sort((a, b) => b[1].total - a[1].total);
    
    for (const [empId, data] of sortedTechs) {
      console.log('  ' + data.name + ':');
      console.log('    Services: ' + data.services + ' (' + data.servicesWithTips + ' with tips)');
      console.log('    Cash: $' + data.cash.toFixed(2));
      console.log('    Card: $' + data.card.toFixed(2));
      console.log('    Total: $' + data.total.toFixed(2));
    }
    
    if (sortedTechs.length > 0) {
      console.log('  ' + '-'.repeat(40));
      console.log('  DAY TOTAL: Cash=$' + dateData.totalCash.toFixed(2) + ', Card=$' + dateData.totalCard.toFixed(2) + ', Total=$' + dateData.totalAll.toFixed(2));
    }
    console.log('');
  }
  
  console.log('========================================');
  console.log('=== DECEMBER 2025 SUMMARY ===');
  console.log('Total Cash Tips: $' + grandTotalCash.toFixed(2));
  console.log('Total Card Tips: $' + grandTotalCard.toFixed(2));
  console.log('Total All Tips:  $' + grandTotalAll.toFixed(2));
  console.log('');
  console.log('Calculation Formula:');
  console.log('  Cash Tips = Customer Cash Tips');
  console.log('  Card Tips = Customer Card Tips + Receptionist Tips');
  console.log('  Total = Cash + Card');
  console.log('');
  console.log('Note: December 15-20 requested by user had no data.');
  console.log('      Showing all available December data instead.');
}

fullDecemberAnalysis().catch(console.error);
