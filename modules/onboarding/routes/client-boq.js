// routes/client-boq.js
// ============================================================
// CLIENT BOQ — our selling price, rolled up. What the client signs.
//
// nu PMC has TWO BOQs by design (NOT a duplication; this is a healthy split):
//
//   1. THIS FILE — client-facing BOQ. Selling price, rolled-up items. RCC
//      stays as one line "RCC M25 — ₹X per cum". This is what the client
//      signs against, what claims/RA-bills compute from, what appears on
//      invoices.
//
//   2. modules/design-services/routes/materials.js — internal/material BOQ.
//      Granular cost basis. RCC explodes into cement + steel + aggregate +
//      labour + shuttering. Drives vendor payments, GRNs, material requests.
//      This is what WE pay for.
//
// 1:N mapping between THIS BOQ and the material BOQ. Different schemas
// because they hold different data; different access patterns because
// different people read them (client BOQ is shown to clients; material
// BOQ is internal). DO NOT MERGE.
// ============================================================
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { requirePermission } = require('../../../middleware/permissions');
const { readFile: readExcel } = require('../../../middleware/excel');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit  = require('../../../services/audit');
const sequence = require('../../../services/sequence');
const {
  STREAM_HEADS_OR_PRINCIPAL: STREAM_HEADS,
  CLIENT_RATE_ROLES,
  HEADS_WITH_FINANCE,
} = require('../../../services/roles');
const router  = express.Router();

// GET /api/client-boq/:project_id — get client BOQ (rates visible to heads + finance_admin)
router.get('/:project_id', requireAuth, requireRole(...HEADS_WITH_FINANCE), asyncHandler(async (req, res) => {
    const [versions] = await db.query(
      `SELECT * FROM client_boq_versions WHERE project_id = ? AND is_current = 1`,
      [req.params.project_id]
    );

    const [items] = await db.query(
      `SELECT cb.*, cbv.stream FROM client_boq_items cb
       JOIN client_boq_versions cbv ON cb.boq_version_id = cbv.id
       WHERE cbv.project_id = ? AND cbv.is_current = 1
       ORDER BY cb.stream, cb.trade, cb.display_order`,
      [req.params.project_id]
    );

    // Group by stream and trade
    const byStream = {};
    items.forEach(item => {
      if (!byStream[item.stream]) byStream[item.stream] = {};
      if (!byStream[item.stream][item.trade]) byStream[item.stream][item.trade] = [];
      byStream[item.stream][item.trade].push(item);
    });

    // Calculate totals
    const totalByStream = {};
    items.forEach(item => {
      if (!totalByStream[item.stream]) totalByStream[item.stream] = 0;
      totalByStream[item.stream] += parseFloat(item.client_rate || 0) * parseFloat(item.quantity || 0);
    });

    res.json({
      versions,
      items,
      byStream,
      totals: totalByStream,
      // Anyone past the requireRole(...CLIENT_RATE_ROLES) gate is authorised to see rates.
      can_see_rates: true
    });

  }));

