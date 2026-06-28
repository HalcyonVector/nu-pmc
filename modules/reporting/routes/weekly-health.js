// routes/weekly-health.js — Monday Morning Health Report
// PDF generation — all projects, process health, financial summary, decay alerts
const express  = require('express');
const db       = require('../../../middleware/db');
const dateUtil = require('../../../services/date-util');
const users = require('../../../services/users-lookup');
const path     = require('path');
const fs       = require('fs');
const PDFDoc   = require('pdfkit');
const { requireAuth, requireRole } = require('../../../middleware/auth');
const { UPLOAD_DIR } = require('../../../middleware/upload');
const asyncHandler = require('../../../middleware/asyncHandler');
const { FINANCE_ROLES } = require('../../../services/roles');
const fileUrls = require('../../../services/file-url');
const router   = express.Router();


// ── HELPERS ─────────────────────────────────────────────────────────

const GREEN  = '#27ae60';
const AMBER  = '#f39c12';
const RED    = '#e74c3c';
const NAVY   = '#2c3e50';
const LIGHT  = '#ecf0f1';

function statusIcon(val) {
  if (val === true  || val === 'green') return '✅';
  if (val === false || val === 'red')   return '❌';
  return '⚠️';
}

function inrFormat(n) {
  return `₹${parseFloat(n||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// ── DATA GATHERERS ───────────────────────────────────────────────────

async function getProjectHealthData(projectId, weekStart, weekEnd) {
  const pid = projectId;

  // Daily updates — did site team update Mon-Fri?
  const [dailyUpdates] = await db.query(
    `SELECT COUNT(DISTINCT report_date) AS days_updated,
       COUNT(DISTINCT CASE WHEN is_flagged = 1 THEN report_date END) AS days_flagged
     FROM task_updates
     WHERE project_id = ? AND report_date BETWEEN ? AND ?`,
    [pid, weekStart, weekEnd]
  );

  // Validated by M/P
  const [validated] = await db.query(
    `SELECT COUNT(*) AS val_count FROM task_validations tv
     JOIN task_updates tu ON tv.task_update_id = tu.id
     WHERE tu.project_id = ? AND tv.validated_at BETWEEN ? AND ?`,
    [pid, weekStart + ' 00:00:00', weekEnd + ' 23:59:59']
  );

  // Photos uploaded this week
  const [photos] = await db.query(
    `SELECT COUNT(DISTINCT photo_date) AS photo_days
     FROM project_photos WHERE project_id = ? AND photo_date BETWEEN ? AND ?`,
    [pid, weekStart, weekEnd]
  );

  // Overdue drawing queries
  const [overdueQueries] = await db.query(
    `SELECT COUNT(*) AS cnt FROM issues
     WHERE project_id = ? AND is_overdue = 1 AND status NOT IN ('closed')`,
    [pid]
  );

  // Drawings issued this week
  const [newDrawings] = await db.query(
    `SELECT COUNT(*) AS cnt FROM drawing_versions
     WHERE drawing_id IN (SELECT id FROM drawings WHERE project_id = ?)
       AND issued_at BETWEEN ? AND ?`,
    [pid, weekStart + ' 00:00:00', weekEnd + ' 23:59:59']
  );

  // L1 reviews stuck > 3 days
  const [stuckL1] = await db.query(
    `SELECT COUNT(*) AS cnt FROM drawing_versions dv
     JOIN drawings d ON dv.drawing_id = d.id
     WHERE d.project_id = ? AND dv.status = 'pending_l1'
       AND dv.created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)`,
    [pid]
  );

  // Pending payment requests
  const [pendingPayments] = await db.query(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_requested),0) AS total
     FROM vendor_payments WHERE project_id = ? AND status = 'pending'`,
    [pid]
  );

  // Oldest pending payment
  const [[oldestPmt]] = await db.query(
    `SELECT DATEDIFF(NOW(), raised_at) AS days_pending
     FROM vendor_payments WHERE project_id = ? AND status = 'pending'
     ORDER BY raised_at ASC LIMIT 1`,
    [pid]
  );

  // Joint measurement this week
  const [measThisWeek] = await db.query(
    `SELECT COUNT(*) AS cnt FROM measurements
     WHERE project_id = ? AND created_at BETWEEN ? AND ?`,
    [pid, weekStart + ' 00:00:00', weekEnd + ' 23:59:59']
  );

  // RA bills raised this week
  const [claimsThisWeek] = await db.query(
    `SELECT COUNT(*) AS cnt FROM client_claims
     WHERE project_id = ? AND created_at BETWEEN ? AND ?`,
    [pid, weekStart + ' 00:00:00', weekEnd + ' 23:59:59']
  );

  // Open CNs awaiting principal approval
  const [openCNs] = await db.query(
    `SELECT cn.cn_number, DATEDIFF(NOW(), cn.raised_at) AS age_days
     FROM change_notices cn
     WHERE cn.project_id = ? AND cn.status = 'pending_approval'`,
    [pid]
  );

  // Schedule risk narratives — AI generated weekly
  const [riskNarratives] = await db.query(
    `SELECT trade, gap_pct, weeks_behind, forecast_delay, narrative, escalation_level, week_ending
     FROM schedule_risk_narratives
     WHERE project_id = ?
     AND week_ending >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
     ORDER BY week_ending DESC, gap_pct DESC`,
    [projectId]
  );

  // Schedule drift
  const [[schedule]] = await db.query(
    `SELECT drift_days, label,
       DATEDIFF(end_date, NOW()) AS days_to_completion
     FROM schedule_versions WHERE project_id = ? AND is_current = 1`,
    [pid]
  );

  // Task completion this week (% of planned tasks with update)
  const [[taskProgress]] = await db.query(
    `SELECT
       COUNT(DISTINCT st.id) AS total_tasks,
       COUNT(DISTINCT tu.task_id) AS updated_tasks,
       ROUND(AVG(tu.pct_complete),1) AS avg_pct
     FROM schedule_tasks st
     JOIN schedule_versions sv ON st.schedule_version_id = sv.id
     LEFT JOIN task_updates tu ON tu.task_id = st.id
       AND tu.report_date BETWEEN ? AND ?
     WHERE sv.project_id = ? AND sv.is_current = 1`,
    [weekStart, weekEnd, pid]
  );

  // Flagged tasks not actioned within 24hrs
  const [unactionedFlags] = await db.query(
    `SELECT COUNT(*) AS cnt FROM task_updates
     WHERE project_id = ? AND is_flagged = 1
       AND flag_note IS NOT NULL
       AND DATEDIFF(NOW(), report_date) > 1`,
    [pid]
  );

  // Weekly report drafted
  const [[weeklyReport]] = await db.query(
    `SELECT status, drafted_by FROM weekly_reports
     WHERE project_id = ? AND week_ending BETWEEN ? AND ?
     ORDER BY created_at DESC LIMIT 1`,
    [pid, weekStart, weekEnd]
  );

  // Financial: total vendor payments approved vs client claims
  const [[financials]] = await db.query(
    `SELECT
       COALESCE((SELECT SUM(amount_requested) FROM vendor_payments
                 WHERE project_id = ? AND status = 'processed'), 0) AS vendor_paid,
       COALESCE((SELECT SUM(cli.claimed_qty * cb.client_rate)
                 FROM claim_items cli
                 JOIN client_claims cl ON cli.claim_id = cl.id
                 JOIN client_boq_items cb ON cli.client_boq_item_id = cb.id
                 WHERE cl.project_id = ? AND cl.status IN ('approved','invoiced')), 0) AS client_claimed`,
    [pid, pid]
  );

  return {
    dailyUpdates:    dailyUpdates[0],
    validated:       validated[0],
    photos:          photos[0],
    overdueQueries:  overdueQueries[0].cnt,
    newDrawings:     newDrawings[0].cnt,
    stuckL1:         stuckL1[0].cnt,
    pendingPayments: pendingPayments[0],
    oldestPmt:       oldestPmt?.days_pending || 0,
    measThisWeek:    measThisWeek[0].cnt,
    claimsThisWeek:  claimsThisWeek[0].cnt,
    openCNs,
    schedule:        schedule || { drift_days: 0, label: 'R0', days_to_completion: 0 },
    riskNarratives:  riskNarratives || [],
    taskProgress:    taskProgress || { total_tasks: 0, updated_tasks: 0, avg_pct: 0 },
    unactionedFlags: unactionedFlags[0].cnt,
    weeklyReport,
    financials:      financials,
  };
}

