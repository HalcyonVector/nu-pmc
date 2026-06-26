// scripts/create-admin.js
// Creates the first principal user.
// Run once after schema is loaded: node scripts/create-admin.js
//
// Required env vars:
//   ADMIN_USERNAME         login username (e.g. admin1)
//   ADMIN_FULL_NAME        display name
//   ADMIN_INITIAL_PASSWORD strong password (min 8 chars)
// Optional:
//   ADMIN_PHONE            phone number with country code (e.g. 919000000000)
//   ADMIN_EMAIL            email address

// Respect DOTENV_CONFIG_PATH for testing; default to ../.env
const path = require('path');
const envFile = process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');

async function run() {
  const username        = process.env.ADMIN_USERNAME;
  const fullName        = process.env.ADMIN_FULL_NAME;
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;

  if (!username || !fullName || !initialPassword || initialPassword.length < 8) {
    console.error('✗ FATAL: set ADMIN_USERNAME, ADMIN_FULL_NAME, and ADMIN_INITIAL_PASSWORD (min 8 chars) before running.');
    console.error('   e.g.  ADMIN_USERNAME=admin1 ADMIN_FULL_NAME="Your Name" ADMIN_INITIAL_PASSWORD=\'<pass>\' node scripts/create-admin.js');
    process.exit(1);
  }

  const conn = {
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'nu_pmc',
    user:     process.env.DB_USER     || 'nu_app',
    password: process.env.DB_PASSWORD || '',
  };
  if (process.env.DB_SOCKET)  conn.socketPath = process.env.DB_SOCKET;
  if (process.env.DB_PORT)    conn.port       = parseInt(process.env.DB_PORT, 10);
  const db = await mysql.createConnection(conn);

  const admin = {
    username,
    password:  initialPassword,
    full_name: fullName,
    role:      'principal',
    phone:     process.env.ADMIN_PHONE || null,
    email:     process.env.ADMIN_EMAIL || null,
    stream:    'all',
  };

  const [[existing]] = await db.execute(
    'SELECT id FROM users WHERE username=?', [admin.username]
  );
  if (existing) {
    // User seeded from schema has placeholder hash — update with working one.
    // No force_password_change flag: the 25-login policy in auth.js handles
    // when the user must rotate. Setting the flag here would prompt them
    // on the very first login, which is not what we want for fresh installs.
    const hash = await bcrypt.hash(admin.password, 10);
    await db.execute(
      'UPDATE users SET password_hash=?, is_active=1 WHERE username=?',
      [hash, admin.username]
    );
    console.log('✓ Admin password updated — login with username:', admin.username);
    console.log('  Password change is prompted automatically after 25 logins on the default password.');
    await db.end();
    return;
  }

  const hash = await bcrypt.hash(admin.password, 12);
  await db.execute(
    `INSERT INTO users (username, password_hash, full_name, role, phone, email, stream, is_active)
     VALUES (?,?,?,?,?,?,?,1)`,
    [admin.username, hash, admin.full_name, admin.role,
     admin.phone, admin.email, admin.stream]
  );

  console.log('');
  console.log('✓ Admin user created');
  console.log('  Username:', admin.username);
  console.log('  Password: (from ADMIN_INITIAL_PASSWORD)');
  console.log('  Auto-change after 25 logins on the default password — see auth.js FORCE_CHANGE_AFTER.');
  console.log('');

  await db.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
