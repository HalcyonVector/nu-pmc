// scripts/overdue-checker.js — runs every 15 min via in-process scheduler in server.js
// Uses the shared db middleware pool (honours DB_HOST/PORT/SOCKET/NAME/USER/PASSWORD consistently)
const db = require('../middleware/db');
const notifLog = require('../services/notif-log');
const { sendDailyExcel } = require('../services/daily-digest');
const scheduleHealth   = require('./schedule-health-checker');

async function run() {

  const now  = new Date();
  const hour = now.getHours();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  console.log(`[overdue-checker] Running at ${now.toISOString()}`);

  // ── SUNDAY NIGHT — weekly schedule health check (runs at 10PM Sunday)
  const isSunday    = now.getDay() === 0;
  const isTenPM     = hour === 22;
  if (isSunday && isTenPM) {
    console.log('[overdue-checker] Sunday 10PM — running schedule health check');
    await scheduleHealth.run().catch(e => console.error('[schedule-health] Error:', e.message));
  }

  // ── SATURDAY PAYMENT FLOW
  const isSaturday = now.getDay() === 6;
  const is4PM      = hour === 16;
  const is5PM      = hour === 17;

  // Principal 4PM Saturday — payment approval digest
  if (isSaturday && is4PM) { await sendPrincipal4PMPayments(db); }

  // Finance Admin 5PM Saturday — Excel after Principal approves
  if (isSaturday && is5PM) { await sendFinanceAdmin5PMExcel(db); }

  // ── TIME FLAGS (declared once, used throughout)
  const isFriday = now.getDay() === 5;
  const is7AM    = hour === 7;
  const is8AM    = hour === 8;
  const is9PM    = hour === 21;
  const is6PM    = hour === 18;
  const is930AM  = hour === 9 && now.getMinutes() >= 30 && now.getMinutes() < 45;

  // ── 9:30AM LOCATION REQUEST — site managers
  if (is930AM) { await sendLocationRequest(db); }

  // ── 9AM labour log carryover — if no submission since 7AM, copy yesterday's counts
  if (hour === 9 && now.getMinutes() < 15) {
    await carryoverLabourCounts(db).catch(e => console.error('[labour-carryover]', e.message));
  }

  // ── MIDNIGHT IST — auto-lock daily reports past T+2 days
  // Tuesday's report locks at Thursday 00:00 (PMC had Tuesday + Wed grace).
  // Only pending_review rows are auto-locked; flagged stays flagged
  // (it's an explicit PMC decision and the audit trail should reflect that).
  if (hour === 0) { await autoLockOverdueDailyReports(db); }

  // ── AUTO-ACCEPT EXPIRED PENDING ACTIONS — process every hour
  await processAutoAccepts(db).catch(e => console.error('[auto-accept]', e.message));

  // ── PHOTO RFI DEADLINE REMINDERS — 8AM on deadline day
  if (is8AM) { await sendPhotoRFIReminders(db); }

  // ── VALIDATION RETRY QUEUE — process every hour
  const { processRetryQueue } = require('../services/vendor-validation');
  await processRetryQueue(db).catch(e => console.error('[retry-queue]', e.message));

  // ── Principal 8AM priorities — Matrix via sendDigest
  if (is8AM) {
    const { sendDigest } = require('../services/digest');
    await sendDigest({ digestType: 'principal' }).catch(e => console.error('[overdue-checker] principal digest:', e.message));
  }

  // ── PMC Head 7AM site prep — Matrix via sendDigest
  if (is7AM) {
    const { sendDigest } = require('../services/digest');
    await sendDigest({ digestType: 'morning_pmc' }).catch(e => console.error('[overdue-checker] morning_pmc digest:', e.message));
    await sendLabourLogReminders(db).catch(e => console.error('[overdue-checker] labour-log reminders:', e.message));
    await sendScheduleReminders(db).catch(e => console.error('[overdue-checker] schedule reminders:', e.message));
  }

  // ── Principal 9PM digest + PMC 9PM close + R/S pending alerts
  if (is9PM) {
    const { sendDigest } = require('../services/digest');
    await sendDigest({ digestType: 'closeout' }).catch(e => console.error('[overdue-checker] closeout digest:', e.message));
    await sendDigest({ digestType: 'vendor_snag' }).catch(e => console.error('[overdue-checker] vendor snag digest:', e.message));
    await sendDesignHeadsPending(db);
  }

  // ── R/S Friday 6PM weekly digest
  if (isFriday && is6PM) { await sendRSWeeklyDigest(db); }

  // ── MOM action items — NO daily PMC review needed
  // System escalates automatically when due date is breached (see MOM overdue section below)
  // PMC only acts when escalation fires — not on a daily review schedule

  // ── 1. Mark drawing queries overdue if open > 3 days
  await db.execute(
    `UPDATE issues SET is_overdue = 1
     WHERE status != 'closed' AND DATEDIFF(NOW(), raised_at) >= 3 AND is_overdue = 0`
  );

  // ── 1b. Notify PMC Head + Design Head for RFIs newly crossed 3-day threshold.
  // Only fires at 9AM to avoid repeated alerts across the 15-min cron windows.
  if (hour === 9 && now.getMinutes() < 15) {
    const [overdueRFIs] = await db.query(
      `SELECT i.id, i.project_id, i.title, i.description,
              DATEDIFF(NOW(), i.raised_at) AS days_open,
              p.code AS project_code
         FROM issues i
         JOIN projects p ON i.project_id = p.id
        WHERE i.issue_type = 'rfi'
          AND i.status NOT IN ('closed','resolved')
          AND i.is_overdue = 1
          AND DATEDIFF(NOW(), i.raised_at) BETWEEN 3 AND 7`
    );
    const notif = require('../services/notifications');
    for (const rfi of overdueRFIs) {
      await notif.notifyRFIOverdue(rfi.project_id, rfi.title.substring(0, 60), rfi.days_open)
        .catch(e => console.warn('[overdue-checker] RFI notify swallowed:', e.message));
    }
    if (overdueRFIs.length) {
      console.log(`[overdue-checker] ${overdueRFIs.length} overdue RFI(s) notified`);
    }
  }

  // ── 2. Mark material requests overdue
  await db.execute(
    `UPDATE material_requests SET is_overdue = 1
     WHERE needed_by_date < CURDATE() AND status < 4 AND is_overdue = 0`
  );

  // ── 3. Drawing approval escalation
  // 1 day stuck → amber (is_overdue flag on drawing_versions)
  // 2 days stuck → escalate to next level / notify Principal
  const [stuckDrawings] = await db.execute(
    `SELECT dv.id, dv.drawing_id, dv.status, dv.l1_reviewed_at, dv.created_at,
            d.project_id, d.drawing_number, d.stream,
            DATEDIFF(NOW(), dv.created_at) AS days_pending
     FROM drawing_versions dv
     JOIN drawings d ON dv.drawing_id = d.id
     WHERE dv.status IN ('pending_l1','pending_l2')
     AND DATEDIFF(NOW(), dv.created_at) >= 1`
  );

  for (const dv of stuckDrawings) {
    if (dv.days_pending >= 2) {
      // Auto-escalate — move to next level if stuck 2+ days
      if (dv.status === 'pending_l1') {
        await db.execute(
          `UPDATE drawing_versions SET status = 'pending_l2',
           l1_reviewed_at = NOW(), l1_rejection_note = 'Auto-escalated after 2 days'
           WHERE id = ?`,
          [dv.id]
        );
        console.log(`[overdue-checker] Drawing ${dv.drawing_number} escalated from L1 to L2`);
      }
      // Alert principals — drawing stuck, needs intervention
      const matrixAdapter = require('../services/matrix-adapter');
      const [principals] = await db.execute(
        `SELECT matrix_room_id FROM users
         WHERE role IN ('principal','design_principal') AND is_active = 1 AND matrix_room_id IS NOT NULL`
      );
      const msg = `⚠️ Drawing stuck — ${dv.drawing_number} has been pending approval for ${dv.days_pending} days. ${process.env.PWA_BASE_URL}/drawings/${dv.project_id}`;
      for (const p of principals) {
        await matrixAdapter.sendText({ roomId: p.matrix_room_id, body: msg })
          .catch(e => console.warn('[overdue-checker] drawing escalation alert failed:', e.message));
      }
    }
  }

  // ── 4. Change Notice decay — 3 days without all signatures → escalate to principals
  const [stuckCNs] = await db.execute(
    `SELECT cn.id, cn.cn_number, cn.project_id, cn.sig_design_head, cn.sig_services_head, cn.sig_pmc,
            DATEDIFF(NOW(), cn.raised_at) AS days_open
     FROM change_notices cn
     WHERE cn.status = 'collecting_sigs'
     AND DATEDIFF(NOW(), cn.raised_at) >= 3`
  );

  for (const cn of stuckCNs) {
    console.log(`[overdue-checker] CN ${cn.cn_number} stuck ${cn.days_open} days — alerting principals`);
    const matrixAdapter = require('../services/matrix-adapter');
    const [principals] = await db.execute(
      `SELECT matrix_room_id FROM users
       WHERE role IN ('principal','design_principal') AND is_active = 1 AND matrix_room_id IS NOT NULL`
    );
    const msg = `⚠️ CN ${cn.cn_number} is stuck — ${cn.days_open} days without all signatures. ${process.env.PWA_BASE_URL}/changes/${cn.project_id}`;
    for (const p of principals) {
      await matrixAdapter.sendText({ roomId: p.matrix_room_id, body: msg })
        .catch(e => console.warn('[overdue-checker] CN escalation alert failed:', e.message));
    }
  }

  // ── 5. Daily report missing checks (run at specific hours)
  if (hour === 20) {
    // 8 PM — check and notify site managers
    await checkMissingReports(db, today, 'site_manager');
  } else if (hour === 21) {
    // 9 PM — notify PMC heads
    await checkMissingReports(db, today, 'pmc_head');
  } else if (hour === 12) {
    // Next day noon — check if yesterday's report still missing, notify Principal
    const yesterday = new Date(now - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    await checkMissingReports(db, yesterday, 'principal');
  }

  // ── 5b. Zero float — real-time alert to principals
  // Digest covers float ≤ threshold in the morning. This fires immediately
  // when a task hits zero float, outside of digest hours.
  // De-duped: only alerts once per task per calendar day via notified_zero_float_at.
  await checkZeroFloat(db);

  // ── 5c. Budget threshold alert — Finance + Principal (C3, friction-reduction brief)
  await checkBudgetThresholds(db).catch(e => console.error('[budget-threshold]', e.message));

  // 6AM — canary suite + site manager daily reminder
  if (hour === 6) {
    await sendDailyExcel(db);  // site manager reminder (kept as alias for backward compat)

    // Run canary checks per brief P10.1 / C12
    try {
      const { runAllCanaryChecks } = require('../services/canary');
      const matrixAdapter = require('../services/matrix-adapter');
      const axios = require('axios');

      await runAllCanaryChecks([
        {
          name: 'Matrix send/read',
          pingFn: async () => {
            const systemRoom = await matrixAdapter.getInternalRoomId('system_health');
            if (!systemRoom) throw new Error('system_health room not found in DB');
            await matrixAdapter.sendText({ roomId: systemRoom, body: '[canary] ping' });
          },
          onSuccessFn: async () => {},
          onFailureFn: async () => {
            if (process.env.NOTIFICATIONS !== 'whatsapp') {
              process.env.NOTIFICATIONS = 'whatsapp';
              console.error('[canary] Matrix down — flipped NOTIFICATIONS=whatsapp');
            }
          },
        },
        {
          name: 'ICICI webhook',
          pingFn: async () => {
            const base = process.env.PWA_BASE_URL || 'http://localhost:3999';
            await axios.post(`${base}/api/payments/utr-webhook`, {
              _secret: process.env.ICICI_WEBHOOK_SECRET,
              utr: 'CANARY_TEST', account_number: '000000000000', amount: '0',
            }, { timeout: 10000 }).catch(e => {
              // 4xx expected (no matching payment row) — that's fine, endpoint is reachable
              if (!e.response) throw e;
            });
          },
          onSuccessFn: async () => {},
          onFailureFn: async (e) => {
            console.error('[canary] ICICI webhook unreachable:', e.message);
          },
        },
      ]);
    } catch (canaryErr) {
      console.error('[canary] runner failed:', canaryErr.message);
    }
  }

  // Digest schedule — read from notifications_config, not hardcoded
  try {
    const { sendDigest } = require('../services/digest');
    const [digestConfigs] = await db.query(
      `SELECT digest_type, send_time FROM notifications_config WHERE active = 1`
    );
    const istHour = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false });
    const currentHour = parseInt(istHour, 10);

    for (const cfg of digestConfigs) {
      const [cfgHour] = (cfg.send_time || '').split(':').map(Number);
      if (cfgHour === currentHour) {
        await sendDigest({ digestType: cfg.digest_type }).catch(e =>
          console.error(`[digest] ${cfg.digest_type} failed:`, e.message)
        );
      }
    }
  } catch (digestErr) {
    console.error('[digest] runner failed:', digestErr.message);
  }

  // shared pool — no close
  console.log(`[overdue-checker] Done at ${new Date().toISOString()}`);
}

