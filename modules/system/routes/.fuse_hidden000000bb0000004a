// modules/system/routes/company-entities.js
// ============================================================
// Account Setup — manage company entities and their bank details.
//
// company_entities holds the legal entities (PROP, LLP, etc.) that
// projects are invoiced from and that ICICI bulk payments debit from.
// Principal manages entities. Finance can read.
//
// What is editable here:
//   - All fields EXCEPT entity_code and gstin (identity/tax fields;
//     changing them breaks invoices and tax records).
//
// What is NOT editable here:
//   - entity_code  — permanent identifier used in invoice sequences
//   - gstin        — tax registration; change requires re-filing
//
// Routes:
//   GET  /api/company-entities              — list all (principal + finance_admin)
//   POST /api/company-entities              — create new (principal only)
//   PATCH /api/company-entities/:id         — update details (principal only)
//   PATCH /api/company-entities/:id/status  — activate / deactivate (principal only)
// ============================================================

'use strict';

const express      = require('express');
const db           = require('../../../middleware/db');
const { requireAuth, requirePrincipal } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit        = require('../../../services/audit');

const router = express.Router();

// Finance admin may read entity list (project setup dropdown uses it too)
function requirePrincipalOrFinance(req, res, next) {
  const role = req.session?.user?.role;
  if (role === 'principal' || role === 'design_principal' || role === 'finance_admin') return next();
  return res.status(403).json({ error: 'Principal or finance access required', code: 'FORBIDDEN' });
}

// Columns finance/all can read — never expose GSTIN over the API for non-principals
const PUBLIC_COLS  = `id, entity_code, legal_name, bank_name, bank_account_no,
                      bank_ifsc, bank_account_holder, bank_branch, upi_id,
                      is_active, updated_at`;
const PRIVATE_COLS = `id, entity_code, legal_name, address_line1, address_line2,
                      city, state, pincode, gstin, state_code,
                      email_primary, email_finance, phone, sac_code,
                      bank_name, bank_account_no, bank_ifsc, bank_account_holder,
                      bank_branch, upi_id, is_active, created_at, updated_at`;

// ── GET /api/company-entities ───────────────────────────────────────────────
router.get('/', requireAuth, requirePrincipalOrFinance, asyncHandler(async (req, res) => {
  const isPrincipal = ['principal', 'design_principal'].includes(req.session.user.role);
  const cols = isPrincipal ? PRIVATE_COLS : PUBLIC_COLS;
  const [rows] = await db.query(
    `SELECT ${cols} FROM company_entities ORDER BY entity_code`
  );
  // Mask bank account — show only last 4 digits to non-principals
  if (!isPrincipal) {
    rows.forEach(r => {
      if (r.bank_account_no) {
        r.bank_account_no = '•••• ' + String(r.bank_account_no).slice(-4);
      }
    });
  }
  res.json({ entities: rows });
}));

