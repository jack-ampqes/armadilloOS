-- ============================================
-- SQL for creating users table in Supabase
-- ============================================
-- Run this in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste this → Run

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Allow signup" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create a policy that allows users to read their own data
-- (You can adjust this based on your needs)
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow anyone to insert (for signup)
-- In production, you might want to restrict this or add additional validation
CREATE POLICY "Allow signup" ON users
  FOR INSERT
  WITH CHECK (true);

-- Allow users to update their own data (optional)
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- Creating Your First User
-- ============================================
-- 
-- Option 1: Use the hash-password script
--   Run: node scripts/hash-password.js "yourpassword"
--   Copy the hash and use it in the INSERT below
--
-- Option 2: Use command line
--   Run: echo -n "yourpassword" | shasum -a 256
--   Copy the hash (first part, before the dash)
--
-- Option 3: Online tool
--   Visit: https://emn178.github.io/online-tools/sha256.html
--   Enter password, copy hash
--
-- Then run this (replace email and password_hash):
--
-- INSERT INTO users (email, password_hash) VALUES (
--   'admin@armadillo.com',
--   'YOUR_HASHED_PASSWORD_HERE'
-- );
--
-- Example (password: "password123"):
-- INSERT INTO users (email, password_hash) VALUES (
--   'admin@armadillo.com',
--   'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'
-- );
