// routes/materials.js
// ============================================================
// INTERNAL / MATERIAL BOQ — our cost basis, granular.
//
// nu PMC has TWO BOQs by design (NOT a duplication; this is a healthy split):
//
//   1. THIS FILE — material-level BOQ. Drives vendor payments, GRNs,
//      material requests, reconciliation against actual delivery.
//      Granularity: one RCC item explodes into cement + steel + aggregate
//      + labour + shuttering + admixture etc. This is what WE pay for.
//
//   2. modules/onboarding/routes/client-boq.js — client-facing BOQ.
//      Selling price, rolled up. RCC stays as one line "RCC M25 — ₹X/cum".
//      This is what the client signs against, what claims/RA-bills compute
//      from, what shows on invoices.
//
// 1:N mapping between client-boq line and material-boq lines. Different
// schemas because they hold different data; different access patterns
// because different people read them. DO NOT MERGE.
// ============================================================
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requirePMC, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { requirePermission } = require('../../../middleware/permissions');
const { upload } = require('../../../middleware/upload');
const { readFile: readExcel } = require('../../../middleware/excel');
const { validators } = require('../../../middleware/validate');
const asyncHandler = require('../../../middleware/asyncHandler');
const sequence = require('../../../services/sequence');
const audit    = require('../../../services/audit');
// Cross-module contracts — hoisted to module scope (no circular deps).
// Onboarding: setChecklistFlag used inside BOQ upload transaction.
const Onboarding = require('../../onboarding/contract');
// Auth: bulk user hydration for GET /boq/versions uploaded_by field.
const Auth = require('../../auth/contract');
const router  = express.Router();

// GET /api/materials/:project_id/boq — get BOQ items for dropdown
//
// v6.02: design_head sees only design-trade items, services_head only services.
router.get('/:project_id/boq', requireAuth,
  requireRole('principal','design_principal','pmc_head','design_head','services_head','site_manager','senior_site_manager','coordinator','finance_admin'),
  asyncHandler(async (req, res) => {
    const [items] = await db.query(
      `SELECT bi.* FROM boq_items bi
       JOIN boq_versions bv ON bi.boq_version_id = bv.id
       WHERE bv.project_id = ? AND bv.is_current = 1 AND bi.is_active = 1
       ORDER BY bi.trade, bi.item_name`,
      [req.params.project_id]
    );

    // Stream filter for design_head/services_head
    const me = req.session.user;
    let filtered = items;
    if (me.role === 'design_head' || me.role === 'services_head') {
      const DESIGN_TRADES   = new Set(['civil','structural','finishes','architectural','interior']);
      const SERVICES_TRADES = new Set(['electrical','hvac','plumbing','fire','it','mep']);
      const streamSet = me.role === 'design_head' ? DESIGN_TRADES : SERVICES_TRADES;
      filtered = items.filter(it => streamSet.has((it.trade || '').toLowerCase()));
    }

    // Group by trade
    const byTrade = {};
    filtered.forEach(item => {
      if (!byTrade[item.trade]) byTrade[item.trade] = [];
      byTrade[item.trade].push(item);
    });

    res.json({ items: filtered, byTrade });

  }));

