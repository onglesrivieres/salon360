import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function analyzeServiceConnections() {
  console.log('=== ANALYZING SERVICE ARCHITECTURE ===\n');

  const globalServices = await supabase.from('services').select('id, code, name, active').eq('active', true).limit(5);
  console.log('1. GLOBAL SERVICES TABLE:');
  console.log('   Count:', globalServices.data?.length || 0);
  if (globalServices.data) {
    globalServices.data.forEach(s => console.log('   -', s.code, ':', s.name));
  }

  const stores = await supabase.from('stores').select('id, name, code').eq('active', true);
  console.log('\n2. STORE-SPECIFIC SERVICES:');
  for (const store of stores.data || []) {
    const storeServices = await supabase.from('store_services').select('id, code, name, service_id, active').eq('store_id', store.id).eq('active', true).limit(3);
    console.log('   Store:', store.name);
    console.log('   Count:', storeServices.data?.length || 0);
    if (storeServices.data) {
      storeServices.data.forEach(ss => {
        console.log('     *', ss.code, ':', ss.name);
        console.log('       store_services.id:', ss.id.substring(0, 8) + '...');
        console.log('       references services.id:', ss.service_id ? ss.service_id.substring(0, 8) + '...' : 'NULL');
      });
    }
  }

  const empServices = await supabase.from('employee_services').select('id, employee_id, service_id').limit(5);
  console.log('\n3. EMPLOYEE SERVICE ASSIGNMENTS:');
  console.log('   Total:', empServices.data?.length || 0);
  for (const es of empServices.data || []) {
    const emp = await supabase.from('employees').select('display_name').eq('id', es.employee_id).single();
    const service = await supabase.from('services').select('code, name').eq('id', es.service_id).single();
    console.log('   -', emp.data?.display_name, ':', service.data?.code);
    console.log('     References services.id:', es.service_id.substring(0, 8) + '...');
  }

  console.log('\n4. THE PROBLEM:');
  console.log('   Current: employee_services.service_id -> services.id (GLOBAL)');
  console.log('   Should be: employee_services.store_service_id -> store_services.id (STORE-SPECIFIC)');
}

analyzeServiceConnections().catch(console.error);
