import { useState } from 'react';
import { Printer, Download, MoreVertical, ChevronDown, ChevronLeft, ChevronRight, Info, ArrowUpDown } from 'lucide-react';
import { DateRange } from '../../lib/timeFilters';
import { useEmployeeSalesData } from '../../hooks/useSalesData';
import { formatCurrency } from '../../lib/formatters';
import { getCurrentDateEST } from '../../lib/timezone';
import { useAuth } from '../../contexts/AuthContext';

interface EmployeeSalesProps {
  dateRange: DateRange;
}

type SortColumn = 'name' | 'grossSales' | 'refunds' | 'netSales' | 'tips' | 'nonRevenueItems' | 'giftCardActivations';
type SortDirection = 'asc' | 'desc';

export function EmployeeSales({ dateRange }: EmployeeSalesProps) {
  const { selectedStoreId } = useAuth();
  const employeeSalesData = useEmployeeSalesData(dateRange, selectedStoreId);
  const [sortColumn, setSortColumn] = useState<SortColumn>('netSales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const formatDateRange = (range: DateRange) => {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };

    if (range.startDate === range.endDate) {
      const optionsWithTz: Intl.DateTimeFormatOptions = { ...options, timeZone: 'America/New_York' };
      const dateStr = start.toLocaleDateString('en-US', optionsWithTz);
      return `${dateStr.replace(',', ', ')} - 11:59 p.m.`;
    }

    const optionsWithTz: Intl.DateTimeFormatOptions = { ...options, timeZone: 'America/New_York' };
    const startStr = start.toLocaleDateString('en-US', optionsWithTz);
    const endStr = end.toLocaleDateString('en-US', optionsWithTz);
    return `${startStr} - ${endStr}`;
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedEmployees = [...employeeSalesData.employees].sort((a, b) => {
    let aValue: number | string;
    let bValue: number | string;

    switch (sortColumn) {
      case 'name':
        aValue = a.employeeName;
        bValue = b.employeeName;
        break;
      case 'grossSales':
        aValue = a.grossSales;
        bValue = b.grossSales;
        break;
      case 'refunds':
        aValue = a.refunds;
        bValue = b.refunds;
        break;
      case 'netSales':
        aValue = a.netSales;
        bValue = b.netSales;
        break;
      case 'tips':
        aValue = a.tips;
        bValue = b.tips;
        break;
      case 'nonRevenueItems':
        aValue = a.nonRevenueItems;
        bValue = b.nonRevenueItems;
        break;
      case 'giftCardActivations':
        aValue = a.giftCardActivations;
        bValue = b.giftCardActivations;
        break;
      default:
        aValue = a.netSales;
        bValue = b.netSales;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  const isToday = dateRange.startDate === getCurrentDateEST();

  const InfoTooltip = ({ text }: { text: string }) => (
    <span title={text}>
      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Reporting - Employee Sales</h1>
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
            <option>All Devices</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
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

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-medium text-gray-600">Net sales</p>
              <InfoTooltip text="Total sales minus refunds" />
            </div>
            {employeeSalesData.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl md:text-3xl font-bold text-gray-900">
                {formatCurrency(employeeSalesData.summary.totalNetSales)}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-medium text-gray-600">Average Net Sales per Transaction</p>
              <InfoTooltip text="Average sales amount per transaction" />
            </div>
            {employeeSalesData.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl md:text-3xl font-bold text-gray-900">
                {formatCurrency(employeeSalesData.summary.averagePerTransaction)}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-medium text-gray-600">Tips</p>
              <InfoTooltip text="Total tips received by employees" />
            </div>
            {employeeSalesData.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl md:text-3xl font-bold text-gray-900">
                {formatCurrency(employeeSalesData.summary.totalTips)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 md:p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Employees sales summary</h3>
          <div className="relative">
            <button className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
              Display
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scroll-smooth">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  className="text-left py-2 px-3 text-xs md:text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 sticky left-0 bg-gray-50 z-10"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Employee
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </th>
                <th
                  className="text-center py-2 px-3 text-xs md:text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('grossSales')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Gross sales
                    <InfoTooltip text="Total sales before refunds" />
                  </div>
                </th>
                <th
                  className="text-center py-3 px-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('refunds')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Refunds
                    <InfoTooltip text="Total refunded amounts" />
                  </div>
                </th>
                <th
                  className="text-center py-3 px-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('netSales')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Net sales
                    <InfoTooltip text="Gross sales minus refunds" />
                    {sortColumn === 'netSales' && (
                      <span className="text-blue-600">▼</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-center py-3 px-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('nonRevenueItems')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Non-revenue Items
                    <InfoTooltip text="Items not counted as revenue" />
                  </div>
                </th>
                <th
                  className="text-center py-3 px-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('giftCardActivations')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Gift Card Activations
                    <InfoTooltip text="Gift cards sold" />
                  </div>
                </th>
                <th
                  className="text-center py-3 px-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('tips')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Tips
                    <InfoTooltip text="Total tips received" />
                  </div>
                </th>
                <th className="text-center py-2 px-3 text-xs md:text-sm font-semibold text-gray-900">
                  Additional
                </th>
              </tr>
            </thead>
            <tbody>
              {employeeSalesData.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-2 px-3 sticky left-0 bg-white z-10">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                    </td>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse mx-auto w-20"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : employeeSalesData.error ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-red-600">
                    {employeeSalesData.error}
                  </td>
                </tr>
              ) : sortedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    No employee sales data available
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((employee) => (
                  <tr key={employee.employeeId} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-3 sticky left-0 bg-white z-10">
                      <div>
                        <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                          {employee.employeeName}
                        </a>
                        <p className="text-xs text-gray-500">{employee.employeeRole}</p>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                      {formatCurrency(employee.grossSales)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                      {formatCurrency(employee.refunds)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                      {formatCurrency(employee.netSales)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                      {formatCurrency(employee.nonRevenueItems)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                      {formatCurrency(employee.giftCardActivations)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                      {formatCurrency(employee.tips)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs md:text-sm text-gray-900">
                      {formatCurrency(0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
