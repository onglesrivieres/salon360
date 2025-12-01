import { FileText } from 'lucide-react';

export function SalesReport() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Sales Report</h3>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors opacity-50 cursor-not-allowed" disabled>
            Export Report
          </button>
        </div>

        <div className="flex items-center justify-center h-96 text-gray-500">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Sales report table coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Detailed sales transactions, filters, and export capabilities
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
