import { useState, useCallback, useMemo } from 'react';
import {
  getStorageService,
  getR2PathFromUrl,
  type StorageService,
  type StorageConfig,
} from '../lib/storage';

const MAX_FILE_SIZE_MB = 2;
const MAX_DIMENSION = 400;

interface UseLogoUploadOptions {
  storeId: string;
  storageConfig?: StorageConfig | null;
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
}

interface UseLogoUploadReturn {
  isUploading: boolean;
  error: string | null;
  uploadLogo: (file: File) => Promise<string | null>;
  deleteLogo: (currentUrl: string) => Promise<boolean>;
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      let { width, height } = img;

      // Scale down if larger than max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_DIMENSION;
          width = MAX_DIMENSION;
        } else {
          width = (width / height) * MAX_DIMENSION;
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/png',
        0.9
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

export function useLogoUpload({
  storeId,
  storageConfig,
  onSuccess,
  onError,
}: UseLogoUploadOptions): UseLogoUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the R2 storage service - throws if not configured
  const storage: StorageService | null = useMemo(() => {
    if (!storageConfig) {
      return null;
    }
    try {
      return getStorageService(storageConfig);
    } catch {
      return null;
    }
  }, [storageConfig]);

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
      if (!storage) {
        const errorMsg = 'Storage is not configured. Please configure Cloudflare R2 in Settings.';
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        const errorMsg = 'Invalid file type. Please use JPG, PNG, or WebP';
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        const errorMsg = `File too large. Maximum ${MAX_FILE_SIZE_MB}MB allowed`;
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      }

      try {
        setIsUploading(true);
        setError(null);

        // Compress image
        const compressedBlob = await compressImage(file);

        // Generate filename with timestamp for cache busting
        const timestamp = Date.now();
        const storagePath = `logos/${storeId}/logo_${timestamp}.png`;

        // Delete any existing logos for this store first
        const listResult = await storage.list(`logos/${storeId}`);
        if (listResult.files && listResult.files.length > 0) {
          const filesToDelete = listResult.files.map((f) => f.path);
          await storage.deleteMultiple(filesToDelete);
        }

        // Upload new logo
        const result = await storage.upload(storagePath, compressedBlob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true,
        });

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        onSuccess?.(result.url);
        return result.url;
      } catch (err) {
        console.error('Error uploading logo:', err);
        const errorMsg = 'Failed to upload logo';
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [storeId, storage, onSuccess, onError]
  );

  const deleteLogo = useCallback(
    async (currentUrl: string): Promise<boolean> => {
      if (!currentUrl) return true;

      if (!storage) {
        setError('Storage is not configured');
        return false;
      }

      try {
        setError(null);

        // Extract path from R2 URL
        const r2PublicUrl = storageConfig?.r2Config?.publicUrl || '';
        if (r2PublicUrl && currentUrl.startsWith(r2PublicUrl)) {
          const storagePath = getR2PathFromUrl(currentUrl, r2PublicUrl);
          if (storagePath) {
            await storage.delete(storagePath);
          }
        } else {
          // Fallback: delete all logos in the store folder
          const listResult = await storage.list(`logos/${storeId}`);
          if (listResult.files && listResult.files.length > 0) {
            const filesToDelete = listResult.files.map((f) => f.path);
            await storage.deleteMultiple(filesToDelete);
          }
        }

        return true;
      } catch (err) {
        console.error('Error deleting logo:', err);
        setError('Failed to delete logo');
        return false;
      }
    },
    [storeId, storage, storageConfig]
  );

  return {
    isUploading,
    error,
    uploadLogo,
    deleteLogo,
  };
}
