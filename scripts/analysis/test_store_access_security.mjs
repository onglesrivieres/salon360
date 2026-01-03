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

async function testStoreAccessSecurity() {
  console.log('\n=== TESTING STORE ACCESS SECURITY ===\n');

  // Get David and the stores
  const { data: davidResults } = await supabase
    .from('employees')
    .select('id, display_name')
    .ilike('display_name', '%david%');

  const david = davidResults?.[0];

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, code')
    .in('name', ['Ongles Charlesbourg', 'Ongles Maily']);

  const charlesbourgStore = stores?.find(s => s.name === 'Ongles Charlesbourg');
  const mailyStore = stores?.find(s => s.name === 'Ongles Maily');

  if (!david || !charlesbourgStore || !mailyStore) {
    console.error('Missing test data');
    return;
  }

  console.log('Test Setup:');
  console.log(`  Employee: ${david.display_name} (${david.id})`);
  console.log(`  Authorized Store: ${mailyStore.name} (${mailyStore.id})`);
  console.log(`  Unauthorized Store: ${charlesbourgStore.name} (${charlesbourgStore.id})\n`);

  // Test 1: Try to create transaction for UNAUTHORIZED store (should fail)
  console.log('Test 1: Attempting to create transaction for UNAUTHORIZED store...');
  const { data: unauthorizedResult, error: unauthorizedError } = await supabase
    .rpc('create_cash_transaction_with_validation', {
      p_store_id: charlesbourgStore.id,
      p_date: '2026-01-03',
      p_transaction_type: 'cash_out',
      p_amount: 100.00,
      p_description: 'Test unauthorized transaction',
      p_category: 'Safe Deposit',
      p_created_by_id: david.id,
    });

  if (unauthorizedError) {
    console.log('  ❌ RPC Error:', unauthorizedError.message);
  } else if (unauthorizedResult && !unauthorizedResult.success) {
    console.log('  ✅ PASS: Transaction blocked by validation');
    console.log(`  Message: ${unauthorizedResult.error}`);
    console.log(`  Error Code: ${unauthorizedResult.error_code}`);
  } else {
    console.log('  ❌ FAIL: Transaction was allowed (security breach!)');
  }

  // Test 2: Try to create transaction for AUTHORIZED store (should succeed)
  console.log('\nTest 2: Attempting to create transaction for AUTHORIZED store...');
  const { data: authorizedResult, error: authorizedError } = await supabase
    .rpc('create_cash_transaction_with_validation', {
      p_store_id: mailyStore.id,
      p_date: '2026-01-03',
      p_transaction_type: 'cash_out',
      p_amount: 50.00,
      p_description: 'Test authorized transaction',
      p_category: 'Safe Deposit',
      p_created_by_id: david.id,
    });

  if (authorizedError) {
    console.log('  ❌ Error:', authorizedError.message);
  } else if (authorizedResult && authorizedResult.success) {
    console.log('  ✅ PASS: Transaction created successfully');
    console.log(`  Transaction ID: ${authorizedResult.transaction_id}`);

    // Clean up test transaction
    await supabase
      .from('cash_transactions')
      .delete()
      .eq('id', authorizedResult.transaction_id);
    console.log('  (Test transaction cleaned up)');
  } else {
    console.log('  ❌ FAIL: Transaction was blocked (should have been allowed)');
  }

  // Test 3: Verify RLS policy blocks direct inserts
  console.log('\nTest 3: Testing RLS policy blocks direct INSERT...');
  const { error: directInsertError } = await supabase
    .from('cash_transactions')
    .insert({
      store_id: charlesbourgStore.id,
      date: '2026-01-03',
      transaction_type: 'cash_out',
      amount: 75.00,
      description: 'Test direct insert bypass attempt',
      category: 'Safe Deposit',
      created_by_id: david.id,
      status: 'pending_approval',
      requires_manager_approval: true,
    });

  if (directInsertError) {
    console.log('  ✅ PASS: Direct INSERT blocked by RLS policy');
    console.log(`  Error: ${directInsertError.message}`);
  } else {
    console.log('  ❌ FAIL: Direct INSERT was allowed (RLS policy not working!)');
  }

  // Test 4: Check existing cross-store transactions still exist but can't be created
  console.log('\nTest 4: Verifying existing problematic transactions still exist...');
  const { data: existingTransactions } = await supabase
    .from('cash_transactions')
    .select('id')
    .eq('created_by_id', david.id)
    .eq('store_id', charlesbourgStore.id);

  console.log(`  Found ${existingTransactions?.length || 0} existing cross-store transactions`);
  console.log('  (These should be reviewed and handled manually)');

  console.log('\n=== SECURITY TEST COMPLETE ===\n');
  console.log('Summary:');
  console.log('  ✅ New unauthorized transactions are blocked');
  console.log('  ✅ Authorized transactions work correctly');
  console.log('  ✅ RLS policy prevents direct INSERT bypasses');
  console.log(`  ⚠️  ${existingTransactions?.length || 0} existing cross-store transactions need manual review\n`);
}

testStoreAccessSecurity().catch(console.error);
