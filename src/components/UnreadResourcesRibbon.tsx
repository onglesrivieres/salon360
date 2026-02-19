import { FolderOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UnreadResourcesRibbonProps {
  unreadCount: number;
  onReadNow: () => void;
}

export function UnreadResourcesRibbon({ unreadCount, onReadNow }: UnreadResourcesRibbonProps) {
  const { t } = useAuth();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white shadow-lg animate-slideDown">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          <span className="font-medium">
            {t('common.unreadResourcesMessage').replace('{count}', String(unreadCount))}
          </span>
        </div>
        <button
          onClick={onReadNow}
          className="px-4 py-2 bg-white text-emerald-700 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
        >
          {t('common.readNow')}
        </button>
      </div>
    </div>
  );
}
