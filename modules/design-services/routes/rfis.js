// modules/design-services/routes/rfis.js
// Formal RFI (Request for Information) register.
//
// Builds on top of the existing `issues` table (issue_type='rfi') and adds
// RFI-specific fields via the add-rfi-fields.sql migration:
//   rfi_number, rfi_direction, response_deadline, contractor_ref, rfi_discipline
//
// Directions:
//   contractor_to_pmc — contractor raises, PMC/design team responds
//   pmc_to_contractor — PMC raises, contractor/site manager responds
//
// State machine (reuses issues state machine):
//   open -> resolved (response provided) -> closed (formally acknowledged)
//
// Notifications: PMC Head + Design Head only (per product decision).

'use strict';

const express    = require('express');
const db         = require('../../../middleware/db');
const { requireAuth, requireRole, requireProjectScope } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit      = require('../../../services/audit');
const sequence   = require('../../../services/sequence');
const notif      = require('../../../services/notifications');

const router = express.Router({ mergeParams: true });

// Roles that can raise an RFI
const RAISE_ROLES = [
  'principal', 'design_principal', 'pmc_head',
  'design_head', 'services_head',
  'site_manager', 'senior_site_manager',
  'coordinator', 'team_lead',
  'jr_architect', 'services_engineer',
];

// Roles that can respond to an RFI
const RESPOND_ROLES = [
  'principal', 'design_principal',
  'pmc_head', 'design_head', 'services_head',
  'site_manager', 'senior_site_manager',
];

// Roles that can formally close an RFI
const CLOSE_ROLES = [
  'principal', 'design_principal',
  'pmc_head', 'design_head',
];

// Disciplines
const VALID_DISCIPLINES = [
  'civil', 'structural', 'mep', 'interior', 'landscape', 'general', 'commercial',
];

// Default response deadline: 7 calendar days
const DEFAULT_DEADLINE_DAYS = 7;

// ── Helper ────────────────────────────────────────────────────────────────────
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── GET /api/rfi/:project_id ─ RFI register ───────────────────────────────────
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const pid = parseInt(req.params.project_id, 10);
  const { status, direction, overdue, discipline, limit = 100, offset = 0 } = req.query;

  let where = 'WHERE i.project_id = ? AND i.issue_type = "rfi"';
  const params = [pid];

  if (status)     { where += ' AND i.status = ?';        params.push(status); }
  if (direction)  { where += ' AND i.rfi_direction = ?'; params.push(direction); }
  if (discipline) { where += ' AND i.rfi_discipline = ?'; params.push(discipline); }
  if (overdue === '1') { where += ' AND i.is_overdue = 1'; }

  const [rows] = await db.query(
    `SELECT
       i.id, i.rfi_number, i.issue_number, i.title, i.description,
       i.status, i.rfi_direction, i.response_deadline, i.contractor_ref,
       i.rfi_discipline, i.is_overdue,
       i.raised_at, i.raised_by,
       i.rfi_response, i.rfi_responded_by, i.rfi_responded_at,
       i.drawing_version_id,
       u_raise.full_name AS raised_by_name,
       u_resp.full_name  AS responded_by_name,
       DATEDIFF(NOW(), i.raised_at) AS days_open,
       CASE WHEN i.response_deadline IS NOT NULL AND i.status NOT IN ('resolved','closed')
            THEN DATEDIFF(i.response_deadline, CURDATE())
            ELSE NULL
       END AS days_until_deadline
     FROM issues i
     LEFT JOIN users u_raise ON u_raise.id = i.raised_by
     LEFT JOIN users u_resp  ON u_resp.id  = i.rfi_responded_by
     ${where}
     ORDER BY i.raised_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM issues i ${where}`,
    params
  );

  res.json({ rfis: rows, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
}));

// ── GET /api/rfi/:project_id/:id ─ single RFI detail ─────────────────────────
router.get('/:project_id/:id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const pid = parseInt(req.params.project_id, 10);
  const id  = parseInt(req.params.id, 10);

  const [[rfi]] = await db.query(
    `SELECT
       i.*,
       u_raise.full_name AS raised_by_name,
       u_resp.full_name  AS responded_by_name,
       DATEDIFF(NOW(), i.raised_at) AS days_open,
       CASE WHEN i.response_deadline IS NOT NULL AND i.status NOT IN ('resolved','closed')
            THEN DATEDIFF(i.response_deadline, CURDATE())
            ELSE NULL
       END AS days_until_deadline
     FROM issues i
     LEFT JOIN users u_raise ON u_raise.id = i.raised_by
     LEFT JOIN users u_resp  ON u_resp.id  = i.rfi_responded_by
     WHERE i.id = ? AND i.project_id = ? AND i.issue_type = "rfi"`,
    [id, pid]
  );
  if (!rfi) return res.status(404).json({ error: 'RFI not found' });

  // Linked drawing versions (rfi_response type drawings that reference this RFI)
  const [linkedDrawings] = await db.query(
    `SELECT dv.id, dv.revision, dv.file_path, dv.uploaded_at, dv.status,
            d.drawing_number, d.title AS drawing_title
       FROM drawing_versions dv
       JOIN drawings d ON d.id = dv.drawing_id
      WHERE dv.rfi_issue_id = ? AND d.drawing_type = "rfi_response"
      ORDER BY dv.uploaded_at DESC`,
    [id]
  );

  res.json({ ...rfi, linked_drawings: linkedDrawings });
}));

