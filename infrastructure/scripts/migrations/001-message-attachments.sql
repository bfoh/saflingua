-- Migration 001: Add attachment support to messages
-- Run this against your existing Supabase database.

-- 1. Add attachment columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_url  VARCHAR,
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER,
  ADD COLUMN IF NOT EXISTS attachment_type VARCHAR;

-- 2. Allow empty string content (for attachment-only messages)
ALTER TABLE messages ALTER COLUMN content SET DEFAULT '';

-- 3. Supabase Storage bucket for message attachments (25 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('message-attachments', 'message-attachments', true, 26214400)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS: authenticated users can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Auth users upload message attachments'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Auth users upload message attachments"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'message-attachments')
    $policy$;
  END IF;
END $$;

-- 5. Storage RLS: public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read message attachments'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public read message attachments"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'message-attachments')
    $policy$;
  END IF;
END $$;
