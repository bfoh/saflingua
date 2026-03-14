-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENABLE REALTIME
-- This tells Supabase to broadcast changes to these tables.
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add tables to publication if not already there
-- We do this individually to avoid failing the whole script if one is already added
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- DROP EXISTING TABLES AND TYPES TO ALLOW CLEAN RE-RUNS
DROP TABLE IF EXISTS writing_submissions      CASCADE;
DROP TABLE IF EXISTS analytics_events         CASCADE;
DROP TABLE IF EXISTS user_badges              CASCADE;
DROP TABLE IF EXISTS badges                   CASCADE;
DROP TABLE IF EXISTS user_streaks             CASCADE;
DROP TABLE IF EXISTS xp_transactions          CASCADE;
DROP TABLE IF EXISTS user_xp                  CASCADE;
DROP TABLE IF EXISTS vocabulary_srs           CASCADE;
DROP TABLE IF EXISTS vocabulary_items         CASCADE;
DROP TABLE IF EXISTS vocabulary_lists         CASCADE;
DROP TABLE IF EXISTS exercise_attempts        CASCADE;
DROP TABLE IF EXISTS exercises                CASCADE;
DROP TABLE IF EXISTS lesson_progress          CASCADE;
DROP TABLE IF EXISTS class_enrollments        CASCADE;
DROP TABLE IF EXISTS enrollments              CASCADE;
DROP TABLE IF EXISTS lessons                  CASCADE;
DROP TABLE IF EXISTS course_modules           CASCADE;
DROP TABLE IF EXISTS courses                  CASCADE;
DROP TABLE IF EXISTS student_progress         CASCADE;
DROP TABLE IF EXISTS lesson_completions       CASCADE;
DROP TABLE IF EXISTS submissions              CASCADE;

-- Dropping SAF specific tables
DROP TABLE IF EXISTS live_sessions            CASCADE;
DROP TABLE IF EXISTS exam_submissions         CASCADE;
DROP TABLE IF EXISTS exam_sections            CASCADE;
DROP TABLE IF EXISTS mock_exams               CASCADE;
DROP TABLE IF EXISTS class_enrollments        CASCADE;
DROP TABLE IF EXISTS assignments              CASCADE;
DROP TABLE IF EXISTS invoices                 CASCADE;
DROP TABLE IF EXISTS classes                  CASCADE;
DROP TABLE IF EXISTS branches                 CASCADE;
DROP TABLE IF EXISTS resources                CASCADE;
DROP TABLE IF EXISTS messages                 CASCADE;
DROP TABLE IF EXISTS profiles                 CASCADE;

-- Dropping types
DROP TYPE IF EXISTS badge_type                CASCADE;
DROP TYPE IF EXISTS content_block_type        CASCADE;
DROP TYPE IF EXISTS exercise_type             CASCADE;
DROP TYPE IF EXISTS cefr_level                CASCADE;
DROP TYPE IF EXISTS user_role                 CASCADE;
DROP TYPE IF EXISTS goethe_module             CASCADE;

-- ENUMS
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'instructor', 'admin', 'superadmin');
CREATE TYPE cefr_level AS ENUM ('A1','A2','B1','B2','C1','C2');
CREATE TYPE goethe_module AS ENUM ('hören','lesen','schreiben','sprechen');

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  first_name  TEXT NOT NULL DEFAULT '',
  last_name   TEXT NOT NULL DEFAULT '',
  role        user_role NOT NULL DEFAULT 'student',
  cefr_level  cefr_level NOT NULL DEFAULT 'A1',
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  visa_status TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DIRECT MESSAGES
CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content          TEXT NOT NULL DEFAULT '',
  is_read          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attachment_url   VARCHAR,
  attachment_name  VARCHAR,
  attachment_size  INTEGER,
  attachment_type  VARCHAR
);

-- BRANCHES
CREATE TABLE branches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  address         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CLASSES
CREATE TABLE classes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  branch_id       UUID REFERENCES branches(id),
  teacher_id      UUID REFERENCES profiles(id),
  cefr_level      cefr_level NOT NULL,
  start_date      DATE,
  end_date        DATE,
  status          VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ENROLLMENTS
CREATE TABLE class_enrollments (
  class_id        UUID REFERENCES classes(id),
  student_id      UUID REFERENCES profiles(id),
  tuition_paid    BOOLEAN DEFAULT false,
  PRIMARY KEY (class_id, student_id)
);

-- COURSES
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  cefr_level cefr_level NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(255),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ASSIGNMENTS
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE
);

-- SUBMISSIONS
CREATE TABLE submissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id   UUID REFERENCES assignments(id) ON DELETE SET NULL,
  student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_title VARCHAR(255) NOT NULL,
  submission_type VARCHAR(50) NOT NULL,
  cefr_level      cefr_level NOT NULL,
  content_text    TEXT,
  audio_url       TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  score           INT,
  feedback        TEXT,
  error_tags      TEXT[],
  graded_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at       TIMESTAMPTZ
);

