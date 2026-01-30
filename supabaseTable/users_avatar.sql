-- Avatars: users column + storage policies for bucket "avatars"
-- Run in Supabase SQL Editor. Bucket "avatars" must already exist (create in Dashboard → Storage).
--
-- For avatar uploads to work, set SUPABASE_SERVICE_ROLE_KEY in .env.local (and in Vercel
-- if deployed). If unset, the API uses the anon key and relies on the "anon" policies below.

-- 1. Store profile picture URL on users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Storage RLS: allow API to upload/upsert into bucket "avatars"
-- Upsert needs INSERT, SELECT, UPDATE (and sometimes DELETE). Drop first so script is idempotent.
DROP POLICY IF EXISTS "Allow avatar uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar select" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon avatar uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon avatar updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon avatar select" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon avatar delete" ON storage.objects;

-- service_role
CREATE POLICY "Allow avatar uploads"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow avatar updates"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'avatars');

CREATE POLICY "Allow avatar select"
ON storage.objects FOR SELECT TO service_role
USING (bucket_id = 'avatars');

CREATE POLICY "Allow avatar delete"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'avatars');

-- anon (fallback when service role key not set)
CREATE POLICY "Allow anon avatar uploads"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow anon avatar updates"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'avatars');

CREATE POLICY "Allow anon avatar select"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'avatars');

CREATE POLICY "Allow anon avatar delete"
ON storage.objects FOR DELETE TO anon
USING (bucket_id = 'avatars');