// ── PDF BUILDER ──────────────────────────────────────────────────────

function drawRow(doc, label, value, status, x, y, width) {
  const icon = statusIcon(status);
  doc.fontSize(9).font('Helvetica').fillColor('#2c3e50');
  doc.text(label, x + 8, y, { width: width * 0.65 });
  doc.text(icon + ' ' + value, x + width * 0.65, y, { width: width * 0.35 });
}

function sectionHeader(doc, title, x, y, width) {
  doc.rect(x, y, width, 16).fill(NAVY);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('white')
     .text(title.toUpperCase(), x + 6, y + 3, { width });
  doc.fillColor(NAVY);
  return y + 20;
}

// ── ROUTE ────────────────────────────────────────────────────────────

// GET /api/weekly-health/report — generate Monday report PDF
router.get('/report', requireAuth, requireRole(...FINANCE_ROLES), asyncHandler(async (req, res) => {
    const me = req.session.user;
    // Week boundaries — last Mon to last Sun
    const today     = new Date();
    const dow       = today.getDay(); // 0=Sun
    const lastMon   = new Date(today);
    lastMon.setDate(today.getDate() - ((dow + 6) % 7) - 7);
    const lastSun   = new Date(lastMon);
    lastSun.setDate(lastMon.getDate() + 6);

    const weekStart = dateUtil.dateIST(lastMon);
    const weekEnd   = dateUtil.dateIST(lastSun);
    const weekLabel = `Week ending ${lastSun.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`;

    // Get all active projects
    const Onboarding = require('../../onboarding/contract');
    const projects = await Onboarding.functions.getActiveProjects();

    if (!projects.length) {
      return res.status(404).json({ error: 'No active projects found' });
    }

    // Fetch firm identity for PDF footer — first active entity (LLP preferred)
    const [[firmEntity]] = await db.query(
      `SELECT legal_name, gstin, email_primary FROM company_entities
       WHERE is_active = 1 ORDER BY FIELD(entity_code,'LLP','PROP') LIMIT 1`
    );
    const firmName  = firmEntity?.legal_name  || '';
    const firmGstin = firmEntity?.gstin        || '';
    const firmEmail = firmEntity?.email_primary || '';

    // Gather health data for all projects
    const projectData = [];
    for (const p of projects) {
      const health = await getProjectHealthData(p.id, weekStart, weekEnd);
      projectData.push({ project: p, health });
    }

    // Build PDF
    const doc     = new PDFDoc({ margin: 40, size: 'A4' });
    const outPath = path.join(UPLOAD_DIR, 'documents',
      `weekly_health_${weekEnd}_${Date.now()}.pdf`);
    const ws = fs.createWriteStream(outPath);
    doc.pipe(ws);

    const PW = 515; // page width after margins
    const LM = 40; // left margin

    // ── COVER / HEADER ───────────────────────────────────────────────
    doc.rect(LM, 40, PW, 50).fill(NAVY);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('white')
       .text('MONDAY HEALTH REPORT', LM + 10, 52);
    doc.fontSize(10).font('Helvetica').fillColor(LIGHT)
       .text(`NU ASSOCIATES LLP  ·  ${weekLabel}  ·  Generated ${new Date().toLocaleString('en-IN')}`,
             LM + 10, 76);
    doc.fillColor(NAVY);

    // ── PER-PROJECT HEALTH PAGES ─────────────────────────────────────
    for (const { project: p, health: h } of projectData) {

      doc.addPage();
      let y = 40;

      // Project title bar
      doc.rect(LM, y, PW, 24).fill(NAVY);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('white')
         .text(`${p.code}  —  ${p.name}`, LM + 8, y + 6);
      doc.fillColor(NAVY);
      y += 32;

      doc.fontSize(9).font('Helvetica').fillColor('#555')
         .text(`Client: ${p.client}  ·  Location: ${p.location || '—'}  ·  R0 End: ${new Date(p.r0_end_date).toLocaleDateString('en-IN')}`,
               LM, y);
      y += 18;

      // ── Process health grid (2 columns)
      const colW = (PW - 10) / 2;
      let yL = y, yR = y;

      // LEFT COLUMN
      yL = sectionHeader(doc, 'Daily Operations', LM, yL, colW);
      const daysExpected = 5;
      const daysUpdated  = Math.min(h.dailyUpdates.days_updated, daysExpected);
      drawRow(doc, 'Daily site updates (Mon–Fri)',
        `${daysUpdated}/${daysExpected} days`,
        daysUpdated >= daysExpected ? true : daysUpdated >= 3 ? 'amber' : false,
        LM, yL, colW); yL += 14;

      drawRow(doc, 'Updates validated by M/P',
        `${h.validated.val_count} updates`,
        h.validated.val_count > 0 ? true : 'amber',
        LM, yL, colW); yL += 14;

      drawRow(doc, 'Flagged tasks actioned < 24hrs',
        h.unactionedFlags === 0 ? 'All actioned' : `${h.unactionedFlags} not actioned`,
        h.unactionedFlags === 0 ? true : false,
        LM, yL, colW); yL += 14;

      drawRow(doc, 'Photos uploaded with updates',
        `${h.photos.photo_days}/${daysExpected} days`,
        h.photos.photo_days >= daysExpected ? true : h.photos.photo_days >= 3 ? 'amber' : false,
        LM, yL, colW); yL += 20;

      yL = sectionHeader(doc, 'Drawings & Queries', LM, yL, colW);
      drawRow(doc, 'Open overdue queries (> 3 days)',
        h.overdueQueries === 0 ? 'None' : `${h.overdueQueries} overdue`,
        h.overdueQueries === 0 ? true : false,
        LM, yL, colW); yL += 14;

      drawRow(doc, 'New drawings issued this week',
        h.newDrawings > 0 ? `${h.newDrawings} issued` : 'None issued',
        h.newDrawings > 0 ? true : 'amber',
        LM, yL, colW); yL += 14;

      drawRow(doc, 'L1 reviews stuck > 3 days',
        h.stuckL1 === 0 ? 'None stuck' : `${h.stuckL1} stuck`,
        h.stuckL1 === 0 ? true : false,
        LM, yL, colW); yL += 20;

      yL = sectionHeader(doc, 'Change Management', LM, yL, colW);
      drawRow(doc, 'Open CNs awaiting principal sign',
        h.openCNs.length === 0 ? 'None pending' : `${h.openCNs.length} pending`,
        h.openCNs.length === 0 ? true : h.openCNs.some(cn => cn.age_days > 5) ? false : 'amber',
        LM, yL, colW); yL += 14;

      if (h.openCNs.length > 0) {
        h.openCNs.slice(0,3).forEach(cn => {
          doc.fontSize(8).fillColor('#666')
             .text(`  → ${cn.cn_number}: ${cn.age_days} days pending`, LM + 8, yL);
          yL += 11;
        });
      }

      yL = sectionHeader(doc, 'Weekly Report', LM, yL, colW);
      const wrStatus = h.weeklyReport?.status;
      drawRow(doc, 'Weekly report drafted by Sun PM',
        wrStatus ? wrStatus.charAt(0).toUpperCase() + wrStatus.slice(1) : 'Not started',
        wrStatus === 'approved' ? true : wrStatus === 'draft' ? 'amber' : false,
        LM, yL, colW); yL += 14;

      // RIGHT COLUMN
      const RX = LM + colW + 10;
      yR = sectionHeader(doc, 'Schedule', RX, yR, colW);
      const drift = h.schedule.drift_days || 0;
      drawRow(doc, 'Drift from R0 baseline',
        drift === 0 ? 'On schedule' : `${drift} days drift`,
        drift === 0 ? true : drift <= 3 ? 'amber' : false,
        RX, yR, colW); yR += 14;

      drawRow(doc, 'Tasks updated this week',
        `${h.taskProgress.updated_tasks}/${h.taskProgress.total_tasks}`,
        h.taskProgress.updated_tasks >= h.taskProgress.total_tasks * 0.8 ? true : 'amber',
        RX, yR, colW); yR += 14;

      drawRow(doc, 'Average task completion',
        `${h.taskProgress.avg_pct || 0}%`,
        (h.taskProgress.avg_pct || 0) >= 50 ? true : 'amber',
        RX, yR, colW); yR += 20;

      yR = sectionHeader(doc, 'Vendor & Payments', RX, yR, colW);
      drawRow(doc, 'Pending payment requests',
        h.pendingPayments.cnt === 0 ? 'None' : `${h.pendingPayments.cnt} requests (${inrFormat(h.pendingPayments.total)})`,
        h.pendingPayments.cnt === 0 ? true : 'amber',
        RX, yR, colW); yR += 14;

      drawRow(doc, 'Oldest unpaid approved request',
        h.oldestPmt === 0 ? 'None' : `${h.oldestPmt} days`,
        h.oldestPmt === 0 ? true : h.oldestPmt <= 7 ? 'amber' : false,
        RX, yR, colW); yR += 20;

      yR = sectionHeader(doc, 'Billing & Claims', RX, yR, colW);
      drawRow(doc, 'Joint measurement this week',
        h.measThisWeek > 0 ? `${h.measThisWeek} done` : 'None',
        h.measThisWeek > 0 ? true : 'amber',
        RX, yR, colW); yR += 14;

      drawRow(doc, 'RA bills raised this week',
        h.claimsThisWeek > 0 ? `${h.claimsThisWeek} raised` : 'None',
        h.claimsThisWeek > 0 ? true : 'amber',
        RX, yR, colW); yR += 20;

      // Financial summary
      yR = sectionHeader(doc, 'Financial This Week', RX, yR, colW);
      const vendorPaid   = parseFloat(h.financials.vendor_paid   || 0);
      const clientClaimed = parseFloat(h.financials.client_claimed || 0);
      doc.fontSize(9).font('Helvetica').fillColor(NAVY);
      doc.text(`Vendor payments approved:  ${inrFormat(vendorPaid)}`,   RX + 8, yR); yR += 12;
      doc.text(`Client amount claimed:      ${inrFormat(clientClaimed)}`, RX + 8, yR); yR += 12;
      const gap = clientClaimed - vendorPaid;
      doc.font('Helvetica-Bold')
         .fillColor(gap >= 0 ? GREEN : RED)
         .text(`Net position:              ${inrFormat(gap)}`, RX + 8, yR); yR += 16;

      // ── SCORE SUMMARY
      y = Math.max(yL, yR) + 15;
      doc.moveTo(LM, y).lineTo(LM + PW, y).strokeColor('#ccc').stroke();
      y += 8;

      // Count statuses
      const items = [
        daysUpdated >= daysExpected ? 'g' : daysUpdated >= 3 ? 'a' : 'r',
        h.validated.val_count > 0 ? 'g' : 'a',
        h.unactionedFlags === 0 ? 'g' : 'r',
        h.photos.photo_days >= daysExpected ? 'g' : h.photos.photo_days >= 3 ? 'a' : 'r',
        h.overdueQueries === 0 ? 'g' : 'r',
        h.newDrawings > 0 ? 'g' : 'a',
        h.stuckL1 === 0 ? 'g' : 'r',
        h.openCNs.length === 0 ? 'g' : h.openCNs.some(cn => cn.age_days > 5) ? 'r' : 'a',
        wrStatus === 'approved' ? 'g' : wrStatus === 'draft' ? 'a' : 'r',
        drift === 0 ? 'g' : drift <= 3 ? 'a' : 'r',
        h.oldestPmt <= 7 ? 'g' : h.oldestPmt === 0 ? 'g' : 'r',
      ];
      const greens = items.filter(x => x === 'g').length;
      const ambers = items.filter(x => x === 'a').length;
      const reds   = items.filter(x => x === 'r').length;

      const overallColor = reds > 2 ? RED : ambers > 4 ? AMBER : GREEN;
      const overallLabel = reds > 2 ? 'NEEDS ATTENTION' : ambers > 4 ? 'MONITOR CLOSELY' : 'HEALTHY';

      doc.rect(LM, y, PW, 24).fill(overallColor);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('white')
         .text(`OVERALL: ${overallLabel}   ·   ${greens} GREEN  ${ambers} AMBER  ${reds} RED`,
               LM + 8, y + 6);
      doc.fillColor(NAVY);
    }

    // ── PAGE 2: DECAY ALERTS ─────────────────────────────────────────
    doc.addPage();
    let y = 40;

    doc.rect(LM, y, PW, 30).fill('#c0392b');
    doc.fontSize(14).font('Helvetica-Bold').fillColor('white')
       .text('ACTIVITY DECAY ALERTS', LM + 10, y + 8);
    doc.fillColor(NAVY);
    y += 40;

    doc.fontSize(8).font('Helvetica').fillColor('#888')
       .text('Items that were active and have gone quiet. Immediate attention required on RED items.',
             LM, y); y += 16;

    for (const { project: p, health: h } of projectData) {
      const decays = [];

      // Overdue queries
      if (h.overdueQueries > 0) {
        decays.push({ sev: 'RED',   text: `Drawing queries unanswered > 3 days: ${h.overdueQueries} open` });
      }
      // Stuck L1
      if (h.stuckL1 > 0) {
        decays.push({ sev: 'RED',   text: `Drawing at L1 review > 3 days: ${h.stuckL1} stuck` });
      }
      // Old pending payments
      if (h.oldestPmt > 7) {
        decays.push({ sev: 'RED',   text: `Vendor payment request unapproved for ${h.oldestPmt} days` });
      }
      // Unactioned flags
      if (h.unactionedFlags > 0) {
        decays.push({ sev: 'RED',   text: `Site flags not actioned within 24hrs: ${h.unactionedFlags}` });
      }
      // Old CNs at principal
      h.openCNs.filter(cn => cn.age_days > 5).forEach(cn => {
        decays.push({ sev: 'RED', text: `CN ${cn.cn_number} awaiting approval for ${cn.age_days} days` });
      });
      // Missing daily updates
      if (h.dailyUpdates.days_updated < 3) {
        decays.push({ sev: 'AMBER', text: `Daily updates missing: only ${h.dailyUpdates.days_updated}/5 days this week` });
      }
      // No photos
      if (h.photos.photo_days < 3) {
        decays.push({ sev: 'AMBER', text: `Photo uploads sparse: ${h.photos.photo_days}/5 days` });
      }
      // Weekly report not done
      if (!h.weeklyReport || h.weeklyReport.status === 'draft') {
        decays.push({ sev: 'AMBER', text: `Weekly client report not yet approved` });
      }
      // Schedule drift
      if ((h.schedule.drift_days || 0) > 3) {
        decays.push({ sev: 'RED',   text: `Schedule drift ${h.schedule.drift_days} days — approval pending` });
      }

      if (!decays.length) continue;

      // Project sub-header
      doc.rect(LM, y, PW, 16).fill(LIGHT);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
         .text(`${p.code} — ${p.name}`, LM + 6, y + 3); y += 20;

      decays.forEach(d => {
        const color = d.sev === 'RED' ? RED : AMBER;
        const icon  = d.sev === 'RED' ? '❌' : '⚠️';
        doc.rect(LM, y, 6, 12).fill(color);
        doc.fontSize(9).font('Helvetica').fillColor(NAVY)
           .text(`${icon}  ${d.text}`, LM + 12, y + 1); y += 14;
      });
      y += 8;
    }

    // ── PAGE 3: FINANCIAL SUMMARY ────────────────────────────────────
    doc.addPage();
    y = 40;

    doc.rect(LM, y, PW, 30).fill(NAVY);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('white')
       .text('FINANCIAL SUMMARY', LM + 10, y + 8);
    doc.fontSize(9).font('Helvetica').fillColor(LIGHT)
       .text(`${weekLabel}  ·  All amounts ex-GST`, LM + 10, y + 22);
    doc.fillColor(NAVY);
    y += 42;

    // Table header
    const cols = { proj: 130, paid: 90, claimed: 90, balance: 90, burnPct: 70, health: 45 };
    const headers = ['Project', 'Vendor Paid', 'Client Claimed', 'Balance', 'Progress', 'Status'];
    const colKeys = Object.keys(cols);

    doc.rect(LM, y, PW, 16).fill('#34495e');
    let cx = LM;
    headers.forEach((h2, i) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
         .text(h2, cx + 4, y + 4, { width: cols[colKeys[i]] });
      cx += cols[colKeys[i]];
    });
    y += 18;

    let grandVendorPaid = 0, grandClientClaimed = 0;
    let rowBg = false;

    for (const { project: p, health: h } of projectData) {
      const vendorPaid    = parseFloat(h.financials.vendor_paid    || 0);
      const clientClaimed = parseFloat(h.financials.client_claimed || 0);
      const progress      = h.taskProgress.avg_pct || 0;
      const drift         = h.schedule.drift_days || 0;

      grandVendorPaid    += vendorPaid;
      grandClientClaimed += clientClaimed;

      if (rowBg) doc.rect(LM, y, PW, 18).fill('#f8f9fa');
      rowBg = !rowBg;

      cx = LM;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
         .text(p.code, cx + 4, y + 4, { width: cols.proj }); cx += cols.proj;
      doc.font('Helvetica').fillColor(NAVY)
         .text(inrFormat(vendorPaid), cx + 4, y + 4, { width: cols.paid }); cx += cols.paid;
      doc.text(inrFormat(clientClaimed), cx + 4, y + 4, { width: cols.claimed }); cx += cols.claimed;
      const bal = clientClaimed - vendorPaid;
      doc.fillColor(bal >= 0 ? GREEN : RED)
         .text(inrFormat(bal), cx + 4, y + 4, { width: cols.balance }); cx += cols.balance;
      doc.fillColor(NAVY).text(`${progress}%`, cx + 4, y + 4, { width: cols.burnPct }); cx += cols.burnPct;
      const statusStr = drift === 0 ? '✅' : drift <= 3 ? '⚠️' : '❌';
      doc.text(statusStr, cx + 4, y + 4, { width: cols.health });

      y += 18;
    }

    // Totals row
    doc.rect(LM, y, PW, 20).fill(NAVY);
    cx = LM;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white')
       .text('TOTAL', cx + 4, y + 5, { width: cols.proj }); cx += cols.proj;
    doc.text(inrFormat(grandVendorPaid),    cx + 4, y + 5, { width: cols.paid });    cx += cols.paid;
    doc.text(inrFormat(grandClientClaimed), cx + 4, y + 5, { width: cols.claimed }); cx += cols.claimed;
    doc.text(inrFormat(grandClientClaimed - grandVendorPaid), cx + 4, y + 5, { width: cols.balance });

    y += 32;

    // Footer
    doc.moveTo(LM, y).lineTo(LM + PW, y).strokeColor('#ccc').stroke();
    y += 8;
    doc.fontSize(7).font('Helvetica').fillColor('#999')
       .text(
         `${firmName}${firmGstin ? '  ·  GSTIN: ' + firmGstin : ''}  ·  ` +
         'This report is auto-generated every Monday at 07:00 AM. ' +
         'Red items require immediate action. Amber items require monitoring.',
         LM, y, { align: 'center', width: PW }
       );

    doc.end();

    await new Promise((resolve, reject) => {
      ws.on('finish', resolve);
      ws.on('error', reject);
    });

    // Notify Principal and Design Principal
    try {
      const { notify } = require('../../../services/notifications');
      const totalDecays = projectData.reduce((s, { health: h }) => {
        let d = h.overdueQueries + h.stuckL1 + h.unactionedFlags;
        if (h.oldestPmt > 7) d++;
        if ((h.schedule.drift_days||0) > 3) d++;
        return s + d;
      }, 0);

      const { notifyWeeklyHealthReport } = require('../../../services/notifications');
      await notifyWeeklyHealthReport(weekLabel, projects.length, totalDecays);
    } catch(_e) { /* notification failure — non-blocking */ }

    res.json({
      success:    true,
      file_url:   fileUrls.fileUrl(outPath, { defaultSubdir: 'documents' }),
      file_name:  `WeeklyHealthReport_${weekEnd}.pdf`,
      week:       weekLabel,
      projects:   projects.length,
      message:    'Report generated — Principal and Design Principal notified via WhatsApp'
    });

  }));

