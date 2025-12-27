import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function checkTableExists() {
  console.log('=== CHECKING ATTENDANCE_CHANGE_PROPOSALS TABLE ===\n');

  const { data, error } = await supabase
    .from('attendance_change_proposals')
    .select('id')
    .limit(1);

  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('not found') || error.message.includes('schema cache')) {
      console.log('❌ Table does NOT exist');
      console.log('Error:', error.message);
      return false;
    }
    console.log('⚠️  Error checking table:', error);
    return false;
  }

  console.log('✅ Table EXISTS');
  return true;
}

async function checkMisspelledTable() {
  console.log('\n=== CHECKING FOR MISSPELLED TABLE ===\n');

  const { data, error } = await supabase
    .from('attenadance_change_proposals')
    .select('id')
    .limit(1);

  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('not found') || error.message.includes('schema cache')) {
      console.log('✅ Misspelled table does NOT exist (good!)');
      return false;
    }
  } else {
    console.log('⚠️  WARNING: Misspelled table "attenadance_change_proposals" EXISTS!');
    console.log('This table should be dropped before creating the correct one.');
    return true;
  }

  return false;
}

async function checkHelperFunctions() {
  console.log('\n=== CHECKING HELPER FUNCTIONS ===\n');

  try {
    const { data: hasPendingData, error: hasPendingError } = await supabase
      .rpc('has_pending_proposal', { p_attendance_record_id: '00000000-0000-0000-0000-000000000000' });

    if (hasPendingError) {
      console.log('❌ has_pending_proposal function does NOT exist');
      console.log('   Error:', hasPendingError.message);
    } else {
      console.log('✅ has_pending_proposal function EXISTS');
    }
  } catch (e) {
    console.log('❌ has_pending_proposal function check failed:', e.message);
  }

  try {
    const { data: countData, error: countError } = await supabase
      .rpc('get_pending_proposals_count', { p_store_id: '00000000-0000-0000-0000-000000000000' });

    if (countError) {
      console.log('❌ get_pending_proposals_count function does NOT exist');
      console.log('   Error:', countError.message);
    } else {
      console.log('✅ get_pending_proposals_count function EXISTS');
    }
  } catch (e) {
    console.log('❌ get_pending_proposals_count function check failed:', e.message);
  }
}

async function main() {
  const tableExists = await checkTableExists();
  const misspelledExists = await checkMisspelledTable();
  await checkHelperFunctions();

  console.log('\n=== SUMMARY ===\n');
  if (!tableExists) {
    console.log('⚠️  ISSUE: The attendance_change_proposals table needs to be created!');
    console.log('\nTO FIX:');
    console.log('1. The migration file exists at: ATTENDANCE_PROPOSALS_MIGRATION.sql');
    console.log('2. You need to apply this migration to your Supabase database');
    console.log('3. Go to Supabase Dashboard > SQL Editor');
    console.log('4. Copy the SQL from ATTENDANCE_PROPOSALS_MIGRATION.sql');
    console.log('5. Paste and run it in the SQL Editor');
  } else {
    console.log('✅ Everything looks good!');
  }

  if (misspelledExists) {
    console.log('\n⚠️  ADDITIONAL ACTION REQUIRED:');
    console.log('Drop the misspelled table "attenadance_change_proposals" first!');
  }
}

main().catch(console.error);
