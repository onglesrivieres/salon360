import { useState, useEffect, useRef } from 'react';
import { BarChart3, FileText, CreditCard, Users, ChevronDown, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SalesOverview } from '../components/insights/SalesOverview';
import { SalesReport } from '../components/insights/SalesReport';
import { PaymentTypes } from '../components/insights/PaymentTypes';
import { EmployeeSales } from '../components/insights/EmployeeSales';
import { TimeFilterDropdown } from '../components/insights/TimeFilterDropdown';
import { TimeFilterType, DateRange, getDateRangeForFilter, getFilterLabel } from '../lib/timeFilters';

type InsightsTab = 'sales-overview' | 'sales-report' | 'payment-types' | 'employee-sales';

interface InsightsPageProps {
  selectedFilter: TimeFilterType;
  onFilterChange: (filter: TimeFilterType) => void;
  customDateRange: DateRange | undefined;
  onCustomDateRangeChange: (range: DateRange | undefined) => void;
}

export function InsightsPage({ selectedFilter, onFilterChange, customDateRange, onCustomDateRangeChange }: InsightsPageProps) {
  const { t } = useAuth();
  const [activeTab, setActiveTab] = useState<InsightsTab>('sales-overview');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeForFilter(selectedFilter, customDateRange));

  const tabs = [
    { id: 'sales-overview' as const, label: t('insights.salesOverview'), icon: BarChart3 },
    { id: 'sales-report' as const, label: t('insights.salesReport'), icon: FileText },
    { id: 'payment-types' as const, label: t('insights.paymentTypes'), icon: CreditCard },
    { id: 'employee-sales' as const, label: t('insights.employeeSales'), icon: Users },
  ];

  // State for responsive tab dropdown
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement>(null);
  const currentTab = tabs.find(tab => tab.id === activeTab);

  // Click-outside handler for tab dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) {
        setIsTabDropdownOpen(false);
      }
    }
    if (isTabDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTabDropdownOpen]);

  useEffect(() => {
    const newDateRange = getDateRangeForFilter(selectedFilter, customDateRange);
    setDateRange(newDateRange);
  }, [selectedFilter, customDateRange]);

  const handleFilterChange = (filter: TimeFilterType) => {
    onFilterChange(filter);
    if (filter !== 'custom') {
      onCustomDateRangeChange(undefined);
    }
  };

  const handleCustomDateApply = (range: DateRange) => {
    onCustomDateRangeChange(range);
    onFilterChange('custom');
  };

  const customDateLabel = customDateRange ? getFilterLabel('custom', customDateRange) : undefined;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-4 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">{t('insights.title')}</h1>
            <p className="text-xs text-gray-600 mt-1 sm:text-sm">{t('insights.subtitle')}</p>
          </div>
          <TimeFilterDropdown
            selectedFilter={selectedFilter}
            onFilterChange={handleFilterChange}
            customDateLabel={customDateLabel}
            onCustomDateApply={handleCustomDateApply}
            customDateRange={customDateRange}
          />
        </div>

        <div className="border-b border-gray-200">
          {/* Mobile dropdown - visible on screens < md */}
          <div className="md:hidden p-2" ref={tabDropdownRef}>
            <div className="relative">
              <button
                onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
              >
                <div className="flex items-center gap-2">
                  {currentTab && (
                    <>
                      <currentTab.icon className="w-4 h-4" />
                      <span>{currentTab.label}</span>
                    </>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isTabDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setIsTabDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </div>
                        {isActive && <CheckCircle className="w-4 h-4 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Desktop tabs - visible on screens >= md */}
          <nav className="hidden md:flex gap-0.5 px-2 md:gap-1 md:px-4 overflow-x-auto scrollbar-hide" aria-label="Tabs">
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
    </div>
  );
}
