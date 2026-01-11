import { Palette } from 'lucide-react';
import { ClientColorHistory } from '../../lib/supabase';

interface ColorDisplayProps {
  colorHistory: ClientColorHistory | null;
  label?: string;
  showDate?: boolean;
  compact?: boolean;
}

/**
 * Check if a string is a valid hex color
 */
function isHexColor(str: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(str);
}

/**
 * Get contrasting text color (black or white) for a hex background
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export function ColorDisplay({
  colorHistory,
  label = 'Last Color Used',
  showDate = true,
  compact = false,
}: ColorDisplayProps) {
  if (!colorHistory) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const color = colorHistory.color;
  const isHex = isHexColor(color);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Palette className="w-3 h-3 text-gray-400" />
        <span className="font-medium">{label}:</span>
        {isHex ? (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: color,
              color: getContrastColor(color),
            }}
          >
            {color}
          </span>
        ) : (
          <span className="text-gray-900">{color}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg">
      <Palette className="w-4 h-4 text-purple-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-purple-600 font-medium">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {isHex ? (
            <>
              <span
                className="inline-block w-5 h-5 rounded border border-purple-200"
                style={{ backgroundColor: color }}
                title={color}
              />
              <span className="text-sm font-medium text-gray-900">{color}</span>
            </>
          ) : (
            <span className="text-sm font-medium text-gray-900">{color}</span>
          )}
        </div>
      </div>
      {showDate && (
        <div className="text-right">
          <p className="text-xs text-purple-400">Used on</p>
          <p className="text-xs font-medium text-purple-600">
            {formatDate(colorHistory.applied_date)}
          </p>
        </div>
      )}
    </div>
  );
}
