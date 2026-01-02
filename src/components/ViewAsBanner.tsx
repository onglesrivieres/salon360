import { AlertCircle, X } from 'lucide-react';
import { Role } from '../lib/permissions';

interface ViewAsBannerProps {
  role: Role;
  onExit: () => void;
}

export function ViewAsBanner({ role, onExit }: ViewAsBannerProps) {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-2 md:px-4 md:py-3 border-b border-amber-600 sticky top-[49px] z-30 shadow-md">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 flex-1">
          <AlertCircle className="w-5 h-5 flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-bold">
              Viewing as {role}
            </p>
            <p className="text-xs opacity-90">
              All actions are disabled in view-only mode
            </p>
          </div>
        </div>
        <button
          onClick={onExit}
          className="flex-shrink-0 flex items-center gap-2 bg-white text-amber-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-50 transition-colors whitespace-nowrap"
        >
          <X className="w-4 h-4" />
          Exit View Mode
        </button>
      </div>
    </div>
  );
}
