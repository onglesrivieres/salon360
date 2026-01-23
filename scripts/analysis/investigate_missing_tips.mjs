import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

// Configuration
const STORE_NAME = 'Ongles Maily';
const DATE_RANGE = {
  start: '2025-12-30', // W1 2026 start (Monday) - using APP's week boundaries
  end: '2026-01-19',   // W3 2026 end (Sunday)
};

// Week boundaries (Monday-Sunday ISO weeks - MATCHING THE APP)
function getWeekLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  if (date >= new Date('2025-12-30') && date <= new Date('2026-01-05')) return 'W1';
  if (date >= new Date('2026-01-06') && date <= new Date('2026-01-12')) return 'W2';
  if (date >= new Date('2026-01-13') && date <= new Date('2026-01-19')) return 'W3';
  return null;
}

async function investigateMissingTips() {
  console.log('='.repeat(70));
  console.log('MISSING TIPS INVESTIGATION');
  console.log('='.repeat(70));
  console.log(`Store: ${STORE_NAME}`);
  console.log(`Date Range: ${DATE_RANGE.start} to ${DATE_RANGE.end}`);
  console.log('Week boundaries (Monday-Sunday ISO weeks - MATCHING APP):');
  console.log('  W1: Dec 30, 2025 - Jan 5, 2026');
  console.log('  W2: Jan 6, 2026 - Jan 12, 2026');
  console.log('  W3: Jan 13, 2026 - Jan 19, 2026');
  console.log('');

  // Step 1: Get store ID
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, code')
    .ilike('name', `%${STORE_NAME}%`)
    .single();

  if (storeError || !store) {
    console.error('Store not found:', storeError?.message);
    return;
  }

  console.log(`Found store: ${store.name} (${store.code}), ID: ${store.id}`);
  console.log('');

  // Step 2: Get all tickets with tips for this store in date range (with pagination)
  let allTickets = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data: tickets, error: ticketsError } = await supabase
      .from('sale_tickets')
      .select(`
        id,
        ticket_no,
        ticket_date,
        opened_at,
        closed_at,
        approval_status,
        rejection_reason,
        approval_required_level,
        requires_higher_approval,
        total,
        ticket_items (
          id,
          employee_id,
          tip_customer_cash,
          tip_customer_card,
          tip_receptionist
        )
      `)
      .eq('store_id', store.id)
      .gte('ticket_date', DATE_RANGE.start)
      .lte('ticket_date', DATE_RANGE.end)
      .order('ticket_date')
      .order('opened_at')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError.message);
      return;
    }

    allTickets = allTickets.concat(tickets);

    if (tickets.length < pageSize) {
      break;
    }
    page++;
  }

  const tickets = allTickets;

  console.log(`Found ${tickets.length} tickets in date range`);

  // Show ticket count by date for debugging
  const ticketsByDate = {};
  for (const t of tickets) {
    ticketsByDate[t.ticket_date] = (ticketsByDate[t.ticket_date] || 0) + 1;
  }
  console.log('Tickets by date:');
  for (const date of Object.keys(ticketsByDate).sort()) {
    console.log(`  ${date}: ${ticketsByDate[date]} tickets`);
  }
  console.log('');

  // Step 2b: Get all employees for name lookup
  const { data: employees } = await supabase
    .from('employees')
    .select('id, display_name');

  const employeeNames = new Map();
  for (const emp of employees || []) {
    employeeNames.set(emp.id, emp.display_name);
  }

  // Step 3: Analyze tickets by employee and approval status
  const employeeData = new Map(); // employee_id -> { name, weeks: { W1: {...}, W2: {...}, W3: {...} } }
  const rejectedTickets = [];
  const pendingTickets = [];
  const weekSummary = {
    W1: { totalTips: 0, countedTips: 0, missingTips: 0, ticketCount: 0 },
    W2: { totalTips: 0, countedTips: 0, missingTips: 0, ticketCount: 0 },
    W3: { totalTips: 0, countedTips: 0, missingTips: 0, ticketCount: 0 },
  };

  for (const ticket of tickets) {
    const week = getWeekLabel(ticket.ticket_date);
    if (!week) continue;

    const approvalStatus = ticket.approval_status;
    const isCounted = ['approved', 'auto_approved'].includes(approvalStatus) || !approvalStatus;

    for (const item of ticket.ticket_items || []) {
      const empId = item.employee_id;
      const empName = employeeNames.get(empId) || 'Unknown';

      const tipCash = parseFloat(item.tip_customer_cash) || 0;
      const tipCard = parseFloat(item.tip_customer_card) || 0;
      const tipReceptionist = parseFloat(item.tip_receptionist) || 0;
      const totalTips = tipCash + tipCard + tipReceptionist;

      if (totalTips === 0) continue;

      // Initialize employee data
      if (!employeeData.has(empId)) {
        employeeData.set(empId, {
          name: empName,
          weeks: {
            W1: { counted: 0, missing: 0, rejectedTickets: [], pendingTickets: [] },
            W2: { counted: 0, missing: 0, rejectedTickets: [], pendingTickets: [] },
            W3: { counted: 0, missing: 0, rejectedTickets: [], pendingTickets: [] },
          },
        });
      }

      const empWeekData = employeeData.get(empId).weeks[week];

      // Update week summary
      weekSummary[week].totalTips += totalTips;
      weekSummary[week].ticketCount += 1;

      if (isCounted) {
        weekSummary[week].countedTips += totalTips;
        empWeekData.counted += totalTips;
      } else {
        weekSummary[week].missingTips += totalTips;
        empWeekData.missing += totalTips;

        const ticketInfo = {
          ticket_no: ticket.ticket_no,
          ticket_date: ticket.ticket_date,
          approval_status: approvalStatus,
          rejection_reason: ticket.rejection_reason,
          approval_required_level: ticket.approval_required_level,
          employee_name: empName,
          tips: totalTips,
          tip_breakdown: { cash: tipCash, card: tipCard, receptionist: tipReceptionist },
        };

        if (approvalStatus === 'rejected') {
          rejectedTickets.push(ticketInfo);
          empWeekData.rejectedTickets.push(ticketInfo);
        } else if (approvalStatus === 'pending_approval') {
          pendingTickets.push(ticketInfo);
          empWeekData.pendingTickets.push(ticketInfo);
        }
      }
    }
  }

  // Step 4: Print results

  // Overall week summary
  console.log('='.repeat(70));
  console.log('OVERALL WEEK SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log('Week | Total Tips DB | Shown in Report | MISSING | % Missing');
  console.log('-'.repeat(65));
  for (const [week, data] of Object.entries(weekSummary)) {
    const pctMissing = data.totalTips > 0 ? ((data.missingTips / data.totalTips) * 100).toFixed(1) : '0.0';
    console.log(
      `${week}   | $${data.totalTips.toFixed(2).padStart(10)} | $${data.countedTips.toFixed(2).padStart(12)} | $${data.missingTips.toFixed(2).padStart(6)} | ${pctMissing}%`
    );
  }
  console.log('');

  // Per-employee breakdown
  console.log('='.repeat(70));
  console.log('PER-EMPLOYEE BREAKDOWN');
  console.log('='.repeat(70));
  console.log('');

  const sortedEmployees = Array.from(employeeData.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      ...data,
      totalMissing: data.weeks.W1.missing + data.weeks.W2.missing + data.weeks.W3.missing,
    }))
    .filter((e) => e.totalMissing > 0)
    .sort((a, b) => b.totalMissing - a.totalMissing);

  if (sortedEmployees.length === 0) {
    console.log('No employees with missing tips found.');
  } else {
    for (const emp of sortedEmployees) {
      console.log(`\n${emp.name}:`);
      console.log(`  W1: Shown $${emp.weeks.W1.counted.toFixed(2)}, Missing $${emp.weeks.W1.missing.toFixed(2)}`);
      console.log(`  W2: Shown $${emp.weeks.W2.counted.toFixed(2)}, Missing $${emp.weeks.W2.missing.toFixed(2)}`);
      console.log(`  W3: Shown $${emp.weeks.W3.counted.toFixed(2)}, Missing $${emp.weeks.W3.missing.toFixed(2)}`);
      console.log(`  TOTAL MISSING: $${emp.totalMissing.toFixed(2)}`);
    }
  }
  console.log('');

  // Rejected tickets detail
  console.log('='.repeat(70));
  console.log('REJECTED TICKETS WITH TIPS');
  console.log('='.repeat(70));
  console.log('');

  if (rejectedTickets.length === 0) {
    console.log('No rejected tickets with tips found.');
  } else {
    console.log(`Found ${rejectedTickets.length} rejected ticket items with tips:`);
    console.log('');
    for (const t of rejectedTickets) {
      const week = getWeekLabel(t.ticket_date);
      console.log(`  ${t.ticket_no} (${t.ticket_date}, ${week}):`);
      console.log(`    Employee: ${t.employee_name}`);
      console.log(`    Tips: $${t.tips.toFixed(2)} (Cash: $${t.tip_breakdown.cash.toFixed(2)}, Card: $${t.tip_breakdown.card.toFixed(2)}, Receptionist: $${t.tip_breakdown.receptionist.toFixed(2)})`);
      console.log(`    Rejection reason: ${t.rejection_reason || 'No reason provided'}`);
      console.log('');
    }
  }

  // Pending tickets detail
  console.log('='.repeat(70));
  console.log('PENDING APPROVAL TICKETS WITH TIPS');
  console.log('='.repeat(70));
  console.log('');

  if (pendingTickets.length === 0) {
    console.log('No pending approval tickets with tips found.');
  } else {
    console.log(`Found ${pendingTickets.length} pending approval ticket items with tips:`);
    console.log('');
    for (const t of pendingTickets) {
      const week = getWeekLabel(t.ticket_date);
      console.log(`  ${t.ticket_no} (${t.ticket_date}, ${week}):`);
      console.log(`    Employee: ${t.employee_name}`);
      console.log(`    Tips: $${t.tips.toFixed(2)} (Cash: $${t.tip_breakdown.cash.toFixed(2)}, Card: $${t.tip_breakdown.card.toFixed(2)}, Receptionist: $${t.tip_breakdown.receptionist.toFixed(2)})`);
      console.log(`    Approval required: ${t.approval_required_level || 'standard'}`);
      console.log('');
    }
  }

  // Summary
  console.log('='.repeat(70));
  console.log('INVESTIGATION SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Total rejected tickets with tips: ${rejectedTickets.length}`);
  console.log(`Total pending approval tickets with tips: ${pendingTickets.length}`);
  console.log('');
  console.log('Total missing tips by week:');
  console.log(`  W1: $${weekSummary.W1.missingTips.toFixed(2)}`);
  console.log(`  W2: $${weekSummary.W2.missingTips.toFixed(2)}`);
  console.log(`  W3: $${weekSummary.W3.missingTips.toFixed(2)}`);
  console.log(`  GRAND TOTAL: $${(weekSummary.W1.missingTips + weekSummary.W2.missingTips + weekSummary.W3.missingTips).toFixed(2)}`);
  console.log('');
  console.log('Root cause: Tips are excluded from reports when ticket approval_status is');
  console.log('"rejected" or "pending_approval". The Jan 18th auto-approval migration');
  console.log('skipped tickets that were already rejected.');
  console.log('');

  // Additional: Show all employees with tips and their amounts
  console.log('='.repeat(70));
  console.log('ALL EMPLOYEES WITH TIPS (for verification)');
  console.log('='.repeat(70));
  console.log('');

  const allEmployeesList = Array.from(employeeData.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      w1: data.weeks.W1.counted,
      w2: data.weeks.W2.counted,
      w3: data.weeks.W3.counted,
      total: data.weeks.W1.counted + data.weeks.W2.counted + data.weeks.W3.counted,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log('Employee              | W1 Tips  | W2 Tips  | W3 Tips  | Total');
  console.log('-'.repeat(65));
  for (const emp of allEmployeesList) {
    const nameCol = emp.name.padEnd(20).substring(0, 20);
    console.log(
      `${nameCol} | $${emp.w1.toFixed(2).padStart(6)} | $${emp.w2.toFixed(2).padStart(6)} | $${emp.w3.toFixed(2).padStart(6)} | $${emp.total.toFixed(2).padStart(7)}`
    );
  }
  console.log('');

  // Check for Hana specifically
  const hanaEmps = allEmployeesList.filter((e) => e.name.toLowerCase().includes('hana'));
  if (hanaEmps.length > 0) {
    console.log('='.repeat(70));
    console.log('HANA SPECIFIC DATA');
    console.log('='.repeat(70));
    for (const emp of hanaEmps) {
      console.log(`${emp.name}:`);
      console.log(`  W1: $${emp.w1.toFixed(2)}`);
      console.log(`  W2: $${emp.w2.toFixed(2)}`);
      console.log(`  W3: $${emp.w3.toFixed(2)}`);
      console.log(`  Total: $${emp.total.toFixed(2)}`);
    }
  }

  // Check for Hana's tips at ALL stores (not just Ongles Maily)
  await investigateHanaAllStores();
}

async function investigateHanaAllStores() {
  console.log('');
  console.log('='.repeat(70));
  console.log('HANA TIPS ACROSS ALL STORES');
  console.log('='.repeat(70));
  console.log('');

  // Find Hana's employee ID
  const { data: hanaEmployee } = await supabase
    .from('employees')
    .select('id, display_name')
    .ilike('display_name', '%hana%')
    .single();

  if (!hanaEmployee) {
    console.log('Hana not found');
    return;
  }

  console.log(`Employee: ${hanaEmployee.display_name} (ID: ${hanaEmployee.id})`);

  // Check which stores Hana is assigned to
  const { data: employeeStores } = await supabase
    .from('employee_stores')
    .select('store_id, store:stores(id, name, code)')
    .eq('employee_id', hanaEmployee.id);

  console.log('');
  console.log('Assigned stores:');
  for (const es of employeeStores || []) {
    console.log(`  - ${es.store?.name} (${es.store?.code})`);
  }
  console.log(`Multi-store employee: ${(employeeStores?.length || 0) > 1 ? 'YES' : 'NO'}`);
  console.log('');

  // Get all ticket items for Hana across ALL stores
  const { data: ticketItems, error } = await supabase
    .from('ticket_items')
    .select(`
      id,
      employee_id,
      tip_customer_cash,
      tip_customer_card,
      tip_receptionist,
      sale_ticket:sale_tickets (
        id,
        ticket_no,
        ticket_date,
        store_id,
        approval_status,
        store:stores (
          id,
          name,
          code
        )
      )
    `)
    .eq('employee_id', hanaEmployee.id)
    .gte('sale_ticket.ticket_date', '2025-12-29')
    .lte('sale_ticket.ticket_date', '2026-01-18');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  // Filter out items without sale_ticket (due to RLS or null)
  const validItems = ticketItems.filter(item => item.sale_ticket && item.sale_ticket.ticket_date);

  // Group by store and week
  const storeWeekData = {};

  for (const item of validItems) {
    const ticket = item.sale_ticket;
    const storeCode = ticket.store?.code || 'Unknown';
    const storeName = ticket.store?.name || 'Unknown';
    const week = getWeekLabelForHana(ticket.ticket_date);
    if (!week) continue;

    const tipCash = parseFloat(item.tip_customer_cash) || 0;
    const tipCard = parseFloat(item.tip_customer_card) || 0;
    const tipReceptionist = parseFloat(item.tip_receptionist) || 0;
    const totalTips = tipCash + tipCard + tipReceptionist;

    if (!storeWeekData[storeCode]) {
      storeWeekData[storeCode] = {
        name: storeName,
        W1: { cash: 0, card: 0, receptionist: 0, total: 0, tickets: [] },
        W2: { cash: 0, card: 0, receptionist: 0, total: 0, tickets: [] },
        W3: { cash: 0, card: 0, receptionist: 0, total: 0, tickets: [] },
      };
    }

    storeWeekData[storeCode][week].cash += tipCash;
    storeWeekData[storeCode][week].card += tipCard;
    storeWeekData[storeCode][week].receptionist += tipReceptionist;
    storeWeekData[storeCode][week].total += totalTips;

    if (totalTips > 0) {
      storeWeekData[storeCode][week].tickets.push({
        ticket_no: ticket.ticket_no,
        date: ticket.ticket_date,
        tips: totalTips,
        breakdown: { cash: tipCash, card: tipCard, receptionist: tipReceptionist },
        approval_status: ticket.approval_status,
      });
    }
  }

  // Print results
  console.log('Tips by Store and Week:');
  console.log('');

  let grandTotal = { W1: 0, W2: 0, W3: 0 };

  for (const [storeCode, data] of Object.entries(storeWeekData)) {
    console.log(`${data.name} (${storeCode}):`);
    for (const week of ['W1', 'W2', 'W3']) {
      const w = data[week];
      if (w.total > 0) {
        console.log(`  ${week}: $${w.total.toFixed(2)} (Cash: $${w.cash.toFixed(2)}, Card: $${w.card.toFixed(2)}, Receptionist: $${w.receptionist.toFixed(2)}) - ${w.tickets.length} tickets`);
        grandTotal[week] += w.total;
      } else {
        console.log(`  ${week}: $0.00`);
      }
    }
    console.log('');
  }

  console.log('GRAND TOTAL ACROSS ALL STORES:');
  console.log(`  W1: $${grandTotal.W1.toFixed(2)}`);
  console.log(`  W2: $${grandTotal.W2.toFixed(2)}`);
  console.log(`  W3: $${grandTotal.W3.toFixed(2)}`);
  console.log(`  Total: $${(grandTotal.W1 + grandTotal.W2 + grandTotal.W3).toFixed(2)}`);
  console.log('');

  // Compare with expected values
  console.log('COMPARISON WITH APP VALUES:');
  console.log('  Expected (from app): W1=$260, W2=$471, W3=$328');
  console.log(`  Database total:      W1=$${grandTotal.W1.toFixed(2)}, W2=$${grandTotal.W2.toFixed(2)}, W3=$${grandTotal.W3.toFixed(2)}`);
  console.log(`  Difference:          W1=$${(260 - grandTotal.W1).toFixed(2)}, W2=$${(471 - grandTotal.W2).toFixed(2)}, W3=$${(328 - grandTotal.W3).toFixed(2)}`);

  // Direct count verification
  console.log('');
  console.log('DIRECT DATABASE VERIFICATION:');

  const { data: directItems, error: directError } = await supabase
    .from('ticket_items')
    .select(`
      id,
      employee_id,
      tip_customer_cash,
      tip_customer_card,
      tip_receptionist,
      sale_ticket_id
    `)
    .eq('employee_id', hanaEmployee.id);

  if (directError) {
    console.log('Error:', directError.message);
  } else {
    // Get all ticket dates
    const ticketIds = [...new Set(directItems.map(i => i.sale_ticket_id))];
    console.log(`  Unique ticket IDs: ${ticketIds.length}`);

    const { data: tickets, error: ticketError } = await supabase
      .from('sale_tickets')
      .select('id, ticket_date, approval_status')
      .in('id', ticketIds);

    if (ticketError) {
      console.log(`  Ticket query error: ${ticketError.message}`);
    }
    console.log(`  Tickets fetched: ${tickets?.length || 0}`);

    const ticketDateMap = new Map();
    for (const t of tickets || []) {
      ticketDateMap.set(t.id, { date: t.ticket_date, status: t.approval_status });
    }
    console.log(`  TicketDateMap size: ${ticketDateMap.size}`);

    let directW1 = 0, directW2 = 0, directW3 = 0;
    let itemCountW1 = 0, itemCountW2 = 0, itemCountW3 = 0;
    let sampleDates = [];

    for (const item of directItems) {
      const ticketInfo = ticketDateMap.get(item.sale_ticket_id);
      if (!ticketInfo) continue;

      // Collect sample dates for debugging
      if (sampleDates.length < 5) {
        sampleDates.push(ticketInfo.date);
      }

      const week = getWeekLabelForHana(ticketInfo.date);
      if (!week) continue;

      const tips = (parseFloat(item.tip_customer_cash) || 0) +
                   (parseFloat(item.tip_customer_card) || 0) +
                   (parseFloat(item.tip_receptionist) || 0);

      if (week === 'W1') { directW1 += tips; itemCountW1++; }
      if (week === 'W2') { directW2 += tips; itemCountW2++; }
      if (week === 'W3') { directW3 += tips; itemCountW3++; }
    }

    console.log(`  Total ticket_items for Hana: ${directItems.length}`);
    console.log(`  Sample dates from tickets: ${sampleDates.join(', ')}`);
    console.log(`  W1: ${itemCountW1} items, $${directW1.toFixed(2)} tips`);
    console.log(`  W2: ${itemCountW2} items, $${directW2.toFixed(2)} tips`);
    console.log(`  W3: ${itemCountW3} items, $${directW3.toFixed(2)} tips`);
    console.log(`  Total: $${(directW1 + directW2 + directW3).toFixed(2)}`);

    // Count items by date range
    let inRangeCount = 0;
    let outOfRangeCount = 0;
    for (const item of directItems) {
      const ticketInfo = ticketDateMap.get(item.sale_ticket_id);
      if (!ticketInfo) continue;
      const d = ticketInfo.date;
      if (d >= '2025-12-30' && d <= '2026-01-19') {
        inRangeCount++;
      } else {
        outOfRangeCount++;
      }
    }
    console.log(`  In date range (Dec 30 - Jan 19): ${inRangeCount} items`);
    console.log(`  Out of date range: ${outOfRangeCount} items`);
  }

  // List all tickets with tips for verification
  console.log('');
  console.log('='.repeat(70));
  console.log('DETAILED TICKET LIST FOR HANA');
  console.log('='.repeat(70));
  console.log('');

  for (const [storeCode, data] of Object.entries(storeWeekData)) {
    for (const week of ['W1', 'W2', 'W3']) {
      const w = data[week];
      if (w.tickets.length > 0) {
        console.log(`${week} - ${data.name}:`);
        let weekTotal = 0;
        for (const t of w.tickets.sort((a, b) => a.date.localeCompare(b.date) || a.ticket_no.localeCompare(b.ticket_no))) {
          console.log(`  ${t.ticket_no} (${t.date}): $${t.tips.toFixed(2)} [Cash:$${t.breakdown.cash}, Card:$${t.breakdown.card}, Rec:$${t.breakdown.receptionist}] Status:${t.approval_status || 'null'}`);
          weekTotal += t.tips;
        }
        console.log(`  WEEK TOTAL: $${weekTotal.toFixed(2)}`);
        console.log('');
      }
    }
  }
}

function getWeekLabelForHana(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  if (date >= new Date('2025-12-30') && date <= new Date('2026-01-05')) return 'W1';
  if (date >= new Date('2026-01-06') && date <= new Date('2026-01-12')) return 'W2';
  if (date >= new Date('2026-01-13') && date <= new Date('2026-01-19')) return 'W3';
  return null;
}

investigateMissingTips().catch(console.error);
