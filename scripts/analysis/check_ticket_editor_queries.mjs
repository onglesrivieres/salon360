import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTicketEditorData() {
  console.log('=== Simulating Ticket Editor Data Loading ===\n');

  // Get stores
  const { data: stores } = await supabase
    .from('stores')
    .select('id, code, name')
    .eq('active', true);

  console.log('Active stores:', stores?.length);
  const selectedStoreId = stores?.[0]?.id;
  console.log('Using store:', stores?.[0]?.name, '-', selectedStoreId, '\n');

  // 1. Check services query (simulating get_services_by_popularity RPC)
  const { data: services, error: servicesError } = await supabase
    .rpc('get_services_by_popularity', {
      p_store_id: selectedStoreId
    });

  console.log('Services from RPC:');
  if (servicesError) {
    console.error('Error:', servicesError);
  } else {
    console.log(`Count: ${services?.length || 0}`);
    if (services && services.length > 0) {
      console.log('Sample:', services.slice(0, 3).map(s => ({ id: s.id, code: s.code, name: s.name })));
    }
  }
  console.log();

  // 2. Check employees query
  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('*')
    .or('status.eq.Active,status.eq.active')
    .order('display_name');

  console.log('Active Employees:');
  if (employeesError) {
    console.error('Error:', employeesError);
  } else {
    console.log(`Count: ${employees?.length || 0}`);
    if (employees && employees.length > 0) {
      console.log('Sample:', employees.slice(0, 3).map(e => ({
        id: e.id,
        name: e.display_name,
        role: e.role,
        status: e.status
      })));
    }
  }
  console.log();

  // 3. Check employee_services query
  const { data: employeeServices, error: esError } = await supabase
    .from('employee_services')
    .select('employee_id, service_id');

  console.log('Employee Services:');
  if (esError) {
    console.error('Error:', esError);
  } else {
    console.log(`Count: ${employeeServices?.length || 0}`);

    // Build map
    const servicesMap = {};
    (employeeServices || []).forEach(es => {
      if (!servicesMap[es.employee_id]) {
        servicesMap[es.employee_id] = [];
      }
      servicesMap[es.employee_id].push(es.service_id);
    });

    console.log('Employees with service assignments:', Object.keys(servicesMap).length);

    // Show a few examples
    const sampleEmployeeIds = Object.keys(servicesMap).slice(0, 3);
    for (const empId of sampleEmployeeIds) {
      const emp = employees?.find(e => e.id === empId);
      console.log(`- ${emp?.display_name || empId}: ${servicesMap[empId].length} services`);
    }
  }
  console.log();

  // 4. Check employee_stores query
  const { data: employeeStores, error: estoError } = await supabase
    .from('employee_stores')
    .select('employee_id, store_id');

  console.log('Employee Stores:');
  if (estoError) {
    console.error('Error:', estoError);
  } else {
    console.log(`Count: ${employeeStores?.length || 0}`);

    const storesMap = {};
    (employeeStores || []).forEach(es => {
      if (!storesMap[es.employee_id]) {
        storesMap[es.employee_id] = [];
      }
      storesMap[es.employee_id].push(es.store_id);
    });

    console.log('Employees with store assignments:', Object.keys(storesMap).length);
  }
  console.log();

  // 5. Simulate the filtering logic from loadData
  console.log('=== SIMULATING TICKET EDITOR FILTERING ===\n');

  const servicesMap = {};
  (employeeServices || []).forEach(es => {
    if (!servicesMap[es.employee_id]) {
      servicesMap[es.employee_id] = [];
    }
    servicesMap[es.employee_id].push(es.service_id);
  });

  const storesMap = {};
  (employeeStores || []).forEach(es => {
    if (!storesMap[es.employee_id]) {
      storesMap[es.employee_id] = [];
    }
    storesMap[es.employee_id].push(es.store_id);
  });

  const allEmployees = (employees || []).filter(emp => {
    const hasAssignedServices = servicesMap[emp.id] && servicesMap[emp.id].length > 0;
    const isServicePerformingRole = (
      emp.role.includes('Technician') ||
      emp.role.includes('Spa Expert') ||
      emp.role.includes('Supervisor') ||
      emp.role.includes('Receptionist')
    ) && !emp.role.includes('Cashier');
    return hasAssignedServices || isServicePerformingRole;
  });

  console.log('After role/service filtering:', allEmployees.length);

  const storeFilteredEmployees = selectedStoreId
    ? allEmployees.filter(emp => {
        const employeeStores = storesMap[emp.id];
        return !employeeStores || employeeStores.length === 0 || employeeStores.includes(selectedStoreId);
      })
    : allEmployees;

  console.log('After store filtering:', storeFilteredEmployees.length);

  if (storeFilteredEmployees.length > 0) {
    console.log('\nFiltered employees:');
    storeFilteredEmployees.slice(0, 5).forEach(emp => {
      const hasServices = servicesMap[emp.id]?.length > 0;
      const stores = storesMap[emp.id];
      console.log(`- ${emp.display_name}: role=${emp.role}, services=${hasServices ? servicesMap[emp.id].length : 0}, stores=${stores ? stores.length : 'all'}`);
    });
  } else {
    console.log('\n⚠️ NO EMPLOYEES PASSED FILTERING!');
  }
}

checkTicketEditorData().catch(console.error);
