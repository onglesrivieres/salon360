import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function investigateCrossStoreTransactions() {
  console.log('\n=== INVESTIGATING CROSS-STORE TRANSACTION ISSUE ===\n');

  // 1. Find David's employee record and store assignments
  console.log('1. Finding David\'s employee record and store assignments...\n');

  const { data: davidResults, error: davidError } = await supabase
    .from('employees')
    .select('id, display_name')
    .ilike('display_name', '%david%');

  const david = davidResults?.[0];

  if (davidError) {
    console.error('Error finding David:', davidError);
  } else {
    console.log('David\'s employee record:', david);
  }

  if (david) {
    const { data: storeAssignments, error: assignmentError } = await supabase
      .from('employee_stores')
      .select('store_id, stores(name, code)')
      .eq('employee_id', david.id);

    if (assignmentError) {
      console.error('Error finding store assignments:', assignmentError);
    } else {
      console.log('\nDavid\'s store assignments:', storeAssignments);
    }
  }

  // 2. Find Ongles Charlesbourg and Ongles Maily store IDs
  console.log('\n2. Finding store IDs...\n');

  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, name, code')
    .in('name', ['Ongles Charlesbourg', 'Ongles Maily']);

  if (storesError) {
    console.error('Error finding stores:', storesError);
  } else {
    console.log('Stores:', stores);
  }

  const charlesbourgStore = stores?.find(s => s.name === 'Ongles Charlesbourg');
  const mailyStore = stores?.find(s => s.name === 'Ongles Maily');

  // 3. Find the problematic transactions
  if (david && charlesbourgStore) {
    console.log('\n3. Finding David\'s transactions for Ongles Charlesbourg on 2026-01-03...\n');

    const { data: transactions, error: txError } = await supabase
      .from('cash_transactions')
      .select('*')
      .eq('created_by_id', david.id)
      .eq('store_id', charlesbourgStore.id)
      .eq('date', '2026-01-03')
      .order('created_at', { ascending: true });

    if (txError) {
      console.error('Error finding transactions:', txError);
    } else {
      console.log(`Found ${transactions?.length || 0} transactions:`);
      transactions?.forEach((tx, i) => {
        console.log(`\n  Transaction ${i + 1}:`);
        console.log(`    ID: ${tx.id}`);
        console.log(`    Type: ${tx.transaction_type}`);
        console.log(`    Amount: $${tx.amount}`);
        console.log(`    Category: ${tx.category}`);
        console.log(`    Description: ${tx.description}`);
        console.log(`    Status: ${tx.status}`);
        console.log(`    Created At: ${tx.created_at}`);
      });
    }
  }

  // 4. Check for ALL cross-store transactions
  console.log('\n4. Checking for ALL cross-store transaction anomalies...\n');

  const { data: allTransactions, error: allTxError } = await supabase
    .from('cash_transactions')
    .select(`
      id,
      store_id,
      created_by_id,
      transaction_type,
      amount,
      category,
      date,
      stores(name),
      employees!cash_transactions_created_by_id_fkey(display_name)
    `);

  if (allTxError) {
    console.error('Error finding all transactions:', allTxError);
  } else {
    // Find transactions where employee's primary store doesn't match transaction store
    const crossStoreTransactions = [];

    for (const tx of allTransactions || []) {
      // Get employee's assigned stores
      const { data: employeeStores } = await supabase
        .from('employee_stores')
        .select('store_id')
        .eq('employee_id', tx.created_by_id);

      const assignedStoreIds = employeeStores?.map(es => es.store_id) || [];

      // If employee has no store assignments, they can access any store
      // If they have assignments, check if transaction store is in their list
      if (assignedStoreIds.length > 0 && !assignedStoreIds.includes(tx.store_id)) {
        crossStoreTransactions.push({
          ...tx,
          assignedStores: assignedStoreIds
        });
      }
    }

    if (crossStoreTransactions.length > 0) {
      console.log(`\n⚠️  Found ${crossStoreTransactions.length} cross-store transaction(s):\n`);
      crossStoreTransactions.forEach((tx, i) => {
        console.log(`  ${i + 1}. Transaction ${tx.id}`);
        console.log(`     Employee: ${tx.employees?.display_name}`);
        console.log(`     Transaction Store: ${tx.stores?.name} (${tx.store_id})`);
        console.log(`     Employee's Assigned Stores: ${tx.assignedStores.join(', ')}`);
        console.log(`     Type: ${tx.transaction_type}, Amount: $${tx.amount}`);
        console.log(`     Date: ${tx.date}\n`);
      });
    } else {
      console.log('✓ No cross-store transaction anomalies found (besides the ones already identified).');
    }
  }

  console.log('\n=== INVESTIGATION COMPLETE ===\n');
}

investigateCrossStoreTransactions().catch(console.error);
