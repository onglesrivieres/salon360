import { useState, useImperativeHandle, forwardRef } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Permissions } from '../../lib/permissions';
import { PhotoUpload, PhotoThumbnail, PhotoPreview, useTicketPhotos } from '../photos';
import { TicketPhotoWithUrl } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface TicketPhotosSectionProps {
  storeId: string;
  ticketId: string;
  readOnly?: boolean;
}

export interface TicketPhotosSectionRef {
  uploadPendingPhotos: () => Promise<boolean>;
  hasPendingChanges: boolean;
}

const MAX_PHOTOS = 5;

export const TicketPhotosSection = forwardRef<TicketPhotosSectionRef, TicketPhotosSectionProps>(
  function TicketPhotosSection({
    storeId,
    ticketId,
    readOnly = false,
  }, ref) {
  const { t, session, effectiveRole } = useAuth();
  const { getStorageConfig } = useSettings();
  const { showToast } = useToast();
  const [previewPhoto, setPreviewPhoto] = useState<TicketPhotoWithUrl | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const {
    photos,
    pendingPhotos,
    isLoading,
    isUploading,
    error,
    canAddMore,
    remainingSlots,
    addPendingPhoto,
    removePendingPhoto,
    uploadPendingPhotos,
    deletePhoto,
    hasPendingChanges,
  } = useTicketPhotos({
    storeId,
    ticketId,
    uploadedBy: session?.employee_id || '',
    storageConfig: getStorageConfig(),
  });

  // Expose uploadPendingPhotos to parent via ref
  useImperativeHandle(ref, () => ({
    uploadPendingPhotos,
    hasPendingChanges,
  }), [uploadPendingPhotos, hasPendingChanges]);

  const canUpload = !readOnly && !!effectiveRole && Permissions.photos.canUploadTicketPhotos(effectiveRole);
  const canDelete = !!effectiveRole && Permissions.photos.canDeleteTicketPhotos(effectiveRole);

  const handleFileSelect = async (file: File) => {
    const success = await addPendingPhoto(file);
    if (success) {
      showToast(t('photos.photoAdded') || 'Photo added', 'success');
    } else if (error) {
      showToast(error, 'error');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    const success = await deletePhoto(photoId);
    if (success) {
      showToast(t('photos.deleteSuccess') || 'Photo deleted', 'success');
    } else {
      showToast(t('photos.deleteFailed') || 'Failed to delete photo', 'error');
    }
  };

  const handleRemovePendingPhoto = (id: string) => {
    removePendingPhoto(id);
    showToast(t('photos.photoRemoved') || 'Photo removed', 'success');
  };

  const openPreview = (photo: TicketPhotoWithUrl, index: number) => {
    setPreviewPhoto(photo);
    setPreviewIndex(index);
  };

  const closePreview = () => {
    setPreviewPhoto(null);
  };

  const goToPrevious = () => {
    if (previewIndex > 0) {
      const newIndex = previewIndex - 1;
      setPreviewIndex(newIndex);
      setPreviewPhoto(photos[newIndex]);
    }
  };

  const goToNext = () => {
    if (previewIndex < photos.length - 1) {
      const newIndex = previewIndex + 1;
      setPreviewIndex(newIndex);
      setPreviewPhoto(photos[newIndex]);
    }
  };

  // Don't render if no ticket ID yet (new ticket)
  if (!ticketId) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">
            {t('photos.title') || 'Photos'}
          </h3>
          <span className="text-xs text-gray-500">
            ({photos.length + pendingPhotos.length}/{MAX_PHOTOS})
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="flex gap-3 flex-wrap items-start">
          {/* Saved photo thumbnails */}
          {photos.map((photo, index) => (
            <PhotoThumbnail
              key={photo.id}
              photo={photo}
              onClick={() => openPreview(photo, index)}
              onDelete={() => handleDeletePhoto(photo.id)}
              canDelete={canDelete && !readOnly}
              size="md"
            />
          ))}

          {/* Pending photo thumbnails (not yet uploaded) */}
          {pendingPhotos.map((pending) => (
            <PhotoThumbnail
              key={pending.id}
              photo={pending}
              onDelete={() => handleRemovePendingPhoto(pending.id)}
              canDelete={canUpload}
              size="md"
              isPending
            />
          ))}

          {/* Upload buttons */}
          {canUpload && canAddMore && (
            <div className="flex-shrink-0">
              <PhotoUpload
                onFileSelect={handleFileSelect}
                disabled={!canAddMore}
                isUploading={isUploading}
                remainingSlots={remainingSlots}
              />
            </div>
          )}

          {/* Empty state */}
          {photos.length === 0 && pendingPhotos.length === 0 && !canUpload && (
            <p className="text-sm text-gray-500 italic">
              {t('photos.noPhotos') || 'No photos'}
            </p>
          )}
        </div>
      )}

      {/* Preview modal */}
      {previewPhoto && (
        <PhotoPreview
          isOpen={!!previewPhoto}
          onClose={closePreview}
          photo={previewPhoto}
          onDelete={canDelete && !readOnly ? () => handleDeletePhoto(previewPhoto.id) : undefined}
          canDelete={canDelete && !readOnly}
          onPrevious={goToPrevious}
          onNext={goToNext}
          hasPrevious={previewIndex > 0}
          hasNext={previewIndex < photos.length - 1}
        />
      )}
    </div>
  );
});
