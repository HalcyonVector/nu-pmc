/* eslint-disable no-undef */
// routes/issues.js — Issue log, five types, type-based routing, 1/2 day escalation
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { validators } = require('../../../middleware/validate');
const { requireAuth, requirePMC, requireRole, requireProjectScope, requireScopeFromEntity } = require('../../../middleware/auth');
const { requirePermission } = require('../../../middleware/permissions');
const { upload } = require('../../../middleware/upload');
const notif   = require('../../../services/notifications');
const router        = express.Router();

// (waInteractive / waReply imports removed — only the issue-create
// flow used them, now migrated to services/signoff-gate.)
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const { generate: generateSeq, insertWithRetry } = require('../../../services/sequence');
const { STREAM_HEADS_OR_PRINCIPAL: STREAM_HEADS } = require('../../../services/roles');

// Auto-routing by issue type
const TYPE_ROUTING = {
  design:     { role: 'design_head',    whatsapp: false, requires_pmc_confirm: false },
  rfi:        { role: 'design_head',    whatsapp: false, requires_pmc_confirm: false },
  safety:     { role: 'pmc_head',       whatsapp: false, requires_pmc_confirm: true  },
  quality:    { role: 'pmc_head',       whatsapp: false, requires_pmc_confirm: true  },
  compliance: { role: 'pmc_head',       whatsapp: false, requires_pmc_confirm: true  },
};

async function getProjectAssignee(projectId, role) {
  const Auth = require('../../auth/contract');
  const users = await Auth.functions.getUsersByRole(role, projectId);
  return users[0] || null;
}

// GET /api/issues/:project_id
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { type, status } = req.query;
    let q = `SELECT * FROM issues WHERE project_id = ?`;
    const params = [req.params.project_id];
    if (type)   { q += ' AND issue_type = ?';  params.push(type); }
    if (status) { q += ' AND status = ?';       params.push(status); }
    q += ' ORDER BY raised_at DESC';
    const [issues] = await db.query(q, params);
    // Bulk hydrate user names via Auth contract (avoids N+1)
    const Auth = require('../../auth/contract');
    const userIds = issues.flatMap(i => [i.raised_by, i.assigned_to, i.confirmed_by].filter(Boolean));
    const users = await Auth.functions.getUsers(userIds);
    // Bulk hydrate vendor names via Onboarding contract
    const Onboarding = require('../../onboarding/contract');
    const vendors = await Onboarding.functions.getVendorsByIds(issues.map(i => i.assigned_vendor_id));
    issues.forEach(i => {
      i.raised_by_name    = users.get(i.raised_by)?.full_name || null;
      i.assigned_to_name  = users.get(i.assigned_to)?.full_name || null;
      i.confirmed_by_name = users.get(i.confirmed_by)?.full_name || null;
      i.vendor_name       = vendors.get(i.assigned_vendor_id)?.vendor_name || null;
    });
    res.json({ issues });
  }));

