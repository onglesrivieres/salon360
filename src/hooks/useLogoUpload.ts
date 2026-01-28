import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const MAX_FILE_SIZE_MB = 2;
const MAX_DIMENSION = 400;
const BUCKET_NAME = 'salon360-photos';

interface UseLogoUploadOptions {
  storeId: string;
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
}

interface UseLogoUploadReturn {
  isUploading: boolean;
  error: string | null;
  uploadLogo: (file: File) => Promise<string | null>;
  deleteLogo: (currentUrl: string) => Promise<boolean>;
}

function getStoragePathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/salon360-photos\/(.+)/);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}

function getPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
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

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function useLogoUpload({
  storeId,
  onSuccess,
  onError,
}: UseLogoUploadOptions): UseLogoUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
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
        const { data: existingFiles } = await supabase.storage
          .from(BUCKET_NAME)
          .list(`logos/${storeId}`);

        if (existingFiles && existingFiles.length > 0) {
          const filesToDelete = existingFiles.map((f) => `logos/${storeId}/${f.name}`);
          await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
        }

        // Upload new logo
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, compressedBlob, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const publicUrl = getPublicUrl(storagePath);
        onSuccess?.(publicUrl);
        return publicUrl;
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
    [storeId, onSuccess, onError]
  );

  const deleteLogo = useCallback(
    async (currentUrl: string): Promise<boolean> => {
      if (!currentUrl) return true;

      try {
        setError(null);

        // Try to extract storage path from URL
        const storagePath = getStoragePathFromUrl(currentUrl);

        if (storagePath) {
          await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        } else {
          // Fallback: delete all logos in the store folder
          const { data: existingFiles } = await supabase.storage
            .from(BUCKET_NAME)
            .list(`logos/${storeId}`);

          if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map((f) => `logos/${storeId}/${f.name}`);
            await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
          }
        }

        return true;
      } catch (err) {
        console.error('Error deleting logo:', err);
        setError('Failed to delete logo');
        return false;
      }
    },
    [storeId]
  );

  return {
    isUploading,
    error,
    uploadLogo,
    deleteLogo,
  };
}