// ── Auto-lock daily reports past T+2 days ──────────────────────────────
// Lock cycle (Principal, 28 Apr 2026):
//   - Tuesday all day            — site mgr submit/edit; PMC can act
//   - Wednesday 06:00 IST        — site mgr edit freeze
//   - Wednesday all day          — PMC grace day to approve/flag
//   - Wednesday 07:00 digest     — soft nudge to PMC
//   - Thursday 00:00 IST         — auto-lock fires
//
// At hour===0 IST today, find pending_review rows where report_date is
// 2 or more days ago and flip them to auto_locked. Only pending_review
// rows are touched — flagged is an explicit PMC decision and remains
// flagged (the audit trail reflects what actually happened).
async function autoLockOverdueDailyReports(db) {
  try {
    const [result] = await db.query(
      `UPDATE daily_reports
          SET status = 'auto_locked', locked_at = NOW()
        WHERE status = 'pending_review'
          AND report_date <= DATE_SUB(CURDATE(), INTERVAL 2 DAY)`
    );
    if (result.affectedRows > 0) {
      console.log(`[auto-lock] ${result.affectedRows} daily report(s) auto-locked`);
    }
  } catch (e) {
    console.error('[auto-lock] error:', e.message);
  }
}

async function checkMissingReports(db, date, notifyRole) {
  const [managers] = await db.execute(
    `SELECT u.id, u.full_name, u.phone, u.matrix_room_id, pa.project_id, p.name AS project_name, p.code AS project_code
     FROM users u
     JOIN project_assignments pa ON pa.user_id = u.id AND pa.is_active = 1
     JOIN projects p ON pa.project_id = p.id AND p.status = 'active'
     WHERE u.role = 'site_manager' AND u.is_active = 1`
  );

  const matrixAdapter = require('../services/matrix-adapter');

  for (const mgr of managers) {
    const [[report]] = await db.execute(
      'SELECT id FROM daily_reports WHERE project_id = ? AND report_date = ? AND site_manager_id = ?',
      [mgr.project_id, date, mgr.id]
    );

    if (!report) {
      const [[onLeave]] = await db.execute(
        `SELECT id FROM site_manager_leave
         WHERE user_id = ? AND project_id = ? AND leave_from <= ? AND leave_to >= ?`,
        [mgr.id, mgr.project_id, date, date]
      );

      if (onLeave) {
        console.log(`[overdue-checker] ${mgr.full_name} on approved leave — no alert`);
        continue;
      }

      console.log(`[overdue-checker] Missing report: ${mgr.full_name} / ${mgr.project_name} / ${date} — notify ${notifyRole}`);
      if (mgr.matrix_room_id) {
        const pwaUrl = `${process.env.PWA_BASE_URL}/daily-report/${mgr.project_id}`;
        await matrixAdapter.sendText({
          roomId: mgr.matrix_room_id,
          body: `📋 ${mgr.project_code} — Daily report for ${date} not yet submitted. Please submit now: ${pwaUrl}`,
          recipientUid: mgr.id,
        }).catch(e => console.warn('[overdue-checker] Matrix missing-report alert failed:', e.message));
      }
    }
  }
}

