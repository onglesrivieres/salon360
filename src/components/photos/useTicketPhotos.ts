import { useState, useEffect, useCallback } from 'react';
import { supabase, TicketPhoto, TicketPhotoWithUrl } from '../../lib/supabase';

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE_MB = 5;
const MAX_DIMENSION = 2048;
const BUCKET_NAME = 'salon360-photos';

export interface PendingPhoto {
  id: string;
  file: File;
  compressedBlob: Blob;
  previewUrl: string;
  filename: string;
}

interface UseTicketPhotosOptions {
  storeId: string;
  ticketId: string;
  uploadedBy: string;
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
  uploadPendingPhotos: () => Promise<boolean>;
  deletePhoto: (photoId: string) => Promise<boolean>;
  hasPendingChanges: boolean;
  refetch: () => Promise<void>;
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
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function useTicketPhotos({
  storeId,
  ticketId,
  uploadedBy,
}: UseTicketPhotosOptions): UseTicketPhotosReturn {
  const [photos, setPhotos] = useState<TicketPhotoWithUrl[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const photosWithUrls: TicketPhotoWithUrl[] = (data || []).map((photo: TicketPhoto) => ({
        ...photo,
        url: getPublicUrl(photo.storage_path),
      }));

      setPhotos(photosWithUrls);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

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

  const uploadPendingPhotos = useCallback(async (): Promise<boolean> => {
    if (pendingPhotos.length === 0) return true;
    if (!ticketId) return false;

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
        const storagePath = `tickets/${storeId}/${ticketId}/${filename}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, pending.compressedBlob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        // Save metadata to database
        const photoData: Omit<TicketPhoto, 'id' | 'created_at'> = {
          store_id: storeId,
          ticket_id: ticketId,
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
          url: getPublicUrl(storagePath),
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
  }, [pendingPhotos, ticketId, storeId, photos.length, uploadedBy]);

  const deletePhoto = useCallback(
    async (photoId: string): Promise<boolean> => {
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) return false;

      try {
        setError(null);

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([photo.storage_path]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
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
    [photos]
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
    refetch: fetchPhotos,
  };
}