// POST /api/issues/:project_id — raise issue (any team member)
router.post('/:project_id', requireAuth, requireProjectScope(), upload.single('photo'), asyncHandler(async (req, res) => {
    const { IssueCreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(IssueCreate, req, res);
    if (!body) return;

    const routing     = TYPE_ROUTING[body.issue_type] || TYPE_ROUTING.quality;

    // Find default assignee based on type
    let assignedTo = body.assigned_to;
    if (!assignedTo && body.issue_type !== 'safety') {
      // Safety stays with PMC — others route by type
      const assignee = await getProjectAssignee(req.params.project_id, routing.role);
      assignedTo = assignee?.id || null;
    }

    // Design and RFI issues bypass PMC confirmation — route direct to design head
    const requiresConfirm = TYPE_ROUTING[body.issue_type]?.requires_pmc_confirm !== false;
    const initialStatus   = requiresConfirm ? 'draft' : 'open';
    const confirmedBy     = requiresConfirm ? null : req.session.user.id;
    const confirmedAt     = requiresConfirm ? null : new Date();

    // Atomic number generation — regen on ER_DUP_ENTRY (concurrent creates)
    let issueNumber, result;
    await insertWithRetry(async () => {
      issueNumber = await generateSeq({
        table: 'issues', numberCol: 'issue_number', projectId: req.params.project_id,
        prefix: 'ISS-', pad: 3,
      });
      const [r] = await db.query(
        `INSERT INTO issues (project_id, issue_number, issue_type, title, description,
         raised_by, assigned_to, drawing_id, location, due_date, file_path,
         status, confirmed_by, confirmed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.params.project_id, issueNumber, body.issue_type, body.title, body.description,
         req.session.user.id, assignedTo, body.drawing_id, body.location,
         body.due_date, req.file?.path||null, initialStatus, confirmedBy, confirmedAt]
      );
      result = r;
    });

    // Send interactive button to PMC for safety/quality — or notify assignee for auto-routed
    try {
      if (requiresConfirm) {
        // Phase 3: replaced WhatsApp dispatch + waReply.registerPendingAction
        // with single signoff-gate.triggerSignoff('issue_confirm', ...).
        // Per signoff_workflows seed, this resolves to the project's PMC
        // head via 'pmc' sequence (not a loop over all pmc_heads — the
        // gate picks one per project_assignments).
        const signoffGate = require('../../../services/signoff-gate');
        await signoffGate.triggerSignoff(
          'issue_confirm',
          result.insertId,
          parseInt(req.params.project_id, 10),
          {
            question: `Issue ${issueNumber} (${body.issue_type}) — ${body.title}. Confirm?`,
            documentRow: { id: result.insertId, raised_by: req.session.user.id },
            triggeredBy:  req.session.user.id,
          }
        ).catch(e => console.warn('[issues signoffGate.triggerSignoff]', e.message));
      } else if (assignedTo) {
        // Auto-routed — notify assignee in-app
        await notif.notify(assignedTo, 'issue_auto', `Issue ${issueNumber} auto-assigned to you — ${body.title}`);
      }
    } catch (_ne) { /* non-blocking */ }

    audit.log({ userId: req.session.user.id, action: 'issue.create',
      entityType: 'issues', entityId: result.insertId,
      details: { project_id: parseInt(req.params.project_id), issue_type: body.issue_type, issue_number: issueNumber, status: initialStatus, assigned_to: assignedTo }, req });

    res.json({
      success: true, id: result.insertId, issue_number: issueNumber,
      message: requiresConfirm
        ? `Issue ${issueNumber} raised — PMC notified for confirmation.`
        : `Issue ${issueNumber} raised — routed directly to ${routing.role.replace('_',' ')}.`,
    });
  }));

// PATCH /api/issues/:id/confirm — PMC Head confirms, enters register
router.patch('/:id/confirm', requireAuth, requireScopeFromEntity('issues'), requirePMC, asyncHandler(async (req, res) => {
    const { assigned_to, assigned_vendor_id, due_date } = req.body;
    const [[issue]] = await db.query('SELECT * FROM issues WHERE id = ?', [req.params.id]);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: issue.status, to: 'open',
        extraCols: {
          confirmed_by: req.session.user.id,
          confirmed_at: new Date(),
          assigned_to:        assigned_to        || issue.assigned_to,
          assigned_vendor_id: assigned_vendor_id || issue.assigned_vendor_id,
          due_date:           due_date           || issue.due_date,
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }

    // Notify assignee
    if (assigned_to || issue.assigned_to) {
      const uid = assigned_to || issue.assigned_to;
      await notif.notify(uid, 'issue', `Issue ${issue.issue_number} assigned to you — ${issue.title}. Due: ${due_date||issue.due_date}.`);
    }

    // Vendor WhatsApp if site issue
    if (assigned_vendor_id || issue.assigned_vendor_id) {
      const vid = assigned_vendor_id || issue.assigned_vendor_id;
      const Onboarding = require('../../onboarding/contract');
      const vMap = await Onboarding.functions.getVendorsByIds([vid]);
      const vendor = vMap.get(vid);
      if (vendor?.phone) {
        await notif.notifyVendorDefectRaised(vendor.phone, issue.project_id, issue.description);
      }
    }

    audit.log({ userId: req.session.user.id, action: 'issue.confirm',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { project_id: issue.project_id, assigned_to: assigned_to || issue.assigned_to, assigned_vendor_id: assigned_vendor_id || issue.assigned_vendor_id }, req });

    res.json({ success: true, message: `Issue ${issue.issue_number} confirmed — entered into register.` });
  }));

// PATCH /api/issues/:id/rfi-respond — design team responds to RFI
router.patch('/:id/rfi-respond', requireAuth, requireScopeFromEntity('issues'), requireRole(...STREAM_HEADS), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { rfi_response } = req.body;
    if (!rfi_response) return res.status(400).json({ error: 'Response text required' });
    const [[cur]] = await db.query('SELECT status FROM issues WHERE id=? AND issue_type="rfi"', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'RFI not found' });
    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: cur.status, to: 'resolved',
        extraCols: {
          rfi_response, rfi_responded_by: me.id, rfi_responded_at: new Date(),
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: me.id, action: 'issue.rfi_respond',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { response_length: rfi_response.length }, req });
    res.json({ success: true, message: 'RFI response recorded — issue resolved.' });
  }));

// PATCH /api/issues/:id/resolve
router.patch('/:id/resolve', requireAuth, requireScopeFromEntity('issues'), asyncHandler(async (req, res) => {
    const { resolution_note } = req.body;
    const me = req.session.user;
    const [[issue]] = await db.query('SELECT * FROM issues WHERE id = ?', [req.params.id]);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    // State machine guard: resolving is valid only from 'open' or 'in_progress'.
    // 'draft' needs confirm first, 'resolved' is already done, 'closed'
    // needs reopen first, 'dismissed' is terminal.
    const VALID_FROM = ['open', 'in_progress'];
    if (!VALID_FROM.includes(issue.status)) {
      return res.status(400).json({
        error: `Cannot resolve from status '${issue.status}'. Issue must be open or in_progress.`,
      });
    }

    const canResolve = issue.assigned_to === me.id ||
      ['pmc_head','design_head','services_head','principal','design_principal','site_manager','senior_site_manager'].includes(me.role);
    if (!canResolve) return res.status(403).json({ error: 'Not authorised to resolve this issue' });

    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: issue.status, to: 'resolved',
        extraCols: {
          resolved_by: me.id, resolved_at: new Date(),
          resolution_note: resolution_note || null,
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: me.id, action: 'issue.resolve',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { from: issue.status, to: 'resolved' }, req });
    res.json({ success: true });
  }));

// PATCH /api/issues/:id/close — close a resolved issue (Bug #16 fix)
// Only PMC / Principal / DP can close. Must be in 'resolved' status.
router.patch('/:id/close',
  requireAuth,
  requireScopeFromEntity('issues'),
  requirePermission('pmc.issue.close-resolved'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[issue]] = await db.query('SELECT status FROM issues WHERE id = ?', [req.params.id]);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (issue.status !== 'resolved') {
      return res.status(400).json({ error: `Cannot close from status '${issue.status}'. Issue must be resolved first.` });
    }
    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: 'resolved', to: 'closed',
        extraCols: { closed_by: me.id, closed_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: me.id, action: 'issue.close',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { from: 'resolved', to: 'closed' }, req });
    res.json({ success: true });
  }));

// PATCH /api/issues/:id/reopen — reopen a closed issue (Bug #16 fix)
// Only PMC / Principal / DP can reopen. Must be 'closed' or 'dismissed'.
router.patch('/:id/reopen',
  requireAuth,
  requireScopeFromEntity('issues'),
  requirePermission('pmc.issue.reactivate'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { reason } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'Reopen reason required (min 5 chars)' });
    }
    const [[issue]] = await db.query('SELECT status, resolution_note FROM issues WHERE id = ?', [req.params.id]);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (!['closed','dismissed'].includes(issue.status)) {
      return res.status(400).json({ error: `Cannot reopen from status '${issue.status}'` });
    }
    // Keep the old resolution note visible in the trail by prefixing with a reopen marker
    const newNote = (issue.resolution_note || '') +
      `\n\n[REOPENED ${new Date().toISOString().slice(0,10)} by ${me.full_name || me.username}] ${reason.trim()}`;
    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: issue.status, to: 'open',
        extraCols: {
          resolution_note: newNote.trim(),
          resolved_by: null, resolved_at: null,
          closed_by: null, closed_at: null,
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: me.id, action: 'issue.reopen',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { from: issue.status, to: 'open', reason: reason.trim() }, req });
    res.json({ success: true });
  }));

// POST /api/issues/:project_id/photo-rfi — raise photo request as RFI
router.post('/:project_id/photo-rfi', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const canRaise = ['design_head','services_head','pmc_head',
                      'principal','design_principal'].includes(me.role);
    if (!canRaise) return res.status(403).json({ error: 'Design heads and PMC only' });

    const { title, description, location, deadline_date, assigned_to_site, response_type } = req.body;
    if (!title || !description || !deadline_date || !assigned_to_site) {
      return res.status(400).json({ error: 'Title, description, deadline and site manager required' });
    }

    // Get next issue number + insert with retry on UNIQUE race (see services/sequence.js)
    const { insertId: issueId, number: issueNumber } = await insertWithRetry(async () => {
      const n = await generateSeq({
        table: 'issues',
        numberCol: 'issue_number',
        projectId: req.params.project_id,
        prefix: 'ISS-',
        pad: 3,
      });
      const [result] = await db.query(
        `INSERT INTO issues
         (project_id, issue_number, issue_type, title, description, raised_by,
          location, due_date, response_type, photo_deadline, assigned_to_site,
          status, confirmed_by, confirmed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'open',?,NOW())`,
        [req.params.project_id, n, 'rfi', title, description, me.id,
         location||null, deadline_date, response_type||'photo',
         deadline_date, assigned_to_site, me.id]
      );
      return { insertId: result.insertId, number: n };
    });

    // Get site manager details
    const sm = await users.userContact(assigned_to_site);
    const proj = { name: await users.projectName(req.params.project_id) };

    // Matrix DM to site manager with PWA deep link.
    if (sm?.matrix_room_id) {
      const matrixAdapter = require('../../../services/matrix-adapter');
      const deadline = new Date(deadline_date).toLocaleDateString('en-IN',
        { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
      const pwaUrl = `${process.env.PWA_BASE_URL}/issues/${issueId}/photos`;
      await matrixAdapter.sendText({
        roomId: sm.matrix_room_id,
        body: `📋 Photo requested — ${title.substring(0,60)}` +
              (location ? `\nLocation: ${location.substring(0,30)}` : '') +
              `\nNeeded by: ${deadline}\n${pwaUrl}`,
        recipientUid: parseInt(assigned_to_site),
      }).catch(e => console.warn('[issues.photo-rfi] Matrix DM failed:', e.message));
    }

    audit.log({ userId: me.id, action: 'issue.photo_rfi.create',
      entityType: 'issues', entityId: issueId,
      details: { project_id: parseInt(req.params.project_id), issue_number: issueNumber, assigned_to_site, deadline_date }, req });

    res.json({
      success: true, id: issueId, issue_number: issueNumber,
      message: 'Photo request sent to ' + (sm?.full_name||'site manager'),
    });
  }));

// GET /api/issues/:id/photos — get all photos for a photo RFI
router.get('/:id/photos', requireAuth, requireScopeFromEntity('issues'), asyncHandler(async (req, res) => {
    const [photos] = await db.query(
      `SELECT * FROM issue_photos WHERE issue_id = ? ORDER BY submitted_at`,
      [req.params.id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(photos.map(p => p.submitted_by).filter(Boolean));
    photos.forEach(p => { p.submitted_by_name = users.get(p.submitted_by)?.full_name || null; });
    res.json({ photos });
  }));

// PATCH /api/issues/:id/dismiss — PMC dismisses a draft/open issue
// Stamps closed_by + closed_at (migration v4.4 columns) for audit trail parity
// with /:id/close. audit.log line makes the admin action discoverable in the log.
router.patch('/:id/dismiss', requireAuth, requireScopeFromEntity('issues'), requirePMC, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const [[cur]] = await db.query('SELECT status FROM issues WHERE id=?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Issue not found' });
  if (cur.status === 'closed') return res.json({ success: true });   // idempotent — already dismissed
  const sm = require('../../../services/state-machines').issue;
  try {
    await sm.transition({
      id: parseInt(req.params.id), from: cur.status, to: 'closed',
      extraCols: { closed_by: me.id, closed_at: new Date() },
    });
  } catch (err) { return sm.handleRouteError(err, res); }
  audit.log({ userId: me.id, action: 'issue.dismiss',
    entityType: 'issues', entityId: parseInt(req.params.id),
    details: { from: cur.status, to: 'closed', reason: 'dismissed by PMC' }, req });
  res.json({ success: true });
}));

// NOTE: PATCH /:id/close-photo-rfi was deleted 2026-04-21 (D-02).
// It was unreachable (no frontend/backend/webhook caller) AND used the wrong
// columns (resolved_by/resolved_at for a status='closed' transition — incorrect
// since v4.4 migration added closed_by/closed_at). If "requester closes own
// photo-RFI" UX is needed in future, reimplement with correct columns and
// explicit permission check (currently handler had no role gate at all).

// =====================================================================
// RFI ENDPOINTS — issues with issue_type='rfi' and drawing_version_id set
// (Previously /api/queries — folded into issues in v2.)
// =====================================================================

// Pick a smart assignee based on prior stream-head routing for this project
async function _getSmartAssignee(projectId, stream) {
  const [[prev]] = await db.query(
    `SELECT assigned_to FROM issues WHERE project_id=? AND query_stream=? AND assigned_to IS NOT NULL
     ORDER BY raised_at DESC LIMIT 1`, [projectId, stream]
  );
  if (prev?.assigned_to) return prev.assigned_to;
  const role = stream === 'design' ? 'design_head' : 'services_head';
  const Auth = require('../../auth/contract');
  const users = await Auth.functions.getUsersByRole(role, projectId);
  return users[0]?.id || null;
}

// GET /api/issues/rfi/:project_id — drawing-linked RFIs
router.get('/rfi/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const [rows] = await db.query(
      `SELECT *
       FROM issues
       WHERE project_id = ? AND issue_type = 'rfi' AND drawing_version_id IS NOT NULL
       ORDER BY raised_at DESC`,
      [req.params.project_id]
    );
    const DS = require('../../design-services/contract');
    const ctx = await DS.functions.getDrawingContextByVersionIds(rows.map(r => r.drawing_version_id));
    rows.forEach(r => {
      const c = ctx.get(r.drawing_version_id);
      r.drawing_file   = c?.file_path    || null;
      r.drawing_number = c?.drawing_number || null;
      r.drawing_name   = c?.drawing_name || null;
    });
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(rows.flatMap(r => [r.raised_by, r.assigned_to].filter(Boolean)));
    rows.forEach(r => {
      r.raised_by_name   = users.get(r.raised_by)?.full_name || null;
      r.assigned_to_name = users.get(r.assigned_to)?.full_name || null;
    });
    res.json({ rfis: rows, queries: rows });  // `queries` kept for backwards-compat
  }));

// POST /api/issues/rfi/:project_id — raise drawing-linked RFI
router.post('/rfi/:project_id', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { RFICreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(RFICreate, req, res);
    if (!body) return;

    const DS = require('../../design-services/contract');
    const dvMap = await DS.functions.getDrawingContextByVersionIds([body.drawing_version_id]);
    const dv = dvMap.get(body.drawing_version_id);
    if (!dv) return res.status(404).json({ error: 'Drawing not found' });

    const autoAssignee = await _getSmartAssignee(req.params.project_id, dv.stream || body.stream);

    // Number + insert with retry on UNIQUE race (see services/sequence.js)
    const { insertId, number: issueNumber } = await insertWithRetry(async () => {
      const n = await generateSeq({
        table: 'issues',
        numberCol: 'issue_number',
        projectId: req.params.project_id,
        prefix: 'ISS-',
        pad: 3,
      });
      const [result] = await db.query(
        `INSERT INTO issues
         (project_id, issue_number, issue_type, title, description, raised_by,
          drawing_version_id, query_stream, assigned_to, status, confirmed_by, confirmed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())`,
        [req.params.project_id, n, 'rfi', 'Drawing query: '+dv.drawing_number,
         body.question, me.id, body.drawing_version_id, dv.stream || body.stream, autoAssignee, 'open', me.id]
      );
      return { insertId: result.insertId, number: n };
    });

    // Notify (via canonical notifications layer)
    const notif = require('../../../services/notifications');
    await notif.notifyRFIRaised(req.params.project_id, dv.drawing_number, body.question, dv.stream || body.stream).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));

    audit.log({ userId: me.id, action: 'issue.rfi.create',
      entityType: 'issues', entityId: insertId,
      details: { project_id: parseInt(req.params.project_id), issue_number: issueNumber, drawing_version_id: body.drawing_version_id, stream: dv.stream || body.stream, auto_assigned: !!autoAssignee }, req });

    res.json({ success: true, id: insertId, issue_number: issueNumber, auto_assigned: !!autoAssignee });
  }));

// POST /api/issues/rfi/:id/assign
router.post('/rfi/:id/assign', requireAuth, requireScopeFromEntity('issues'), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const canAssign = ['pmc_head','principal','design_principal','design_head','services_head'].includes(me.role);
    if (!canAssign) return res.status(403).json({ error: 'Not authorised to assign RFIs' });
    const { assigned_to } = req.body;
    await db.query(
      "UPDATE issues SET assigned_to=? WHERE id=? AND issue_type='rfi'",
      [assigned_to, req.params.id]
    );
    audit.log({ userId: me.id, action: 'issue.rfi.assign',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { assigned_to: parseInt(assigned_to) || null }, req });
    res.json({ success: true });
  }));

// POST /api/issues/rfi/:id/answer — stream head answers RFI
router.post('/rfi/:id/answer', requireAuth, requireScopeFromEntity('issues'), requireRole(...STREAM_HEADS), asyncHandler(async (req, res) => {
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ error: 'Answer required' });
    const [[cur]] = await db.query('SELECT status FROM issues WHERE id=? AND issue_type="rfi"', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'RFI not found' });
    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: cur.status, to: 'resolved',
        extraCols: {
          rfi_response: answer, rfi_responded_by: req.session.user.id, rfi_responded_at: new Date(),
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: req.session.user.id, action: 'issue.rfi.answer',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { answer_length: answer.length }, req });
    res.json({ success: true });
  }));

// POST /api/issues/rfi/:id/close — close resolved RFI
// POST /api/issues/rfi/:id/close — close an RFI with resolution note.
// Bug #30 fix: previously had no role gate — any authenticated user could
// close any RFI. Now requires stream heads or PMC + project scope.
router.post('/rfi/:id/close', requireAuth,
  requireScopeFromEntity('issues'),
  requireRole('design_head', 'services_head', 'pmc_head', 'principal', 'design_principal'),
  asyncHandler(async (req, res) => {
    const { resolution_note } = req.body;
    const [[cur]] = await db.query('SELECT status FROM issues WHERE id=? AND issue_type="rfi"', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'RFI not found' });
    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: cur.status, to: 'closed',
        extraCols: {
          resolution_note: resolution_note || null,
          closed_by: req.session.user.id, closed_at: new Date(),
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    // Notify requester
    const [[issue]] = await db.query('SELECT project_id, drawing_version_id FROM issues WHERE id=?', [req.params.id]);
    if (issue?.drawing_version_id) {
      const DS = require('../../design-services/contract');
      const closeDvMap = await DS.functions.getDrawingContextByVersionIds([issue.drawing_version_id]);
      const dv = closeDvMap.get(issue.drawing_version_id);
      const notif = require('../../../services/notifications');
      await notif.notifyRFIClosed(issue.project_id, dv?.drawing_number || '', resolution_note).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
    }
    audit.log({ userId: req.session.user.id, action: 'issue.rfi.close',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { resolution_note: resolution_note || null }, req });
    res.json({ success: true });
  }));

// =====================================================================
// NCR ENDPOINTS — issues with issue_type='quality' (non-conformance)
// (Previously /api/ncr — folded into issues in v2.)
// =====================================================================

// GET /api/issues/ncr/:project_id
router.get('/ncr/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const [rows] = await db.query(
      `SELECT * FROM issues
       WHERE project_id = ? AND issue_type = 'quality'
       ORDER BY raised_at DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(rows.map(r => r.raised_by).filter(Boolean));
    const Onboarding = require('../../onboarding/contract');
    const vendors = await Onboarding.functions.getVendorsByIds(rows.map(r => r.assigned_vendor_id));
    rows.forEach(r => {
      r.raised_by_name = users.get(r.raised_by)?.full_name || null;
      r.vendor_name    = vendors.get(r.assigned_vendor_id)?.vendor_name || null;
    });
    res.json({ ncrs: rows });
  }));

// POST /api/issues/ncr/:project_id — raise NCR
router.post('/ncr/:project_id', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { NCRCreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(NCRCreate, req, res);
    if (!body) return;

    // Number + insert with retry on UNIQUE race (see services/sequence.js)
    const { insertId, number: ncrNumber } = await insertWithRetry(async () => {
      const n = await generateSeq({
        table: 'issues',
        numberCol: 'issue_number',
        projectId: req.params.project_id,
        prefix: 'NCR-',
        pad: 3,
        where: "AND issue_type='quality'",
      });
      const [result] = await db.query(
        `INSERT INTO issues
         (project_id, issue_number, ncr_number, issue_type, title, description,
          raised_by, assigned_vendor_id, location, due_date, drawing_id,
          vendor_accountability, status, confirmed_by, confirmed_at)
         VALUES (?,?,?,'quality',?,?,?,?,?,?,?,1,'open',?,NOW())`,
        [req.params.project_id, n, n, body.title, body.description,
         me.id, body.vendor_id, body.location, body.due_date, body.drawing_id, me.id]
      );
      return { insertId: result.insertId, number: n };
    });

    // Notify vendor (if any) via canonical notifications layer
    if (body.vendor_id) {
      const Onboarding = require('../../onboarding/contract');
      const vMap = await Onboarding.functions.getVendorsByIds([body.vendor_id]);
      const vendor = vMap.get(body.vendor_id);
      if (vendor?.phone) {
        const notif = require('../../../services/notifications');
        await notif.notifyVendorDefectRaised(vendor.phone, req.params.project_id, body.title + ': ' + body.description).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
      }
    }

    audit.log({ userId: me.id, action: 'issue.ncr.create',
      entityType: 'issues', entityId: insertId,
      details: { project_id: parseInt(req.params.project_id), ncr_number: ncrNumber, vendor_id: body.vendor_id || null, due_date: body.due_date || null }, req });

    res.json({ success: true, id: insertId, ncr_number: ncrNumber });
  }));

// PATCH /api/issues/ncr/:id/resolve
router.patch('/ncr/:id/resolve', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { resolution_note, rectification_date } = req.body;
    const [[cur]] = await db.query('SELECT status FROM issues WHERE id=? AND issue_type="quality"', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'NCR not found' });
    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: cur.status, to: 'resolved',
        extraCols: {
          resolution_note: resolution_note || null,
          rectification_date: rectification_date || null,
          resolved_by: req.session.user.id, resolved_at: new Date(),
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: req.session.user.id, action: 'issue.ncr.resolve',
      entityType: 'issues', entityId: parseInt(req.params.id),
      details: { resolution_note: resolution_note || null, rectification_date: rectification_date || null }, req });
    res.json({ success: true });
  }));

