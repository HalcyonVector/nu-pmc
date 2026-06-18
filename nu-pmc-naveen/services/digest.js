// services/digest.js
// ============================================================
// sendDigest — one function, three database configurations.
//
// Per v2 brief C11 / P7.4:
//   "Three digests documented as separate things. One function,
//    three database configurations. No digest-specific code."
//
// The function is called three times daily by scripts/cron/digest-runner.js
// with different parameters read from notifications_config:
//
//   morning_pmc  07:00 — per-project digest to PMC heads
//   naveen       08:00 — cross-project digest to Naveen / principal
//   closeout     21:00 — end-of-day status to PMC heads
//
// Content is assembled from DB queries. The DB (project_thresholds,
// daily_reports, payment_requests, signoff_instances) is the source
// of truth — no hardcoded thresholds here.
// ============================================================

'use strict';

const db            = require('../middleware/db');
const matrixAdapter = require('./matrix-adapter');

const DELIM = '──────────────────';

/**
 * Send a digest message.
 *
 * @param {object} opts
 * @param {string} opts.digestType   'morning_pmc' | 'naveen' | 'closeout'
 * @param {number} [opts.userId]     recipient user id (null = resolve from digestType)
 * @param {string} [opts.roomId]     Matrix room id (null = resolve from digestType)
 * @param {number[]} [opts.projectIds]  projects to include (null = all active)
 */
async function sendDigest({ digestType, userId = null, roomId = null, projectIds = null }) {
  if (!digestType) throw new Error('digestType required');

  // 1. Resolve projects scope
  const projects = await _resolveProjects(projectIds);
  if (!projects.length) return;

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  if (digestType === 'morning_pmc') {
    await _sendMorningPMC({ projects, today });
  } else if (digestType === 'naveen') {
    await _sendNaveenDigest({ projects, today, userId, roomId });
  } else if (digestType === 'closeout') {
    await _sendCloseout({ projects, today });
  } else {
    throw new Error(`Unknown digestType: ${digestType}`);
  }
}

// ── Project resolution ───────────────────────────────────────────────────

