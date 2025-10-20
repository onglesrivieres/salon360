import { Smartphone, Tablet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function DeviceToggle() {
  const { deviceMode, setDeviceMode } = useAuth();

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setDeviceMode('iphone')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          deviceMode === 'iphone'
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="iPhone Mode"
      >
        <Smartphone className="w-3 h-3" />
        <span className="hidden sm:inline">iPhone</span>
      </button>
      <button
        onClick={() => setDeviceMode('ipad')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          deviceMode === 'ipad'
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="iPad Mode"
      >
        <Tablet className="w-3 h-3" />
        <span className="hidden sm:inline">iPad</span>
      </button>
    </div>
  );
}
