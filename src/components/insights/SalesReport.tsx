import { useState } from 'react';
import { Printer, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { DateRange } from '../../lib/timeFilters';
import { useSalesReportData } from '../../hooks/useSalesData';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { SalesReportChart } from './SalesReportChart';
import { SalesBreakdownTable } from './SalesBreakdownTable';
import { TenderTypesTable } from './TenderTypesTable';

interface SalesReportProps {
  dateRange: DateRange;
}

export function SalesReport({ dateRange }: SalesReportProps) {
  const reportData = useSalesReportData(dateRange);
  const [showFilters, setShowFilters] = useState(false);

  const formatDateRange = (range: DateRange) => {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };

    if (range.startDate === range.endDate) {
      const dateStr = start.toLocaleDateString('en-US', options);
      return `${dateStr}, 12:00 a.m. - 11:59 p.m.`;
    }

    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', options);
    return `${startStr} - ${endStr}`;
  };

  const isToday = dateRange.startDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            onClick={() => {}}
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{formatDateRange(dateRange)}</h2>
          </div>
          <button
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {}}
            disabled={isToday}
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start gap-6 md:gap-8">
          <div className="w-full md:w-auto md:flex-shrink-0 space-y-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Net sales</p>
              <p className="text-3xl md:text-4xl font-bold text-gray-900">
                {reportData.isLoading ? (
                  <span className="animate-pulse bg-gray-200 rounded w-48 h-10 inline-block"></span>
                ) : (
                  formatCurrency(reportData.netSales)
                )}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                from {formatNumber(reportData.transactions)} transactions
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Amount collected</p>
                <p className="text-lg md:text-xl font-semibold text-gray-900">
                  {reportData.isLoading ? (
                    <span className="animate-pulse bg-gray-200 rounded w-32 h-6 inline-block"></span>
                  ) : (
                    formatCurrency(reportData.amountCollected)
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Gross sales</p>
                <p className="text-lg md:text-xl font-semibold text-gray-900">
                  {reportData.isLoading ? (
                    <span className="animate-pulse bg-gray-200 rounded w-32 h-6 inline-block"></span>
                  ) : (
                    formatCurrency(reportData.grossSales)
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full md:flex-1">
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-600">Hourly view</p>
            </div>
            {reportData.isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading chart...</div>
              </div>
            ) : (
              <SalesReportChart hourlyData={reportData.hourlyData} showNowIndicator={isToday} />
            )}
          </div>
        </div>
      </div>

      <SalesBreakdownTable dateRange={dateRange} />

      <TenderTypesTable dateRange={dateRange} />
    </div>
  );
}
