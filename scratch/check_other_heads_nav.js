require('dotenv').config();
const path = require('path');
const db = require(path.join(process.cwd(), 'middleware/db'));
(async () => {
  const [designRows] = await db.query('SELECT * FROM role_nav WHERE role = "design_head" ORDER BY bucket, sort_order');
  console.log('--- design_head ---');
  console.log(designRows);
  
  const [servicesRows] = await db.query('SELECT * FROM role_nav WHERE role = "services_head" ORDER BY bucket, sort_order');
  console.log('--- services_head ---');
  console.log(servicesRows);
  
  process.exit(0);
})().catch(console.error);
