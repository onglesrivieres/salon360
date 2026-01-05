import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkEmployeeServices() {
  console.log('=== Checking employee_services table ===\n');

  // Check total records
  const { data: allRecords, error: allError } = await supabase
    .from('employee_services')
    .select('*');

  if (allError) {
    console.error('Error fetching employee_services:', allError);
    return;
  }

  console.log(`Total records in employee_services: ${allRecords.length}\n`);

  // Check if service_id references exist in services table
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id, code, name');

  if (servicesError) {
    console.error('Error fetching services:', servicesError);
    return;
  }

  console.log(`Total services in services table: ${services.length}\n`);

  const validServiceIds = new Set(services.map(s => s.id));

  const invalidRecords = allRecords.filter(record => !validServiceIds.has(record.service_id));

  console.log(`Invalid records (service_id not in services table): ${invalidRecords.length}`);

  if (invalidRecords.length > 0) {
    console.log('\nSample invalid records:');
    console.log(invalidRecords.slice(0, 5));
  }

  // Check valid records
  const validRecords = allRecords.filter(record => validServiceIds.has(record.service_id));
  console.log(`\nValid records: ${validRecords.length}`);

  if (validRecords.length > 0) {
    console.log('\nSample valid records:');
    console.log(validRecords.slice(0, 5));
  }

  // Show sample of employee_services with employee names
  if (allRecords.length > 0) {
    const { data: employeeServicesWithNames, error: joinError } = await supabase
      .from('employee_services')
      .select(`
        id,
        employee_id,
        service_id,
        employees:employee_id (display_name)
      `)
      .limit(10);

    if (!joinError && employeeServicesWithNames) {
      console.log('\n=== Sample employee_services with names ===');
      employeeServicesWithNames.forEach(es => {
        console.log(`- ${es.employees?.display_name}: service_id=${es.service_id}`);
      });
    }
  }
}

checkEmployeeServices().catch(console.error);
