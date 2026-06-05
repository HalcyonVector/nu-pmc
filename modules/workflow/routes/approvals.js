// routes/approvals.js
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { requireAuth, requirePrincipal, requireRole } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router  = express.Router();

// GET /api/approvals — all pending approvals visible to this user.
//
// Build-commit lock #8: ONE endpoint reads from BOTH wa_pending_actions
// (legacy single-approval) AND approvals (unified single + multi-signer).
// Each row carries a `source` field ('legacy' | 'unified') so the frontend
// knows which POST endpoint to dispatch the approve/reject action to.
//
// User filtering rules:
//   LEGACY: principals see all pending; pmc_head sees own + all pending;
//           others see only own.
//   UNIFIED: filtered by services/approvals.pendingForUser() — role gate
//           against signer_roles_json + project membership for project-scoped.
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const isPrincipal = ['principal','design_principal'].includes(me.role);
    const isPMC       = me.role === 'pmc_head';

    // ── LEGACY: wa_pending_actions ──────────────────────────────────────
    let where = '';
    const params = [];

    if (isPrincipal) {
      where = "WHERE ar.status = 'pending'";
    } else if (isPMC) {
      where = "WHERE ar.user_id = ? OR ar.status = 'pending'";
      params.push(me.id);
    } else {
      where = "WHERE ar.user_id = ?";
      params.push(me.id);
    }

    const [legacyRows] = await db.query(
      `SELECT ar.* FROM wa_pending_actions ar
       WHERE ar.channel IN ('app','both')${where ? ' AND ' + where.replace(/^\s*WHERE\s+/i, '') : ''}
       ORDER BY ar.status ASC, ar.raised_at DESC`,
      params
    );
    const Onboarding = require('../../onboarding/contract');
    const projs = await Onboarding.functions.getProjectsByIds(legacyRows.map(a => a.project_id));
    legacyRows.forEach(a => {
      a.project_name = projs.get(a.project_id)?.name || null;
      a.project_code = projs.get(a.project_id)?.code || null;
    });
    const Auth = require('../../auth/contract');
    const userMap = await Auth.functions.getUsers(
      legacyRows.flatMap(a => [a.user_id, a.raised_by].filter(Boolean))
    );
    legacyRows.forEach(a => {
      a.user_id_name      = userMap.get(a.raised_by)?.full_name     || null;
      a.actioned_by_name  = ['approved','rejected','acted'].includes(a.status) ? (userMap.get(a.user_id)?.full_name || null) : null;
    });

    // ── UNIFIED: approvals (build-commit lock #7) ───────────────────────
    // pendingForUser already handles role/project/self-vote/already-voted
    // filtering. We map its rows to a shape consistent with legacyRows so
    // the frontend can render one merged list.
    //
    // session.user.projects is shaped [{id, code, name, ...}] (from
    // loadProjectsForUser in modules/auth/routes/auth.js) — NOT {project_id}.
    const approvalsService = require('../../../services/approvals');
    const projectIds = (me.projects || []).map(p => p.id).filter(Boolean);
    const unifiedRaw = await approvalsService.pendingForUser({
      userId: me.id, role: me.role, projectIds,
    });
    // Hydrate project name on unified rows (pendingForUser doesn't join projects)
    const unifiedProjs = await Onboarding.functions.getProjectsByIds(unifiedRaw.map(u => u.project_id));
    const unifiedRows = unifiedRaw.map(u => ({
      // Common shape (matches legacy fields the frontend already reads)
      id: u.id,
      action_type: u.approval_type,
      title: u.title,
      details: u.details,
      project_id: u.project_id,
      project_name: u.project_id ? (unifiedProjs.get(u.project_id)?.name || null) : null,
      project_code: u.project_id ? (unifiedProjs.get(u.project_id)?.code || null) : null,
      raised_at: u.raised_at,
      status: 'pending',
      user_id: u.raised_by,
      user_id_name: u.raised_by_name || null,
      // Unified-specific
      label: u.label,
      quorum: u.quorum,
      expires_at: u.expires_at,
      vendor_id: u.vendor_id,
      ref_table: u.ref_table,
      ref_id: u.ref_id,
    }));

    // ── Tag source so the frontend dispatches POST to the correct endpoint
    legacyRows.forEach(r => { r.source = 'legacy'; });
    unifiedRows.forEach(r => { r.source = 'unified'; });

    // ── Merge + sort by raised_at desc (newest first); pendings ahead of
    // resolved-but-still-visible legacy rows. Unified rows are always
    // pending (pendingForUser filtered out resolved).
    const merged = [...legacyRows, ...unifiedRows].sort((a, b) => {
      // status: pending (any non-pending = '') first, then by raised_at desc
      const aPending = a.status === 'pending' ? 0 : 1;
      const bPending = b.status === 'pending' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      const aTs = new Date(a.raised_at || 0).getTime();
      const bTs = new Date(b.raised_at || 0).getTime();
      return bTs - aTs;
    });

    res.json({ approvals: merged });
  }));