// POST /api/materials/:project_id/boq/upload — Rajani/Srinath uploads BOQ Excel
router.post('/:project_id/boq/upload', requireAuth, requireProjectScope(),
  requirePermission('onboarding.boq.upload'),
  upload.single('boq'), asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { stream } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Derive stream strictly from user role. Principals (cross-stream) may override
    // via request body; everyone else is locked to their own stream.
    // This closes the stream-swap hole where a design_head could POST stream=services.
    let boqStream;
    if (me.role === 'design_head')    boqStream = 'design';
    else if (me.role === 'services_head') boqStream = 'services';
    else if (me.role === 'principal' || me.role === 'design_principal') {
      // Principals can specify either stream; fall back to 'design' if unspecified
      boqStream = (stream === 'design' || stream === 'services') ? stream : 'design';
    }
    if (!['design','services'].includes(boqStream)) {
      return res.status(400).json({ error: 'Invalid stream' });
    }

    // Parse Excel first — outside transaction, no DB impact
    const rows  = await readExcel(file.path);
    const validationErrors = [];

    // TRANSACTION: deactivate old + insert new version + insert all items + update checklist
    // Wrapped in insertWithRetry — regen version on ER_DUP_ENTRY (uq_boq_version UNIQUE added in v3.1)
    let nextVer;
    const { count, vResult } = await sequence.insertWithRetry(async () => {
      return await db.tx(async (conn) => {
        // Re-read inside retry so concurrent committed writes are seen
        const [[lastVer]] = await conn.query(
          'SELECT version_number FROM boq_versions WHERE project_id = ? AND stream = ? ORDER BY id DESC LIMIT 1',
          [pid, boqStream]
        );
        nextVer = (parseInt(lastVer?.version_number || 0, 10) || 0) + 1;

        await conn.query('UPDATE boq_versions SET is_current = 0 WHERE project_id = ? AND stream = ?', [pid, boqStream]);

        const [vR] = await conn.query(
          'INSERT INTO boq_versions (project_id, stream, version_number, label, file_path, is_current, uploaded_by) VALUES (?,?,?,?,?,1,?)',
          [pid, boqStream, nextVer, `v${nextVer}`, file.path, me.id]
        );

        let cnt = 0, order = 0;
        const sectionMap = {}; // trade -> current section parentId

        for (const row of rows) {
      const trade    = (row['Trade']    || row['trade']     || '').trim();
      const itemName = (row['Item']     || row['item_name'] || row['Description'] || '').trim();
      const unit     = (row['Unit']     || row['unit']      || '').trim();
      const qtyRaw   = row['Quantity'] !== undefined ? row['Quantity'] : (row['qty'] !== undefined ? row['qty'] : 0);
      const quantity = parseFloat(qtyRaw);
      // Reject rows with invalid quantity (non-empty but non-numeric)
      if (qtyRaw !== '' && qtyRaw !== null && qtyRaw !== undefined && isNaN(quantity)) {
        validationErrors.push({ row: order, field: 'Quantity', value: String(qtyRaw), item: itemName });
        continue;
      }
      const qty = isNaN(quantity) ? 0 : quantity;
      const itemCode = (row['Code']     || row['item_code'] || null);
      const section  = (row['Section']  || row['section']   || '').trim();

      if (!trade || !itemName) continue;

      order++;

      // Detect section header — priority order:
      // 1. Explicit 'Section' column = 1/yes/true (most reliable)
      // 2. Has Section column header in Excel but blank unit AND blank quantity
      // 3. ALL CAPS item name with no quantity AND no unit (fallback heuristic)
      const hasExplicitSection = section === '1' || section === 'yes' || section === 'true' || section === 1;
      const isLikelySection = !unit && !quantity &&
        (itemName === itemName.toUpperCase() && itemName.length > 3);
      const isSection = hasExplicitSection || isLikelySection;

      let parentId = null;

      if (isSection) {
          // This row is a section header — becomes parent for subsequent items in same trade
          const [sr] = await conn.query(
            'INSERT INTO boq_items (boq_version_id, project_id, parent_id, trade, item_code, item_name, unit, quantity, display_order, is_section) VALUES (?,?,NULL,?,?,?,?,0,?,1)',
            [vR.insertId, pid, trade, itemCode, itemName, '', order]
          );
          sectionMap[trade] = sr.insertId;
          cnt++;
          continue;
        }

      // Use current section as parent if same trade
      parentId = sectionMap[trade] || null;

      await conn.query(
          'INSERT INTO boq_items (boq_version_id, project_id, parent_id, trade, item_code, item_name, unit, quantity, display_order, is_section) VALUES (?,?,?,?,?,?,?,?,?,0)',
          [vR.insertId, pid, parentId, trade, itemCode, itemName, unit||'nos', qty, order]
        );
        cnt++;
      }

      // Update project checklist inside the same transaction.
      // Onboarding is required at module scope — see top of file.
      if (boqStream === 'design') {
        await Onboarding.functions.setChecklistFlag(pid, 'checklist_design_boq', conn);
      } else {
        await Onboarding.functions.setChecklistFlag(pid, 'checklist_services_boq', conn);
      }

      return { count: cnt, vResult: vR };
    });
    });

    res.json({
      success: true,
      items_imported: count,
      version: `v${nextVer}`,
      validation_errors: validationErrors.length ? validationErrors : undefined,
      warning: validationErrors.length ? `${validationErrors.length} rows skipped due to invalid quantity` : undefined,
    });

  }));

