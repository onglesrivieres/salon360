import { Clock, AlertCircle } from 'lucide-react';

interface OutsideWorkingHoursPageProps {
  openingTime: string;
  closingTime: string;
  currentDay: string;
}

export function OutsideWorkingHoursPage({
  openingTime,
  closingTime,
  currentDay,
}: OutsideWorkingHoursPageProps) {
  const capitalizedDay = currentDay.charAt(0).toUpperCase() + currentDay.slice(1);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Outside Working Hours
        </h1>

        <p className="text-gray-600 mb-6">
          Access to this application is only available during store working hours.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-gray-700 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span className="font-medium">{capitalizedDay}'s Hours</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {openingTime} - {closingTime}
          </p>
        </div>

        <p className="text-sm text-gray-500">
          Please return during business hours to access the system.
        </p>
      </div>
    </div>
  );
}
