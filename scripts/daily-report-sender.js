// Daily report Excel generator — sends to site managers
// WhatsApp sending disabled in Phase 1 — generates files only
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql  = require('mysql2/promise');
// WhatsApp sender wired in Phase 2
const { writeExcel } = require('../middleware/excel');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST||'localhost', database: process.env.DB_NAME||'nu_pmc',
    user: process.env.DB_USER||'nu_app', password: process.env.DB_PASS||'',
  });

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Get all active site managers with their projects
  const [managers] = await db.execute(
    `SELECT u.id, u.username, u.full_name, u.phone, pa.project_id, p.name AS project_name, p.code
     FROM users u
     JOIN project_assignments pa ON pa.user_id = u.id AND pa.is_active = 1
     JOIN projects p ON pa.project_id = p.id AND p.status = 'active'
     WHERE u.role = 'site_manager' AND u.is_active = 1`
  );

  for (const mgr of managers) {
    await generateReport(db, mgr, today);
  }

  await db.end();
  console.log(`[daily-sender] Done for ${today} — ${managers.length} managers`);
}

async function generateReport(db, mgr, today) {
  try {
    // Get today's tasks
    const [tasks] = await db.execute(
      `SELECT st.task_name, st.trade, st.start_date, st.end_date
       FROM schedule_tasks st
       JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
       WHERE st.project_id = ? AND st.start_date <= ? AND st.end_date >= ?
       ORDER BY st.trade, st.display_order`,
      [mgr.project_id, today, today]
    );

    if (!tasks.length) {
      console.log(`[daily-sender] No tasks for ${mgr.full_name} on ${today}`);
      return;
    }

    // Build Excel
    const data = [
      ['nu associates — Daily Site Report'],
      [`Project: ${mgr.project_name}  |  Date: ${today}  |  Site Manager: ${mgr.full_name}`],
      [],
      ['Trade', 'Task', '% Complete', 'Notes', 'Flag (Y/N)'],
      ...tasks.map(t => [t.trade, t.task_name, 0, '', 'N']),
      [],
      ['Overall Notes:', ''],
    ];

    const outDir  = path.join(UPLOAD_DIR, 'daily-reports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${mgr.code}_${mgr.username}_${today}.xlsx`);
    const colWidths = [{ wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 30 }, { wch: 10 }];
    await writeExcel(outPath, 'Daily Report', data, colWidths);

    console.log(`[daily-sender] Generated: ${outPath}`);

    // Phase 2: WhatsApp send goes here
    // await sendViaWhatsApp(mgr.phone, outPath, mgr.full_name, today);

  } catch (err) {
    console.error(`[daily-sender] Error for ${mgr.full_name}:`, err.message);
  }
}

async function sendForUser(username) {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST||'localhost', database: process.env.DB_NAME||'nu_pmc',
    user: process.env.DB_USER||'nu_app', password: process.env.DB_PASS||'',
  });
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [[mgr]] = await db.execute(
    `SELECT u.id, u.username, u.full_name, u.phone, pa.project_id, p.name AS project_name, p.code
     FROM users u
     JOIN project_assignments pa ON pa.user_id = u.id AND pa.is_active = 1
     JOIN projects p ON pa.project_id = p.id
     WHERE u.username = ?`, [username]
  );
  if (mgr) await generateReport(db, mgr, today);
  await db.end();
}

module.exports = { run, sendForUser };
if (require.main === module) run().catch(console.error);
