import { PaymentBreakdownData } from '../../hooks/useSalesData';
import { formatCurrency } from '../../lib/formatters';

interface TenderTypesChartProps {
  data: PaymentBreakdownData;
}

export function TenderTypesChart({ data }: TenderTypesChartProps) {
  if (data.isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Top 5 Tender Types</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Top 5 Tender Types</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-red-600">{data.error}</div>
        </div>
      </div>
    );
  }

  if (data.tenderTypes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Top 5 Tender Types</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-500">No payment data available</div>
        </div>
      </div>
    );
  }

  const maxAmount = Math.max(...data.tenderTypes.map((t) => t.amount));
  const chartHeight = 240;

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Top 5 Tender Types</h3>
      <div className="space-y-4 mb-4">
        {data.tenderTypes.map((tender, index) => {
          const percentage = (tender.amount / maxAmount) * 100;
          return (
            <div key={index}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{tender.method}</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(tender.amount)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end mt-6">
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">DETAILS</button>
      </div>
    </div>
  );
}
