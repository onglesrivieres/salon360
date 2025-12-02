import { Users, Award, TrendingUp } from 'lucide-react';
import { DateRange } from '../../lib/timeFilters';

interface EmployeeSalesProps {
  dateRange: DateRange;
}

export function EmployeeSales({ dateRange }: EmployeeSalesProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">Coming Soon</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600">Top Performer</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">Coming Soon</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600">Avg. Sales Per Employee</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">Coming Soon</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Employee Performance Leaderboard</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors opacity-50 cursor-not-allowed" disabled>
              This Week
            </button>
            <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors opacity-50 cursor-not-allowed" disabled>
              This Month
            </button>
          </div>
        </div>

        <div className="h-96 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Award className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Employee sales rankings coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Performance metrics, ticket counts, and revenue per employee
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Distribution by Employee</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          Sales distribution chart coming soon
        </div>
      </div>
    </div>
  );
}