// ═══════════════════════════════════════════════════════════════════════════
// SNAGS — Defect Liability Period punch list. Stored as issue_type='snag'.
// Collapsed from the previous handover_snags table (v5.7 migration).
// Reuses issue infrastructure: photo upload, audit, RFI flow, vendor link.
// Signoff is multi-signature using the generic issue_signoffs table.
// ═══════════════════════════════════════════════════════════════════════════

const { getAssignedRoles, determineSignoffSlot } = require('../lib/signoff-helpers');

const SNAG_SIGNOFF_ROLES = ['pmc_head', 'design_head', 'services_head'];

// GET /api/issues/:project_id/snags — list snags + signoff annotation
router.get('/:project_id/snags',
  requireAuth, requireProjectScope(),
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.project_id, 10);
    const [snags] = await db.query(
      `SELECT i.id, i.project_id, i.issue_number, i.severity, i.trade, i.location,
              i.description, i.due_date, i.assigned_vendor_id AS vendor_id,
              i.status, i.raised_by, i.raised_at,
              i.resolution_note,
              i.signed_off_at, i.client_acceptance_note,
              v.vendor_name,
              (SELECT COUNT(*) FROM entity_photos ep
               WHERE ep.primary_entity_type='issue' AND ep.primary_entity_id = i.id) AS photo_count
       FROM issues i LEFT JOIN vendors v ON i.assigned_vendor_id = v.id
       WHERE i.project_id = ? AND i.issue_type = 'snag'
       ORDER BY i.raised_at DESC`,
      [projectId]
    );

    if (snags.length) {
      const ids = snags.map(s => s.id);
      const assignedRoles = await getAssignedRoles(projectId, SNAG_SIGNOFF_ROLES);
      const [signoffs] = await db.query(
        `SELECT issue_id, signed_for_role, signed_by_user_id, signed_at, notes
         FROM issue_signoffs WHERE issue_id IN (?)`,
        [ids]
      );
      const sigByIssue = {};
      for (const s of signoffs) {
        if (!sigByIssue[s.issue_id]) sigByIssue[s.issue_id] = [];
        sigByIssue[s.issue_id].push(s);
      }
      for (const snag of snags) {
        snag.required_signoffs = assignedRoles;
        snag.received_signoffs = sigByIssue[snag.id] || [];
      }
    }

    res.json({ snags });
  })
);

