import { Store as StoreIcon, ClipboardCheck, UserCheck, FileText } from 'lucide-react';

interface HomePageProps {
  onActionSelected: (action: 'checkin' | 'ready' | 'report') => void;
}

export function HomePage({ onActionSelected }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 rounded-full mb-3 sm:mb-4 shadow-lg">
            <StoreIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2 sm:mb-3">Salon360</h1>

          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-lg mx-auto px-2">
            Complete salon management system for scheduling, tracking, and reporting
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <button
            onClick={() => onActionSelected('checkin')}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mb-2 sm:mb-3">
                <UserCheck className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Check In/Out
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Clock in and out for your shift
              </p>
            </div>
          </button>

          <button
            onClick={() => onActionSelected('ready')}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2 sm:mb-3">
                <ClipboardCheck className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Ready
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Mark yourself ready for customers
              </p>
            </div>
          </button>

          <button
            onClick={() => onActionSelected('report')}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform active:scale-95"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-orange-100 flex items-center justify-center mb-2 sm:mb-3">
                <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Report
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                View reports and manage tickets
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
