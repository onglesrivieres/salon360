import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { TicketPhotoWithUrl } from '../../lib/supabase';

interface PhotoThumbnailProps {
  photo: TicketPhotoWithUrl;
  onClick?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PhotoThumbnail({
  photo,
  onClick,
  onDelete,
  canDelete = false,
  size = 'md',
}: PhotoThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && !isDeleting) {
      setIsDeleting(true);
      await onDelete();
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`relative ${sizeClasses[size]} rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 group`}
    >
      {/* Loading placeholder */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-xs text-gray-400">Error</span>
        </div>
      )}

      {/* Image */}
      <img
        src={photo.url}
        alt={photo.filename}
        className={`w-full h-full object-cover cursor-pointer transition-transform hover:scale-105 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={onClick}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />

      {/* Delete button */}
      {canDelete && !isDeleting && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 min-w-[24px] min-h-[24px] flex items-center justify-center"
          aria-label="Delete photo"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Deleting overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
