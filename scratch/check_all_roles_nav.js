require('dotenv').config();
const path = require('path');
const db = require(path.join(process.cwd(), 'middleware/db'));
(async () => {
  const [rows] = await db.query('SELECT role, GROUP_CONCAT(DISTINCT bucket) as buckets FROM role_nav GROUP BY role');
  console.log(rows);
  process.exit(0);
})().catch(console.error);
