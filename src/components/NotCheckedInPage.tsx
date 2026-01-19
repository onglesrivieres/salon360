import { Clock, AlertCircle, LogIn } from 'lucide-react';

interface NotCheckedInPageProps {
  employeeName?: string;
  onCheckIn?: () => void;
}

export function NotCheckedInPage({ employeeName, onCheckIn }: NotCheckedInPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Check-In Required
        </h1>

        <p className="text-gray-600 mb-6">
          {employeeName
            ? `Hello ${employeeName}, you need to check in before accessing the application.`
            : 'You need to check in before accessing the application.'
          }
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-gray-700 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span className="font-medium">Access Restricted</span>
          </div>
          <p className="text-sm text-gray-600">
            Please use the Check In button below to check in and access the system.
          </p>
        </div>

        {onCheckIn && (
          <button
            onClick={onCheckIn}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <LogIn className="w-5 h-5" />
            Check In Now
          </button>
        )}

        <p className="text-sm text-gray-500 mt-4">
          After checking in, you will have full access to the system.
        </p>
      </div>
    </div>
  );
}