// POST /api/client-boq/:project_id/upload — R/S uploads client BOQ
router.post('/:project_id/upload', requireAuth, requireProjectScope(), requireRole(...STREAM_HEADS), asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { stream } = req.body;
    if (!stream) return res.status(400).json({ error: 'Stream required' });

    // Handle file upload inline
    const { upload } = require('../../../middleware/upload');
    const multerUpload = upload.single('boq');

    await new Promise((resolve, reject) => {
      multerUpload(req, res, err => err ? reject(err) : resolve());
    });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Parse Excel BEFORE the transaction so a malformed file doesn't tie up
    // a DB connection. Items are validated/cleaned here; the tx just persists.
    const rows = await readExcel(file.path);
    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const row      = rows[i];
      const trade    = row['Trade']       || row['trade']       || '';
      const itemCode = row['Code']        || row['item_code']   || null;
      const itemName = row['Item']        || row['Description'] || row['item_name'] || '';
      const unit     = row['Unit']        || row['unit']        || 'nos';
      const quantity = parseFloat(row['Quantity'] || row['qty'] || 0);
      const rate     = parseFloat(row['Rate']     || row['client_rate'] || 0);
      if (!trade || !itemName) continue;
      items.push({ trade, itemCode, itemName, unit, quantity, rate, displayOrder: i });
    }

    // Bug B22: version row + items used to be separate queries with no
    // transaction. If any item INSERT failed mid-loop, the version row was
    // already committed and the items list was incomplete — silently
    // corrupting the BOQ. Now: version + all items in one transaction.
    // The version_number race is handled by sequence.insertWithRetry around
    // the whole tx — if uq_client_boq_version rejects, the tx rolls back
    // and a new attempt picks the next number.
    let nextVer, versionId, itemsImported = 0;
    await sequence.insertWithRetry(async () => {
      await db.tx(async (conn) => {
        const [lastVerRows] = await conn.query(
          'SELECT version_number FROM client_boq_versions WHERE project_id = ? AND stream = ? ORDER BY id DESC LIMIT 1',
          [pid, stream]
        );
        const lastVer = lastVerRows[0];
        nextVer = (parseInt(lastVer?.version_number || 0, 10) || 0) + 1;

        await conn.query(
          'UPDATE client_boq_versions SET is_current = 0 WHERE project_id = ? AND stream = ?',
          [pid, stream]
        );

        const [vRes] = await conn.query(
          `INSERT INTO client_boq_versions (project_id, stream, version_number, label, file_path, is_current, uploaded_by)
           VALUES (?,?,?,?,?,1,?)`,
          [pid, stream, nextVer, `v${nextVer}`, file.path, me.id]
        );
        versionId = vRes.insertId;

        // Batch-insert items in one query if any.
        if (items.length) {
          const placeholders = items.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',');
          const flat = [];
          for (const it of items) {
            flat.push(versionId, pid, stream, it.trade, it.itemCode, it.itemName, it.unit, it.quantity, it.rate, it.displayOrder);
          }
          await conn.query(
            `INSERT INTO client_boq_items
               (boq_version_id, project_id, stream, trade, item_code, item_name, unit, quantity, client_rate, display_order)
             VALUES ${placeholders}`,
            flat
          );
          itemsImported = items.length;
        }
      });
    });

    // Bug B24: high-stakes event — BOQ defines all client billing for the
    // project. Must be audited.
    audit.log({ userId: me.id, action: 'client_boq.upload',
      entityType: 'client_boq_versions', entityId: versionId,
      details: { project_id: parseInt(pid), stream, version_number: nextVer, items_imported: itemsImported }, req });

    res.json({ success: true, items_imported: itemsImported, version: `v${nextVer}` });

  }));

// PATCH /api/client-boq/:project_id/items/:item_id/rate — update rate
router.patch('/:project_id/items/:item_id/rate', requireAuth, requireProjectScope(),
  requirePermission('finance.client-boq.edit-rate'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;

    const { ClientBOQRate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(ClientBOQRate, req, res);
    if (!body) return;

    await db.query(
      'UPDATE client_boq_items SET client_rate = ? WHERE id = ? AND project_id = ?',
      [body.client_rate, req.params.item_id, req.params.project_id]
    );

    // Bug B25: rate change directly affects client billing — must be audited.
    audit.log({ userId: me.id, action: 'client_boq.rate_update',
      entityType: 'client_boq_items', entityId: parseInt(req.params.item_id),
      details: { project_id: parseInt(req.params.project_id), client_rate: body.client_rate }, req });

    res.json({ success: true });
  }));

// PATCH /api/client-boq/:project_id/items/:item_id/hsn — update HSN code
// Editable by R/S and Finance Admin — may need iterations for GST accuracy
router.patch('/:project_id/items/:item_id/hsn', requireAuth, requireProjectScope(),
  requirePermission('finance.client-boq.edit-hsn'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;

    const { hsn_code, note } = req.body;
    // hsn_code can be empty string — allows clearing a wrong HSN
    if (hsn_code === undefined) return res.status(400).json({ error: 'hsn_code required (can be empty string to clear)' });

    // Validate format if provided — HSN is 4, 6, or 8 digits
    if (hsn_code && !/^[0-9]{4}([0-9]{2}([0-9]{2})?)?$/.test(hsn_code)) {
      return res.status(400).json({ error: 'HSN must be 4, 6, or 8 digits' });
    }

    await db.query(
      'UPDATE client_boq_items SET hsn_code = ? WHERE id = ? AND project_id = ?',
      [hsn_code || null, req.params.item_id, req.params.project_id]
    );

    // Log the change for audit trail — Finance Admin may iterate
    await audit.log({
      userId: me.id,
      action: 'client_boq.hsn_update',
      entityType: 'client_boq_items',
      entityId: parseInt(req.params.item_id),
      details: {
        project_id: parseInt(req.params.project_id),
        hsn_code: hsn_code || null,
        note: note || null,
        actor: me.full_name,
      },
      req,
    });

    res.json({
      success: true,
      hsn_code: hsn_code || null,
      message: hsn_code
        ? `HSN ${hsn_code} saved — confirm with Finance Admin for GST accuracy`
        : 'HSN cleared'
    });
  }));

module.exports = router;