// GET /api/materials/:project_id/requests — material requests
//
// v6.02: design_head sees only design-trade requests, services_head sees only
// services-trade requests. PMC, Principal, site managers see everything.
// Trade→stream mapping mirrors the canonical inline sets used in
// payment-requests.js and vendor onboarding.
router.get('/:project_id/requests', requireAuth,
  requireRole('principal','design_principal','pmc_head','design_head','services_head','site_manager','senior_site_manager','coordinator','finance_admin'),
  asyncHandler(async (req, res) => {
    const [requests] = await db.query(
      `SELECT mr.*, bi.item_name, bi.trade, bi.unit
       FROM material_requests mr
       JOIN boq_items bi ON mr.boq_item_id = bi.id
       WHERE mr.project_id = ?
       ORDER BY mr.is_overdue DESC, mr.needed_by_date ASC`,
      [req.params.project_id]
    );

    // Stream filter — only for design_head and services_head
    const me = req.session.user;
    let filtered = requests;
    if (me.role === 'design_head' || me.role === 'services_head') {
      const DESIGN_TRADES   = new Set(['civil','structural','finishes','architectural','interior']);
      const SERVICES_TRADES = new Set(['electrical','hvac','plumbing','fire','it','mep']);
      const streamSet = me.role === 'design_head' ? DESIGN_TRADES : SERVICES_TRADES;
      filtered = requests.filter(r => streamSet.has((r.trade || '').toLowerCase()));
    }

    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      filtered.flatMap(r => [r.raised_by, r.validated_by].filter(Boolean))
    );
    filtered.forEach(r => {
      r.raised_by_name    = users.get(r.raised_by)?.full_name    || null;
      r.validated_by_name = users.get(r.validated_by)?.full_name || null;
    });

    res.json({ requests: filtered });

  }));

// POST /api/materials/:project_id/requests — site manager raises request
router.post('/:project_id/requests', requireAuth, requireProjectScope(),
  requireRole('principal','design_principal','pmc_head','design_head','services_head','site_manager','senior_site_manager','coordinator'),
  validators.materialRequest, asyncHandler(async (req, res) => {
    const { boq_item_id, quantity_needed, needed_by_date, notes } = req.body;
    if (!boq_item_id || !quantity_needed || !needed_by_date) {
      return res.status(400).json({ error: 'Item, quantity and needed-by date required' });
    }

    const [result] = await db.query(
      'INSERT INTO material_requests (project_id, boq_item_id, quantity_needed, needed_by_date, notes, raised_by) VALUES (?,?,?,?,?,?)',
      [req.params.project_id, boq_item_id, quantity_needed, needed_by_date, notes || null, req.session.user.id]
    );

    audit.log({ userId: req.session.user.id, action: 'material_request.create',
      entityType: 'material_requests', entityId: result.insertId,
      details: { project_id: parseInt(req.params.project_id), boq_item_id: parseInt(boq_item_id), quantity_needed, needed_by_date }, req });

    res.json({ success: true, id: result.insertId });

  }));

// PATCH /api/materials/requests/:id/status — PMC updates status
router.patch('/requests/:id/status', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { status } = req.body; // 1-5
    if (!status || status < 1 || status > 5) return res.status(400).json({ error: 'Invalid status' });

    // Read current state. Pre-v5.22 the UPDATE here blindly nulled every
    // timestamp column on each transition (status=3 wiped ordered_at written
    // by status=2 etc.). State machine fix: only set timestamps that the
    // current transition stamps; existing timestamps are preserved.
    const [[cur]] = await db.query('SELECT status FROM material_requests WHERE id = ?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Material request not found' });

    const now = new Date();
    const extraCols = {};
    if (status === 2) { extraCols.ordered_by = req.session.user.id; extraCols.ordered_at = now; }
    if (status === 3) { extraCols.dispatched_at = now; }
    if (status === 4) { extraCols.received_at = now; }
    if (status === 5) { extraCols.validated_by = req.session.user.id; extraCols.validated_at = now; }

    const sm = require('../../../services/state-machines').materialRequest;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: cur.status, to: status, extraCols,
      });
    } catch (err) { return sm.handleRouteError(err, res); }

    audit.log({ userId: req.session.user.id, action: 'material_request.status_change',
      entityType: 'material_requests', entityId: parseInt(req.params.id),
      details: { from: cur.status, new_status: status }, req });

    res.json({ success: true });

  }));

// ── BOQ VERSION MANAGEMENT (M02 Stage 2) ──────────────────────

// GET /api/materials/:project_id/boq/versions — list all BOQ versions for project
// Shows item count, uploaded-by, timestamp, current-flag for each version.
router.get('/:project_id/boq/versions', requireAuth,
  requireRole('principal','design_principal','pmc_head','design_head','services_head'),
  asyncHandler(async (req, res) => {
    const [versions] = await db.query(
      `SELECT bv.id, bv.version_number, bv.label, bv.stream, bv.is_current,
              bv.created_at, bv.file_path, bv.uploaded_by,
              (SELECT COUNT(*) FROM boq_items bi
                WHERE bi.boq_version_id = bv.id AND bi.is_active = 1) AS item_count
       FROM boq_versions bv
       WHERE bv.project_id = ?
       ORDER BY bv.stream, bv.version_number DESC`,
      [req.params.project_id]
    );
    // Auth is required at module scope — see top of file.
    const users = await Auth.functions.getUsers(versions.map(v => v.uploaded_by).filter(Boolean));
    versions.forEach(v => { v.uploaded_by_name = users.get(v.uploaded_by)?.full_name || null; });
    res.json({ versions });
  }));

