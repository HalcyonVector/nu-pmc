const db = require('./middleware/db');
async function run() {
  const [rows] = await db.query("SELECT * FROM role_nav WHERE role = 'pmc_head'");
  console.log(rows);
  process.exit(0);
}
run();
