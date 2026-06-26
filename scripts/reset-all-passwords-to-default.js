#!/usr/bin/env node
// scripts/reset-all-passwords-to-default.js
// ============================================================
// One-off operational script.
//
// Sets EVERY user's password to the shared default 'Start@123' and forces a
// password change on their next login (force_password_change = 1). After this
// runs, every user signs in with Start@123 and is immediately required to set
// a new password (the server-side must-change-password guard blocks all other
// API access until they do).
//
// Run ON THE SERVER, from the repo root, with .env present:
//   node scripts/reset-all-passwords-to-default.js          # dry-run (counts only)
//   node scripts/reset-all-passwords-to-default.js --yes    # apply
//
// DB connection is read from .env: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD /
// DB_NAME. Idempotent — safe to run more than once.
//
// Why a single hash works for all users: bcrypt embeds a random salt in every
// hash, and login uses bcrypt.compare(plaintext, hash), so one freshly
// generated hash of 'Start@123' validates for every row.
// ============================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

const DEFAULT_PASSWORD = 'Start@123';

(async () => {
  const apply = process.argv.includes('--yes');

  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || '127.0.0.1',
    port:     Number(process.env.DB_PORT || 3306),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  try {
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM users');

    if (!apply) {
      console.log(`[dry-run] ${n} user(s) would be reset to '${DEFAULT_PASSWORD}' with forced change on next login.`);
      console.log('[dry-run] Re-run with --yes to apply.');
      return;
    }

    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const [res] = await conn.query(
      `UPDATE users
          SET password_hash         = ?,
              force_password_change = 1,
              temp_password         = NULL,
              login_count           = 0`,
      [hash]
    );

    console.log(`[done] ${res.affectedRows} user(s) updated.`);
    console.log(`[done] Password for all users: '${DEFAULT_PASSWORD}' — must change on next login.`);
  } finally {
    await conn.end();
  }
})().catch(err => {
  console.error('[FAILED]', err.message);
  process.exit(1);
});
