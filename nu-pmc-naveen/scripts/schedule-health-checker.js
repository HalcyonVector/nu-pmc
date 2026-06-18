// scripts/schedule-health-checker.js
// Runs weekly (Sunday night via overdue-checker).
// Per project, per trade:
//   1. Calculate planned % complete from task dates
//   2. Compare to actual % from task_updates
//   3. Gap > 10% → AI narrative → store → escalate

const db = require('../middleware/db');
const ai     = require('../services/ai');

const GAP_THRESHOLD      = 10;   // % gap before flagging
const AMBER_DAYS         = 1;    // flag amber at day 1
const PMC_NOTIFY_DAYS    = 3;    // notify PMC at day 3
const NAVEEN_NOTIFY_DAYS = 7;    // notify Naveen at day 7

async function run() {
  // use shared middleware db pool

  const today      = new Date();
  const weekEnding = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  console.log(`[schedule-health] Running — week ending ${weekEnding}`);
  const pendingNarratives = []; // collect for batch AI

  // Get all active projects
  const [projects] = await db.execute(
    "SELECT id, name FROM projects WHERE status = 'active'"
  );

  for (const project of projects) {
    await checkProjectSchedule(db, project, weekEnding, pendingNarratives);
  }

  // Submit batch AI request for all narratives
  if (pendingNarratives.length > 0) {
    try {
      const batchRequests = pendingNarratives.map(n => ({
        id: n.id,
        systemPrompt: 'You are a senior PMC consultant writing a schedule risk narrative. Be direct and actionable. Max 2 sentences.',
        userPrompt: `Project: ${n.projectName}\nTrade: ${n.trade}\nPlanned: ${n.planned}%\nActual: ${n.actual}%\nBehind: ${n.weeksBehind} weeks\nForecast delay: ${n.forecastDelay} weeks\nWrite the narrative.`,
        maxTokens: 100,
        model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
      }));

      const batch = await ai.batch(batchRequests);
      if (batch?.id) {
        console.log(`[schedule-health] Batch submitted: ${batch.id} — ${pendingNarratives.length} narratives`);
        // Store batch ID for later retrieval (processed by separate job).
        // PRE-EXISTING BUG: uses user_id=0 to repurpose this table as batch tracker;
        // user_id NOT NULL FK means this INSERT fails in production. Logged here as
        // a known issue for v5.23 — should move batch tracking to its own table.
        const notifLog = require('../services/notif-log');
        await notifLog.logUserNotif({
          userId: 0, messageType: 'batch_id',
          body: batch.id, status: 'pending',
        }).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
      }
    } catch (batchErr) {
      console.error('[schedule-health] Batch AI error:', batchErr.message);
    }
  }

  // shared pool — no close
  console.log('[schedule-health] Done');
}

