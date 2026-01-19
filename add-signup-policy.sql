-- ============================================
-- Quick fix: Add INSERT policy for signup
-- ============================================
-- Run this if you already have the users table and policies
-- This only adds the missing INSERT policy needed for signup

-- Drop the policy if it already exists (to avoid errors)
DROP POLICY IF EXISTS "Allow signup" ON users;

-- Create the INSERT policy to allow signups
CREATE POLICY "Allow signup" ON users
  FOR INSERT
  WITH CHECK (true);
