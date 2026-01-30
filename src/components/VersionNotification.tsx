import { Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface VersionNotificationProps {
  onUpdate: () => void;
}

export function VersionNotification({ onUpdate }: VersionNotificationProps) {
  const { t } = useAuth();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-lg animate-slideDown">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          <span className="font-medium">{t('newVersionAvailable')}</span>
        </div>
        <button
          onClick={onUpdate}
          className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          {t('updateNow')}
        </button>
      </div>
    </div>
  );
}
