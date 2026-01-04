import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillSnapshots() {
  try {
    console.log('Starting safe balance snapshot backfill...\n');

    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name');

    if (storesError) throw storesError;

    if (!stores || stores.length === 0) {
      console.log('No stores found');
      return;
    }

    for (const store of stores) {
      console.log(`\nBackfilling snapshots for store: ${store.name}`);
      console.log('='.repeat(60));

      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('store_id', store.id)
        .limit(1)
        .maybeSingle();

      if (empError || !employees) {
        console.log(`  ⚠️  No employees found for store ${store.name}, skipping`);
        continue;
      }

      const startDate = '2025-01-01';
      const endDate = new Date().toISOString().split('T')[0];

      console.log(`  Date range: ${startDate} to ${endDate}`);

      const { data: results, error: backfillError } = await supabase
        .rpc('backfill_safe_balance_snapshots', {
          p_store_id: store.id,
          p_start_date: startDate,
          p_end_date: endDate,
          p_employee_id: employees.id,
        });

      if (backfillError) {
        console.error(`  ❌ Error backfilling for ${store.name}:`, backfillError);
        continue;
      }

      if (results) {
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        console.log(`  ✅ Successfully created: ${successCount} snapshots`);
        if (failCount > 0) {
          console.log(`  ❌ Failed: ${failCount} snapshots`);

          const failures = results.filter(r => !r.success).slice(0, 5);
          failures.forEach(f => {
            console.log(`     - ${f.date}: ${f.message}`);
          });
          if (failCount > 5) {
            console.log(`     ... and ${failCount - 5} more failures`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Backfill complete!');
    console.log('\nVerifying snapshots...');

    for (const store of stores) {
      const { data: snapshots, error } = await supabase
        .from('safe_balance_history')
        .select('date')
        .eq('store_id', store.id)
        .order('date', { ascending: true });

      if (error) {
        console.error(`Error checking snapshots for ${store.name}:`, error);
        continue;
      }

      if (snapshots && snapshots.length > 0) {
        const firstDate = snapshots[0].date;
        const lastDate = snapshots[snapshots.length - 1].date;
        console.log(`  ${store.name}: ${snapshots.length} snapshots (${firstDate} to ${lastDate})`);
      } else {
        console.log(`  ${store.name}: No snapshots found`);
      }
    }

  } catch (error) {
    console.error('Fatal error during backfill:', error);
    process.exit(1);
  }
}

backfillSnapshots();
