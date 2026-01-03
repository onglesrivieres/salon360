import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const TRANSACTION_IDS_TO_DELETE = [
  '73992b58-78ee-4ff4-bf82-720f38734b75',
  'd4199156-8642-4674-b744-9e3f9258a4e8',
  '8e99ee1b-ac60-4e36-9438-2d4f91c27f43',
  'eb0345f2-df41-4d26-9794-0e0dadb1d4f3',
  '668a97b5-37ee-4928-bf33-3981c550b044',
  'a946d4af-fefc-42b4-8c9a-f554f46a8cef',
  '04977fed-0cbf-485e-b35d-0e4194091c32',
  'a6b6e069-78c3-4ea0-98a5-5ae23b35a292',
  '320faf09-102c-49c4-8248-bb9d490d790a',
  '56222a23-702b-4ffb-a4aa-9df9df940937',
  '875a8a8c-0690-4c5a-a56d-53e6dc60bf9b',
  '7231516b-8493-4c0f-8407-ab52e1080c5e',
  '33bf4053-71ae-49d3-8862-2b3fb33744fa',
  'd320c0f2-8fa0-4673-bcef-73e6de454f93'
];

async function deleteCrossStoreTransactions() {
  console.log('🗑️  Deleting cross-store transactions...\n');
  console.log(`Total transactions to delete: ${TRANSACTION_IDS_TO_DELETE.length}\n`);

  // First, let's check if there are any related records in cash_transaction_edit_history
  console.log('Checking for related edit history records...');
  const { data: historyRecords, error: historyError } = await supabase
    .from('cash_transaction_edit_history')
    .select('id, transaction_id')
    .in('transaction_id', TRANSACTION_IDS_TO_DELETE);

  if (historyError) {
    console.error('Error checking edit history:', historyError);
  } else {
    console.log(`Found ${historyRecords.length} edit history records to delete\n`);

    if (historyRecords.length > 0) {
      console.log('Deleting edit history records...');
      const { error: deleteHistoryError } = await supabase
        .from('cash_transaction_edit_history')
        .delete()
        .in('transaction_id', TRANSACTION_IDS_TO_DELETE);

      if (deleteHistoryError) {
        console.error('Error deleting edit history:', deleteHistoryError);
        return;
      }
      console.log('✅ Edit history records deleted successfully\n');
    }
  }

  // Now delete the transactions
  console.log('Deleting cash transactions...');
  let deletedCount = 0;
  let failedCount = 0;

  for (const txId of TRANSACTION_IDS_TO_DELETE) {
    const { error } = await supabase
      .from('cash_transactions')
      .delete()
      .eq('id', txId);

    if (error) {
      console.error(`❌ Failed to delete transaction ${txId}:`, error.message);
      failedCount++;
    } else {
      console.log(`✅ Deleted transaction ${txId}`);
      deletedCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DELETION SUMMARY:');
  console.log(`Successfully deleted: ${deletedCount} transactions`);
  console.log(`Failed to delete: ${failedCount} transactions`);
  console.log('='.repeat(60));

  return { deletedCount, failedCount };
}

deleteCrossStoreTransactions();