// ── POST /api/company-entities ──────────────────────────────────────────────
router.post('/', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const {
    entity_code, legal_name, address_line1, address_line2,
    city, state, pincode, gstin, state_code,
    email_primary, email_finance, phone, sac_code,
    bank_name, bank_account_no, bank_ifsc, bank_account_holder,
    bank_branch, upi_id,
  } = req.body;

  if (!entity_code?.trim()) return res.status(400).json({ error: 'entity_code required', code: 'MISSING_ENTITY_CODE' });
  if (!legal_name?.trim())  return res.status(400).json({ error: 'legal_name required',  code: 'MISSING_LEGAL_NAME' });
  if (!bank_account_no?.trim()) return res.status(400).json({ error: 'bank_account_no required', code: 'MISSING_BANK_ACCOUNT' });
  if (!bank_ifsc?.trim())       return res.status(400).json({ error: 'bank_ifsc required',       code: 'MISSING_IFSC' });

  // entity_code must be unique
  const [[existing]] = await db.query(
    'SELECT id FROM company_entities WHERE entity_code = ? LIMIT 1',
    [entity_code.toUpperCase().trim()]
  );
  if (existing) return res.status(409).json({ error: `Entity code '${entity_code}' already exists`, code: 'DUPLICATE_ENTITY_CODE' });

  const [result] = await db.query(
    `INSERT INTO company_entities
       (entity_code, legal_name, address_line1, address_line2, city, state, pincode,
        gstin, state_code, email_primary, email_finance, phone, sac_code,
        bank_name, bank_account_no, bank_ifsc, bank_account_holder, bank_branch, upi_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      entity_code.toUpperCase().trim(), legal_name.trim(),
      address_line1 || null, address_line2 || null,
      city || 'Bengaluru', state || 'Karnataka', pincode || null,
      gstin?.trim() || null, state_code || null,
      email_primary || null, email_finance || null, phone || null,
      sac_code || '998311',
      bank_name?.trim() || null, bank_account_no.trim(), bank_ifsc.toUpperCase().trim(),
      bank_account_holder?.trim() || null, bank_branch?.trim() || null,
      upi_id?.trim() || null,
    ]
  );

  audit.log({
    userId: req.session.user.id,
    action: 'company_entity.create',
    entityType: 'company_entity',
    entityId: result.insertId,
    details: { entity_code, legal_name },
    req,
  });

  const [[created]] = await db.query(
    `SELECT ${PRIVATE_COLS} FROM company_entities WHERE id = ?`,
    [result.insertId]
  );
  res.status(201).json({ entity: created });
}));

// ── PATCH /api/company-entities/:id ────────────────────────────────────────
// Updates all fields EXCEPT entity_code and gstin.
router.patch('/:id', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const [[current]] = await db.query(
    'SELECT id, entity_code FROM company_entities WHERE id = ? LIMIT 1', [id]
  );
  if (!current) return res.status(404).json({ error: 'Entity not found', code: 'NOT_FOUND' });

  // Whitelist — entity_code and gstin are intentionally excluded
  const ALLOWED = [
    'legal_name', 'address_line1', 'address_line2', 'city', 'state', 'pincode',
    'state_code', 'email_primary', 'email_finance', 'phone', 'sac_code',
    'bank_name', 'bank_account_no', 'bank_ifsc', 'bank_account_holder',
    'bank_branch', 'upi_id',
  ];

  const updates = {};
  for (const col of ALLOWED) {
    if (req.body[col] !== undefined) {
      updates[col] = req.body[col] === '' ? null : req.body[col];
    }
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided', code: 'NOTHING_TO_UPDATE' });
  }

  // Normalise IFSC to uppercase
  if (updates.bank_ifsc) updates.bank_ifsc = String(updates.bank_ifsc).toUpperCase().trim();
  if (updates.bank_account_no) updates.bank_account_no = String(updates.bank_account_no).trim();

  const setClauses = Object.keys(updates).map(k => `\`${k}\` = ?`).join(', ');
  await db.query(
    `UPDATE company_entities SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
    [...Object.values(updates), id]
  );

  audit.log({
    userId: req.session.user.id,
    action: 'company_entity.update',
    entityType: 'company_entity',
    entityId: id,
    details: {
      entity_code: current.entity_code,
      fields_changed: Object.keys(updates),
      // Log last 4 of bank account only — not the full number
      bank_account_tail: updates.bank_account_no
        ? String(updates.bank_account_no).slice(-4)
        : undefined,
    },
    req,
  });

  const [[updated]] = await db.query(
    `SELECT ${PRIVATE_COLS} FROM company_entities WHERE id = ?`, [id]
  );
  res.json({ entity: updated });
}));

// ── PATCH /api/company-entities/:id/status ─────────────────────────────────
router.patch('/:id/status', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active (boolean) required', code: 'MISSING_STATUS' });
  }

  const [[entity]] = await db.query(
    'SELECT id, entity_code, legal_name FROM company_entities WHERE id = ? LIMIT 1', [id]
  );
  if (!entity) return res.status(404).json({ error: 'Entity not found', code: 'NOT_FOUND' });

  // Guard: can't deactivate the last active entity
  if (!is_active) {
    const [[{ active_count }]] = await db.query(
      'SELECT COUNT(*) AS active_count FROM company_entities WHERE is_active = 1'
    );
    if (active_count <= 1) {
      return res.status(409).json({
        error: 'Cannot deactivate the last active entity — at least one must remain active.',
        code: 'LAST_ACTIVE_ENTITY',
      });
    }
  }

  await db.query(
    'UPDATE company_entities SET is_active = ?, updated_at = NOW() WHERE id = ?',
    [is_active ? 1 : 0, id]
  );

  audit.log({
    userId: req.session.user.id,
    action: is_active ? 'company_entity.activate' : 'company_entity.deactivate',
    entityType: 'company_entity', entityId: id,
    details: { entity_code: entity.entity_code, legal_name: entity.legal_name },
    req,
  });

  res.json({ success: true, is_active });
}));

module.exports = router;