// sendPMCDigest removed — was a dead duplicate of sendPMC7AM with a
// global (non-project-scoped) query and a double-WHERE bug. sendPMC7AM
// is the real function and is called from the hour===7 branch above.

// (Retention reminders and handover-approaching crons removed in v2 trim —
// the handover_events and related tables were not in product scope.)


// ── DIGEST FUNCTIONS






async function sendDesignHeadsPending(db) {
  for (const role of ['design_head', 'services_head']) {
    const [heads] = await db.execute("SELECT u.id FROM users u WHERE u.role=? AND u.is_active=1", [role]);
    for (const head of heads) {
      const [drawings] = await db.execute(
        "SELECT COUNT(*) AS cnt FROM drawing_versions dv JOIN drawings d ON dv.drawing_id=d.id JOIN project_assignments pa ON d.project_id=pa.project_id WHERE pa.user_id=? AND dv.status='pending_l2'",
        [head.id]);
      const [queries] = await db.execute(
        "SELECT COUNT(*) AS cnt FROM issues WHERE assigned_by=? AND answer IS NULL",
        [head.id]);
      const total = drawings[0].cnt + queries[0].cnt;
      if (total > 0) {
        await notifLog.logUserNotif({
          userId: head.id, messageType: 'pending_items',
          body: 'nu PMC: ' + drawings[0].cnt + ' drawing' + (drawings[0].cnt !== 1 ? 's' : '') + ' to approve, ' + queries[0].cnt + ' quer' + (queries[0].cnt !== 1 ? 'ies' : 'y') + ' pending.',
          status: 'pending',
        });
      }
    }
  }
}