// POST /api/approvals — raise approval request
// W3: tightened to roles that legitimately raise approval requests (heads,
// PMC, finance, principals). Previously any auth user could spawn rows in
// wa_pending_actions — a spam vector even though it didn't escalate.
//
// D1 NOTE: this endpoint writes to the legacy wa_pending_actions table.
// Currently called from the PMC "Raise Schedule Change / Raise Weekly Report"
// buttons in the approvals view (public/js/app.js showRaiseApproval). When
// the unified approvals API gains config rows for these workflows (Naveen
// must approve signer/quorum), migrate the frontend to /approvals/v2 and
// then this endpoint can be deleted.
const APPROVAL_RAISERS = ['principal','design_principal','pmc_head','design_head','services_head','finance_admin'];
router.post('/', requireAuth, requireRole(...APPROVAL_RAISERS), asyncHandler(async (req, res) => {
    const { project_id, action_type, message_sent, drift_days } = req.body;
    if (!project_id || !action_type || !message_sent) return res.status(400).json({ error: 'Missing required fields' });

    const [result] = await db.query(
      'INSERT INTO wa_pending_actions (action_type, ref_id, ref_table, phone, user_id, raised_by, message_sent, expires_at, channel) VALUES (?,?,?,?,?,?,?,DATE_ADD(NOW(), INTERVAL 7 DAY),?)',
      [action_type, 0, 'general', '', null, req.session.user.id, message_sent, 'app']
    );

    audit.log({ userId: req.session.user.id, action: 'approval.create',
      entityType: 'wa_pending_actions', entityId: result.insertId,
      details: { action_type, project_id: parseInt(project_id), drift_days: drift_days || null }, req });

    // Notify principals
    const { notifyApprovalNeeded } = require('../../../services/notifications');
    const proj = { name: await users.projectName(project_id) };
    notifyApprovalNeeded(action_type, message_sent, proj?.name||'').catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));

    res.json({ success: true, id: result.insertId });

  }));

