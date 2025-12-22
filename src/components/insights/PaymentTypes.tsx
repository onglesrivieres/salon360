import { useState } from 'react';
import { Printer, Download, MoreVertical, ChevronDown, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { DateRange } from '../../lib/timeFilters';
import { useCardPaymentAnalysis } from '../../hooks/useSalesData';
import { TenderTypesChart } from './TenderTypesChart';
import { CardPaymentTable } from './CardPaymentTable';
import { getCurrentDateEST } from '../../lib/timezone';
import { useAuth } from '../../contexts/AuthContext';

interface PaymentTypesProps {
  dateRange: DateRange;
}

export function PaymentTypes({ dateRange }: PaymentTypesProps) {
  const { selectedStoreId } = useAuth();
  const cardData = useCardPaymentAnalysis(dateRange, selectedStoreId);
  const [showTips, setShowTips] = useState(false);

  const formatDateRange = (range: DateRange) => {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);

    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };

    if (range.startDate === range.endDate) {
      const startStr = start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${startStr} 12:00 AM - ${startStr} 11:59 PM`;
    }

    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', options);
    return `${startStr} - ${endStr}`;
  };

  const isToday = dateRange.startDate === getCurrentDateEST();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            Reporting - Sales by Tender and Card Type
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button className="flex items-center gap-2 px-3 py-2 md:px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            EXPORT
          </button>
          <button
            className="flex items-center gap-2 px-3 py-2 md:px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
            PRINT
          </button>
          <button className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <div className="relative">
          <select className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 md:px-4 md:py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Today</option>
            <option>This Week</option>
            <option>This Month</option>
            <option>Custom Range</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div className="relative">
          <select className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 md:px-4 md:py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>All Employees</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div className="relative">
          <select className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 md:px-4 md:py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>All Devices</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div className="relative">
          <button className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 md:px-4 md:py-2 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
            More Filters
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <p className="text-lg font-semibold text-gray-900">{formatDateRange(dateRange)}</p>
        </div>
        <button
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isToday}
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <TenderTypesChart
        creditCard={cardData.chartData.creditCard}
        debitCard={cardData.chartData.debitCard}
        isLoading={cardData.isLoading}
      />

      <div className="flex items-center justify-end gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showTips}
            onChange={(e) => setShowTips(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show tips breakdown</span>
        </label>
        <Info className="w-4 h-4 text-gray-400 cursor-help" title="Toggle to show tip details" />
      </div>

      <CardPaymentTable data={cardData} showTips={showTips} />
    </div>
  );
}
