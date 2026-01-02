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

async function checkAndCreateFunction() {
  console.log('Checking if get_safe_balance_for_date function exists...');

  // Test if the function exists by calling it
  const { data, error } = await supabase
    .rpc('get_safe_balance_for_date', {
      p_store_id: '00000000-0000-0000-0000-000000000000',
      p_date: '2025-01-01'
    })
    .maybeSingle();

  if (error) {
    if (error.message.includes('function') && error.message.includes('does not exist')) {
      console.log('❌ Function does not exist. Migration needs to be applied manually.');
      console.log('\nPlease apply the migration manually by:');
      console.log('1. Go to your Supabase Dashboard SQL Editor');
      console.log('2. Copy the SQL from: supabase/migrations/20251230000000_create_safe_balance_system.sql');
      console.log('3. Execute it in the SQL Editor');
      console.log('\nOr use the Supabase CLI:');
      console.log('   supabase db push');
      return false;
    } else {
      console.log('Error checking function:', error);
      return false;
    }
  }

  console.log('✅ Function exists and is working!');
  return true;
}

checkAndCreateFunction();
