-- Documents: table + storage bucket policies for admin-only document storage.
-- Run in Supabase SQL Editor. Create bucket "documents" in Dashboard → Storage (private).
--
-- Bucket: create as private so files are only accessible via signed URLs from the API.

-- 1. Table for document metadata (actual file lives in storage)
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  content_type text DEFAULT 'application/pdf',
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_uploaded_by_idx ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at DESC);

-- 2. Storage RLS: allow service_role (and anon fallback) to manage "documents" bucket
DROP POLICY IF EXISTS "Allow documents uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow documents updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow documents select" ON storage.objects;
DROP POLICY IF EXISTS "Allow documents delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon documents uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon documents updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon documents select" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon documents delete" ON storage.objects;

CREATE POLICY "Allow documents uploads"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow documents updates"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'documents');

CREATE POLICY "Allow documents select"
ON storage.objects FOR SELECT TO service_role
USING (bucket_id = 'documents');

CREATE POLICY "Allow documents delete"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'documents');

CREATE POLICY "Allow anon documents uploads"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow anon documents updates"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'documents');

CREATE POLICY "Allow anon documents select"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'documents');

CREATE POLICY "Allow anon documents delete"
ON storage.objects FOR DELETE TO anon
USING (bucket_id = 'documents');