// GET /api/materials/:project_id/boq/versions/:version_id/items — items in a specific version
// Used to preview historical versions before rollback.
router.get('/:project_id/boq/versions/:version_id/items', requireAuth,
  requireRole('principal','design_principal','pmc_head','design_head','services_head'),
  asyncHandler(async (req, res) => {
    const [[version]] = await db.query(
      'SELECT id, project_id, stream, version_number, label, is_current FROM boq_versions WHERE id = ? AND project_id = ?',
      [req.params.version_id, req.params.project_id]
    );
    if (!version) return res.status(404).json({ error: 'Version not found' });

    const [items] = await db.query(
      `SELECT id, trade, item_code, item_name, unit, quantity, parent_id, is_section, display_order
       FROM boq_items
       WHERE boq_version_id = ? AND is_active = 1
       ORDER BY trade, display_order, item_name`,
      [req.params.version_id]
    );
    res.json({ version, items });
  }));

// PATCH /api/materials/:project_id/boq/versions/:version_id/activate — roll back to this version
// Only heads of the matching stream (or principals) may rollback.
// Caveat: material requests raised against later versions continue to display their
// item names via non-filtered JOIN in GET /requests; new requests will see only this
// version's items.
router.patch('/:project_id/boq/versions/:version_id/activate', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[version]] = await db.query(
      'SELECT id, project_id, stream, version_number, label, is_current FROM boq_versions WHERE id = ? AND project_id = ?',
      [req.params.version_id, req.params.project_id]
    );
    if (!version) return res.status(404).json({ error: 'Version not found' });
    if (version.is_current) return res.status(400).json({ error: 'Already current' });

    // Stream-scoped authorisation — same policy as upload
    const canRollback =
      ['principal','design_principal'].includes(me.role) ||
      (me.role === 'design_head' && version.stream === 'design') ||
      (me.role === 'services_head' && version.stream === 'services');
    if (!canRollback) {
      return res.status(403).json({ error: 'Not authorised to roll back this stream\'s BOQ' });
    }

    // Swap current: deactivate current, activate target, all within one stream
    await db.tx(async (conn) => {
      await conn.query(
        'UPDATE boq_versions SET is_current = 0 WHERE project_id = ? AND stream = ?',
        [req.params.project_id, version.stream]
      );
      await conn.query(
        'UPDATE boq_versions SET is_current = 1 WHERE id = ?',
        [req.params.version_id]
      );
    });

    audit.log({ userId: me.id, action: 'boq.rollback', entityType: 'boq_versions',
                entityId: req.params.version_id,
                details: { stream: version.stream, rolled_to: version.label }, req });

    res.json({ success: true, message: `Rolled back to ${version.stream} ${version.label}` });
  }));

// ── BOQ ITEM CRUD (M02 Stage 3) ───────────────────────────────
// Allows heads to add/edit/delete single BOQ items without re-uploading the
// whole Excel. Operations are stream-scoped — heads can only touch their own
// stream's BOQ; principals may touch either.

// Helper: resolve which stream + version the acting head is working on.
// Returns { version, stream, error } — caller should return 400 with error if present.
async function resolveCurrentVersion(projectId, me, requestedStream) {
  let stream;
  if (me.role === 'design_head')         stream = 'design';
  else if (me.role === 'services_head')  stream = 'services';
  else if (me.role === 'principal' || me.role === 'design_principal') {
    stream = (requestedStream === 'design' || requestedStream === 'services') ? requestedStream : null;
    if (!stream) return { error: 'Principals must specify stream' };
  }
  else return { error: 'Not authorised to edit BOQ items' };

  const [[ver]] = await db.query(
    'SELECT id, stream FROM boq_versions WHERE project_id = ? AND stream = ? AND is_current = 1',
    [projectId, stream]
  );
  if (!ver) return { error: `No current ${stream} BOQ for this project` };
  return { version: ver, stream };
}

