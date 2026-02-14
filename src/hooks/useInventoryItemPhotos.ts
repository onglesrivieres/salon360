import { useState, useCallback, useMemo } from 'react';
import { supabase, InventoryTransactionItemPhoto } from '../lib/supabase';
import { compressImage } from '../lib/image-utils';
import {
  getStorageService,
  type StorageService,
  type StorageConfig,
} from '../lib/storage';

const MAX_PHOTOS_PER_ITEM = 3;
const MAX_FILE_SIZE_MB = 5;

export interface PendingItemPhoto {
  id: string;
  file: File;
  compressedBlob: Blob;
  previewUrl: string;
  filename: string;
}

interface UseInventoryItemPhotosOptions {
  storeId: string;
  uploadedBy: string;
  storageConfig: StorageConfig | null;
}

export function useInventoryItemPhotos({
  storeId,
  uploadedBy,
  storageConfig,
}: UseInventoryItemPhotosOptions) {
  // Map<itemFormIndex, PendingItemPhoto[]>
  const [pendingPhotos, setPendingPhotos] = useState<Map<number, PendingItemPhoto[]>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storagePublicUrl = storageConfig?.r2Config?.publicUrl;
  const storage: StorageService | null = useMemo(() => {
    if (!storageConfig || !storagePublicUrl) return null;
    try {
      return getStorageService(storageConfig);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, storagePublicUrl]);

  const addPendingPhoto = useCallback(async (index: number, file: File): Promise<boolean> => {
    const current = pendingPhotos.get(index) || [];
    if (current.length >= MAX_PHOTOS_PER_ITEM) {
      setError(`Maximum ${MAX_PHOTOS_PER_ITEM} photos per item`);
      return false;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please use JPG, PNG, or WebP');
      return false;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum ${MAX_FILE_SIZE_MB}MB allowed`);
      return false;
    }

    try {
      setError(null);
      const compressedBlob = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressedBlob);

      const pendingPhoto: PendingItemPhoto = {
        id: crypto.randomUUID(),
        file,
        compressedBlob,
        previewUrl,
        filename: file.name,
      };

      setPendingPhotos(prev => {
        const next = new Map(prev);
        const existing = next.get(index) || [];
        next.set(index, [...existing, pendingPhoto]);
        return next;
      });
      return true;
    } catch (err) {
      console.error('Error preparing photo:', err);
      setError('Failed to process photo');
      return false;
    }
  }, [pendingPhotos]);

  const removePendingPhoto = useCallback((index: number, photoId: string) => {
    setPendingPhotos(prev => {
      const next = new Map(prev);
      const existing = next.get(index) || [];
      const photo = existing.find(p => p.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      const filtered = existing.filter(p => p.id !== photoId);
      if (filtered.length === 0) {
        next.delete(index);
      } else {
        next.set(index, filtered);
      }
      return next;
    });
  }, []);

  const getPhotoCount = useCallback((index: number): number => {
    return (pendingPhotos.get(index) || []).length;
  }, [pendingPhotos]);

  const getRemainingSlots = useCallback((index: number): number => {
    return MAX_PHOTOS_PER_ITEM - (pendingPhotos.get(index) || []).length;
  }, [pendingPhotos]);

  const getPhotosForIndex = useCallback((index: number): PendingItemPhoto[] => {
    return pendingPhotos.get(index) || [];
  }, [pendingPhotos]);

  const removeItemPhotos = useCallback((index: number) => {
    setPendingPhotos(prev => {
      const next = new Map(prev);
      const existing = next.get(index) || [];
      existing.forEach(p => URL.revokeObjectURL(p.previewUrl));
      next.delete(index);

      // Reindex: shift down keys above removed index
      const reindexed = new Map<number, PendingItemPhoto[]>();
      for (const [key, value] of next) {
        if (key > index) {
          reindexed.set(key - 1, value);
        } else {
          reindexed.set(key, value);
        }
      }
      return reindexed;
    });
  }, []);

  const uploadAllPhotos = useCallback(async (
    transactionId: string,
    indexToItemIdMap: Map<number, string>
  ): Promise<boolean> => {
    if (pendingPhotos.size === 0) return true;

    if (!storage) {
      setError('Storage is not configured');
      return false;
    }

    try {
      setIsUploading(true);
      setError(null);

      for (const [index, photos] of pendingPhotos) {
        const itemId = indexToItemIdMap.get(index);
        if (!itemId) continue;

        for (let i = 0; i < photos.length; i++) {
          const pending = photos[i];
          const timestamp = Date.now();
          const uuid = crypto.randomUUID();
          const filename = `${timestamp}_${uuid}.jpg`;
          const storagePath = `inventory/${storeId}/${transactionId}/${itemId}/${filename}`;

          const uploadResult = await storage.upload(storagePath, pending.compressedBlob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Upload failed');
          }

          const photoData: Omit<InventoryTransactionItemPhoto, 'id' | 'created_at'> = {
            store_id: storeId,
            transaction_item_id: itemId,
            storage_path: storagePath,
            filename: pending.filename,
            file_size: pending.compressedBlob.size,
            mime_type: 'image/jpeg',
            display_order: i,
            uploaded_by: uploadedBy,
            caption: '',
          };

          const { error: insertError } = await supabase
            .from('inventory_transaction_item_photos')
            .insert(photoData);

          if (insertError) throw insertError;

          URL.revokeObjectURL(pending.previewUrl);
        }
      }

      setPendingPhotos(new Map());
      return true;
    } catch (err) {
      console.error('Error uploading inventory photos:', err);
      setError('Failed to upload photos');
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [pendingPhotos, storeId, uploadedBy, storage]);

  const clearAll = useCallback(() => {
    setPendingPhotos(prev => {
      for (const photos of prev.values()) {
        photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
      }
      return new Map();
    });
    setError(null);
  }, []);

  const hasPendingPhotos = pendingPhotos.size > 0;

  const totalPendingCount = useMemo(() => {
    let count = 0;
    for (const photos of pendingPhotos.values()) {
      count += photos.length;
    }
    return count;
  }, [pendingPhotos]);

  return {
    addPendingPhoto,
    removePendingPhoto,
    getPhotoCount,
    getRemainingSlots,
    getPhotosForIndex,
    removeItemPhotos,
    uploadAllPhotos,
    clearAll,
    isUploading,
    error,
    hasPendingPhotos,
    totalPendingCount,
  };
}
