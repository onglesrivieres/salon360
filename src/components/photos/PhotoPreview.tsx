import React, { useState } from 'react';
import { X, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { TicketPhotoWithUrl } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PhotoPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  photo: TicketPhotoWithUrl;
  onDelete?: () => Promise<void>;
  canDelete?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function PhotoPreview({
  isOpen,
  onClose,
  photo,
  onDelete,
  canDelete = false,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: PhotoPreviewProps) {
  const { t } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;

    if (window.confirm(t('photos.deleteConfirm') || 'Delete this photo?')) {
      setIsDeleting(true);
      await onDelete();
      setIsDeleting(false);
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
      onPrevious();
    } else if (e.key === 'ArrowRight' && hasNext && onNext) {
      onNext();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Delete button */}
      {canDelete && onDelete && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-4 left-4 p-2 text-white hover:text-red-400 transition-colors z-10 disabled:opacity-50"
          aria-label="Delete"
        >
          {isDeleting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Trash2 className="w-6 h-6" />
          )}
        </button>
      )}

      {/* Previous button */}
      {hasPrevious && onPrevious && (
        <button
          onClick={onPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white hover:text-gray-300 transition-colors z-10"
          aria-label="Previous"
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
      )}

      {/* Next button */}
      {hasNext && onNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white hover:text-gray-300 transition-colors z-10"
          aria-label="Next"
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      )}

      {/* Image container */}
      <div className="relative max-w-[90vw] max-h-[90vh]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
        <img
          src={photo.url}
          alt={photo.filename}
          className={`max-w-full max-h-[90vh] object-contain ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setIsLoading(false)}
        />
      </div>

      {/* Caption */}
      {photo.caption && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black bg-opacity-70 text-white rounded-lg text-sm max-w-md text-center">
          {photo.caption}
        </div>
      )}
    </div>
  );
}
