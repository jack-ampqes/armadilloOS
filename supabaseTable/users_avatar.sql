-- Avatars: users column + storage policies for bucket "avatars"
-- Run in Supabase SQL Editor. Bucket "avatars" must already exist (create in Dashboard → Storage).

-- 1. Store profile picture URL on users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Storage RLS: allow API to upload/upsert into bucket "avatars"
-- Drop first so this script is safe to run again.
DROP POLICY IF EXISTS "Allow avatar uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon avatar uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon avatar updates" ON storage.objects;

CREATE POLICY "Allow avatar uploads"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow avatar updates"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'avatars');

CREATE POLICY "Allow anon avatar uploads"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow anon avatar updates"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'avatars');