async function checkProjectSchedule(db, project, weekEnding, pendingNarratives) {
  // Get current schedule version
  const [[sv]] = await db.execute(
    `SELECT sv.id AS version_id, sv.end_date AS r0_end
     FROM schedule_versions sv
     WHERE sv.project_id = ? AND sv.is_current = 1 LIMIT 1`,
    [project.id]
  );
  if (!sv) return;

  // Get all tasks with their latest actual % complete
  const [tasks] = await db.execute(
    `SELECT
       st.id, st.trade, st.task_name,
       st.start_date, st.end_date, st.is_milestone,
       COALESCE(
         (SELECT tu.pct_complete
          FROM task_updates tu
          WHERE tu.task_id = st.id
          ORDER BY tu.report_date DESC LIMIT 1), 0
       ) AS actual_pct,
       COALESCE(
         (SELECT MAX(tu.report_date)
          FROM task_updates tu
          WHERE tu.task_id = st.id), NULL
       ) AS last_update_date
     FROM schedule_tasks st
     WHERE st.project_id = ? AND st.schedule_version_id = ?
     ORDER BY st.trade, st.display_order`,
    [project.id, sv.version_id]
  );

  if (!tasks.length) return;

  // Group by trade
  const byTrade = {};
  for (const t of tasks) {
    if (!byTrade[t.trade]) byTrade[t.trade] = [];
    byTrade[t.trade].push(t);
  }

  const today = new Date();

  for (const [trade, tradeTasks] of Object.entries(byTrade)) {
    // Calculate planned % for each task based on date position
    let totalPlanned = 0, totalActual = 0, taskCount = 0;

    for (const task of tradeTasks) {
      if (task.is_milestone) continue; // milestones don't contribute to %
      const start    = new Date(task.start_date);
      const end      = new Date(task.end_date);
      const duration = (end - start) / 86400000;
      if (duration <= 0) continue;

      // Planned % = how far through the task timeline we are today
      const elapsed    = Math.max(0, Math.min(duration, (today - start) / 86400000));
      const plannedPct = Math.min(100, (elapsed / duration) * 100);

      totalPlanned += plannedPct;
      totalActual  += parseFloat(task.actual_pct);
      taskCount++;
    }

    if (taskCount === 0) continue;

    const avgPlanned = totalPlanned / taskCount;
    const avgActual  = totalActual  / taskCount;
    const gap        = avgPlanned - avgActual;

    if (gap < GAP_THRESHOLD) {
      console.log(`[schedule-health] ${project.name} — ${trade}: gap ${gap.toFixed(1)}% — OK`);
      continue;
    }

    console.log(`[schedule-health] ${project.name} — ${trade}: gap ${gap.toFixed(1)}% — FLAGGING`);

    // Calculate weeks behind and forecast delay
    const weeksBehind   = parseFloat((gap / (100 / Math.max(1, (new Date(sv.r0_end) - today) / 604800000 + (gap/10)))).toFixed(1));
    const forecastDelay = parseFloat((weeksBehind * 1.2).toFixed(1)); // simple forecast

    // Determine escalation level
    let escalationLevel = 'amber';
    if (gap >= 25) escalationLevel = 'critical';
    else if (gap >= 15) escalationLevel = 'red';

    // Generate AI narrative — collect for batch API (50% cheaper)
    // Batch submitted after all projects processed
    const narrative = `${trade} is ${gap.toFixed(1)}% behind plan. Forecast delay: ${forecastDelay} weeks. (AI narrative pending batch processing)`;
    pendingNarratives.push({
      id: `${project.id}_${trade}_${weekEnding}`,
      projectId: project.id, trade, weekEnding,
      planned: parseFloat(avgPlanned.toFixed(1)),
      actual:  parseFloat(avgActual.toFixed(1)),
      weeksBehind, forecastDelay,
      projectName: project.name,
    });

    // Upsert risk narrative
    await db.execute(
      `INSERT INTO schedule_risk_narratives
       (project_id, trade, week_ending, planned_pct, actual_pct, gap_pct,
        weeks_behind, forecast_delay, narrative, escalation_level)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         planned_pct=VALUES(planned_pct), actual_pct=VALUES(actual_pct),
         gap_pct=VALUES(gap_pct), weeks_behind=VALUES(weeks_behind),
         forecast_delay=VALUES(forecast_delay), narrative=VALUES(narrative),
         escalation_level=VALUES(escalation_level)`,
      [project.id, trade, weekEnding,
       avgPlanned.toFixed(2), avgActual.toFixed(2), gap.toFixed(2),
       weeksBehind, forecastDelay, narrative, escalationLevel]
    );

    // Identify primary vendor responsible for the lag
    let primaryVendor = null;
    try {
      const [vendors] = await db.execute(
        `SELECT v.vendor_name, COUNT(*) AS task_count
         FROM vendor_boq_items vbi
         JOIN boq_items bi ON vbi.boq_item_id=bi.id
         JOIN vendor_engagements ve ON vbi.engagement_id=ve.id
         JOIN vendors v ON ve.vendor_id=v.id
         WHERE bi.project_id=? AND bi.trade=? AND ve.is_active=1
         GROUP BY v.id, v.vendor_name
         ORDER BY task_count DESC LIMIT 1`,
        [project.id, trade]
      );
      primaryVendor = vendors[0]?.vendor_name || null;
    } catch(_e) {}

    // Store vendor in narrative for PMC flag
    if (primaryVendor) {
      await db.execute(
        `UPDATE schedule_risk_narratives SET narrative=CONCAT(narrative, ' Primary vendor: ', ?)
         WHERE project_id=? AND trade=? AND week_ending=?`,
        [primaryVendor, project.id, trade, weekEnding]
      );
    }

    // Schedule drift alert to project's internal Matrix room
    try {
      const matrixAdapter = require('../services/matrix-adapter');
      const room = await matrixAdapter.getProjectRoomId(project.id, 'internal');
      if (room) {
        await matrixAdapter.sendText({
          roomId: room,
          body: `⚠️ ${project.name} — Schedule drift detected: ${trade} trade is ${gap.toFixed(1)} days behind. Review required.`,
        }).catch(e => console.warn('[schedule-health] Matrix alert failed:', e.message));
      }
    } catch(_e) {}

    // Flag individual tasks that are behind
    for (const task of tradeTasks) {
      if (task.is_milestone) continue;
      const start     = new Date(task.start_date);
      const end       = new Date(task.end_date);
      const duration  = (end - start) / 86400000;
      if (duration <= 0) continue;
      const elapsed   = Math.max(0, Math.min(duration, (today - start) / 86400000));
      const planned   = Math.min(100, (elapsed / duration) * 100);
      const taskGap   = planned - parseFloat(task.actual_pct);

      if (taskGap >= GAP_THRESHOLD) {
        // Flag task — insert a flagged task_update entry if none exists today
        const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const [[existing]] = await db.execute(
          'SELECT id FROM task_updates WHERE task_id=? AND report_date=? AND is_flagged=1',
          [task.id, todayStr]
        );
        if (!existing) {
          // Get system user (PMC Head on project or first active PMC)
          const [[pmcUser]] = await db.execute(
            `SELECT u.id FROM users u
             JOIN project_assignments pa ON pa.user_id = u.id
             WHERE pa.project_id = ? AND u.role = 'pmc_head' LIMIT 1`,
            [project.id]
          );
          if (pmcUser) {
            await db.execute(
              `INSERT IGNORE INTO task_updates
               (task_id, project_id, report_date, pct_complete, is_flagged, flag_note, updated_by)
               VALUES (?,?,?,?,1,?,?)`,
              [task.id, project.id, todayStr, task.actual_pct,
               `Auto-flagged: ${taskGap.toFixed(1)}% behind plan`, pmcUser.id]
            );
          }
        }
      }
    }

    // 3-day escalation ladder
    await escalate(db, project, trade, gap, escalationLevel, narrative);
  }
}