async function sendRSWeeklyDigest(db) {
  for (const role of ['design_head', 'services_head']) {
    const [heads] = await db.execute("SELECT u.id FROM users u WHERE u.role=? AND u.is_active=1", [role]);
    for (const head of heads) {
      const [projects] = await db.execute(
        'SELECT p.id, p.name FROM projects p JOIN project_assignments pa ON p.id=pa.project_id WHERE pa.user_id=? AND p.status=?',
        [head.id, 'active']);
      for (const proj of projects) {
        const lines = [];
        const [sched] = await db.execute(
          "SELECT drift_days FROM schedule_versions WHERE project_id=? AND is_current=1", [proj.id]);
        if (sched[0]?.drift_days > 0) lines.push('Schedule: ' + sched[0].drift_days + ' days drift');
        const [queries] = await db.execute(
          "SELECT COUNT(*) AS cnt FROM issues WHERE project_id=? AND status IN ('open','assigned') AND answer IS NULL",
          [proj.id]);
        if (queries[0].cnt > 0) lines.push(queries[0].cnt + ' drawing quer' + (queries[0].cnt !== 1 ? 'ies' : 'y') + ' open');
        const [issues] = await db.execute(
          "SELECT COUNT(*) AS cnt FROM issues WHERE project_id=? AND status IN ('open','in_progress')", [proj.id]);
        if (issues[0].cnt > 0) lines.push(issues[0].cnt + ' issue' + (issues[0].cnt !== 1 ? 's' : '') + ' open');
        const msg = 'nu PMC - Weekly Digest\n' + proj.name + '\n\n' + (lines.length ? lines.join('\n') : 'All good.') + '\n\nOpen app for full detail.';
        await notifLog.logUserNotif({ userId: head.id, messageType: 'weekly_digest', body: msg, status: 'pending' })
      }
    }
  }

  // ── RETRY QUEUES — run on every checker cycle (every 15 min)
  // Email retry: up to 3 attempts, exponential back-off 30m/1h/2h
  try {
    const { retryFailed } = require('../services/email');
    await retryFailed();
  } catch (e) { console.error('[overdue-checker] email retry error:', e.message); }
}

module.exports = { run };

