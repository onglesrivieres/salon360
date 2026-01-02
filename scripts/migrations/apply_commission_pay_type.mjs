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
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationSQL = `
-- Drop the existing pay_type constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_pay_type_valid;

-- Add new constraint to include 'commission'
ALTER TABLE employees ADD CONSTRAINT employees_pay_type_valid
CHECK (pay_type IN ('hourly', 'daily', 'commission'));
`;

async function applyMigration() {
  console.log('Applying commission pay type migration...');

  try {
    // Execute the migration SQL directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      // Try alternative: execute each statement separately
      console.log('Trying alternative approach...');

      // First drop constraint
      const { error: error1 } = await supabase.rpc('exec', {
        sql: 'ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_pay_type_valid'
      });

      // Then add new constraint
      const { error: error2 } = await supabase.rpc('exec', {
        sql: "ALTER TABLE employees ADD CONSTRAINT employees_pay_type_valid CHECK (pay_type IN ('hourly', 'daily', 'commission'))"
      });

      if (error1 || error2) {
        console.error('Errors:', error1, error2);
        console.log('\nPlease run this SQL manually in your Supabase SQL Editor:');
        console.log(migrationSQL);
        process.exit(1);
      }
    }

    console.log('Migration applied successfully!');
    console.log('Commission pay type is now available for employees.');
  } catch (error) {
    console.error('Error applying migration:', error);
    console.log('\nPlease run this SQL manually in your Supabase SQL Editor:');
    console.log(migrationSQL);
    process.exit(1);
  }
}

applyMigration();
