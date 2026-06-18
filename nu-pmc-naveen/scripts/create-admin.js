// scripts/create-admin.js
// Creates the first principal (Naveen) user
// Run once after schema is loaded: node scripts/create-admin.js

// Respect DOTENV_CONFIG_PATH for testing; default to ../.env
const path = require('path');
const envFile = process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');

async function run() {
  // Password MUST come from env — never commit a literal.
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword || initialPassword.length < 8) {
    console.error('✗ FATAL: set ADMIN_INITIAL_PASSWORD env var (min 8 chars) before running this script.');
    console.error('   e.g.  ADMIN_INITIAL_PASSWORD=\'<yourStrongPass>\' node scripts/create-admin.js');
    process.exit(1);
  }

  const conn = {
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'nu_pmc',
    user:     process.env.DB_USER     || 'nu_app',
    password: process.env.DB_PASSWORD || '',
  };
  if (process.env.DB_SOCKET)  conn.socketPath = process.env.DB_SOCKET;
  if (process.env.DB_PORT)    conn.port       = parseInt(process.env.DB_PORT);
  const db = await mysql.createConnection(conn);

  const admin = {
    username:  'naveen',
    password:  initialPassword,
    full_name: 'Naveen Kumar Bhat',
    role:      'principal',
    phone:     '919886050673',
    email:     'naveen@nuassociates.com',
    stream:    'all',
  };

  const [[existing]] = await db.execute(
    'SELECT id FROM users WHERE username=?', [admin.username]
  );
  if (existing) {
    // User seeded from schema has placeholder hash — update with working one
    const hash = await bcrypt.hash(admin.password, 10);
    await db.execute(
      'UPDATE users SET password_hash=?, is_active=1, force_password_change=1 WHERE username=?',
      [hash, admin.username]
    );
    console.log('✓ Admin password updated — login with username:', admin.username);
    console.log('  Will be prompted to change on first login.');
    await db.end();
    return;
  }

  const hash = await bcrypt.hash(admin.password, 12);
  await db.execute(
    `INSERT INTO users (username, password_hash, full_name, role, phone, email, stream, is_active, force_password_change)
     VALUES (?,?,?,?,?,?,?,1,1)`,
    [admin.username, hash, admin.full_name, admin.role,
     admin.phone, admin.email, admin.stream]
  );

  console.log('');
  console.log('✓ Admin user created');
  console.log('  Username: naveen');
  console.log('  Password: (from ADMIN_INITIAL_PASSWORD env) — WILL BE PROMPTED TO CHANGE ON FIRST LOGIN');
  console.log('');
  console.log('Next: ADMIN_INITIAL_PASSWORD=<pass> node scripts/create-admin.js --user ajay  (for Ajay)');

  await db.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
