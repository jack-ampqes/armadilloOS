#!/usr/bin/env node

// Simple script to hash passwords for user creation
// Usage: node scripts/hash-password.js "yourpassword"

const crypto = require('crypto');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js "yourpassword"');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(password).digest('hex');
console.log('\nPassword hash:', hash);
console.log('\nSQL to insert user:');
console.log(`INSERT INTO users (email, password_hash) VALUES ('your-email@example.com', '${hash}');\n`);
