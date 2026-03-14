-- Migration 002: Add lecture-recordings bucket
-- Run this against your Supabase database to enable recording storage.

-- 1. Create the bucket (100 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lecture-recordings', 'lecture-recordings', true, 104857600, '{video/webm,video/mp4,video/x-matroska}')
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS: Instructors and Admins can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Instructors can upload lecture recordings'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Instructors can upload lecture recordings"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'lecture-recordings' AND
          (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('instructor', 'admin', 'superadmin')
          ))
        )
    $policy$;
  END IF;
END $$;

-- 3. Storage RLS: Public read access for playback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read lecture recordings'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public read lecture recordings"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'lecture-recordings')
    $policy$;
  END IF;
END $$;
