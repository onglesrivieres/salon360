import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSalesBreakdownData, ViewByType } from '../../hooks/useSalesData';
import { DateRange } from '../../lib/timeFilters';
import { formatCurrency } from '../../lib/formatters';

interface SalesBreakdownTableProps {
  dateRange: DateRange;
}

export function SalesBreakdownTable({ dateRange }: SalesBreakdownTableProps) {
  const [viewBy, setViewBy] = useState<ViewByType>('hourly');
  const data = useSalesBreakdownData(dateRange, viewBy);

  if (data.isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-red-600">{data.error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Sales</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">View by</label>
            <div className="relative">
              <select
                value={viewBy}
                onChange={(e) => setViewBy(e.target.value as ViewByType)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="hourly">Hourly sales</option>
                <option value="daily">Daily sales</option>
                <option value="weekly">Weekly sales</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto scroll-smooth">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1.5 px-2 text-[10px] md:text-xs font-semibold text-gray-900 bg-gray-50 sticky left-0 z-10">
                  Total
                </th>
                {data.timeLabels.map((label, index) => (
                  <th
                    key={index}
                    className="text-right py-1.5 px-2 text-[10px] md:text-xs font-medium text-gray-700 bg-gray-50 whitespace-nowrap"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-1.5 px-2 text-[10px] md:text-xs font-medium text-gray-900 sticky left-0 bg-white z-10">
                  <span className="border-b-2 border-dotted border-gray-400" title="Gross sales">Gross</span>
                </td>
                <td className="py-1.5 px-2 text-right text-[10px] md:text-xs font-semibold text-blue-600">
                  {formatCurrency(data.totals.grossSales)}
                </td>
                {data.grossSales.map((amount, index) => (
                  <td key={index} className="py-1.5 px-2 text-right text-[10px] md:text-xs text-gray-900">
                    {formatCurrency(amount)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-1.5 px-2 text-[10px] md:text-xs font-medium text-gray-900 sticky left-0 bg-white z-10">
                  <span className="border-b-2 border-dotted border-gray-400">Refunds</span>
                </td>
                <td className="py-1.5 px-2 text-right text-[10px] md:text-xs font-semibold text-blue-600">
                  {formatCurrency(data.totals.refunds)}
                </td>
                {data.refunds.map((amount, index) => (
                  <td key={index} className="py-1.5 px-2 text-right text-[10px] md:text-xs text-gray-900">
                    {formatCurrency(amount)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-1.5 px-2 text-[10px] md:text-xs font-medium text-gray-900 sticky left-0 bg-white z-10">
                  <span className="border-b-2 border-dotted border-gray-400">Net</span>
                </td>
                <td className="py-1.5 px-2 text-right text-[10px] md:text-xs font-semibold text-blue-600">
                  {formatCurrency(data.totals.netSales)}
                </td>
                {data.netSales.map((amount, index) => (
                  <td key={index} className="py-1.5 px-2 text-right text-[10px] md:text-xs text-gray-900">
                    {formatCurrency(amount)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-gray-50">
                <td className="py-1.5 px-2 text-[10px] md:text-xs font-medium text-gray-900 sticky left-0 bg-white z-10">
                  <span className="border-b-2 border-dotted border-gray-400" title="Amount collected">Collected</span>
                </td>
                <td className="py-1.5 px-2 text-right text-[10px] md:text-xs font-semibold text-blue-600">
                  {formatCurrency(data.totals.amountCollected)}
                </td>
                {data.amountCollected.map((amount, index) => (
                  <td key={index} className="py-1.5 px-2 text-right text-[10px] md:text-xs text-gray-900">
                    {formatCurrency(amount)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