// POST /api/approvals/:id/approve
router.post('/:id/approve', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
    const [[ar]] = await db.query(`SELECT * FROM wa_pending_actions WHERE channel IN ('app','both') AND id = ?`, [req.params.id]);
    if (!ar) return res.status(404).json({ error: 'Not found' });

    // W3: state guard — block re-approval / late-approval of already-actioned requests.
    if (ar.status === 'approved') {
      return res.status(400).json({ error: 'Already approved', current_status: ar.status });
    }
    if (ar.status === 'rejected') {
      return res.status(400).json({ error: 'Already rejected — cannot approve', current_status: ar.status });
    }

    // W1: approval status UPDATE + (for schedule_change) promoteScheduleVersion's
    // own two UPDATEs were three separate writes. A failure between them left
    // the approval recorded as 'approved' but no schedule version current, OR
    // demoted-old-without-elevating-new. All three writes now share one tx so
    // the whole approval either commits or rolls back. promoteScheduleVersion
    // accepts an optional `conn` (added in v5.14 contract change) — when not
    // a schedule_change, the second-and-third writes are skipped, the tx
    // wraps just the one approval status UPDATE.
    let promoted = null;
    let weeklyReportData = null;
    await db.tx(async (conn) => {
      await conn.query(
        'UPDATE wa_pending_actions SET status = ?, user_id = ?, actioned_at = NOW() WHERE id = ?',
        ['approved', req.session.user.id, req.params.id]
      );

      // Schedule change — promote the new schedule version inside the same tx
      if (ar.action_type === 'schedule_change' && ar.ref_table === 'schedule_versions' && ar.ref_id) {
        const DS = require('../../design-services/contract');
        promoted = await DS.functions.promoteScheduleVersion(ar.ref_id, ar.project_id, req.session.user.id, conn);
      }

      // Weekly report — fetch payload inside tx so the read is consistent
      if (ar.action_type === 'weekly_report') {
        const [wrRows] = await conn.query('SELECT summary, issues_for_client, week_number FROM weekly_reports WHERE id = ?', [ar.ref_id||0]);
        weeklyReportData = wrRows?.[0] || null;
      }
    });

    // Audit AFTER tx commits — record reflects the actual committed state
    audit.log({ userId: req.session.user.id, action: 'approval.approve',
      entityType: 'wa_pending_actions', entityId: parseInt(req.params.id),
      details: { action_type: ar.action_type, ref_table: ar.ref_table, ref_id: ar.ref_id, project_id: ar.project_id }, req });

    // Side-effects after tx — notifications, checklist flags. These do not
    // need to be atomic with the approval write.
    if (ar.action_type === 'schedule_change' && promoted) {
      const Onboarding = require('../../onboarding/contract');
      await Onboarding.functions.setChecklistFlag(ar.project_id, 'checklist_schedule').catch(e => console.warn('[checklist setChecklistFlag] swallowed:', e.message));
      try {
        const { notifyScheduleApproved } = require('../../../services/notifications');
        notifyScheduleApproved(ar.project_id, promoted?.label||'', promoted?.drift_days||0).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
      } catch(_e) { /* notification failure — non-blocking */ }
    }
    if (ar.action_type === 'weekly_report' && weeklyReportData) {
      try {
        const { notifyWeeklyReportApproved } = require('../../../services/notifications');
        notifyWeeklyReportApproved(ar.project_id, weeklyReportData.week_number, weeklyReportData.summary||'', weeklyReportData.issues_for_client||'').catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
      } catch(_e) { /* notification failure — non-blocking */ }
    }

    res.json({ success: true });

  }));

// POST /api/approvals/:id/reject
router.post('/:id/reject', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
    const { rejection_note } = req.body;
    const [[ar]] = await db.query(`SELECT action_type, ref_table, ref_id, project_id, status FROM wa_pending_actions WHERE id = ?`, [req.params.id]);
    if (!ar) return res.status(404).json({ error: 'Not found' });

    // W2: state guard — match the approve endpoint. Rejecting an already-actioned
    // request was silently overwriting status; now blocked.
    if (ar.status === 'rejected') {
      return res.status(400).json({ error: 'Already rejected', current_status: ar.status });
    }
    if (ar.status === 'approved') {
      return res.status(400).json({ error: 'Already approved — cannot reject', current_status: ar.status });
    }

    await db.query(
      'UPDATE wa_pending_actions SET status = ?, user_id = ?, actioned_at = NOW(), rejection_note = ? WHERE id = ?',
      ['rejected', req.session.user.id, rejection_note || 'No reason given', req.params.id]
    );
    audit.log({ userId: req.session.user.id, action: 'approval.reject',
      entityType: 'wa_pending_actions', entityId: parseInt(req.params.id),
      details: { action_type: ar?.action_type, ref_table: ar?.ref_table, ref_id: ar?.ref_id, project_id: ar?.project_id, rejection_note: rejection_note || 'No reason given' }, req });
    res.json({ success: true });
  }));

