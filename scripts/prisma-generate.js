#!/usr/bin/env node
// Ensures prisma generate runs even when DATABASE_URL is unset (e.g. Vercel build).
// Prisma only needs the URL format at generate time; runtime uses real DATABASE_URL.
const { execSync } = require('child_process');
const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://build:build@localhost:5432/build';
}
execSync('npx prisma generate', { stdio: 'inherit', env });
