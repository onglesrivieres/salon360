import { Clock, AlertCircle, LogIn } from 'lucide-react';
import { Modal } from './ui/Modal';

interface CheckInRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  employeeName?: string;
}

export function CheckInRequiredModal({
  isOpen,
  onClose,
  onCheckIn,
  employeeName
}: CheckInRequiredModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Check-In Required" size="sm">
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>

        <p className="text-gray-600 mb-6">
          {employeeName
            ? `Hello ${employeeName}, you haven't checked in yet.`
            : 'You haven\'t checked in yet.'
          }
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-gray-700 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span className="font-medium">Check-In Reminder</span>
          </div>
          <p className="text-sm text-gray-600">
            Please check in to track your attendance. You can continue using the app without checking in.
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
            onClick={onClose}
            className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Continue Without Checking In
          </button>
        </div>
      </div>
    </Modal>
  );
}
