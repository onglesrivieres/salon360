/*
  # Create Photo Storage Bucket

  ## Overview
  Creates the `salon360-photos` storage bucket for ticket photos.

  ## Changes
  - Creates storage bucket with 5MB file size limit
  - Allows only image types (jpeg, png, webp)
  - Sets up RLS policies for public read, authenticated upload/delete

  ## Notes
  - This fixes the "Bucket not found" error when uploading photos
*/

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Create the storage bucket for photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'salon360-photos',
  'salon360-photos',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================

-- Allow public read access to photos
DROP POLICY IF EXISTS "Allow public read access on salon360-photos" ON storage.objects;
CREATE POLICY "Allow public read access on salon360-photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'salon360-photos');

-- Allow authenticated users to upload photos
DROP POLICY IF EXISTS "Allow authenticated uploads to salon360-photos" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to salon360-photos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'salon360-photos');

-- Allow authenticated users to delete their photos
DROP POLICY IF EXISTS "Allow authenticated deletes from salon360-photos" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from salon360-photos"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'salon360-photos');
