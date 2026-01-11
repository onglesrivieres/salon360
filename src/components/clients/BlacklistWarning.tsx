import { AlertTriangle, User } from 'lucide-react';
import { Client } from '../../lib/supabase';

interface BlacklistWarningProps {
  client: Client;
  blacklistedByName?: string;
  onViewDetails?: () => void;
  compact?: boolean;
}

export function BlacklistWarning({
  client,
  blacklistedByName,
  onViewDetails,
  compact = false,
}: BlacklistWarningProps) {
  if (!client.is_blacklisted) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700">
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Blacklisted</span>
        {client.blacklist_reason && (
          <span className="text-red-600 truncate max-w-[150px]" title={client.blacklist_reason}>
            - {client.blacklist_reason}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-800">
            Warning: Client is Blacklisted
          </h4>
          {client.blacklist_reason && (
            <p className="mt-1 text-sm text-red-700">
              <span className="font-medium">Reason:</span> {client.blacklist_reason}
            </p>
          )}
          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
            {blacklistedByName && (
              <>
                <User className="w-3 h-3" />
                <span>By {blacklistedByName}</span>
                <span className="mx-1">|</span>
              </>
            )}
            <span>{formatDate(client.blacklist_date)}</span>
          </p>
        </div>
        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="flex-shrink-0 text-xs font-medium text-red-700 hover:text-red-800 hover:underline"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