// POST /api/issues/:project_id/snags — raise a snag (with optional photo)
router.post('/:project_id/snags',
  requireAuth, requireProjectScope(),
  requirePermission('pmc.issue.snag-raise'),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const projectId = parseInt(req.params.project_id, 10);
    const { SnagCreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(SnagCreate, req, res);
    if (!body) return;
    const { trade, location, description, severity, due_date, vendor_id } = body;
    // Severity defaults to 'minor' to preserve prior behaviour when omitted.
    const sev = severity || 'minor';

    // S20: snag issue_number generation used SELECT MAX → INSERT with no
    // UNIQUE retry. Two concurrent snag raises produced duplicate numbers
    // (uq_issue_project_number rejected one). Wrap in insertWithRetry so
    // ER_DUP_ENTRY automatically retries with the next number.
    let r, issueNumber;
    await insertWithRetry(async () => {
      const [[last]] = await db.query(
        `SELECT issue_number FROM issues
         WHERE project_id = ? AND issue_type = 'snag'
         ORDER BY id DESC LIMIT 1`,
        [projectId]
      );
      let next = 1;
      if (last?.issue_number) {
        const m = last.issue_number.match(/SNAG-(\d+)/);
        if (m) next = parseInt(m[1]) + 1;
      }
      issueNumber = `SNAG-${String(next).padStart(4, '0')}`;

      const title = `${trade || 'Other'}: ${description.trim().slice(0, 200)}`;
      const photoPath = req.file?.path || null;

      const [insertResult] = await db.query(
        `INSERT INTO issues
         (project_id, issue_number, issue_type, severity, title, description,
          raised_by, location, trade, due_date, assigned_vendor_id, status)
         VALUES (?,?,'snag',?,?,?,?,?,?,?,?,'open')`,
        [projectId, issueNumber, sev, title, description.trim(),
         me.id, location || null, trade || null, due_date || null, vendor_id || null]
      );
      r = insertResult;
      r._photoPath = photoPath;
    });

    // Photo handling — if uploaded, insert into entity_photos with
    // primary_entity_type='issue' (since snags ARE issues with type='snag').
    // The photo can later be cross-linked to other entities via entity_photo_links.
    if (r._photoPath) {
      try {
        await db.query(
          `INSERT INTO entity_photos
             (project_id, primary_entity_type, primary_entity_id,
              file_path, caption, uploaded_by, source, photo_date)
           VALUES (?, 'issue', ?, ?, ?, ?, 'app', CURDATE())`,
          [projectId, r.insertId, r._photoPath,
           `Snag photo: ${trade || ''} - ${(description || '').slice(0, 100)}`,
           me.id]
        );
      } catch (err) {
        console.error('[issues.snag.raise] entity_photos insert failed:', err.message);
      }
    }

    audit.log({ userId: me.id, action: 'issue.snag.raise',
      entityType: 'issues', entityId: r.insertId,
      details: { project_id: projectId, severity: sev, trade }, req });

    res.json({ success: true, snag_id: r.insertId, issue_number: issueNumber });
  })
);

