-- ============================================================
-- Migration: Add resources table + Supabase Storage bucket
-- Run this once in the Supabase SQL editor:
--   https://supabase.com/dashboard → SQL editor → New query
-- ============================================================

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        VARCHAR(255) NOT NULL,
    type         VARCHAR(100) NOT NULL,   -- 'Lesson Plan', 'Worksheet', 'Audio', etc.
    cefr_level   cefr_level NOT NULL,
    file_url     TEXT NOT NULL,
    file_name    VARCHAR(255) NOT NULL,
    file_size    BIGINT,
    file_type    VARCHAR(100),            -- MIME type e.g. 'application/pdf'
    uploaded_by  UUID REFERENCES profiles(id) ON DELETE CASCADE,
    shared       BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by ON resources(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_resources_cefr_level  ON resources(cefr_level);

-- RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own resources"
    ON resources FOR ALL TO authenticated
    USING (uploaded_by = auth.uid())
    WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "All authenticated users can view resources"
    ON resources FOR SELECT TO authenticated
    USING (true);

-- Supabase Storage bucket for resource files (50 MB limit per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('resources', 'resources', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload resources"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'resources');

CREATE POLICY "Public can read resource files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'resources');

CREATE POLICY "Owners can delete their resource files"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'resources');
