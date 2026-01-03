import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function identifyCrossStoreTransactions() {
  console.log('🔍 Identifying all cross-store transactions...\n');

  const { data: transactions, error: txError } = await supabase
    .from('cash_transactions')
    .select(`
      id,
      store_id,
      transaction_type,
      amount,
      category,
      description,
      date,
      created_by_id,
      created_at,
      stores!inner (name)
    `)
    .order('created_at', { ascending: false });

  if (txError) {
    console.error('Error fetching transactions:', txError);
    return;
  }

  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select(`
      id,
      display_name,
      employee_stores (store_id)
    `);

  if (empError) {
    console.error('Error fetching employees:', empError);
    return;
  }

  const employeeMap = new Map(employees.map(e => [e.id, e]));

  console.log(`Total transactions found: ${transactions.length}\n`);

  const crossStoreViolations = [];

  for (const tx of transactions) {
    const employee = employeeMap.get(tx.created_by_id);
    if (!employee) {
      console.log(`⚠️  Transaction ${tx.id.substring(0, 8)}... has no employee (orphaned)`);
      crossStoreViolations.push({
        ...tx,
        violation_type: 'orphaned'
      });
      continue;
    }

    const employeeStores = employee.employee_stores.map(es => es.store_id);

    if (!employeeStores.includes(tx.store_id)) {
      console.log(`❌ CROSS-STORE VIOLATION:`);
      console.log(`   Transaction ID: ${tx.id}`);
      console.log(`   Store: ${tx.stores.name} (${tx.store_id})`);
      console.log(`   Employee: ${employee.display_name} (${employee.id})`);
      console.log(`   Employee's Stores: ${employeeStores.join(', ')}`);
      console.log(`   Amount: $${tx.amount}`);
      console.log(`   Type: ${tx.transaction_type}`);
      console.log(`   Description: ${tx.description || 'N/A'}`);
      console.log(`   Date: ${tx.date}`);
      console.log(`   Created: ${tx.created_at}`);
      console.log('');

      crossStoreViolations.push({
        ...tx,
        violation_type: 'cross_store',
        employee_name: employee.display_name,
        employee_stores: employeeStores
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY:`);
  console.log(`Total transactions: ${transactions.length}`);
  console.log(`Cross-store violations: ${crossStoreViolations.length}`);
  console.log('='.repeat(60));

  if (crossStoreViolations.length > 0) {
    console.log('\n📋 Violations by store:');
    const byStore = {};
    for (const v of crossStoreViolations) {
      const storeName = v.stores.name;
      if (!byStore[storeName]) {
        byStore[storeName] = [];
      }
      byStore[storeName].push(v);
    }

    for (const [storeName, violations] of Object.entries(byStore)) {
      console.log(`\n  ${storeName}: ${violations.length} violations`);
      for (const v of violations) {
        console.log(`    - ID: ${v.id.substring(0, 8)}... by ${v.employee_name || 'unknown'} ($${v.amount})`);
      }
    }

    console.log('\n🗑️  Transaction IDs to delete:');
    crossStoreViolations.forEach(v => {
      console.log(`  ${v.id}`);
    });
  }

  return crossStoreViolations;
}

identifyCrossStoreTransactions();
