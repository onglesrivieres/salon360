import { Clock, AlertCircle, LogIn, LogOut } from 'lucide-react';

interface CheckInRequiredModalProps {
  isOpen: boolean;
  onExit: () => void;
  onCheckIn: () => void;
  employeeName?: string;
}

export function CheckInRequiredModal({
  isOpen,
  onExit,
  onCheckIn,
  employeeName
}: CheckInRequiredModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay - not clickable to close */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Check-In Required</h2>
          </div>
          <div className="px-6 py-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>

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
                  Please check in to track your attendance and access the system.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={onCheckIn}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <LogIn className="w-5 h-5" />
                  Check In Now
                </button>
                <button
                  onClick={onExit}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors font-medium border border-gray-300"
                >
                  <LogOut className="w-5 h-5" />
                  Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
