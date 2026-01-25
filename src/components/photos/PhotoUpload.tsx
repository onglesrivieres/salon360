import React, { useRef } from 'react';
import { Camera, Paperclip } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface PhotoUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
  remainingSlots: number;
}

export function PhotoUpload({
  onFileSelect,
  disabled = false,
  isUploading = false,
  remainingSlots,
}: PhotoUploadProps) {
  const { t } = useAuth();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDisabled = disabled || isUploading || remainingSlots <= 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  };

  const handleTakePhotoClick = () => {
    cameraInputRef.current?.click();
  };

  const handleAddFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={isDisabled}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={isDisabled}
      />

      {/* Compact square buttons side by side */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleTakePhotoClick}
          disabled={isDisabled}
          className="flex flex-col items-center justify-center w-20 h-20 text-xs font-medium text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera className="w-6 h-6 mb-1" />
          <span className="text-center leading-tight">{t('photos.takePhoto') || 'Take Photo'}</span>
        </button>

        <button
          type="button"
          onClick={handleAddFileClick}
          disabled={isDisabled}
          className="flex flex-col items-center justify-center w-20 h-20 text-xs font-medium text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Paperclip className="w-6 h-6 mb-1" />
          <span className="text-center leading-tight">{t('photos.addFile') || 'Add File'}</span>
        </button>
      </div>

      {remainingSlots <= 0 && (
        <p className="text-xs text-amber-600 text-center">
          {t('photos.maxReached') || 'Maximum 5 photos reached'}
        </p>
      )}

      {isUploading && (
        <p className="text-xs text-blue-600 text-center animate-pulse">
          {t('photos.uploading') || 'Uploading...'}
        </p>
      )}
    </div>
  );
}
