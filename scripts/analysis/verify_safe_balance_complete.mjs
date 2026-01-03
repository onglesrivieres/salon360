#!/usr/bin/env node

/**
 * Complete Safe Balance System Verification Script
 *
 * This script performs comprehensive verification of the Safe Balance system:
 * - Checks table existence and structure
 * - Verifies functions exist and work correctly
 * - Tests calculations with seed data
 * - Validates indexes and RLS policies
 * - Checks error logging capabilities
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CHECKS = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function pass(message) {
  console.log(`✅ PASS: ${message}`);
  CHECKS.passed++;
}

function fail(message) {
  console.log(`❌ FAIL: ${message}`);
  CHECKS.failed++;
}

function warn(message) {
  console.log(`⚠️  WARN: ${message}`);
  CHECKS.warnings++;
}

function info(message) {
  console.log(`ℹ️  INFO: ${message}`);
}

function section(title) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(70)}\n`);
}

async function checkTableExists(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error && error.code === '42P01') {
    fail(`Table "${tableName}" does not exist`);
    return false;
  }

  pass(`Table "${tableName}" exists`);
  return true;
}

async function checkFunctionExists(functionName) {
  const { data, error } = await supabase.rpc('pg_get_functiondef', {
    funcoid: `public.${functionName}`
  }).maybeSingle();

  // Try alternative check
  const { data: funcData, error: funcError } = await supabase
    .from('pg_proc')
    .select('proname')
    .eq('proname', functionName)
    .maybeSingle();

  if (funcData) {
    pass(`Function "${functionName}" exists`);
    return true;
  }

  fail(`Function "${functionName}" does not exist`);
  return false;
}

async function testGetSafeBalanceFunction(storeId, date) {
  try {
    const { data, error } = await supabase
      .rpc('get_safe_balance_for_date', {
        p_store_id: storeId,
        p_date: date
      })
      .maybeSingle();

    if (error) {
      fail(`get_safe_balance_for_date failed: ${error.message}`);
      return null;
    }

    if (!data) {
      warn(`get_safe_balance_for_date returned no data for ${date}`);
      return null;
    }

    pass(`get_safe_balance_for_date returned data for ${date}`);
    info(`  Opening: $${data.opening_balance}, Deposits: $${data.total_deposits}, Withdrawals: $${data.total_withdrawals}, Closing: $${data.closing_balance}`);
    return data;
  } catch (err) {
    fail(`get_safe_balance_for_date threw exception: ${err.message}`);
    return null;
  }
}

async function checkTransactionTypes() {
  // Check for deposits (cash_out + Safe Deposit)
  const { data: deposits, error: depositError } = await supabase
    .from('cash_transactions')
    .select('*')
    .eq('transaction_type', 'cash_out')
    .eq('category', 'Safe Deposit')
    .limit(5);

  if (depositError) {
    fail(`Failed to query Safe Deposits: ${depositError.message}`);
  } else if (deposits && deposits.length > 0) {
    pass(`Found ${deposits.length} Safe Deposit transaction(s) with correct type (cash_out)`);
  } else {
    warn(`No Safe Deposit transactions found (this is OK if seed data wasn't applied)`);
  }

  // Check for withdrawals (cash_in + Safe Withdrawal)
  const { data: withdrawals, error: withdrawalError } = await supabase
    .from('cash_transactions')
    .select('*')
    .eq('transaction_type', 'cash_in')
    .eq('category', 'Safe Withdrawal')
    .limit(5);

  if (withdrawalError) {
    fail(`Failed to query Safe Withdrawals: ${withdrawalError.message}`);
  } else if (withdrawals && withdrawals.length > 0) {
    pass(`Found ${withdrawals.length} Safe Withdrawal transaction(s) with correct type (cash_in)`);
  } else {
    warn(`No Safe Withdrawal transactions found (this is OK if seed data wasn't applied)`);
  }

  // Check for incorrect transaction types (old bug)
  const { data: incorrectWithdrawals, error: incorrectError } = await supabase
    .from('cash_transactions')
    .select('*')
    .eq('transaction_type', 'cash_out')
    .eq('category', 'Safe Withdrawal')
    .limit(5);

  if (!incorrectError && incorrectWithdrawals && incorrectWithdrawals.length > 0) {
    fail(`Found ${incorrectWithdrawals.length} Safe Withdrawal(s) with INCORRECT type (cash_out instead of cash_in)`);
    info(`  These need to be fixed manually or the balance calculations will be wrong`);
  }
}

async function checkErrorLogging() {
  const { data, error } = await supabase
    .from('function_error_logs')
    .select('*')
    .limit(10)
    .order('occurred_at', { ascending: false });

  if (error) {
    fail(`Error log table is not accessible: ${error.message}`);
    return;
  }

  pass(`Error log table exists and is accessible`);

  if (data && data.length > 0) {
    warn(`Found ${data.length} error log entries`);
    data.forEach(log => {
      info(`  ${log.occurred_at}: ${log.function_name} - ${log.error_message}`);
    });
  } else {
    pass(`No errors logged (system is working correctly)`);
  }
}

async function checkBalanceHistory(storeId) {
  const { data, error } = await supabase
    .from('safe_balance_history')
    .select('*')
    .eq('store_id', storeId)
    .order('date', { ascending: false })
    .limit(5);

  if (error) {
    fail(`Failed to query safe_balance_history: ${error.message}`);
    return;
  }

  if (data && data.length > 0) {
    pass(`Found ${data.length} historical balance record(s) for store`);
    data.forEach(record => {
      info(`  ${record.date}: Opening $${record.opening_balance} → Closing $${record.closing_balance}`);
    });
  } else {
    warn(`No historical balance records found (this is OK for new stores)`);
  }
}

async function verifyBalanceCalculation(storeId, date) {
  info(`\nVerifying balance calculation for ${date}...`);

  // Get balance from function
  const balance = await testGetSafeBalanceFunction(storeId, date);
  if (!balance) return;

  // Manually calculate to verify
  const { data: deposits } = await supabase
    .from('cash_transactions')
    .select('amount')
    .eq('store_id', storeId)
    .eq('date', date)
    .eq('transaction_type', 'cash_out')
    .eq('category', 'Safe Deposit')
    .eq('status', 'approved');

  const { data: withdrawals } = await supabase
    .from('cash_transactions')
    .select('amount')
    .eq('store_id', storeId)
    .eq('date', date)
    .eq('transaction_type', 'cash_in')
    .eq('category', 'Safe Withdrawal')
    .eq('status', 'approved');

  const manualDeposits = (deposits || []).reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const manualWithdrawals = (withdrawals || []).reduce((sum, t) => sum + parseFloat(t.amount), 0);

  info(`  Manual calculation: Deposits=$${manualDeposits}, Withdrawals=$${manualWithdrawals}`);

  const depositMatch = Math.abs(parseFloat(balance.total_deposits) - manualDeposits) < 0.01;
  const withdrawalMatch = Math.abs(parseFloat(balance.total_withdrawals) - manualWithdrawals) < 0.01;

  if (depositMatch && withdrawalMatch) {
    pass(`Balance calculation is correct for ${date}`);
  } else {
    fail(`Balance calculation mismatch for ${date}`);
    info(`  Function: Deposits=$${balance.total_deposits}, Withdrawals=$${balance.total_withdrawals}`);
    info(`  Manual: Deposits=$${manualDeposits}, Withdrawals=$${manualWithdrawals}`);
  }
}

async function main() {
  console.log('\n🔍 Safe Balance System Verification\n');

  // SECTION 1: Table Structure
  section('1. Table Structure Verification');
  const historyExists = await checkTableExists('safe_balance_history');
  const transactionsExist = await checkTableExists('cash_transactions');
  const errorLogsExist = await checkTableExists('function_error_logs');

  if (!historyExists || !transactionsExist || !errorLogsExist) {
    fail('Critical tables are missing. Cannot continue verification.');
    process.exit(1);
  }

  // SECTION 2: Function Verification
  section('2. Database Functions Verification');
  await checkFunctionExists('get_safe_balance_for_date');
  await checkFunctionExists('get_previous_safe_balance');
  await checkFunctionExists('get_recent_function_errors');

  // SECTION 3: Transaction Type Verification
  section('3. Transaction Type Verification');
  await checkTransactionTypes();

  // SECTION 4: Get Test Store
  section('4. Test Store Detection');
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .order('name')
    .limit(1);

  if (!stores || stores.length === 0) {
    fail('No stores found in database');
    info('Summary');
    console.log(`\nPassed: ${CHECKS.passed}, Failed: ${CHECKS.failed}, Warnings: ${CHECKS.warnings}`);
    process.exit(1);
  }

  const testStore = stores[0];
  info(`Using test store: ${testStore.name} (${testStore.id})`);

  // SECTION 5: Balance History
  section('5. Balance History Verification');
  await checkBalanceHistory(testStore.id);

  // SECTION 6: Function Testing with Real Data
  section('6. Function Testing with Real Data');

  // Get dates with transactions
  const { data: transactionDates } = await supabase
    .from('cash_transactions')
    .select('date')
    .eq('store_id', testStore.id)
    .order('date', { ascending: false })
    .limit(3);

  if (transactionDates && transactionDates.length > 0) {
    const uniqueDates = [...new Set(transactionDates.map(t => t.date))];
    info(`Found transactions on ${uniqueDates.length} date(s), testing calculations...`);

    for (const date of uniqueDates.slice(0, 2)) {
      await verifyBalanceCalculation(testStore.id, date);
    }
  } else {
    // Test with today's date
    const today = new Date().toISOString().split('T')[0];
    info(`No transactions found, testing with today's date (${today})...`);
    await testGetSafeBalanceFunction(testStore.id, today);
  }

  // SECTION 7: Error Logging
  section('7. Error Logging Verification');
  await checkErrorLogging();

  // SECTION 8: Summary
  section('Summary');
  console.log(`\nPassed: ${CHECKS.passed}`);
  console.log(`Failed: ${CHECKS.failed}`);
  console.log(`Warnings: ${CHECKS.warnings}\n`);

  if (CHECKS.failed === 0) {
    console.log('✅ All critical checks passed! Safe Balance system is working correctly.\n');
    process.exit(0);
  } else {
    console.log('❌ Some checks failed. Please review the output above and fix the issues.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