async function sendPrincipal4PMPayments(db) {
  const [projects] = await db.execute("SELECT id, name, code FROM projects WHERE status='active'");
  const matrixAdapter = require('../services/matrix-adapter');

  let totalAmt = 0;
  const lines = [];

  for (const proj of projects) {
    const [payments] = await db.execute(
      `SELECT pr.id, v.vendor_name, pr.amount_requested
       FROM payment_requests pr
       JOIN vendor_engagements ve ON pr.engagement_id=ve.id
       JOIN vendors v ON ve.vendor_id=v.id
       WHERE pr.project_id=? AND pr.status='pmc_approved'
       ORDER BY v.vendor_name`,
      [proj.id]
    );
    if (!payments.length) continue;
    const projTotal = payments.reduce((s, p) => s + parseFloat(p.amount_requested), 0);
    totalAmt += projTotal;
    lines.push(`${proj.code}: ${payments.length} vendor${payments.length > 1 ? 's' : ''} — ₹${projTotal.toLocaleString('en-IN')}`);

    // Per-project payment batch alert to finance room
    const financeRoom = await matrixAdapter.getProjectRoomId(proj.id, 'finance');
    if (financeRoom) {
      const pwaUrl = `${process.env.PWA_BASE_URL}/payments/batch/${proj.id}`;
      await matrixAdapter.sendText({
        roomId: financeRoom,
        body: `💰 ${proj.code} — ${payments.length} payment${payments.length > 1 ? 's' : ''} ready for approval — ₹${projTotal.toLocaleString('en-IN')}\n${pwaUrl}`,
      }).catch(e => console.warn('[4PM payments]', e.message));
    }
  }

  if (!lines.length) return;

  // Summary to #internal-principal
  const principalRoom = await matrixAdapter.getInternalRoomId('internal_principal');
  if (principalRoom) {
    const msg = `💰 Saturday Payment Summary — ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}\n\n` +
      lines.join('\n') + `\n\nTotal: ₹${totalAmt.toLocaleString('en-IN')}\n\nOpen app to approve by project.`;
    await matrixAdapter.sendText({ roomId: principalRoom, body: msg })
      .catch(e => console.warn('[4PM principal summary]', e.message));
  }
}

async function sendFinanceAdmin5PMExcel(db) {
  const [approved] = await db.execute(
    "SELECT COUNT(*) AS cnt FROM payment_requests WHERE status='principal_approved' AND DATE(principal_reviewed_at)=CURDATE()"
  );
  if (!approved[0].cnt) return;

  const [financeAdmins] = await db.execute(
    "SELECT id, matrix_room_id FROM users WHERE role='finance_admin' AND is_active=1");
  if (!financeAdmins.length) return;

  const matrixAdapter = require('../services/matrix-adapter');

  const [payments] = await db.execute(
    `SELECT pr.id, pr.pmc_amount, pr.amount_requested,
            v.vendor_name, ve.scope, p.name AS project_name,
            v.bank_account, v.bank_ifsc
     FROM payment_requests pr
     JOIN vendor_engagements ve ON pr.engagement_id=ve.id
     JOIN vendors v ON ve.vendor_id=v.id
     JOIN projects p ON pr.project_id=p.id
     WHERE pr.status='principal_approved' AND DATE(pr.principal_reviewed_at)=CURDATE()`
  );
  if (!payments.length) return;

  const totalAmt = payments.reduce((s, p) => s + parseFloat(p.pmc_amount || p.amount_requested), 0);
  const pwaUrl = `${process.env.PWA_BASE_URL}/payments/icici-excel`;

  // Post to #internal-finance with summary + PWA link to download ICICI Excel.
  const financeRoom = await matrixAdapter.getInternalRoomId('internal_finance');
  if (financeRoom) {
    const lines = payments.map((p, i) =>
      `${i+1}. ${p.vendor_name.substring(0,18)} — ₹${parseFloat(p.pmc_amount||p.amount_requested).toLocaleString('en-IN')} — ${p.project_name.substring(0,12)}`
    );
    const body = `💰 Saturday payments ready — ${payments.length} vendors — ₹${totalAmt.toLocaleString('en-IN')}\n\n` +
      lines.join('\n') + `\n\nDownload ICICI Excel: ${pwaUrl}`;
    await matrixAdapter.sendText({ roomId: financeRoom, body })
      .catch(e => console.warn('[5PM excel] Matrix failed:', e.message));
  }

  // Log for each finance admin
  for (const u of financeAdmins) {
    await notifLog.logUserNotif({ userId: u.id, messageType: 'saturday_excel',
      body: `${payments.length} payments ready — ₹${totalAmt.toLocaleString('en-IN')}`, status: 'sent' });
  }
}



