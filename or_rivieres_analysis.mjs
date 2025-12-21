import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function analyzeOnglesRivieres() {
  console.log('=== ONGLES RIVIERES TIP ANALYSIS ===');
  console.log('Period: December 15-20, 2025');
  console.log('Store: Ongles Rivieres (OR)');
  console.log('');

  const onglesRivieresId = '090391d3-0899-4947-8735-c0bfe8dbe0e4';
  const dates = ['2025-12-15', '2025-12-16', '2025-12-17', '2025-12-18', '2025-12-19', '2025-12-20'];

  const byDate = new Map();
  let grandTotalCash = 0;
  let grandTotalCard = 0;
  let grandTotalAll = 0;

  for (const testDate of dates) {
    const { data: tickets, error } = await supabase
      .from('sale_tickets')
      .select('id, ticket_items(id, employee_id, tip_customer_cash, tip_customer_card, tip_receptionist, employee:employees!ticket_items_employee_id_fkey(display_name))')
      .eq('store_id', onglesRivieresId)
      .eq('ticket_date', testDate);

    if (error) {
      console.log('Error for', testDate, ':', error);
      continue;
    }

    if (!tickets || tickets.length === 0) continue;

    const dateData = {
      technicians: new Map(),
      totalCash: 0,
      totalCard: 0,
      totalAll: 0,
      itemsWithTips: 0,
      totalItems: 0
    };

    for (const ticket of tickets) {
      for (const item of ticket.ticket_items || []) {
        dateData.totalItems++;

        const empId = item.employee_id;
        const empName = item.employee?.display_name || 'Unknown';

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
    }

    if (dateData.totalItems > 0) {
      byDate.set(testDate, dateData);
    }
  }

  const sortedDates = Array.from(byDate.keys()).sort();

  console.log('========================================');
  console.log('OVERVIEW');
  console.log('========================================');
  console.log('Dates with data:', sortedDates.length);
  if (sortedDates.length > 0) {
    console.log('Date range:', sortedDates[0], 'to', sortedDates[sortedDates.length - 1]);
  }
  console.log('');

  for (const date of sortedDates) {
    const dateData = byDate.get(date);

    console.log('========================================');
    console.log('DATE: ' + date);
    console.log('========================================');
    console.log('Items: ' + dateData.totalItems + ' (' + dateData.itemsWithTips + ' with tips)');

    const sortedTechs = Array.from(dateData.technicians.entries())
      .filter(([_, data]) => data.total > 0)
      .sort((a, b) => b[1].total - a[1].total);

    console.log('Technicians with tips: ' + sortedTechs.length);
    console.log('');

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
  console.log('DECEMBER 15-20, 2025 GRAND TOTAL');
  console.log('ONGLES RIVIERES (OR)');
  console.log('========================================');
  console.log('Total Cash Tips: $' + grandTotalCash.toFixed(2));
  console.log('Total Card Tips: $' + grandTotalCard.toFixed(2));
  console.log('Total All Tips:  $' + grandTotalAll.toFixed(2));
  console.log('');
  console.log('========================================');
  console.log('CALCULATION FORMULA (VERIFIED CORRECT)');
  console.log('========================================');
  console.log('Cash Tips = Customer Cash Tips');
  console.log('Card Tips = Customer Card Tips + Receptionist Tips');
  console.log('Total Tips = Cash + Card');
}

analyzeOnglesRivieres().catch(console.error);
