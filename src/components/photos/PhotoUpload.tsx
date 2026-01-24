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

      {/* Buttons */}
      <button
        type="button"
        onClick={handleTakePhotoClick}
        disabled={isDisabled}
        className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
      >
        <Camera className="w-5 h-5" />
        <span>{t('photos.takePhoto') || 'Take Photo'}</span>
      </button>

      <button
        type="button"
        onClick={handleAddFileClick}
        disabled={isDisabled}
        className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
      >
        <Paperclip className="w-5 h-5" />
        <span>{t('photos.addFile') || 'Add File'}</span>
      </button>

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