// PATCH /api/issues/:id/resolve-snag — mark a snag resolved (separate from
// the generic /resolve which is for type='quality'). Body: resolution_note.
router.patch('/:id/resolve-snag',
  requireAuth, requireScopeFromEntity('issues'),
  requirePermission('pmc.issue.snag-resolve'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const issueId = parseInt(req.params.id, 10);
    const { resolution_note } = req.body;
    if (!resolution_note || resolution_note.trim().length < 3) {
      return res.status(400).json({ error: 'resolution_note required (min 3 chars)' });
    }

    const [[issue]] = await db.query(
      'SELECT status, issue_type FROM issues WHERE id = ?', [issueId]
    );
    if (!issue) return res.status(404).json({ error: 'Snag not found' });
    if (issue.issue_type !== 'snag') return res.status(400).json({ error: 'Not a snag' });
    if (issue.status !== 'open') {
      return res.status(400).json({ error: `Cannot resolve from status '${issue.status}'` });
    }

    const sm = require('../../../services/state-machines').issue;
    try {
      await sm.transition({
        id: issueId, from: 'open', to: 'resolved',
        extraCols: {
          resolution_note: resolution_note.trim(),
          resolved_by: me.id, resolved_at: new Date(),
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: me.id, action: 'issue.snag.resolve',
      entityType: 'issues', entityId: issueId, req });

    res.json({ success: true });
  })
);

// POST /api/issues/:id/snag-signoff — multi-signature signoff
router.post('/:id/snag-signoff',
  requireAuth, requireScopeFromEntity('issues'),
  requirePermission('pmc.issue.snag-signoff'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const issueId = parseInt(req.params.id, 10);
    const projectId = req._projectId;   // populated by requireScopeFromEntity
    const { notes, role: bodyRole } = req.body || {};

    const [[issue]] = await db.query(
      'SELECT status, issue_type FROM issues WHERE id = ?', [issueId]
    );
    if (!issue) return res.status(404).json({ error: 'Snag not found' });
    if (issue.issue_type !== 'snag') return res.status(400).json({ error: 'Not a snag' });
    if (issue.status !== 'resolved') {
      return res.status(400).json({ error: `Snag must be resolved before signoff (current: ${issue.status})` });
    }

    const requiredRoles = await getAssignedRoles(projectId, SNAG_SIGNOFF_ROLES);
    if (!requiredRoles.length) {
      return res.status(400).json({ error: 'No signoff roles assigned to this project' });
    }

    const slot = await determineSignoffSlot(me, projectId, requiredRoles, bodyRole);
    if (!slot) {
      return res.status(403).json({
        error: 'You are not in a required signoff slot and not a deputy for one.',
        code:  'NO_SIGNOFF_SLOT',
        required_slots: requiredRoles,
      });
    }

    // S23: signoff INSERT and project status UPDATE were separate. If the
    // UPDATE failed after INSERT succeeded, the project would stay in
    // non-signed-off state but the audit said all signoffs done. Now: tx.
    let allSigned = false;
    let dupSlot = false;

    try {
      await db.tx(async (conn) => {
        try {
          await conn.query(
            `INSERT INTO issue_signoffs (issue_id, signed_for_role, signed_by_user_id, notes)
             VALUES (?,?,?,?)`,
            [issueId, slot, me.id, notes || null]
          );
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            dupSlot = true;
            return;  // exit tx callback; conn will commit (the dup is signalled out-of-band)
          }
          throw err;
        }

        const [[counts]] = await conn.query(
          `SELECT COUNT(DISTINCT signed_for_role) AS c
           FROM issue_signoffs WHERE issue_id = ? AND signed_for_role IN (?)`,
          [issueId, requiredRoles]
        );

        if (counts.c >= requiredRoles.length) {
          // From-state is 'resolved' (snag was rectified before signoff sequence starts).
          // Use conn so the status flip commits atomically with the signoff INSERT.
          const sm = require('../../../services/state-machines').issue;
          await sm.transition({
            id: issueId, from: 'resolved', to: 'signed_off',
            extraCols: { signed_off_at: new Date() },
            conn,
          });
          allSigned = true;
        }
      });
    } catch (err) {
      throw err;
    }

    if (dupSlot) {
      return res.status(409).json({ error: `Slot '${slot}' already signed` });
    }

    audit.log({ userId: me.id, action: 'issue.snag.signoff',
      entityType: 'issues', entityId: issueId,
      details: { slot, all_signed: allSigned }, req });

    res.json({ success: true, slot, all_signed: allSigned });
  })
);