async function sendLocationRequest(db) {
  // Per migration plan: no native Matrix location request API.
  // Send Matrix DM with PWA deep link — user taps, PWA captures geolocation.
  const matrixAdapter = require('../services/matrix-adapter');
  const [siteManagers] = await db.execute(
    `SELECT u.id, u.matrix_room_id, u.full_name, p.id AS project_id, p.name AS project_name
     FROM users u
     JOIN project_assignments pa ON pa.user_id = u.id
     JOIN projects p ON pa.project_id = p.id
     WHERE u.role IN ('site_manager','senior_site_manager')
     AND u.is_active = 1 AND u.matrix_room_id IS NOT NULL
     AND p.status = 'active'`
  );

  for (const sm of siteManagers) {
    try {
      const pwaUrl = `${process.env.PWA_BASE_URL}/check-in/${sm.project_id}`;
      await matrixAdapter.sendText({
        roomId: sm.matrix_room_id,
        body: `📍 Good morning ${sm.full_name.split(' ')[0]}! Please share your location for ${sm.project_name} — 9:30AM check-in: ${pwaUrl}`,
        recipientUid: sm.id,
      });
    } catch (_e) { /* non-blocking */ }
  }
}

async function processAutoAccepts(db) {
  const AUTO_ACCEPT_TYPES = ['anomaly_ack','drawing_approval','vendor_defect_ack'];

  // Find expired pending actions eligible for auto-accept
  const [expired] = await db.execute(
    `SELECT * FROM wa_pending_actions
     WHERE action_type IN (${AUTO_ACCEPT_TYPES.map(()=>'?').join(',')})
     AND status = 'pending'
     AND auto_accept_at IS NOT NULL
     AND auto_accept_at <= NOW()`,
    AUTO_ACCEPT_TYPES
  );

  if (!expired.length) return;
  console.log('[auto-accept] Processing', expired.length, 'expired actions');

  for (const pending of expired) {
    try {
      // Mark as auto-accepted
      await db.execute(
        "UPDATE wa_pending_actions SET status='acted', reply_received='AUTO_ACCEPTED', replied_at=NOW() WHERE id=?",
        [pending.id]
      );

      // Apply the default acceptance action
      if (pending.action_type === 'anomaly_ack') {
        await db.execute(
          "UPDATE daily_reports SET ai_flag_acknowledged=1, ai_flag_ack_at=NOW() WHERE id=?",
          [pending.ref_id]
        );
      }

      if (pending.action_type === 'drawing_approval') {
        await db.execute(
          "UPDATE drawing_versions SET status='issued', l2_approved_by=0, l2_approved_at=NOW() WHERE id=? AND status='pending_l2'",
          [pending.ref_id]
        );
      }

      if (pending.action_type === 'vendor_defect_ack') {
        await db.execute(
          "UPDATE issues SET vendor_acknowledged=1, vendor_ack_at=NOW() WHERE id=?",
          [pending.ref_id]
        );
      }

      // Notify that auto-accept occurred
      if (pending.raised_by) {
        await notifLog.logUserNotif({
          userId: pending.raised_by, messageType: 'auto_accepted',
          body: 'Auto-accepted: ' + pending.action_type.replace(/_/g,' ') + ' (no reply received by deadline)',
          status: 'pending',
        });
      }

      console.log('[auto-accept] Auto-accepted:', pending.action_type, 'ref:', pending.ref_id);
    } catch (e) {
      console.error('[auto-accept] Error on', pending.id, e.message);
    }
  }
}

async function sendPhotoRFIReminders(db) {
  const [due] = await db.execute(
    `SELECT i.id, i.title, i.project_id, i.assigned_to_site,
            u.matrix_room_id AS site_room, u.full_name AS site_name,
            p.name AS project_name, p.code AS project_code,
            (SELECT COUNT(*) FROM issue_photos ip WHERE ip.issue_id=i.id) AS photo_count
     FROM issues i
     JOIN users u ON i.assigned_to_site=u.id
     JOIN projects p ON i.project_id=p.id
     WHERE i.issue_type='rfi'
     AND i.response_type IN ('photo','both')
     AND i.photo_deadline=CURDATE()
     AND i.status IN ('open','in_progress')
     AND u.matrix_room_id IS NOT NULL`
  );

  const matrixAdapter = require('../services/matrix-adapter');

  for (const rfi of due) {
    const pwaUrl = `${process.env.PWA_BASE_URL}/issues/${rfi.id}/photos`;
    const body = parseInt(rfi.photo_count) === 0
      ? `🔴 ${rfi.project_code} — Photo RFI due today: ${rfi.title.substring(0,60)}. No photos received yet. Please upload now: ${pwaUrl}`
      : `⏰ ${rfi.project_code} — Photo RFI closes today: ${rfi.title.substring(0,60)}. ${rfi.photo_count} photo(s) received. Upload more if needed: ${pwaUrl}`;

    await matrixAdapter.sendText({
      roomId: rfi.site_room,
      body,
      recipientUid: rfi.assigned_to_site,
    }).catch(e => console.warn('[photo-rfi-reminder] Matrix DM failed:', e.message));

    if (parseInt(rfi.photo_count) === 0) {
      await db.execute(
        "UPDATE issues SET status='in_progress' WHERE id=? AND status='open'",
        [rfi.id]
      );
    }
  }
}

