import { Store as StoreIcon, ClipboardCheck, UserCheck, FileText } from 'lucide-react';

interface HomePageProps {
  onActionSelected: (action: 'checkin' | 'ready' | 'report') => void;
}

export function HomePage({ onActionSelected }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-600 rounded-full mb-6 shadow-lg">
            <StoreIcon className="w-12 h-12 text-white" />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-4">Salon360</h1>

          <p className="text-xl text-gray-600 max-w-lg mx-auto">
            Complete salon management system for scheduling, tracking, and reporting
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => onActionSelected('checkin')}
            className="bg-white rounded-xl p-8 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <UserCheck className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Check In/Out
              </h3>
              <p className="text-gray-600 text-sm">
                Clock in and out for your shift
              </p>
            </div>
          </button>

          <button
            onClick={() => onActionSelected('ready')}
            className="bg-white rounded-xl p-8 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <ClipboardCheck className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Ready
              </h3>
              <p className="text-gray-600 text-sm">
                Mark yourself ready for customers
              </p>
            </div>
          </button>

          <button
            onClick={() => onActionSelected('report')}
            className="bg-white rounded-xl p-8 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Report
              </h3>
              <p className="text-gray-600 text-sm">
                View reports and manage tickets
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