// ── POST /api/rfi/:project_id ─ raise new RFI ────────────────────────────────
router.post('/:project_id', requireAuth, requireProjectScope(), requireRole(...RAISE_ROLES), asyncHandler(async (req, res) => {
  const me  = req.session.user;
  const pid = parseInt(req.params.project_id, 10);
  const {
    title, description,
    direction = 'contractor_to_pmc',
    response_deadline,
    contractor_ref,
    discipline = 'general',
    drawing_version_id = null,
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!['contractor_to_pmc', 'pmc_to_contractor'].includes(direction)) {
    return res.status(400).json({ error: 'direction must be contractor_to_pmc or pmc_to_contractor' });
  }
  if (discipline && !VALID_DISCIPLINES.includes(discipline)) {
    return res.status(400).json({ error: 'Invalid discipline. Allowed: ' + VALID_DISCIPLINES.join(', ') });
  }

  const deadline = response_deadline || addDays(new Date(), DEFAULT_DEADLINE_DAYS);

  let issueNumber, rfiNumber, result;
  await sequence.insertWithRetry(async () => {
    // Issue number (global per project, shared with other issue types)
    issueNumber = await sequence.generate({
      table: 'issues', numberCol: 'issue_number', projectId: pid,
      prefix: 'ISS-', pad: 3,
    });
    // RFI number (per project, RFI-specific sequence)
    const [[{ maxRfi }]] = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(rfi_number, 5) AS UNSIGNED)), 0) AS maxRfi
         FROM issues WHERE project_id = ? AND issue_type = "rfi" AND rfi_number IS NOT NULL`,
      [pid]
    );
    rfiNumber = 'RFI-' + String(maxRfi + 1).padStart(3, '0');

    const [r] = await db.query(
      `INSERT INTO issues
         (project_id, issue_number, rfi_number, issue_type,
          title, description, status,
          rfi_direction, response_deadline, contractor_ref, rfi_discipline,
          drawing_version_id, raised_by, raised_at)
       VALUES (?,?,?,'rfi',?,?,'open',?,?,?,?,?,?,NOW())`,
      [pid, issueNumber, rfiNumber, title.trim(), description || null,
       direction, deadline, contractor_ref || null, discipline,
       drawing_version_id, me.id]
    );
    result = r;
  });

  const rfiId = result.insertId;

  audit.log({
    userId: me.id, action: 'rfi.raise',
    entityType: 'issues', entityId: rfiId,
    details: { project_id: pid, rfi_number: rfiNumber, direction, discipline },
    req,
  });

  // Notify PMC Head + Design/Services Head. Pass the RFI subject as the
  // question text and map discipline → stream ('mep' is the services
  // discipline, per materials.js SERVICES_TRADES; all others are design)
  // so design RFIs reach design_head and MEP RFIs reach services_head.
  notif.notifyRFIRaised(pid, rfiNumber, title, discipline === 'mep' ? 'services' : 'design')
    .catch(e => console.warn('[rfis] raise notify swallowed:', e.message));

  res.status(201).json({
    success: true,
    id: rfiId,
    rfi_number: rfiNumber,
    issue_number: issueNumber,
    response_deadline: deadline,
  });
}));

// ── PATCH /api/rfi/:project_id/:id/respond ─ add text response ───────────────
router.patch('/:project_id/:id/respond', requireAuth, requireProjectScope(), requireRole(...RESPOND_ROLES), asyncHandler(async (req, res) => {
  const me  = req.session.user;
  const pid = parseInt(req.params.project_id, 10);
  const id  = parseInt(req.params.id, 10);
  const { rfi_response } = req.body;

  if (!rfi_response || !rfi_response.trim()) {
    return res.status(400).json({ error: 'rfi_response text is required' });
  }

  const [[cur]] = await db.query(
    'SELECT status, rfi_number, project_id FROM issues WHERE id = ? AND project_id = ? AND issue_type = "rfi"',
    [id, pid]
  );
  if (!cur) return res.status(404).json({ error: 'RFI not found in this project' });
  if (cur.status === 'closed') {
    return res.status(400).json({ error: 'Cannot respond to a closed RFI' });
  }
  if (cur.status === 'resolved') {
    return res.status(400).json({ error: 'RFI already has a response. Use close to formally close it.' });
  }

  const sm = require('../../../services/state-machines').issue;
  try {
    await sm.transition({
      id, from: cur.status, to: 'resolved',
      extraCols: {
        rfi_response: rfi_response.trim(),
        rfi_responded_by: me.id,
        rfi_responded_at: new Date(),
      },
    });
  } catch (err) { return sm.handleRouteError(err, res); }

  audit.log({
    userId: me.id, action: 'rfi.respond',
    entityType: 'issues', entityId: id,
    details: { project_id: pid, rfi_number: cur.rfi_number, response_length: rfi_response.length },
    req,
  });

  // Notify PMC Head + Design Head that response is ready
  notif.notifyRFIClosed(pid, cur.rfi_number, rfi_response.substring(0, 80))
    .catch(e => console.warn('[rfis] respond notify swallowed:', e.message));

  res.json({ success: true, message: 'RFI response recorded — status: resolved.' });
}));

// ── PATCH /api/rfi/:project_id/:id/close ─ formal closure ────────────────────
router.patch('/:project_id/:id/close', requireAuth, requireProjectScope(), requireRole(...CLOSE_ROLES), asyncHandler(async (req, res) => {
  const me  = req.session.user;
  const pid = parseInt(req.params.project_id, 10);
  const id  = parseInt(req.params.id, 10);
  const { closure_note } = req.body;

  const [[cur]] = await db.query(
    'SELECT status, rfi_number FROM issues WHERE id = ? AND project_id = ? AND issue_type = "rfi"',
    [id, pid]
  );
  if (!cur) return res.status(404).json({ error: 'RFI not found in this project' });
  if (cur.status === 'closed') {
    return res.status(400).json({ error: 'RFI is already closed' });
  }
  if (!['resolved', 'open', 'in_progress'].includes(cur.status)) {
    return res.status(400).json({ error: 'Cannot close RFI in status: ' + cur.status });
  }

  const sm = require('../../../services/state-machines').issue;
  try {
    await sm.transition({
      id, from: cur.status, to: 'closed',
      extraCols: { resolution_note: closure_note || null },
    });
  } catch (err) { return sm.handleRouteError(err, res); }

  audit.log({
    userId: me.id, action: 'rfi.close',
    entityType: 'issues', entityId: id,
    details: { project_id: pid, rfi_number: cur.rfi_number, closure_note: closure_note || null },
    req,
  });

  res.json({ success: true, message: 'RFI closed.' });
}));

// ── PATCH /api/rfi/:project_id/:id ─ update metadata (pre-response only) ──────
router.patch('/:project_id/:id', requireAuth, requireProjectScope(), requireRole(...RAISE_ROLES), asyncHandler(async (req, res) => {
  const me  = req.session.user;
  const pid = parseInt(req.params.project_id, 10);
  const id  = parseInt(req.params.id, 10);
  const { title, description, response_deadline, contractor_ref, discipline } = req.body;

  const [[cur]] = await db.query(
    'SELECT status, raised_by FROM issues WHERE id = ? AND project_id = ? AND issue_type = "rfi"',
    [id, pid]
  );
  if (!cur) return res.status(404).json({ error: 'RFI not found in this project' });
  if (!['open', 'in_progress'].includes(cur.status)) {
    return res.status(400).json({ error: 'Can only edit RFIs that are open or in_progress' });
  }
  // Only the original raiser or PMC Head / principals can edit
  const editRoles = ['pmc_head', 'design_head', 'principal', 'design_principal'];
  if (cur.raised_by !== me.id && !editRoles.includes(me.role)) {
    return res.status(403).json({ error: 'Only the original raiser or a PMC Head / Principal can edit this RFI' });
  }

  const setClauses = [];
  const params = [];
  if (title)             { setClauses.push('title = ?');             params.push(title.trim()); }
  if (description !== undefined) { setClauses.push('description = ?'); params.push(description || null); }
  if (response_deadline) { setClauses.push('response_deadline = ?'); params.push(response_deadline); }
  if (contractor_ref !== undefined) { setClauses.push('contractor_ref = ?'); params.push(contractor_ref || null); }
  if (discipline) {
    if (!VALID_DISCIPLINES.includes(discipline)) {
      return res.status(400).json({ error: 'Invalid discipline' });
    }
    setClauses.push('rfi_discipline = ?');
    params.push(discipline);
  }

  if (!setClauses.length) return res.status(400).json({ error: 'No updatable fields provided' });

  params.push(id);
  await db.query(`UPDATE issues SET ${setClauses.join(', ')} WHERE id = ?`, params);

  audit.log({
    userId: me.id, action: 'rfi.update',
    entityType: 'issues', entityId: id,
    details: { project_id: pid, updated: setClauses.map(s => s.split(' ')[0]) },
    req,
  });

  res.json({ success: true });
}));

module.exports = router;
