import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Permissions } from '../lib/permissions';
import { WeeklyCalendarView } from '../components/WeeklyCalendarView';

interface TechnicianSummary {
  technician_id: string;
  technician_name: string;
  services_count: number;
  revenue: number;
  tips_customer: number;
  tips_receptionist: number;
  tips_total: number;
  tips_cash: number;
  tips_card: number;
  items: ServiceItemDetail[];
}

interface ServiceItemDetail {
  ticket_id: string;
  service_code: string;
  service_name: string;
  price: number;
  tip_customer: number;
  tip_receptionist: number;
  tip_cash: number;
  tip_card: number;
  payment_method: string;
  opened_at: string;
  closed_at: string | null;
  ticket_completed_at: string | null;
  duration_min: number;
  started_at: string | null;
  completed_at: string | null;
  store_code: string;
  store_name: string;
}

interface TipReportWeeklyViewProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function TipReportWeeklyView({ selectedDate, onDateChange }: TipReportWeeklyViewProps) {
  const [summaries, setSummaries] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [weeklyData, setWeeklyData] = useState<Map<string, Map<string, Array<{ store_id: string; store_code: string; revenue: number }>>>>(new Map());
  const { showToast } = useToast();
  const { session, selectedStoreId } = useAuth();

  useEffect(() => {
    fetchWeeklyData();
  }, [selectedDate, selectedStoreId]);

  function getDateRange(currentDate: Date) {
    // Bi-weekly payroll periods starting from October 13, 2024 (Sunday)
    const payrollStartDate = new Date(2024, 9, 13); // October 13, 2024

    // Normalize dates to midnight for accurate day calculation
    const normalizedCurrent = new Date(currentDate);
    normalizedCurrent.setHours(0, 0, 0, 0);

    const normalizedStart = new Date(payrollStartDate);
    normalizedStart.setHours(0, 0, 0, 0);

    const daysSinceStart = Math.floor((normalizedCurrent.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24));
    const periodNumber = Math.floor(daysSinceStart / 14);

    const periodStart = new Date(normalizedStart);
    periodStart.setDate(periodStart.getDate() + (periodNumber * 14));

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 13); // 14 days total (0-13)

