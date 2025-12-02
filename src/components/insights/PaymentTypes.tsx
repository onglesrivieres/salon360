import { CreditCard, Banknote, Gift } from 'lucide-react';
import { DateRange } from '../../lib/timeFilters';

interface PaymentTypesProps {
  dateRange: DateRange;
}

export function PaymentTypes({ dateRange }: PaymentTypesProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600">Card Payments</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">Coming Soon</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Banknote className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600">Cash Payments</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">Coming Soon</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600">Gift Card Payments</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">Coming Soon</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method Distribution</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Payment breakdown visualization coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Pie chart and detailed payment method analytics
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Trends</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          Payment trends over time coming soon
        </div>
      </div>
    </div>
  );
}