// ── checkZeroFloat — real-time alert to principals when a task hits zero float
// Fires on every overdue-checker run (every 15 min). De-duped: the DB column
// notified_zero_float_at is set on first alert; cleared when task completes.
async function checkZeroFloat(db) {
  const [tasks] = await db.execute(
    `SELECT st.id, st.task_name, st.start_date, st.float_days,
            p.id AS project_id, p.code AS project_code
       FROM schedule_tasks st
       JOIN projects p ON p.id = st.project_id
      WHERE st.float_days <= 0
        AND st.status != 'completed'
        AND (st.notified_zero_float_at IS NULL
             OR DATE(st.notified_zero_float_at) < CURDATE())`
  );
  if (!tasks.length) return;

  const matrixAdapter = require('../services/matrix-adapter');
  const [principals] = await db.execute(
    `SELECT matrix_room_id FROM users
      WHERE role IN ('principal','design_principal') AND is_active = 1 AND matrix_room_id IS NOT NULL`
  );

  for (const task of tasks) {
    const startStr = new Date(task.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const msg = `🔴 ${task.project_code} — Zero float: ${task.task_name} — starts ${startStr}. Any delay now delays the project. ${process.env.PWA_BASE_URL}/schedule/${task.project_id}`;
    for (const p of principals) {
      await matrixAdapter.sendText({ roomId: p.matrix_room_id, body: msg })
        .catch(e => console.warn('[zero-float] Matrix alert failed:', e.message));
    }
    await db.execute(
      'UPDATE schedule_tasks SET notified_zero_float_at = NOW() WHERE id = ?',
      [task.id]
    );
  }
}

// ── checkBudgetThresholds — alert Finance + Principal when category spend hits threshold
// Reads budget_alert_pct from project_thresholds (default 90%).
// De-duped: checks budget_alerts table to avoid re-firing until spend increases further.
async function checkBudgetThresholds(db) {
  // Get global threshold (project-level override wins if present)
  const [[global]] = await db.execute(
    `SELECT threshold_value FROM project_thresholds
      WHERE project_id IS NULL AND threshold_type = 'budget_alert_pct' LIMIT 1`
  );
  const defaultPct = global?.threshold_value ?? 90;

  // Find active projects with budget data
  const [projects] = await db.execute(
    `SELECT p.id, p.code, p.name FROM projects p WHERE p.status = 'active'`
  );

  const matrixAdapter = require('../services/matrix-adapter');

  for (const proj of projects) {
    // Project-level threshold override
    const [[projCfg]] = await db.execute(
      `SELECT threshold_value FROM project_thresholds
        WHERE project_id = ? AND threshold_type = 'budget_alert_pct' LIMIT 1`,
      [proj.id]
    );
    const alertPct = projCfg?.threshold_value ?? defaultPct;

    // Find BOQ categories where spend >= alertPct of approved budget
    const [categories] = await db.execute(
      `SELECT
          cb.trade                              AS category_name,
          (cb.client_rate * cb.quantity)        AS approved_amount,
          COALESCE(SUM(pr.amount_requested), 0) AS spent
        FROM client_boq_items cb
        LEFT JOIN vendor_engagements ve ON ve.project_id = cb.project_id
        LEFT JOIN payment_requests pr ON pr.engagement_id = ve.id
          AND pr.status NOT IN ('rejected','cancelled')
        WHERE cb.project_id = ?
        GROUP BY cb.trade, cb.client_rate, cb.quantity
        HAVING spent >= ((cb.client_rate * cb.quantity) * ? / 100)
          AND (cb.client_rate * cb.quantity) > 0`,
      [proj.id, alertPct]
    );

    for (const cat of categories) {
      const pct = Math.round((cat.spent / cat.approved_amount) * 100);
      // Check if already alerted at this level (within 5% band)
      const [[alerted]] = await db.execute(
        `SELECT id FROM budget_threshold_alerts
          WHERE project_id = ? AND category_name = ? AND alert_pct >= ?
          ORDER BY alerted_at DESC LIMIT 1`,
        [proj.id, cat.category_name, pct - 5]
      ).catch(() => [[null]]);  // table may not exist — non-fatal

      if (alerted) continue;

      const msg = `⚠️ ${proj.code} — Budget Alert\nCategory: ${cat.category_name}\nSpent: ₹${Number(cat.spent).toLocaleString('en-IN')} of ₹${Number(cat.approved_amount).toLocaleString('en-IN')} (${pct}%)\n${process.env.PWA_BASE_URL}/budget/${proj.id}`;

      const [recipients] = await db.execute(
        `SELECT matrix_room_id FROM users
          WHERE role IN ('principal','design_principal','finance_admin') AND is_active = 1 AND matrix_room_id IS NOT NULL`
      );

      for (const r of recipients) {
        await matrixAdapter.sendText({ roomId: r.matrix_room_id, body: msg })
          .catch(e => console.warn('[budget-threshold] Matrix send failed:', e.message));
      }

      // Record alert to prevent re-firing
      await db.execute(
        `INSERT IGNORE INTO budget_threshold_alerts (project_id, category_name, alert_pct, alerted_at)
          VALUES (?, ?, ?, NOW())`,
        [proj.id, cat.category_name, pct]
      ).catch(() => {});  // table may not exist yet — non-fatal until migration runs
    }
  }
}

// ── sendLabourLogReminders — A2, friction-reduction brief
// Runs at 07:00. For each active project with an assigned site manager,
// reads yesterday's labour counts and sends a pre-filled summary to the
// site manager's Matrix room with a deep link to /labour-quick.
// 2-hour carryover: if no submission by 09:00, overdue-checker copies
// yesterday's counts automatically (handled by the 9AM run below).
async function sendLabourLogReminders(db) {
  const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Active projects with their assigned site manager
  const [projects] = await db.execute(
    `SELECT p.id AS project_id, p.code AS project_code,
            u.id AS user_id, u.matrix_room_id, u.full_name
       FROM projects p
       JOIN project_assignments pa ON pa.project_id = p.id AND pa.is_active = 1
       JOIN users u ON u.id = pa.user_id
      WHERE p.status = 'active'
        AND u.role IN ('site_manager','senior_site_manager')
        AND u.matrix_room_id IS NOT NULL`
  );
  if (!projects.length) return;

  const matrixAdapter = require('../services/matrix-adapter');

  for (const proj of projects) {
    // Yesterday's headcounts
    const [entries] = await db.execute(
      `SELECT v.vendor_name, lr.headcount
         FROM labour_register lr
         JOIN vendor_engagements ve ON ve.id = lr.engagement_id
         JOIN vendors v ON v.id = ve.vendor_id
        WHERE lr.project_id = ? AND lr.register_date = ?
        ORDER BY v.vendor_name`,
      [proj.project_id, yesterday]
    );

    const THICK = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬';
    const dateDisplay = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const pwaUrl = `${process.env.PWA_BASE_URL}/labour-quick/${proj.project_id}`;

    let lines = [`☀️ ${proj.project_code} — Labour Log — ${dateDisplay}`, THICK];
    if (entries.length) {
      let total = 0;
      for (const e of entries) {
        lines.push(`${e.vendor_name} — ${e.headcount}`);
        total += parseInt(e.headcount || 0);
      }
      lines.push(`Total: ${total}`);
    } else {
      lines.push('No entries yesterday.');
    }
    lines.push(THICK);
    lines.push(`✍️ Update if anything changed → ${pwaUrl}`);

    await matrixAdapter.sendText({
      roomId: proj.matrix_room_id,
      body:   lines.join('\n'),
    }).catch(e => console.warn(`[labour-quick] Matrix send failed for ${proj.project_code}:`, e.message));
  }
}

// ── carryoverLabourCounts — called at 09:00 if site manager hasn't submitted
// Copies yesterday's counts as today's automatically. Non-blocking.
async function carryoverLabourCounts(db) {
  const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Copy yesterday's rows where today doesn't already have an entry
  await db.execute(
    `INSERT IGNORE INTO labour_register
       (project_id, engagement_id, register_date, trade, headcount, notes, recorded_by)
     SELECT project_id, engagement_id, ?, trade, headcount,
            CONCAT('[auto-carry] ', COALESCE(notes,'')), recorded_by
       FROM labour_register
      WHERE register_date = ?`,
    [today, yesterday]
  );
}

// ── sendScheduleReminders — A3, friction-reduction brief
// Runs at 07:00. Sends today's active tasks to each site manager's Matrix room
// with a deep link to /schedule-quick.
async function sendScheduleReminders(db) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const [projects] = await db.execute(
    `SELECT p.id AS project_id, p.code AS project_code,
            u.id AS user_id, u.matrix_room_id
       FROM projects p
       JOIN project_assignments pa ON pa.project_id = p.id AND pa.is_active = 1
       JOIN users u ON u.id = pa.user_id
      WHERE p.status = 'active'
        AND u.role IN ('site_manager','senior_site_manager')
        AND u.matrix_room_id IS NOT NULL`
  );
  if (!projects.length) return;

  const matrixAdapter = require('../services/matrix-adapter');

  for (const proj of projects) {
    const [tasks] = await db.execute(
      `SELECT st.task_name, COALESCE(tu.pct_complete, 0) AS pct_complete
         FROM schedule_tasks st
         LEFT JOIN task_updates tu ON tu.task_id = st.id
           AND tu.report_date = (SELECT MAX(r.report_date) FROM task_updates r WHERE r.task_id = st.id)
        WHERE st.project_id = ? AND st.status NOT IN ('completed','not_started')
          AND st.start_date <= ?
        ORDER BY st.float_days ASC, st.start_date ASC
        LIMIT 5`,
      [proj.project_id, today]
    );

    if (!tasks.length) continue;

    const THICK  = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬';
    const pwaUrl = `${process.env.PWA_BASE_URL}/schedule-quick/${proj.project_id}`;
    const dateDisplay = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const lines = [
      `📋 ${proj.project_code} — Today's Tasks — ${dateDisplay}`,
      THICK,
      ...tasks.map(t => `${t.task_name} — ${t.pct_complete}% complete`),
      THICK,
      `✍️ Update Progress → ${pwaUrl}`,
    ];

    await matrixAdapter.sendText({
      roomId: proj.matrix_room_id,
      body:   lines.join('\n'),
    }).catch(e => console.warn(`[schedule-quick] Matrix send failed for ${proj.project_code}:`, e.message));
    }
}
