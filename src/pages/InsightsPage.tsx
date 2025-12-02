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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
            <p className="text-sm text-gray-600 mt-1">Analytics and reports for business insights</p>
          </div>
          <TimeFilterDropdown
            selectedFilter={selectedFilter}
            onFilterChange={handleFilterChange}
            customDateLabel={customDateLabel}
          />
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex gap-1 px-4" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
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
