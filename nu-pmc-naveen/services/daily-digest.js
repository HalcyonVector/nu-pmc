// services/daily-digest.js
// ============================================================
// Morning push to site managers — replaced Excel with Matrix DM.
//
// Naveen's decision (May 2026): drop the pre-filled Excel sent via
// WhatsApp. Site managers fill the daily report in the PWA. The 6AM
// message is a reminder + deep link, not a data entry template.
//
// Called by scripts/overdue-checker.js at 6AM.
// ============================================================

'use strict';

const matrixAdapter = require('./matrix-adapter');

async function sendDailyDigest(db) {
  try {
    const [assignments] = await db.execute(`
      SELECT u.id, u.full_name, u.matrix_room_id,
             p.id AS project_id, p.name AS project_name, p.code AS project_code
      FROM project_assignments pa
      JOIN users u ON pa.user_id = u.id
      JOIN projects p ON pa.project_id = p.id
      WHERE u.role = 'site_manager' AND u.is_active = 1
        AND pa.is_active = 1 AND p.status = 'active'
        AND u.matrix_room_id IS NOT NULL
    `);

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    for (const assign of assignments) {
      const [[leave]] = await db.execute(
        `SELECT id FROM site_manager_leave
          WHERE user_id = ? AND project_id = ?
            AND CURDATE() BETWEEN leave_from AND leave_to`,
        [assign.id, assign.project_id]
      );
      if (leave) continue;

      const [[todayReport]] = await db.execute(
        `SELECT id FROM daily_reports
          WHERE project_id = ? AND report_date = CURDATE() AND site_manager_id = ?`,
        [assign.project_id, assign.id]
      );
      if (todayReport) continue;

      const pwaLink = `${process.env.PWA_BASE_URL || ''}/daily-report/${assign.project_id}`;

      await matrixAdapter.sendText({
        roomId: assign.matrix_room_id,
        body:
          `📋 ${assign.project_code} — Daily Report — ${today}\n` +
          `Good morning ${assign.full_name.split(' ')[0]} — please submit today's report.\n\n` +
          `${pwaLink}`,
        recipientUid: assign.id,
      }).catch(err => {
        console.warn(`[6AM] Matrix send failed for ${assign.full_name}:`, err.message);
      });

      console.log(`[6AM] Reminder sent to ${assign.full_name} — ${assign.project_name}`);
    }
  } catch (err) {
    console.error('[6AM] Daily digest error:', err.message);
  }
}

// Legacy alias kept for callers that import sendDailyExcel by name
const sendDailyExcel = sendDailyDigest;

module.exports = { sendDailyDigest, sendDailyExcel };