async function _resolveProjects(projectIds) {
  if (projectIds && projectIds.length) {
    const ph = projectIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id, code, name FROM projects WHERE id IN (${ph}) AND status = 'active'`,
      projectIds
    );
    return rows;
  }
  const [rows] = await db.query(
    `SELECT id, code, name FROM projects WHERE status = 'active' ORDER BY code ASC`
  );
  return rows;
}

// ── morning_pmc — 7AM, per project, to PMC heads ────────────────────────

async function _sendMorningPMC({ projects, today }) {
  for (const proj of projects) {
    // Find PMC head(s) for this project with a Matrix room
    const [pmcs] = await db.query(
      `SELECT u.id, u.full_name, u.matrix_room_id
         FROM users u
         JOIN project_assignments pa ON pa.user_id = u.id
        WHERE pa.project_id = ? AND u.role = 'pmc_head'
          AND u.is_active = 1 AND pa.is_active = 1
          AND u.matrix_room_id IS NOT NULL`,
      [proj.id]
    );
    if (!pmcs.length) continue;

    const sections = await _buildProjectSections(proj.id, proj.code);
    if (!sections.length) continue;

    const body = [
      `☀️ Good morning — nu PMC Digest — ${today}`,
      DELIM,
      `📍 ${proj.code} — ${proj.name}`,
      ...sections,
    ].join('\n');

    for (const pmc of pmcs) {
      await matrixAdapter.sendText({
        roomId: pmc.matrix_room_id,
        body,
        recipientUid: pmc.id,
      }).catch(e => console.warn(`[digest.morning_pmc] ${pmc.full_name}:`, e.message));
    }
  }
}

// ── naveen — 8AM, cross-project, to principal(s) ────────────────────────

async function _sendNaveenDigest({ projects, today, userId, roomId }) {
  // Resolve recipient
  let recipientId = userId;
  let recipientRoom = roomId;
  if (!recipientRoom) {
    recipientRoom = await matrixAdapter.getInternalRoomId('internal_naveen');
  }
  if (!recipientRoom) {
    console.warn('[digest.naveen] no internal_naveen room found');
    return;
  }

  const lines = [`☀️ Good morning — nu PMC Digest — ${today}`, DELIM];

  for (const proj of projects) {
    const sections = await _buildProjectSections(proj.id, proj.code);
    if (!sections.length) continue;
    lines.push(`📍 ${proj.code} — ${proj.name}`, ...sections, '');
  }

  if (lines.length <= 2) return;  // nothing beyond the header

  await matrixAdapter.sendText({
    roomId: recipientRoom,
    body: lines.join('\n'),
    recipientUid: recipientId,
  }).catch(e => console.warn('[digest.naveen]', e.message));
}

// ── closeout — 9PM, per project, to PMC heads ───────────────────────────

async function _sendCloseout({ projects, today }) {
  for (const proj of projects) {
    const [pmcs] = await db.query(
      `SELECT u.id, u.full_name, u.matrix_room_id
         FROM users u
         JOIN project_assignments pa ON pa.user_id = u.id
        WHERE pa.project_id = ? AND u.role = 'pmc_head'
          AND u.is_active = 1 AND pa.is_active = 1
          AND u.matrix_room_id IS NOT NULL`,
      [proj.id]
    );
    if (!pmcs.length) continue;

    const sections = await _buildCloseoutSections(proj.id, proj.code);
    if (!sections.length) continue;

    const body = [
      `🌙 Close-out — ${proj.code} — ${today}`,
      DELIM,
      ...sections,
    ].join('\n');

    for (const pmc of pmcs) {
      await matrixAdapter.sendText({
        roomId: pmc.matrix_room_id,
        body,
        recipientUid: pmc.id,
      }).catch(e => console.warn(`[digest.closeout] ${pmc.full_name}:`, e.message));
    }
  }
}

// ── Content builders ─────────────────────────────────────────────────────

async function _buildProjectSections(projectId, projectCode) {
  const lines = [];

  // REPORTS section
  const [[reportRow]] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
       SUM(CASE WHEN status IN ('pending_review','submitted') THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN DATEDIFF(CURDATE(), report_date) > 0 AND status != 'approved' THEN 1 ELSE 0 END) AS overdue
     FROM daily_reports
     WHERE project_id = ? AND report_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
    [projectId]
  );

  // Read overdue threshold from DB — never hardcoded
  const [[overdueCfg]] = await db.query(
    `SELECT threshold_value FROM project_thresholds
      WHERE (project_id = ? OR project_id IS NULL)
        AND threshold_type = 'overdue_days'
      ORDER BY project_id DESC LIMIT 1`,
    [projectId]
  );
  const overdueThreshold = overdueCfg?.threshold_value ?? 2;

  if (Number(reportRow.total) > 0) {
    lines.push('📋 REPORTS');
    if (Number(reportRow.approved) > 0) {
      lines.push(`  ✅ ${projectCode} — ${reportRow.approved} approved`);
    }
    if (Number(reportRow.pending) > 0) {
      lines.push(`  ⏳ ${projectCode} — ${reportRow.pending} pending review`);
    }
    if (Number(reportRow.overdue) >= overdueThreshold) {
      lines.push(`  ❌ ${projectCode} — ${reportRow.overdue} overdue (>${overdueThreshold} days)`);
    }
  }

  // PAYMENTS section
  const [[payRow]] = await db.query(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(pmc_amount),0) AS total
       FROM payment_requests
      WHERE project_id = ? AND status NOT IN ('paid','rejected','cancelled')`,
    [projectId]
  );
  if (Number(payRow.cnt) > 0) {
    const amt = Number(payRow.total).toLocaleString('en-IN');
    lines.push('💰 PAYMENTS');
    lines.push(`  ${payRow.cnt} payment request(s) pending — ₹${amt}`);
  }

  // ALERTS section — float threshold from DB
  const [[floatCfg]] = await db.query(
    `SELECT threshold_value FROM project_thresholds
      WHERE (project_id = ? OR project_id IS NULL)
        AND threshold_type = 'float_days'
      ORDER BY project_id DESC LIMIT 1`,
    [projectId]
  );
  const floatThreshold = floatCfg?.threshold_value ?? 3;

  const [zeroFloat] = await db.query(
    `SELECT task_name, start_date FROM schedule_tasks
      WHERE project_id = ? AND float_days <= ? AND status != 'completed'
      ORDER BY start_date ASC LIMIT 3`,
    [projectId, floatThreshold]
  );
  if (zeroFloat.length > 0) {
    lines.push('⚠️ ALERTS');
    for (const t of zeroFloat) {
      const startStr = new Date(t.start_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
      lines.push(`  ${projectCode} — ${t.task_name} — ${t.float_days <= 0 ? 'zero' : `≤${floatThreshold}`} float — starts ${startStr}`);
    }
  }

  return lines;
}

async function _buildCloseoutSections(projectId, projectCode) {
  const lines = [];

  // Today's report status
  const [[todayReport]] = await db.query(
    `SELECT status FROM daily_reports
      WHERE project_id = ? AND report_date = CURDATE()
      ORDER BY id DESC LIMIT 1`,
    [projectId]
  );

  if (!todayReport) {
    lines.push(`❌ ${projectCode} — No report submitted today`);
  } else if (todayReport.status === 'approved') {
    lines.push(`✅ ${projectCode} — Report approved`);
  } else {
    lines.push(`⏳ ${projectCode} — Report pending review`);
  }

  // Pending sign-offs
  const [[siRow]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM signoff_instances
      WHERE project_id = ? AND status = 'in_progress'`,
    [projectId]
  );
  if (Number(siRow.cnt) > 0) {
    lines.push(`📋 ${siRow.cnt} sign-off(s) still pending`);
  }

  return lines;
}

module.exports = { sendDigest };
