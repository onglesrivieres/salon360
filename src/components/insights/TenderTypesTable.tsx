import { useTenderTypesData } from '../../hooks/useSalesData';
import { DateRange } from '../../lib/timeFilters';
import { formatCurrency } from '../../lib/formatters';

interface TenderTypesTableProps {
  dateRange: DateRange;
}

export function TenderTypesTable({ dateRange }: TenderTypesTableProps) {
  const data = useTenderTypesData(dateRange);

  if (data.isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-100 rounded"></div>
            <div className="h-10 bg-gray-100 rounded"></div>
          </div>
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
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Tender types</h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 bg-gray-50">
                  Tender
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 bg-gray-50">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.tenderTypes.map((tender, index) => (
                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    <span className="border-b-2 border-dotted border-gray-400">
                      {tender.tenderType === 'Card' ? 'Credit and debit cards' : tender.tenderType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-gray-900">
                    {formatCurrency(tender.amount)}
                  </td>
                </tr>
              ))}

              <tr className="hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-semibold text-gray-900">Amount collected</td>
                <td className="py-3 px-4 text-right text-sm font-semibold text-gray-900">
                  {formatCurrency(data.totalCollected)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
