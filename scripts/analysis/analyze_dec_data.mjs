import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function analyzeDecData() {
  console.log('=== COMPREHENSIVE TIP DATA ANALYSIS ===');
  console.log('Analyzing December 2025 data');
  console.log('');
  
  // Get all tickets in December with their items
  const { data: tickets } = await supabase
    .from('sale_tickets')
    .select(`
      id,
      ticket_date,
      store:stores(name, code),
      ticket_items(
        id,
        employee_id,
        tip_customer_cash,
        tip_customer_card,
        tip_receptionist,
        employee:employees(display_name)
      )
    `)
    .gte('ticket_date', '2025-12-01')
    .lte('ticket_date', '2025-12-12')
    .order('ticket_date', { ascending: true });
  
  const byDate = new Map();
  let totalTickets = 0;
  let totalItems = 0;
  let itemsWithTips = 0;
  
  for (const ticket of tickets || []) {
    totalTickets++;
    const date = ticket.ticket_date;
    
    if (!byDate.has(date)) {
      byDate.set(date, {
        technicians: new Map(),
        totalCash: 0,
        totalCard: 0,
        totalAll: 0,
        itemCount: 0,
        itemsWithTips: 0
      });
    }
    
    const dateData = byDate.get(date);
    
    for (const item of ticket.ticket_items || []) {
      totalItems++;
      dateData.itemCount++;
      
      const empId = item.employee_id;
      const empName = item.employee?.display_name || 'Unknown';
      
      const tipCustomerCash = parseFloat(item.tip_customer_cash) || 0;
      const tipCustomerCard = parseFloat(item.tip_customer_card) || 0;
      const tipReceptionist = parseFloat(item.tip_receptionist) || 0;
      
      const hasTips = tipCustomerCash > 0 || tipCustomerCard > 0 || tipReceptionist > 0;
      if (hasTips) {
        itemsWithTips++;
        dateData.itemsWithTips++;
      }
      
      const tipCash = tipCustomerCash;
      const tipCard = tipCustomerCard + tipReceptionist;
      const tipTotal = tipCash + tipCard;
      
      dateData.totalCash += tipCash;
      dateData.totalCard += tipCard;
      dateData.totalAll += tipTotal;
      
      if (!dateData.technicians.has(empId)) {
        dateData.technicians.set(empId, {
          name: empName,
          cash: 0,
          card: 0,
          total: 0,
          services: 0
        });
      }
      
      const techData = dateData.technicians.get(empId);
      techData.cash += tipCash;
      techData.card += tipCard;
      techData.total += tipTotal;
      techData.services++;
    }
  }
  
  console.log('OVERVIEW:');
  console.log('  Total tickets:', totalTickets);
  console.log('  Total items:', totalItems);
  console.log('  Items with tips:', itemsWithTips);
  console.log('  Dates with data:', byDate.size);
  console.log('');
  
  const sortedDates = Array.from(byDate.keys()).sort();
  
  for (const date of sortedDates) {
    const dateData = byDate.get(date);
    console.log('=== ' + date + ' ===');
    console.log('Items: ' + dateData.itemCount + ' (' + dateData.itemsWithTips + ' with tips)');
    console.log('Technicians: ' + dateData.technicians.size);
    
    const sortedTechs = Array.from(dateData.technicians.entries())
      .sort((a, b) => a[1].name.localeCompare(b[1].name));
    
    for (const [empId, data] of sortedTechs) {
      if (data.total > 0) {
        console.log('  ' + data.name + ':');
        console.log('    Services: ' + data.services);
        console.log('    Cash: $' + data.cash.toFixed(2));
        console.log('    Card: $' + data.card.toFixed(2));
        console.log('    Total: $' + data.total.toFixed(2));
      }
    }
    
    console.log('  DAY TOTAL: Cash=$' + dateData.totalCash.toFixed(2) + ', Card=$' + dateData.totalCard.toFixed(2) + ', Total=$' + dateData.totalAll.toFixed(2));
    console.log('');
  }
  
  console.log('=== PERIOD SUMMARY (Dec 1-12) ===');
  let periodCash = 0;
  let periodCard = 0;
  let periodTotal = 0;
  
  for (const [date, data] of byDate.entries()) {
    periodCash += data.totalCash;
    periodCard += data.totalCard;
    periodTotal += data.totalAll;
  }
  
  console.log('Total Cash: $' + periodCash.toFixed(2));
  console.log('Total Card: $' + periodCard.toFixed(2));
  console.log('Total Tips: $' + periodTotal.toFixed(2));
}

analyzeDecData().catch(console.error);
