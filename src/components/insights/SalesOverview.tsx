import { DateRange } from '../../lib/timeFilters';
import { useSalesMetrics, useSalesChartData, usePaymentBreakdown } from '../../hooks/useSalesData';
import { SalesMetrics } from './SalesMetrics';
import { SalesChart } from './SalesChart';
import { TenderTypesChart } from './TenderTypesChart';

interface SalesOverviewProps {
  dateRange: DateRange;
}

export function SalesOverview({ dateRange }: SalesOverviewProps) {
  const metricsData = useSalesMetrics(dateRange);
  const chartData = useSalesChartData(dateRange);
  const paymentData = usePaymentBreakdown(dateRange);

  return (
    <div className="space-y-6">
      <SalesMetrics data={metricsData} />

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Sales Summary</h3>
          <p className="text-sm text-gray-600">Net Sales</p>
        </div>
        <SalesChart data={chartData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TenderTypesChart data={paymentData} />

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Top 5 Card Types</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Card type breakdown coming soon
          </div>
          <div className="flex justify-end mt-6">
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">DETAILS</button>
          </div>
        </div>
      </div>
    </div>
  );
}
