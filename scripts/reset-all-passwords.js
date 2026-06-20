// scripts/reset-all-passwords.js
// ============================================================
// Resets ALL active users' passwords to Start@123 and sets
// force_password_change=1 so they must change it on first login.
//
// USAGE:
//   node scripts/reset-all-passwords.js
//
// This will:
//   1. Hash 'Start@123' with bcrypt (cost 10)
//   2. Update every active user's password_hash to that hash
//   3. Set force_password_change=1 for all users
//   4. Reset login_count to 0 so the threshold works cleanly
//
// After running, every user logs in with Start@123 and is
// immediately prompted to set a new password.
// ============================================================

'use strict';

const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

async function run() {
  const newPassword = 'Start@123';

  const conn = {
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'nu_pmc',
    user:     process.env.DB_USER     || 'nu_app',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  };
  if (process.env.DB_SOCKET) conn.socketPath = process.env.DB_SOCKET;
  if (process.env.DB_PORT)   conn.port       = parseInt(process.env.DB_PORT);

  const db = await mysql.createConnection(conn);

  // Hash the password once
  const hash = await bcrypt.hash(newPassword, 10);

  // Update all active users
  const [result] = await db.execute(
    `UPDATE users
     SET password_hash = ?,
         force_password_change = 1,
         login_count = 0
     WHERE is_active = 1`,
    [hash]
  );

  console.log('');
  console.log(`✓ Reset ${result.affectedRows} user(s) to password: ${newPassword}`);
  console.log('  force_password_change = 1 (users must change on first login)');
  console.log('  login_count = 0 (reset)');
  console.log('');

  await db.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
