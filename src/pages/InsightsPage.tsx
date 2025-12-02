import { useState, useEffect } from 'react';
import { BarChart3, FileText, CreditCard, Users } from 'lucide-react';
import { SalesOverview } from '../components/insights/SalesOverview';
import { SalesReport } from '../components/insights/SalesReport';
import { PaymentTypes } from '../components/insights/PaymentTypes';
import { EmployeeSales } from '../components/insights/EmployeeSales';
import { TimeFilterDropdown } from '../components/insights/TimeFilterDropdown';
import { CustomDateRangeModal } from '../components/insights/CustomDateRangeModal';
import { TimeFilterType, DateRange, getDateRangeForFilter, getFilterLabel } from '../lib/timeFilters';

type InsightsTab = 'sales-overview' | 'sales-report' | 'payment-types' | 'employee-sales';

export function InsightsPage() {
  const [activeTab, setActiveTab] = useState<InsightsTab>('sales-overview');
  const [selectedFilter, setSelectedFilter] = useState<TimeFilterType>('today');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeForFilter('today'));

  const tabs = [
    { id: 'sales-overview' as const, label: 'Sales Overview', icon: BarChart3 },
    { id: 'sales-report' as const, label: 'Sales Report', icon: FileText },
    { id: 'payment-types' as const, label: 'Payment Types', icon: CreditCard },
    { id: 'employee-sales' as const, label: 'Employee Sales', icon: Users },
  ];

  useEffect(() => {
    const newDateRange = getDateRangeForFilter(selectedFilter, customDateRange);
    setDateRange(newDateRange);
  }, [selectedFilter, customDateRange]);

  const handleFilterChange = (filter: TimeFilterType) => {
    if (filter === 'custom') {
      setShowCustomModal(true);
    } else {
      setSelectedFilter(filter);
      setCustomDateRange(undefined);
    }
  };

  const handleCustomDateApply = (range: DateRange) => {
    setCustomDateRange(range);
    setSelectedFilter('custom');
  };

  const customDateLabel = customDateRange ? getFilterLabel('custom', customDateRange) : undefined;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-4 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Insights</h1>
            <p className="text-xs text-gray-600 mt-1 sm:text-sm">Analytics and reports for business insights</p>
          </div>
          <TimeFilterDropdown
            selectedFilter={selectedFilter}
            onFilterChange={handleFilterChange}
            customDateLabel={customDateLabel}
          />
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex gap-0.5 px-2 md:gap-1 md:px-4 overflow-x-auto scrollbar-hide" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap sm:px-3 sm:gap-2 md:px-4 md:py-3 md:text-sm ${
                    isActive
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'sales-overview' && <SalesOverview dateRange={dateRange} />}
          {activeTab === 'sales-report' && <SalesReport dateRange={dateRange} />}
          {activeTab === 'payment-types' && <PaymentTypes dateRange={dateRange} />}
          {activeTab === 'employee-sales' && <EmployeeSales dateRange={dateRange} />}
        </div>
      </div>

      <CustomDateRangeModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onApply={handleCustomDateApply}
        initialDateRange={customDateRange}
      />
    </div>
  );
}