async function escalate(db, project, trade, gap, level, narrative) {
  // Check how many consecutive weeks this trade has been flagged
  const [history] = await db.execute(
    `SELECT week_ending, gap_pct FROM schedule_risk_narratives
     WHERE project_id = ? AND trade = ?
     ORDER BY week_ending DESC LIMIT 10`,
    [project.id, trade]
  );

  const consecutiveWeeks = history.filter(h => parseFloat(h.gap_pct) >= GAP_THRESHOLD).length;
  const daysEquivalent   = consecutiveWeeks * 7; // each weekly check = 7 days

  // Get PMC Head(s) on project
  const [pmcHeads] = await db.execute(
    `SELECT u.id FROM users u
     JOIN project_assignments pa ON pa.user_id = u.id
     WHERE pa.project_id = ? AND u.role = 'pmc_head' AND u.is_active = 1`,
    [project.id]
  );

  // Day 1+ — amber — notify PMC in-app
  if (daysEquivalent >= AMBER_DAYS) {
    const [[existing]] = await db.execute(
      `SELECT id FROM schedule_risk_narratives
       WHERE project_id=? AND trade=? AND notified_pmc=1
       ORDER BY week_ending DESC LIMIT 1`,
      [project.id, trade]
    );
    if (!existing) {
      const notifLog = require('../services/notif-log');
      for (const pmc of pmcHeads) {
        await notifLog.logUserNotif({
          userId: pmc.id, messageType: 'schedule_risk',
          body: `${level.toUpperCase()}: ${project.name} — ${trade} is ${gap.toFixed(1)}% behind plan. ${narrative}`,
          status: 'pending',
        });
      }
      await db.execute(
        `UPDATE schedule_risk_narratives SET notified_pmc=1
         WHERE project_id=? AND trade=?
         ORDER BY week_ending DESC LIMIT 1`,
        [project.id, trade]
      );
    }
  }

  // Day 7+ — notify Naveen in-app
  if (daysEquivalent >= NAVEEN_NOTIFY_DAYS) {
    const [[alreadyNotified]] = await db.execute(
      `SELECT id FROM schedule_risk_narratives
       WHERE project_id=? AND trade=? AND notified_naveen=1
       ORDER BY week_ending DESC LIMIT 1`,
      [project.id, trade]
    );
    if (!alreadyNotified) {
      const [principals] = await db.execute(
        "SELECT id FROM users WHERE role IN ('principal','design_principal') AND is_active=1"
      );
      const notifLog = require('../services/notif-log');
      for (const p of principals) {
        await notifLog.logUserNotif({
          userId: p.id, messageType: 'schedule_risk',
          body: `ESCALATION: ${project.name} — ${trade} has been ${gap.toFixed(1)}% behind plan for ${consecutiveWeeks} weeks. ${process.env.PWA_BASE_URL}/schedule/${project.id}`,
          status: 'pending',
        });
      }
      await db.execute(
        `UPDATE schedule_risk_narratives SET notified_naveen=1
         WHERE project_id=? AND trade=?
         ORDER BY week_ending DESC LIMIT 1`,
        [project.id, trade]
      );
    }
  }
}

module.exports = { run };
if (require.main === module) run().catch(console.error);
