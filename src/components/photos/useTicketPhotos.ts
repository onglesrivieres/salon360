import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, TicketPhoto, TicketPhotoWithUrl } from '../../lib/supabase';
import {
  getStorageService,
  getR2PathFromUrl,
  type StorageService,
  type StorageConfig,
} from '../../lib/storage';
import { compressImage } from '../../lib/image-utils';

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE_MB = 5;

export interface PendingPhoto {
  id: string;
  file: File;
  compressedBlob: Blob;
  previewUrl: string;
  filename: string;
}

interface UseTicketPhotosOptions {
  storeId: string;
  ticketId: string | null;
  uploadedBy: string;
  storageConfig?: StorageConfig | null;
}

interface UseTicketPhotosReturn {
  photos: TicketPhotoWithUrl[];
  pendingPhotos: PendingPhoto[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  canAddMore: boolean;
  remainingSlots: number;
  totalPhotoCount: number;
  addPendingPhoto: (file: File) => Promise<boolean>;
  removePendingPhoto: (id: string) => void;
  uploadPendingPhotos: (overrideTicketId?: string) => Promise<boolean>;
  deletePhoto: (photoId: string) => Promise<boolean>;
  hasPendingChanges: boolean;
  pendingCount: number;
  refetch: () => Promise<void>;
}

export function useTicketPhotos({
  storeId,
  ticketId,
  uploadedBy,
  storageConfig,
}: UseTicketPhotosOptions): UseTicketPhotosReturn {
  const [photos, setPhotos] = useState<TicketPhotoWithUrl[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the R2 storage service - null if not configured
  // Use primitive values for memoization to avoid infinite re-render loop.
  // storageConfig is a new object each render (from getStorageConfig()), but the
  // StorageService only depends on storeId and publicUrl.
  const storagePublicUrl = storageConfig?.r2Config?.publicUrl;
  const storage: StorageService | null = useMemo(() => {
    if (!storageConfig || !storagePublicUrl) {
      return null;
    }
    try {
      return getStorageService(storageConfig);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, storagePublicUrl]);

  const totalPhotoCount = photos.length + pendingPhotos.length;

  const fetchPhotos = useCallback(async () => {
    if (!ticketId) {
      setPhotos([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('ticket_photos')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;

      // Generate URLs for photos - use storage service if available
      const photosWithUrls: TicketPhotoWithUrl[] = (data || []).map((photo: TicketPhoto) => ({
        ...photo,
        url: storage ? storage.getPublicUrl(photo.storage_path) : photo.storage_path,
      }));

      setPhotos(photosWithUrls);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, storage]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const addPendingPhoto = useCallback(
    async (file: File): Promise<boolean> => {
      if (totalPhotoCount >= MAX_PHOTOS) {
        setError(`Maximum ${MAX_PHOTOS} photos allowed`);
        return false;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. Please use JPG, PNG, or WebP');
        return false;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`File too large. Maximum ${MAX_FILE_SIZE_MB}MB allowed`);
        return false;
      }

      try {
        setError(null);

        // Compress image
        const compressedBlob = await compressImage(file);

        // Create preview URL
        const previewUrl = URL.createObjectURL(compressedBlob);

        const pendingPhoto: PendingPhoto = {
          id: crypto.randomUUID(),
          file,
          compressedBlob,
          previewUrl,
          filename: file.name,
        };

        setPendingPhotos((prev) => [...prev, pendingPhoto]);
        return true;
      } catch (err) {
        console.error('Error preparing photo:', err);
        setError('Failed to process photo');
        return false;
      }
    },
    [totalPhotoCount]
  );

  const removePendingPhoto = useCallback((id: string) => {
    setPendingPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const uploadPendingPhotos = useCallback(async (overrideTicketId?: string): Promise<boolean> => {
    if (pendingPhotos.length === 0) return true;
    const effectiveTicketId = overrideTicketId || ticketId;
    if (!effectiveTicketId) return false;

    if (!storage) {
      setError('Storage is not configured. Please configure Cloudflare R2 in Settings.');
      return false;
    }

    try {
      setIsUploading(true);
      setError(null);

      for (let i = 0; i < pendingPhotos.length; i++) {
        const pending = pendingPhotos[i];

        // Generate unique filename
        const timestamp = Date.now();
        const uuid = crypto.randomUUID();
        const extension = 'jpg';
        const filename = `${timestamp}_${uuid}.${extension}`;
        const storagePath = `tickets/${storeId}/${effectiveTicketId}/${filename}`;

        // Upload to storage using the storage service
        const uploadResult = await storage.upload(storagePath, pending.compressedBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload failed');
        }

        // Save metadata to database
        const photoData: Omit<TicketPhoto, 'id' | 'created_at'> = {
          store_id: storeId,
          ticket_id: effectiveTicketId,
          storage_path: storagePath,
          filename: pending.filename,
          file_size: pending.compressedBlob.size,
          mime_type: 'image/jpeg',
          display_order: photos.length + i,
          uploaded_by: uploadedBy,
          caption: '',
        };

        const { data: insertedPhoto, error: insertError } = await supabase
          .from('ticket_photos')
          .insert(photoData)
          .select()
          .single();

        if (insertError) throw insertError;

        // Add to saved photos
        const newPhoto: TicketPhotoWithUrl = {
          ...insertedPhoto,
          url: uploadResult.url,
        };

        setPhotos((prev) => [...prev, newPhoto]);

        // Revoke blob URL
        URL.revokeObjectURL(pending.previewUrl);
      }

      // Clear pending photos
      setPendingPhotos([]);
      return true;
    } catch (err) {
      console.error('Error uploading photos:', err);
      setError('Failed to upload photos');
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [pendingPhotos, ticketId, storeId, photos.length, uploadedBy, storage]);

  const deletePhoto = useCallback(
    async (photoId: string): Promise<boolean> => {
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) return false;

      if (!storage) {
        setError('Storage is not configured');
        return false;
      }

      try {
        setError(null);

        // Extract path and delete from R2
        const r2PublicUrl = storageConfig?.r2Config?.publicUrl || '';
        if (r2PublicUrl && photo.url.startsWith(r2PublicUrl)) {
          const storagePath = getR2PathFromUrl(photo.url, r2PublicUrl) || photo.storage_path;
          await storage.delete(storagePath);
        } else {
          // Use the storage_path directly
          await storage.delete(photo.storage_path);
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from('ticket_photos')
          .delete()
          .eq('id', photoId);

        if (dbError) throw dbError;

        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        return true;
      } catch (err) {
        console.error('Error deleting photo:', err);
        setError('Failed to delete photo');
        return false;
      }
    },
    [photos, storage, storageConfig]
  );

  return {
    photos,
    pendingPhotos,
    isLoading,
    isUploading,
    error,
    canAddMore: totalPhotoCount < MAX_PHOTOS,
    remainingSlots: MAX_PHOTOS - totalPhotoCount,
    totalPhotoCount,
    addPendingPhoto,
    removePendingPhoto,
    uploadPendingPhotos,
    deletePhoto,
    hasPendingChanges: pendingPhotos.length > 0,
    pendingCount: pendingPhotos.length,
    refetch: fetchPhotos,
  };
}
