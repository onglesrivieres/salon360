import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testSortedTechniciansRPC() {
  console.log('=== Testing get_sorted_technicians_for_store RPC ===\n');

  // Get stores
  const { data: stores } = await supabase
    .from('stores')
    .select('id, code, name')
    .eq('active', true);

  console.log('Active stores:', stores?.length);

  for (const store of stores || []) {
    console.log(`\n=== Store: ${store.name} (${store.code}) ===`);
    console.log(`Store ID: ${store.id}`);

    const today = new Date().toISOString().split('T')[0];
    console.log(`Date: ${today}`);

    const { data, error } = await supabase.rpc('get_sorted_technicians_for_store', {
      p_store_id: store.id,
      p_date: today
    });

    if (error) {
      console.error('Error:', error);
    } else {
      console.log(`Technicians returned: ${data?.length || 0}`);
      if (data && data.length > 0) {
        console.log('\nTechnicians:');
        data.forEach((tech, index) => {
          console.log(`${index + 1}. ${tech.display_name} - Status: ${tech.queue_status}, Role: ${tech.role?.join(', ')}`);
        });
      }
    }
  }

  // Also check employee_services for one of the stores
  console.log('\n=== Checking employee_services data ===');
  const { data: empServices } = await supabase
    .from('employee_services')
    .select(`
      employee_id,
      service_id,
      employee:employees!employee_services_employee_id_fkey(display_name, role, status)
    `)
    .limit(10);

  if (empServices && empServices.length > 0) {
    console.log('Sample employee_services:');
    empServices.forEach(es => {
      console.log(`- ${es.employee?.display_name}: status=${es.employee?.status}, service_id=${es.service_id.substring(0, 8)}...`);
    });
  }
}

testSortedTechniciansRPC().catch(console.error);