// POST /api/materials/:project_id/boq/items — add a single line item to the current BOQ version
router.post('/:project_id/boq/items', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { trade, item_name, unit, quantity, item_code, stream } = req.body;
    if (!trade || !item_name || !unit) {
      return res.status(400).json({ error: 'Trade, item name, and unit are required' });
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) return res.status(400).json({ error: 'Quantity must be a non-negative number' });

    const r = await resolveCurrentVersion(req.params.project_id, me, stream);
    if (r.error) return res.status(403).json({ error: r.error });

    // Compute next display_order for this trade+version
    const [[maxOrder]] = await db.query(
      'SELECT MAX(display_order) AS max_order FROM boq_items WHERE boq_version_id = ? AND trade = ?',
      [r.version.id, trade]
    );
    const nextOrder = (maxOrder?.max_order || 0) + 10;

    const [result] = await db.query(
      `INSERT INTO boq_items (boq_version_id, project_id, trade, item_code, item_name,
                              unit, quantity, display_order, is_section, is_active)
       VALUES (?,?,?,?,?,?,?,?,0,1)`,
      [r.version.id, req.params.project_id, String(trade).trim(),
       item_code ? String(item_code).trim() : null,
       String(item_name).trim(), String(unit).trim(), qty, nextOrder]
    );
    audit.log({ userId: me.id, action: 'boq.item.add', entityType: 'boq_items',
                entityId: result.insertId, details: { trade, item_name, quantity: qty, stream: r.stream }, req });
    res.json({ success: true, id: result.insertId });
  }));

// PATCH /api/materials/:project_id/boq/items/:id — edit a single item (stream-scoped)
router.patch('/:project_id/boq/items/:id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;

    // Look up item and its version to know which stream it belongs to
    const [[itemRow]] = await db.query(
      `SELECT bi.*, bv.stream FROM boq_items bi
       JOIN boq_versions bv ON bi.boq_version_id = bv.id
       WHERE bi.id = ? AND bi.project_id = ?`,
      [req.params.id, req.params.project_id]
    );
    if (!itemRow) return res.status(404).json({ error: 'Item not found' });

    const canEdit =
      ['principal','design_principal'].includes(me.role) ||
      (me.role === 'design_head'   && itemRow.stream === 'design') ||
      (me.role === 'services_head' && itemRow.stream === 'services');
    if (!canEdit) return res.status(403).json({ error: 'Not authorised to edit this item' });

    const allowed = ['trade','item_code','item_name','unit','quantity'];
    const fields = [], values = [];
    for (const k of allowed) {
      if (req.body[k] === undefined) continue;
      if (k === 'quantity') {
        const q = parseFloat(req.body[k]);
        if (isNaN(q) || q < 0) return res.status(400).json({ error: 'Quantity must be a non-negative number' });
        fields.push('quantity = ?'); values.push(q);
      } else {
        fields.push(`${k} = ?`);
        values.push(req.body[k] == null ? null : String(req.body[k]).trim());
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id);
    await db.query(`UPDATE boq_items SET ${fields.join(', ')} WHERE id = ?`, values);
    audit.log({ userId: me.id, action: 'boq.item.edit', entityType: 'boq_items',
                entityId: req.params.id, details: { fields: fields.map(f => f.split(' ')[0]), stream: itemRow.stream }, req });
    res.json({ success: true });
  }));

// DELETE /api/materials/:project_id/boq/items/:id — soft-delete (is_active=0, stream-scoped)
router.delete('/:project_id/boq/items/:id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;

    const [[itemRow]] = await db.query(
      `SELECT bi.*, bv.stream FROM boq_items bi
       JOIN boq_versions bv ON bi.boq_version_id = bv.id
       WHERE bi.id = ? AND bi.project_id = ?`,
      [req.params.id, req.params.project_id]
    );
    if (!itemRow) return res.status(404).json({ error: 'Item not found' });

    const canDelete =
      ['principal','design_principal'].includes(me.role) ||
      (me.role === 'design_head'   && itemRow.stream === 'design') ||
      (me.role === 'services_head' && itemRow.stream === 'services');
    if (!canDelete) return res.status(403).json({ error: 'Not authorised to delete this item' });

    // Check if any material requests reference this item — block hard-delete, allow soft
    const [[refCount]] = await db.query(
      'SELECT COUNT(*) AS c FROM material_requests WHERE boq_item_id = ?',
      [req.params.id]
    );
    await db.query('UPDATE boq_items SET is_active = 0 WHERE id = ?', [req.params.id]);
    audit.log({ userId: me.id, action: 'boq.item.delete', entityType: 'boq_items',
                entityId: req.params.id,
                details: { item_name: itemRow.item_name, had_requests: refCount.c > 0, stream: itemRow.stream }, req });
    res.json({
      success: true,
      message: refCount.c > 0
        ? `Deleted (${refCount.c} past material request(s) will continue to display this item name)`
        : 'Deleted',
    });
  }));

module.exports = router;