-- COURSE MODULES
CREATE TABLE course_modules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  order_index  INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LESSONS
CREATE TABLE lessons (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id    UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  content_data JSONB,
  order_index  INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- STUDENT PROGRESS
CREATE TABLE student_progress (
  student_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp_points       INTEGER NOT NULL DEFAULT 0,
  streak_days     INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RESOURCES
CREATE TABLE resources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  type            TEXT NOT NULL,
  cefr_level      cefr_level NOT NULL,
  file_url        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER,
  file_type       TEXT,
  uploaded_by     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  shared          BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LIVE CLASSROOM SESSIONS
CREATE TABLE IF NOT EXISTS live_sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id      UUID REFERENCES classes(id) ON DELETE SET NULL,
    host_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    started_at    TIMESTAMPTZ,
    ended_at      TIMESTAMPTZ,
    recording_url TEXT,
    resource_id   UUID REFERENCES resources(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INVOICES
CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    cohort_name     VARCHAR(255),
    amount          DECIMAL(10, 2),
    date_issued     DATE DEFAULT CURRENT_DATE,
    status          VARCHAR(50) DEFAULT 'Pending'
);

-- SYNC PROFILES FROM AUTH
INSERT INTO public.profiles (id, email, first_name, last_name, role)
SELECT 
  id, 
  email, 
  CASE 
    WHEN (raw_user_meta_data->>'first_name') IS NOT NULL AND (raw_user_meta_data->>'first_name') <> '' THEN (raw_user_meta_data->>'first_name')
    WHEN (raw_app_meta_data->>'role') = 'admin' THEN 'SAF'
    ELSE ''
  END, 
  CASE 
    WHEN (raw_user_meta_data->>'last_name') IS NOT NULL AND (raw_user_meta_data->>'last_name') <> '' THEN (raw_user_meta_data->>'last_name')
    WHEN (raw_app_meta_data->>'role') = 'admin' THEN 'Administrator'
    ELSE ''
  END,
  COALESCE((raw_app_meta_data->>'role')::user_role, 'student'::user_role)
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = CASE 
    WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name 
    WHEN public.profiles.role = 'admin' AND public.profiles.first_name = '' THEN 'SAF'
    ELSE public.profiles.first_name 
  END,
  last_name = CASE 
    WHEN EXCLUDED.last_name <> '' THEN EXCLUDED.last_name 
    WHEN public.profiles.role = 'admin' AND public.profiles.last_name = '' THEN 'Administrator'
    ELSE public.profiles.last_name 
  END;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles viewable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Student view own sub" ON submissions FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Instructor manage all sub" ON submissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin', 'superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin', 'superadmin')));

CREATE POLICY "Participants view live sessions" ON live_sessions FOR SELECT TO authenticated 
  USING (
    host_id = auth.uid() OR 
    class_id IN (SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Hosts manage live sessions" ON live_sessions FOR ALL TO authenticated
  USING (host_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- SEED
INSERT INTO branches (id, name, address) VALUES ('0b111111-1111-1111-1111-111111111111', 'Accra Main', 'Accra');
INSERT INTO courses (id, title, cefr_level, is_published) VALUES ('03111111-1111-1111-1111-111111111111', 'German B1 Intensive', 'B1', true);
INSERT INTO classes (id, name, branch_id, teacher_id, cefr_level, status)
VALUES ('04111111-1111-1111-1111-111111111111', 'B1 Accra Morning', '0b111111-1111-1111-1111-111111111111', 
  (SELECT id FROM profiles WHERE role = 'instructor' LIMIT 1), 'B1', 'active');
INSERT INTO assignments (id, course_id, title, due_date)
VALUES ('05111111-1111-1111-1111-111111111111', '03111111-1111-1111-1111-111111111111', 'Weekend Narrative Essay', NOW() + INTERVAL '7 days');

DO $$
DECLARE v_sid UUID;
BEGIN
    SELECT id INTO v_sid FROM profiles WHERE email = 'bfoh2g@yahoo.com' OR first_name ILIKE '%Ebenezer%' LIMIT 1;
    IF v_sid IS NOT NULL THEN
        INSERT INTO class_enrollments (class_id, student_id) VALUES ('04111111-1111-1111-1111-111111111111', v_sid);
        INSERT INTO submissions (assignment_id, student_id, assignment_title, submission_type, cefr_level, content_text, status)
        VALUES ('05111111-1111-1111-1111-111111111111', v_sid, 'Weekend Narrative Essay', 'writing', 'B1', 'Great essay content.', 'pending');
        -- SEED RESOURCES
        INSERT INTO resources (id, title, type, cefr_level, file_url, file_name, uploaded_by, shared)
        VALUES (uuid_generate_v4(), 'B1 Grammar Essentials', 'Reference', 'B1', 
          'https://yarditssvzaksyanwvha.supabase.co/storage/v1/object/public/resources/grammar_prep.pdf', 
          'grammar_prep.pdf', (SELECT id FROM profiles WHERE role = 'instructor' LIMIT 1), true);

        -- SEED INVOICES
        INSERT INTO invoices (id, student_id, cohort_name, amount, status)
        VALUES (uuid_generate_v4(), v_sid, 'German B1 Intensive - April 2024', 2500.00, 'Pending');
    END IF;
END $$;
