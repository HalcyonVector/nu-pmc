require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');
async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST||'localhost', database: process.env.DB_NAME||'nu_pmc',
    user: process.env.DB_USER||'nu_app', password: process.env.DB_PASS||'',
  });
  const hash = await bcrypt.hash('Welcome@123', 10);
  await db.execute('UPDATE users SET password_hash = ?', [hash]);
  console.log('✓ All 19 users set to: Welcome@123');
  await db.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
