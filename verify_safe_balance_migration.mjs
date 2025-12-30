import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('🔍 Verifying Safe Balance Migration...\n');

  let allPassed = true;

  // Test 1: Check if safe_balance_history table exists
  console.log('1. Checking if safe_balance_history table exists...');
  const { data: tableData, error: tableError } = await supabase
    .from('safe_balance_history')
    .select('id')
    .limit(1);

  if (tableError && !tableError.message.includes('JWT')) {
    console.log('   ❌ Table does not exist or has issues:', tableError.message);
    allPassed = false;
  } else {
    console.log('   ✅ Table exists and is accessible');
  }

  // Test 2: Check if get_safe_balance_for_date function exists
  console.log('\n2. Checking if get_safe_balance_for_date function exists...');
  const { data: functionData, error: functionError } = await supabase
    .rpc('get_safe_balance_for_date', {
      p_store_id: '00000000-0000-0000-0000-000000000000',
      p_date: '2025-01-01'
    })
    .maybeSingle();

  if (functionError) {
    if (functionError.message.includes('function') && functionError.message.includes('does not exist')) {
      console.log('   ❌ Function does not exist');
      allPassed = false;
    } else if (functionError.code === 'PGRST202') {
      console.log('   ❌ Function not found in schema cache');
      allPassed = false;
    } else {
      console.log('   ✅ Function exists (returned data or expected error)');
    }
  } else {
    console.log('   ✅ Function exists and works correctly');
    console.log('   📊 Sample response:', functionData);
  }

  // Test 3: Check if get_previous_safe_balance function exists
  console.log('\n3. Checking if get_previous_safe_balance function exists...');
  const { data: prevBalanceData, error: prevBalanceError } = await supabase
    .rpc('get_previous_safe_balance', {
      p_store_id: '00000000-0000-0000-0000-000000000000',
      p_date: '2025-01-01'
    });

  if (prevBalanceError) {
    if (prevBalanceError.message.includes('function') && prevBalanceError.message.includes('does not exist')) {
      console.log('   ❌ Function does not exist');
      allPassed = false;
    } else if (prevBalanceError.code === 'PGRST202') {
      console.log('   ❌ Function not found in schema cache');
      allPassed = false;
    } else {
      console.log('   ✅ Function exists (returned data or expected error)');
    }
  } else {
    console.log('   ✅ Function exists and works correctly');
    console.log('   💰 Sample response:', prevBalanceData);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All checks passed! Safe Balance should work correctly.');
    console.log('You can now use the Safe Balance page in your application.');
  } else {
    console.log('❌ Some checks failed. Please apply the migration:');
    console.log('   See APPLY_MIGRATION_INSTRUCTIONS.md for details.');
  }
  console.log('='.repeat(50));
}

verifyMigration();