// GET /api/weekly-health/summary — JSON summary for in-app Health tab
router.get('/summary', requireAuth, requireRole(...FINANCE_ROLES), asyncHandler(async (req, res) => {
  const Onboarding = require('../../onboarding/contract');
  const projects = await Onboarding.functions.getActiveProjects();

  if (!projects.length) {
    return res.json({ projects: [] });
  }

  // Batch all per-project queries — replaces N*5 queries with 5 total.
  const projectIds = projects.map(p => p.id);

  const [scheduleRows] = await db.query(
    `SELECT project_id, drift_days, label
       FROM schedule_versions WHERE project_id IN (?) AND is_current = 1`,
    [projectIds]
  );
  const scheduleMap = new Map(scheduleRows.map(r => [r.project_id, r]));

  const [issueCounts] = await db.query(
    `SELECT project_id, COUNT(*) AS cnt
       FROM issues WHERE project_id IN (?) AND status NOT IN ('closed')
       GROUP BY project_id`,
    [projectIds]
  );
  const issueMap = new Map(issueCounts.map(r => [r.project_id, Number(r.cnt)]));

  const [pmtCounts] = await db.query(
    `SELECT project_id, COUNT(*) AS cnt
       FROM vendor_payments WHERE project_id IN (?) AND status = 'pending'
       GROUP BY project_id`,
    [projectIds]
  );
  const pmtMap = new Map(pmtCounts.map(r => [r.project_id, Number(r.cnt)]));

  const [cnCounts] = await db.query(
    `SELECT project_id, COUNT(*) AS cnt
       FROM change_notices WHERE project_id IN (?) AND status NOT IN ('approved','rejected')
       GROUP BY project_id`,
    [projectIds]
  );
  const cnMap = new Map(cnCounts.map(r => [r.project_id, Number(r.cnt)]));

  // Risk narratives: fetch all within 4 weeks, slice top-4 per project in JS.
  const [allRiskNarratives] = await db.query(
    `SELECT project_id, trade, gap_pct, narrative, escalation_level
       FROM schedule_risk_narratives
       WHERE project_id IN (?) AND week_ending >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
       ORDER BY week_ending DESC, gap_pct DESC`,
    [projectIds]
  );
  const riskMap = new Map();
  for (const rn of allRiskNarratives) {
    if (!riskMap.has(rn.project_id)) riskMap.set(rn.project_id, []);
    const arr = riskMap.get(rn.project_id);
    if (arr.length < 4) arr.push(rn);
  }

  const results = projects.map(p => {
    const schedule    = scheduleMap.get(p.id);
    const drift       = schedule?.drift_days || 0;
    const healthStatus = drift > 14 ? 'at_risk' : drift > 7 ? 'caution' : 'active';
    return {
      id:               p.id,
      name:             p.name,
      code:             p.code,
      client_name:      p.client || '—',
      health_status:    healthStatus,
      schedule:         { drift_days: drift, label: schedule?.label || 'R0' },
      open_issues:      issueMap.get(p.id)  || 0,
      open_cns:         cnMap.get(p.id)     || 0,
      riskNarratives:   riskMap.get(p.id)   || [],
    };
  });

  res.json({ projects: results });
}));

// GET /api/weekly-health/schedule -- show when next report runs
router.get('/schedule', requireAuth, asyncHandler(async (req, res) => {
  const today   = new Date();
  const nextMon = new Date(today);
  const daysUntilMon = (8 - today.getDay()) % 7 || 7;
  nextMon.setDate(today.getDate() + daysUntilMon);
  nextMon.setHours(7, 0, 0, 0);
  const principalUsers = await users.principals(['full_name']);
  res.json({
    report_day:  'Monday',
    report_time: '07:00 AM',
    next_run:    nextMon.toISOString(),
    recipients:  principalUsers.map(u => u.full_name),
    delivery:    ['WhatsApp summary', 'PDF in-app']
  });
}));

module.exports = router;