    // Use local date formatting to avoid timezone conversion
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDate = formatLocalDate(periodStart);
    const endDate = formatLocalDate(periodEnd);
    return { startDate, endDate, periodStart, periodEnd };
  }

  function getPeriodDates(): string[] {
    const currentDate = new Date(selectedDate + 'T00:00:00');
    const { periodStart, periodEnd } = getDateRange(currentDate);

    const dates: string[] = [];
    for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    return dates;
  }

  function getCurrentPeriodLabel(): string {
    const currentDate = new Date(selectedDate + 'T00:00:00');
    const { periodStart, periodEnd } = getDateRange(currentDate);

    const startYear = periodStart.getFullYear();
    const endYear = periodEnd.getFullYear();

    if (startYear !== endYear) {
      const formatDateWithYear = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      return `${formatDateWithYear(periodStart)} - ${formatDateWithYear(periodEnd)}`;
    } else {
      const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
      return `${formatDate(periodStart)} - ${formatDate(periodEnd)}/${endYear}`;
    }
  }

  function navigatePeriod(direction: 'prev' | 'next') {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + (direction === 'prev' ? -14 : 14));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    onDateChange(`${year}-${month}-${day}`);
  }

  async function fetchDailyTipData(dateToFetch: string): Promise<Map<string, TechnicianSummary>> {
    const canViewAll = session?.role_permission ? Permissions.endOfDay.canViewAll(session.role_permission) : false;
    const isTechnician = !canViewAll;

    const { data: allEmployeeStores, error: allEmployeeStoresError } = await supabase
      .from('employee_stores')
      .select('employee_id, store_id');

    if (allEmployeeStoresError) {
      throw allEmployeeStoresError;
    }

    const employeeStoreMap = new Map<string, string[]>();
    for (const es of allEmployeeStores || []) {
      if (!employeeStoreMap.has(es.employee_id)) {
        employeeStoreMap.set(es.employee_id, []);
      }
      employeeStoreMap.get(es.employee_id)!.push(es.store_id);
    }

    const multiStoreEmployees = new Set<string>();
    for (const [empId, stores] of employeeStoreMap.entries()) {
      if (stores.length > 1) {
        multiStoreEmployees.add(empId);
      }
    }

    let storeIds: string[] = [];

    if (isTechnician && session?.employee_id) {
      storeIds = employeeStoreMap.get(session.employee_id) || [];
    } else if (canViewAll && selectedStoreId) {
      const relevantStores = new Set<string>([selectedStoreId]);

      for (const empId of multiStoreEmployees) {
        const empStores = employeeStoreMap.get(empId) || [];
        if (empStores.includes(selectedStoreId)) {
          for (const storeId of empStores) {
            relevantStores.add(storeId);
          }
        }
      }

      storeIds = Array.from(relevantStores);
    }

    let query = supabase
      .from('sale_tickets')
      .select(
        `
        id,
        total,
        payment_method,
        opened_at,
        closed_at,
        completed_at,
        store_id,
        store:stores!sale_tickets_store_id_fkey(id, name, code),
        ticket_items${isTechnician ? '!inner' : ''} (
          id,
          store_service_id,
          custom_service_name,
          employee_id,
          qty,
          price_each,
          addon_price,
          tip_customer_cash,
          tip_customer_card,
          tip_receptionist,
          started_at,
          completed_at,
          service:store_services!ticket_items_store_service_id_fkey(code, name, duration_min),
          employee:employees!ticket_items_employee_id_fkey(
            id,
            display_name
          )
        )
      `
      )
      .eq('ticket_date', dateToFetch);

    if (storeIds.length > 0) {
      query = query.in('store_id', storeIds);
    } else if (selectedStoreId) {
      query = query.eq('store_id', selectedStoreId);
    }

    if (isTechnician && session?.employee_id) {
      query = query.eq('ticket_items.employee_id', session.employee_id);
    }

    query = query.is('voided_at', null);

    const { data: tickets, error: ticketsError } = await query;

    if (ticketsError) throw ticketsError;

    const technicianMap = new Map<string, TechnicianSummary>();

    for (const ticket of tickets || []) {
      const ticketStoreId = (ticket as any).store_id;

      for (const item of (ticket as any).ticket_items || []) {
        const itemRevenue = (parseFloat(item.qty) || 0) * (parseFloat(item.price_each) || 0) + (parseFloat(item.addon_price) || 0);
        const techId = item.employee_id;
        const technician = item.employee;

        if (!technician) continue;

        if (isTechnician && session?.employee_id && techId !== session.employee_id) {
          continue;
        }

        if (canViewAll && selectedStoreId) {
          const empStores = employeeStoreMap.get(techId) || [];
          if (!empStores.includes(selectedStoreId)) {
            continue;
          }

          if (ticketStoreId !== selectedStoreId && !multiStoreEmployees.has(techId)) {
            continue;
          }
        }

        if (!technicianMap.has(techId)) {
          technicianMap.set(techId, {
            technician_id: techId,
            technician_name: technician.display_name,
            services_count: 0,
            revenue: 0,
            tips_customer: 0,
            tips_receptionist: 0,
            tips_total: 0,
            tips_cash: 0,
            tips_card: 0,
            items: [],
          });
        }

        const summary = technicianMap.get(techId)!;
        const tipCustomerCash = item.tip_customer_cash || 0;
        const tipCustomerCard = item.tip_customer_card || 0;
        const tipCustomer = tipCustomerCash + tipCustomerCard;
        const tipReceptionist = item.tip_receptionist || 0;
        const tipCash = tipCustomerCash;
        const tipCard = tipCustomerCard + tipReceptionist;

        summary.services_count += 1;
        summary.revenue += itemRevenue;
        summary.tips_customer += tipCustomer;
        summary.tips_receptionist += tipReceptionist;
        summary.tips_total += tipCustomer + tipReceptionist;
        summary.tips_cash += tipCash;
        summary.tips_card += tipCard;

        summary.items.push({
          ticket_id: ticket.id,
          service_code: item.service?.code || '',
          service_name: item.service?.name || '',
          price: itemRevenue,
          tip_customer: tipCustomer,
          tip_receptionist: tipReceptionist,
          tip_cash: tipCash,
          tip_card: tipCard,
          payment_method: (ticket as any).payment_method || '',
          opened_at: (ticket as any).opened_at,
          closed_at: ticket.closed_at,
          ticket_completed_at: (ticket as any).completed_at || null,
          duration_min: item.service?.duration_min || 0,
          started_at: item.started_at || null,
          completed_at: item.completed_at || null,
          store_code: (ticket as any).store?.code || '',
          store_name: (ticket as any).store?.name || '',
        });
      }
    }

    return technicianMap;
  }

  async function fetchWeeklyData() {
    try {
      setLoading(true);

      const periodDates = getPeriodDates();

      const dailyDataPromises = periodDates.map(date => fetchDailyTipData(date));
      const dailyDataResults = await Promise.all(dailyDataPromises);

      const dataMap = new Map<string, Map<string, Map<string, { store_id: string; store_code: string; revenue: number }>>>();

      periodDates.forEach((date, index) => {
        const technicianMap = dailyDataResults[index];

        for (const [techId, summary] of technicianMap.entries()) {
          if (!dataMap.has(techId)) {
            dataMap.set(techId, new Map());
          }

          const techMap = dataMap.get(techId)!;
          if (!techMap.has(date)) {
            techMap.set(date, new Map());
          }

          const dateMap = techMap.get(date)!;

          const storeBreakdown = new Map<string, { store_id: string; store_code: string; revenue: number }>();

          for (const item of summary.items) {
            const storeId = item.store_code;
            if (!storeBreakdown.has(storeId)) {
              storeBreakdown.set(storeId, {
                store_id: storeId,
                store_code: item.store_code,
                revenue: 0,
              });
            }

            const storeData = storeBreakdown.get(storeId)!;
            storeData.revenue += item.price;
          }

          for (const [storeId, storeData] of storeBreakdown.entries()) {
            dateMap.set(storeId, storeData);
          }
        }
      });

      const finalData = new Map<string, Map<string, Array<{ store_id: string; store_code: string; revenue: number }>>>();

      for (const [techId, dateMap] of dataMap.entries()) {
        const techDateMap = new Map<string, Array<{ store_id: string; store_code: string; revenue: number }>>();

        for (const [date, storeMap] of dateMap.entries()) {
          const storesArray = Array.from(storeMap.values());
          techDateMap.set(date, storesArray);
        }

        finalData.set(techId, techDateMap);
      }

      const techNames = new Map<string, string>();
      for (const technicianMap of dailyDataResults) {
        for (const [techId, summary] of technicianMap.entries()) {
          techNames.set(techId, summary.technician_name);
        }
      }

      const sortedData = new Map(
        Array.from(finalData.entries()).sort((a, b) => {
          const nameA = techNames.get(a[0]) || '';
          const nameB = techNames.get(b[0]) || '';
          return nameA.localeCompare(nameB);
        })
      );

      setWeeklyData(sortedData);

      const technicianMap = new Map<string, TechnicianSummary>();
      for (const [techId, dayMap] of sortedData.entries()) {
        const techName = techNames.get(techId) || 'Unknown';
        let totalRevenue = 0;

        for (const storesArray of dayMap.values()) {
          for (const storeData of storesArray) {
            totalRevenue += storeData.revenue;
          }
        }

        technicianMap.set(techId, {
          technician_id: techId,
          technician_name: techName,
          services_count: 0,
          revenue: totalRevenue,
          tips_customer: 0,
          tips_receptionist: 0,
          tips_total: 0,
          tips_cash: 0,
          tips_card: 0,
          items: [],
        });
      }

      const sortedSummaries = Array.from(technicianMap.values());
      setSummaries(sortedSummaries);
    } catch (error) {
      showToast('Failed to load period data', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-gray-500">Loading period data...</div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">No data for this period</p>
      </div>
    );
  }

  const periodDates = getPeriodDates();

  return (
    <div>
      <div className="p-2 border-b border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">Period Revenue</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigatePeriod('prev')}
            className="h-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
            {getCurrentPeriodLabel()}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigatePeriod('next')}
            className="h-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="p-2">
        <WeeklyCalendarView
          selectedDate={selectedDate}
          weeklyData={weeklyData}
          summaries={summaries}
          periodDates={periodDates}
          mode="revenue"
        />
      </div>
    </div>
  );
}
