import { supabase } from './supabase';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

export interface UploadResult {
  success: boolean;
  url: string;
  path: string;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface ListResult {
  files: StorageFile[];
  error?: string;
}

export interface StorageFile {
  name: string;
  path: string;
  size?: number;
  lastModified?: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface StorageConfig {
  r2Config: R2Config;
  storeId: string;
}

export interface StorageService {
  upload(path: string, file: Blob, options?: UploadOptions): Promise<UploadResult>;
  delete(path: string): Promise<DeleteResult>;
  deleteMultiple(paths: string[]): Promise<DeleteResult>;
  getPublicUrl(path: string): string;
  list(prefix: string): Promise<ListResult>;
}

// ============================================================================
// R2 Storage Service (via Edge Function)
// ============================================================================

class R2StorageService implements StorageService {
  private storeId: string;
  private publicUrl: string;

  constructor(storeId: string, publicUrl: string) {
    this.storeId = storeId;
    this.publicUrl = publicUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async upload(path: string, file: Blob, options?: UploadOptions): Promise<UploadResult> {
    try {
      // Create FormData for the upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);
      formData.append('storeId', this.storeId);
      if (options?.contentType) {
        formData.append('contentType', options.contentType);
      }

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('r2-storage', {
        body: formData,
      });

      if (error) {
        return { success: false, url: '', path, error: error.message };
      }

      if (!data?.success) {
        return { success: false, url: '', path, error: data?.error || 'Upload failed' };
      }

      const url = this.getPublicUrl(path);
      return { success: true, url, path };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      return { success: false, url: '', path, error: message };
    }
  }

  async delete(path: string): Promise<DeleteResult> {
    try {
      const { data, error } = await supabase.functions.invoke('r2-storage', {
        body: {
          action: 'delete',
          path,
          storeId: this.storeId,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Delete failed' };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { success: false, error: message };
    }
  }

  async deleteMultiple(paths: string[]): Promise<DeleteResult> {
    if (paths.length === 0) return { success: true };

    try {
      const { data, error } = await supabase.functions.invoke('r2-storage', {
        body: {
          action: 'delete-multiple',
          paths,
          storeId: this.storeId,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Delete failed' };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { success: false, error: message };
    }
  }

  getPublicUrl(path: string): string {
    // Return the public URL for the file
    return `${this.publicUrl}/${path}`;
  }

  async list(prefix: string): Promise<ListResult> {
    try {
      const { data, error } = await supabase.functions.invoke('r2-storage', {
        body: {
          action: 'list',
          prefix,
          storeId: this.storeId,
        },
      });

      if (error) {
        return { files: [], error: error.message };
      }

      if (!data?.success) {
        return { files: [], error: data?.error || 'List failed' };
      }

      return { files: data.files || [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'List failed';
      return { files: [], error: message };
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get the R2 storage service for a specific store
 */
export function getR2Storage(storeId: string, publicUrl: string): StorageService {
  return new R2StorageService(storeId, publicUrl);
}

/**
 * Get the storage service based on configuration
 * Throws error if R2 is not configured
 */
export function getStorageService(config: StorageConfig): StorageService {
  if (!config.r2Config?.publicUrl) {
    throw new Error('R2 storage is not configured. Please configure Cloudflare R2 in Settings.');
  }
  return getR2Storage(config.storeId, config.r2Config.publicUrl);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Test credentials for R2 connection (passed directly, not from database)
 */
export interface R2TestCredentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

/**
 * Test R2 connection by attempting to access the bucket
 * @param storeId - The store ID (required for request context)
 * @param credentials - Optional credentials to test. If provided, tests these credentials directly.
 *                      If not provided, tests credentials stored in the database.
 */
export async function testR2Connection(
  storeId: string,
  credentials?: R2TestCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      action: 'test',
      storeId,
    };

    // If credentials are provided, include them in the request body
    // This allows testing credentials before they are saved to the database
    if (credentials) {
      body.accountId = credentials.accountId;
      body.accessKeyId = credentials.accessKeyId;
      body.secretAccessKey = credentials.secretAccessKey;
      body.bucketName = credentials.bucketName;
    }

    const { data, error } = await supabase.functions.invoke('r2-storage', {
      body,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Connection test failed' };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection test failed';
    return { success: false, error: message };
  }
}

/**
 * Check if a URL is from R2 storage (based on known R2 patterns)
 */
export function isR2StorageUrl(url: string, r2PublicUrl?: string): boolean {
  if (r2PublicUrl && url.startsWith(r2PublicUrl)) {
    return true;
  }
  // Check for common R2 URL patterns
  return url.includes('.r2.dev/') || url.includes('.r2.cloudflarestorage.com/');
}

/**
 * Extract storage path from an R2 public URL
 */
export function getR2PathFromUrl(url: string, r2PublicUrl: string): string | null {
  try {
    const baseUrl = r2PublicUrl.replace(/\/$/, '');
    if (url.startsWith(baseUrl)) {
      return url.substring(baseUrl.length + 1); // +1 for the /
    }
    return null;
  } catch {
    return null;
  }
}
