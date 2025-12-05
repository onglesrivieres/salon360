import { useState } from 'react';
import { Printer, SlidersHorizontal } from 'lucide-react';
import { DateRange } from '../../lib/timeFilters';
import { useSalesReportData } from '../../hooks/useSalesData';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { SalesReportChart } from './SalesReportChart';
import { SalesBreakdownTable } from './SalesBreakdownTable';
import { TenderTypesTable } from './TenderTypesTable';
import { getCurrentDateEST } from '../../lib/timezone';

interface SalesReportProps {
  dateRange: DateRange;
}

export function SalesReport({ dateRange }: SalesReportProps) {
  const reportData = useSalesReportData(dateRange);
  const [showFilters, setShowFilters] = useState(false);

  const isToday = dateRange.startDate === getCurrentDateEST();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
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

      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="space-y-6">
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

          <div className="grid grid-cols-2 gap-6">
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
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">Hourly view</h3>
        </div>
        {reportData.isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading chart...</div>
          </div>
        ) : (
          <SalesReportChart hourlyData={reportData.hourlyData} showNowIndicator={isToday} />
        )}
      </div>

      <SalesBreakdownTable dateRange={dateRange} />

      <TenderTypesTable dateRange={dateRange} />
    </div>
  );
}
