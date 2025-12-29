import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://kycnryuiramusmdedqnq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('=== APPLYING SANS SOUCI STORE MIGRATION ===\n');

  // Read the migration file
  const migrationSQL = readFileSync('./supabase/migrations/20251229185127_add_sans_souci_store.sql', 'utf8');

  // Split into individual statements (excluding comments and the final SELECT)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('/*') && !s.startsWith('--') && !s.startsWith('SELECT'));

  console.log(`Executing ${statements.length} SQL statements...\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement) {
      console.log(`Statement ${i + 1}:`, statement.substring(0, 50) + '...');

      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
        // Continue anyway - might be a duplicate insert
      } else {
        console.log(`✓ Statement ${i + 1} executed successfully`);
      }
    }
  }

  console.log('\n=== VERIFYING SANS SOUCI STORE ===\n');

  const { data: sansSouci, error: verifyError } = await supabase
    .from('stores')
    .select('*')
    .eq('code', 'SS')
    .maybeSingle();

  if (verifyError) {
    console.error('Error verifying store:', verifyError);
  } else if (sansSouci) {
    console.log('✓ Sans Souci store found in database:');
    console.log(JSON.stringify(sansSouci, null, 2));
  } else {
    console.log('✗ Sans Souci store not found - trying direct insert...');

    // Try direct insert
    const { data: insertData, error: insertError } = await supabase
      .from('stores')
      .insert({
        name: 'Sans Souci',
        code: 'SS',
        active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting store:', insertError);
    } else {
      console.log('✓ Store inserted successfully:', insertData);

      // Update opening hours
      const { error: openingError } = await supabase
        .from('stores')
        .update({
          opening_hours: {
            monday: '10:00:00',
            tuesday: '10:00:00',
            wednesday: '10:00:00',
            thursday: '10:00:00',
            friday: '10:00:00',
            saturday: '09:00:00',
            sunday: '10:00:00'
          }
        })
        .eq('code', 'SS');

      if (openingError) {
        console.error('Error updating opening hours:', openingError);
      } else {
        console.log('✓ Opening hours updated');
      }

      // Update closing hours
      const { error: closingError } = await supabase
        .from('stores')
        .update({
          closing_hours: {
            monday: '19:00:00',
            tuesday: '19:00:00',
            wednesday: '19:00:00',
            thursday: '21:00:00',
            friday: '21:00:00',
            saturday: '19:00:00',
            sunday: '18:00:00'
          }
        })
        .eq('code', 'SS');

      if (closingError) {
        console.error('Error updating closing hours:', closingError);
      } else {
        console.log('✓ Closing hours updated');
      }
    }
  }

  console.log('\n=== ALL STORES IN DATABASE ===\n');

  const { data: allStores, error: allError } = await supabase
    .from('stores')
    .select('*')
    .order('name');

  if (allError) {
    console.error('Error fetching all stores:', allError);
  } else {
    console.log(`Found ${allStores?.length || 0} stores:\n`);
    allStores?.forEach(store => {
      console.log(`- ${store.name} (${store.code}) - Active: ${store.active}`);
    });
  }
}

applyMigration().catch(console.error);
