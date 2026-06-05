require('dotenv').config();
const path = require('path');
const db = require(path.join(process.cwd(), 'middleware/db'));
(async () => {
  const [rows] = await db.query('SELECT id, username, full_name, role FROM users');
  console.log(rows);
  process.exit(0);
})().catch(console.error);