module.exports = router;

// ════════════════════════════════════════════════════════════════════════════
// UNIFIED API (build-commit lock #7) — /api/approvals/v2/*
// These endpoints operate on the new approvals + approval_signoffs tables.
// The merged GET above tags rows with source='unified' so the frontend
// knows to call these endpoints rather than the legacy /:id/approve path.
// ════════════════════════════════════════════════════════════════════════════

const approvalsService = require('../../../services/approvals');

// GET /api/approvals/v2/:id — single approval row + its signoffs
router.get('/v2/:id', requireAuth, asyncHandler(async (req, res) => {
  const result = await approvalsService.get(parseInt(req.params.id, 10));
  if (!result) return res.status(404).json({ error: 'Approval not found' });
  res.json(result);
}));

// POST /api/approvals/v2/:id/vote — cast a vote on a unified approval
// Body: { vote: 'approve' | 'reject', comment?: string }
//
// Quorum + reject-veto rules live in the service. The route enforces
// auth (requireAuth), then delegates. The service raises ApprovalError
// with status codes 400/403/404/409 — translate those to HTTP responses.
router.post('/v2/:id/vote', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const { vote, comment } = req.body || {};
  try {
    const r = await approvalsService.vote({
      approvalId: parseInt(req.params.id, 10),
      signerId: me.id,
      signerRole: me.role,
      vote,
      comment: comment || null,
    });
    audit.log({
      userId: me.id,
      action: r.newStatus === 'approved' ? 'approval.v2.approved'
            : r.newStatus === 'rejected' ? 'approval.v2.rejected'
            : 'approval.v2.voted',
      entityType: 'approvals',
      entityId: parseInt(req.params.id, 10),
      details: { vote, quorum_progress: r.quorumProgress },
      req,
    });
    res.json({ success: true, ...r });
  } catch (err) {
    if (err.name === 'ApprovalError') {
      return res.status(err.status || 400).json({ error: err.message, code: err.code });
    }
    throw err;
  }
}));

// POST /api/approvals/v2/:id/cancel — proposer withdraws their approval
// Body: { reason?: string }
router.post('/v2/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const { reason } = req.body || {};
  // Only the proposer may cancel — verify by reading the approval first.
  const result = await approvalsService.get(parseInt(req.params.id, 10));
  if (!result) return res.status(404).json({ error: 'Approval not found' });
  if (result.approval.raised_by !== me.id) {
    return res.status(403).json({
      error: 'Only the proposer may cancel an approval',
      code: 'NOT_PROPOSER',
    });
  }
  if (result.approval.status !== 'pending') {
    return res.status(409).json({
      error: `Approval is ${result.approval.status} — cannot cancel`,
      code: 'NOT_PENDING',
    });
  }
  const r = await approvalsService.cancel({
    approvalId: parseInt(req.params.id, 10),
    cancelledBy: me.id,
    reason: reason || null,
  });
  // TOCTOU: between the route's status-check above and the UPDATE inside
  // cancel(), another signer's vote could have flipped status to approved/
  // rejected. The cancel() UPDATE is gated on `status = 'pending'`, so it
  // affects 0 rows in that case. Surface that to the client (409) instead
  // of silently returning success — the proposer needs to know their
  // cancel didn't take effect.
  if (!r.cancelled) {
    return res.status(409).json({
      error: 'Approval status changed before cancel could take effect',
      code: 'CANCEL_RACED',
    });
  }
  audit.log({
    userId: me.id,
    action: 'approval.v2.cancelled',
    entityType: 'approvals',
    entityId: parseInt(req.params.id, 10),
    details: { reason: reason || null },
    req,
  });
  res.json({ success: true, ...r });
}));