// ── SPOT DEFECT FROM PHOTO WORKFLOW ──────────────────────────────────────
// POST /api/issues/:project_id/snag-from-photo
// Body: { photo_id, trade?, location?, description, severity?, due_date?, vendor_id? }
// Raises a snag and links it to an EXISTING photo (typically a site progress
// photo from the gallery). The photo is NOT duplicated — entity_photo_links
// records the snag → photo relationship. The photo remains the property of
// its primary entity (project_progress) but is now also visible from the snag.
router.post('/:project_id/snag-from-photo',
  requireAuth, requireProjectScope(),
  requirePermission('pmc.issue.snag-raise'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const projectId = parseInt(req.params.project_id, 10);
    const { SnagCreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(SnagCreate, req, res);
    if (!body) return;
    const { photo_id, trade, location, description, severity, due_date, vendor_id } = body;
    // photo_id is optional in the shared schema (the /snags route doesn't need
    // one) but required here — this endpoint links a snag to an existing photo.
    if (!photo_id) {
      return res.status(400).json({ error: 'photo_id required' });
    }

    // Verify the photo exists and belongs to this project
    const [[photo]] = await db.query(
      `SELECT id, project_id FROM entity_photos WHERE id = ?`,
      [photo_id]
    );
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (photo.project_id !== projectId) {
      return res.status(403).json({ error: 'Photo belongs to a different project' });
    }

    // Severity defaults to 'minor' to preserve prior behaviour when omitted.
    const sev = severity || 'minor';

    // S22: same race as S20 — wrap in insertWithRetry.
    let r, issueNumber;
    await insertWithRetry(async () => {
      const [[last]] = await db.query(
        `SELECT issue_number FROM issues
         WHERE project_id = ? AND issue_type = 'snag'
         ORDER BY id DESC LIMIT 1`,
        [projectId]
      );
      let next = 1;
      if (last?.issue_number) {
        const m = last.issue_number.match(/SNAG-(\d+)/);
        if (m) next = parseInt(m[1]) + 1;
      }
      issueNumber = `SNAG-${String(next).padStart(4, '0')}`;
      const title = `${trade || 'Other'}: ${description.trim().slice(0, 200)}`;

      const [insertResult] = await db.query(
        `INSERT INTO issues
         (project_id, issue_number, issue_type, severity, title, description,
          raised_by, location, trade, due_date, assigned_vendor_id, status)
         VALUES (?,?,'snag',?,?,?,?,?,?,?,?,'open')`,
        [projectId, issueNumber, sev, title, description.trim(),
         me.id, location || null, trade || null, due_date || null, vendor_id || null]
      );
      r = insertResult;
    });

    // Link the existing photo to this snag (no duplicate upload!)
    try {
      await db.query(
        `INSERT INTO entity_photo_links
           (photo_id, entity_type, entity_id, linked_by, link_caption)
         VALUES (?, 'snag', ?, ?, ?)`,
        [photo_id, r.insertId, me.id,
         `Defect spotted: ${trade || ''} - ${description.trim().slice(0, 100)}`]
      );
    } catch (err) {
      // Duplicate link wouldn't be a real failure (UNIQUE constraint),
      // but other errors we should log
      if (err.code !== 'ER_DUP_ENTRY') {
        console.error('[issues.snag-from-photo] link insert failed:', err.message);
      }
    }

    audit.log({ userId: me.id, action: 'issue.snag.raise.from-photo',
      entityType: 'issues', entityId: r.insertId,
      details: { project_id: projectId, photo_id, severity: sev, trade }, req });

    res.json({ success: true, snag_id: r.insertId, issue_number: issueNumber, photo_id });
  })
);

module.exports = router;
