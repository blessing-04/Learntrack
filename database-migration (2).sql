-- LearnTrack Database Schema Updates
-- Run this in Supabase SQL Editor

-- 1. Add thumbnail_url to courses table if it doesn't exist
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 2. Add content storage columns to courses
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS content_data JSONB DEFAULT '{}';

-- 3. Create course_files table for storing uploaded content references
CREATE TABLE IF NOT EXISTS course_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL, -- 'video', 'document', 'thumbnail'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_course_files_course_id ON course_files(course_id);
CREATE INDEX IF NOT EXISTS idx_course_files_type ON course_files(file_type);

-- 4. Create course_links table
CREATE TABLE IF NOT EXISTS course_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create course_quizzes table
CREATE TABLE IF NOT EXISTS course_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options JSONB, -- For multiple choice options
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create course_assignments table
CREATE TABLE IF NOT EXISTS course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Set up Row Level Security (RLS) for new tables
ALTER TABLE course_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all course content
CREATE POLICY "Allow authenticated users to read course files"
  ON course_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read course links"
  ON course_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read course quizzes"
  ON course_quizzes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read course assignments"
  ON course_assignments FOR SELECT
  TO authenticated
  USING (true);

-- Allow instructors to insert/update/delete their own course content
CREATE POLICY "Allow instructors to manage their course files"
  ON course_files FOR ALL
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE instructor_id = auth.uid()
    )
  );

CREATE POLICY "Allow instructors to manage their course links"
  ON course_links FOR ALL
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE instructor_id = auth.uid()
    )
  );

CREATE POLICY "Allow instructors to manage their course quizzes"
  ON course_quizzes FOR ALL
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE instructor_id = auth.uid()
    )
  );

CREATE POLICY "Allow instructors to manage their course assignments"
  ON course_assignments FOR ALL
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses WHERE instructor_id = auth.uid()
    )
  );

-- IMPORTANT: Create Storage Buckets
-- Run these separately in Supabase Dashboard > Storage or via API:
-- 1. Create bucket: 'course-videos' (public: true)
-- 2. Create bucket: 'course-documents' (public: true)
-- 3. Create bucket: 'course-thumbnails' (public: true)

COMMENT ON TABLE course_files IS 'Stores references to files uploaded to Supabase Storage';
COMMENT ON TABLE course_links IS 'External resource links for courses';
COMMENT ON TABLE course_quizzes IS 'Quiz questions and answers for courses';
COMMENT ON TABLE course_assignments IS 'Course assignments with descriptions';
