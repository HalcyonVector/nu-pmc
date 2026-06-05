require('dotenv').config();
const path = require('path');
const db = require(path.join(process.cwd(), 'middleware/db'));
(async () => {
  const [rows] = await db.query('SELECT * FROM role_nav WHERE role = "pmc_head" ORDER BY bucket, sort_order');
  console.log(rows);
  process.exit(0);
})().catch(console.error);
