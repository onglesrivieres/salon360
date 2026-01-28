import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useLogoUpload } from '../hooks/useLogoUpload';
import type { StorageConfig } from '../lib/storage';

interface LogoUploadFieldProps {
  currentLogoUrl: string;
  storeId: string;
  onLogoChange: (url: string) => void;
  disabled?: boolean;
  storageConfig?: StorageConfig | null;
}

export function LogoUploadField({
  currentLogoUrl,
  storeId,
  onLogoChange,
  disabled = false,
  storageConfig,
}: LogoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { isUploading, error, uploadLogo, deleteLogo } = useLogoUpload({
    storeId,
    storageConfig,
    onSuccess: (url) => {
      onLogoChange(url);
      setPreviewUrl(null);
    },
    onError: () => {
      setPreviewUrl(null);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    // Upload the file
    const url = await uploadLogo(file);

    // Clean up preview
    URL.revokeObjectURL(preview);

    if (!url) {
      setPreviewUrl(null);
    }

    // Reset input
    e.target.value = '';
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    setIsDeleting(true);
    const success = await deleteLogo(currentLogoUrl);
    setIsDeleting(false);

    if (success) {
      onLogoChange('');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const displayUrl = previewUrl || currentLogoUrl;
  const isProcessing = isUploading || isDeleting;

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isProcessing}
      />

      {/* Logo preview or placeholder */}
      <div className="flex items-start gap-4">
        <div className="relative">
          {displayUrl ? (
            <div className="relative w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <img
                src={displayUrl}
                alt="Logo preview"
                className="w-full h-full object-contain"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={disabled || isProcessing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {currentLogoUrl ? 'Change Logo' : 'Upload Logo'}
              </>
            )}
          </button>

          {currentLogoUrl && !isUploading && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={disabled || isProcessing}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Remove Logo
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-500">
        Recommended size: 200x200 pixels. Supports JPG, PNG, and WebP formats. Max 2MB.
      </p>
    </div>
  );
}
