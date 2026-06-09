// scripts/set-passwords.js
// ============================================================
// Bulk password seeder for placeholder accounts.
//
// Use this after loading a database dump where every user's
// password_hash is a sentinel string like '$2b$10$placeholder'.
// The script hashes the plain-text password ONCE and updates
// every user whose hash is still a sentinel.
//
// Real bcrypt hashes ($2a/$2b/$2y prefix, 60 chars long) are
// never touched. Re-running the script is safe.
//
// USAGE
//   # Default — seed every placeholder user with 'Welcome@123'
//   node scripts/set-passwords.js
//
//   # Override the seed password
//   SEED_PASSWORD='MyTempPass123' node scripts/set-passwords.js
//
//   # Restrict to specific usernames (comma-separated)
//   SEED_USERNAMES='naveen,udupa,test_principal' \
//     node scripts/set-passwords.js
//
// SECURITY MODEL
//   - Plain text never leaves this process. The hash is computed
//     in memory and only the hash is written to the DB.
//   - Default password expires automatically after 25 logins
//     (see auth.js FORCE_CHANGE_AFTER). No force-change flag is
//     set here — the 25-login policy handles rotation.
//   - Use a strong SEED_PASSWORD on production hosts. The default
//     'Welcome@123' is for development/testing only.
// ============================================================

'use strict';

const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

// Sentinel patterns — anything matching is treated as "no real password set"
// and gets the seed password applied. A real bcrypt hash is 60 characters
// and starts with $2a$, $2b$, or $2y$ followed by the cost.
function isPlaceholderHash(hash) {
  if (!hash) return true;
  const s = String(hash);
  if (s.length < 50) return true;                          // too short to be bcrypt
  if (!/^\$2[aby]\$\d{2}\$/.test(s)) return true;          // not a bcrypt hash
  if (s.includes('placeholder')) return true;              // common sentinel
  return false;
}

async function run() {
  const seedPassword = process.env.SEED_PASSWORD || 'Start@123';
  if (seedPassword.length < 8) {
    console.error('✗ SEED_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  const usernameFilter = (process.env.SEED_USERNAMES || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const conn = {
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'nu_pmc',
    user:     process.env.DB_USER     || 'nu_app',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  };
  if (process.env.DB_SOCKET) conn.socketPath = process.env.DB_SOCKET;
  if (process.env.DB_PORT)   conn.port       = parseInt(process.env.DB_PORT);
  const db = await mysql.createConnection(conn);

  // Pull every active user — we'll filter for placeholder hashes in JS so we
  // never accidentally over-write a real hash.
  let sql = 'SELECT id, username, role, password_hash FROM users WHERE is_active = 1';
  const params = [];
  if (usernameFilter.length) {
    sql += ` AND username IN (${usernameFilter.map(() => '?').join(',')})`;
    params.push(...usernameFilter);
  }
  sql += ' ORDER BY id';
  const [users] = await db.execute(sql, params);

  // Hash the seed password ONCE — bcrypt is intentionally slow.
  const hash = await bcrypt.hash(seedPassword, 10);

  let updated = 0, skipped = 0;
  for (const u of users) {
    if (!isPlaceholderHash(u.password_hash)) {
      skipped++;
      continue;
    }
    await db.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hash, u.id]
    );
    updated++;
  }

  console.log('');
  console.log(`✓ Seeded ${updated} user${updated === 1 ? '' : 's'} with password: ${seedPassword}`);
  if (skipped) {
    console.log(`  (${skipped} user${skipped === 1 ? '' : 's'} already had a real password — left alone)`);
  }
  console.log('');
  console.log('Auto-rotation: each user is prompted to change after 25 logins on the seed password.');
  console.log('               (Configurable in modules/auth/routes/auth.js — FORCE_CHANGE_AFTER)');
  console.log('');

  await db.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
