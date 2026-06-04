const db = require('../middleware/db');

async function run() {
  try {
    const [rows] = await db.query('SELECT id, task_name, validation_type, validation_config FROM setup_checklist_items');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
