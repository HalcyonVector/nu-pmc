// routes/nav-admin.js — IT Admin nav editor (Sprint 2 Item 8).
//
// Endpoints:
//   GET  /api/nav-admin/current/:role — read current nav for a role (editor source)
//   POST /api/nav-admin/propose       — IT Admin submits a proposed nav for a role
//   GET  /api/nav-admin/drafts        — Principal sees all pending drafts
//   POST /api/nav-admin/:id/approve   — Principal approves a draft (it goes live)
//   POST /api/nav-admin/:id/reject    — Principal rejects a draft (reason optional)
//
// Flow:
//   IT Admin → POST /propose with {role, items: [{bucket, tab_key, sort_order}]}
//   → writes one draft_group to role_nav_drafts with status='pending_principal'
//   → creates an in-app notification to the principal (via `notifications` table)
//
//   Principal → POST /:draft_group_id/approve
//   → transactionally deletes current role_nav rows for that role + inserts
//     the approved set + marks draft rows approved + writes audit snapshot
//
// Notes:
//   - Only ONE pending draft per role at a time. A new proposal supersedes
//     any existing pending draft for the same role (the old one is auto-rejected).
//   - role_nav is DB-driven (loaded at login). Approved changes take effect
//     on next login — existing sessions keep their cached nav.

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requireRole } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router = express.Router();

const VALID_BUCKETS = ['home','work','money','more','pending','strip'];

// Role whitelist — IT Admin can only edit nav for these. Prevents accidental
// editing of 'audit' (read-only test account) or 'it_admin' (bootstrap lock).
const EDITABLE_ROLES = [
  'principal','design_principal','pmc_head','design_head','services_head',
  'team_lead','jr_architect','jr_engineer','services_engineer','coordinator',
  'site_manager','senior_site_manager','finance_admin','trainee',
];

// ── GET /api/nav-admin/current/:role — fetch current nav as editor input
router.get('/current/:role', requireAuth, requireRole('it_admin','principal','audit'),
  asyncHandler(async (req, res) => {
    const role = req.params.role;
    if (!EDITABLE_ROLES.includes(role) && role !== 'audit' && role !== 'it_admin') {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const [rows] = await db.query(
      `SELECT bucket, tab_key, sort_order, is_visible
         FROM role_nav
        WHERE role = ?
        ORDER BY FIELD(bucket,'home','work','money','pending','more','strip'), sort_order`,
      [role]
    );
    res.json({ role, items: rows });
  })
);

// ── POST /api/nav-admin/propose — IT Admin submits a proposed nav
router.post('/propose', requireAuth, requireRole('it_admin'), asyncHandler(async (req, res) => {
  const me = req.session.user;
  const { role, items, note } = req.body || {};

  // Validation
  if (!EDITABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role not editable' });
  }

  // Self-lockout guard: IT Admin cannot edit their own role.
  // If they did, and the new nav omits 'nav_editor', they'd be stuck
  // with no way to revert — the Principal would have to manually SQL
  // them back in. The it_admin role IS listed in EDITABLE_ROLES for
  // cases where a Principal (using an it_admin session for ops work)
  // needs to edit it — but self-edits are blocked here regardless.
  if (role === me.role) {
    return res.status(403).json({
      error: 'Cannot edit your own role — self-lockout risk. Ask a Principal to make this change, or propose for a different role first.',
      code:  'SELF_ROLE_EDIT_BLOCKED',
    });
  }

  // Governance lockout guard: Principal + Design Principal must always
  // have access to the Pending tab and nav_editor (to approve/reject
  // subsequent drafts). If IT Admin proposes a nav for them that strips
  // those tabs, block the proposal — otherwise the firm loses its
  // override mechanism and only a DB hand-edit can recover it.
  if (['principal', 'design_principal'].includes(role)) {
    const tabKeys = new Set(items.map(i => i.tab_key));
    const hasApprovals = tabKeys.has('approvals') || tabKeys.has('nav_drafts');
    const hasPendingBucket = items.some(i => i.bucket === 'pending');
    if (!hasPendingBucket && !hasApprovals) {
      return res.status(400).json({
        error: 'Proposed nav strips Principal\'s ability to approve nav drafts (no pending bucket, no approvals tab). This would lock out the firm\'s governance override. Keep at least one of these in the draft.',
        code:  'GOVERNANCE_LOCKOUT_BLOCKED',
      });
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }
  for (const it of items) {
    if (!VALID_BUCKETS.includes(it.bucket)) {
      return res.status(400).json({ error: `Invalid bucket: ${it.bucket}` });
    }
    if (!it.tab_key || typeof it.tab_key !== 'string') {
      return res.status(400).json({ error: 'tab_key required for each item' });
    }
    if (typeof it.sort_order !== 'number' || it.sort_order < 1 || it.sort_order > 99) {
      return res.status(400).json({ error: 'sort_order must be 1-99' });
    }
  }

  // Enforce bottom-bar cap: max 4 non-strip, non-pending buckets
  // Actually — pending IS one of the 4 buttons. So cap is 4 distinct buckets
  // across home/work/money/pending/more. Strip is a separate mode (trainee).
  const activeBuckets = new Set(items.filter(i => i.bucket !== 'strip').map(i => i.bucket));
  if (activeBuckets.size > 5) {
    return res.status(400).json({ error: 'Max 5 bucket categories' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Auto-reject any existing pending draft for this role (supersede).
    // Pre-v5.22 this was an unguarded WHERE+UPDATE; now via state machine
    // transitionMany so the bypass audit stays clean.
    const [pendingRows] = await conn.query(
      `SELECT id FROM role_nav_drafts WHERE role = ? AND status = 'pending_principal'`,
      [role]
    );
    if (pendingRows.length) {
      const sm = require('../../../services/state-machines').roleNavDraft;
      await sm.transitionMany({
        ids: pendingRows.map(r => r.id),
        from: 'pending_principal', to: 'rejected',
        extraCols: { reviewed_at: new Date(), reject_reason: 'Superseded by newer proposal' },
        conn,
      });
    }

    // Get next draft_group_id (simple: max+1)
    const [[{ next_id }]] = await conn.query(
      'SELECT COALESCE(MAX(draft_group_id),0) + 1 AS next_id FROM role_nav_drafts'
    );

    // Insert each item as a draft row
    for (const it of items) {
      await conn.query(
        `INSERT INTO role_nav_drafts
           (draft_group_id, role, bucket, tab_key, sort_order, is_visible,
            proposed_by, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [next_id, role, it.bucket, it.tab_key, it.sort_order,
         it.is_visible === false ? 0 : 1, me.id, note || null]
      );
    }

    await conn.commit();
    await audit.log({
      userId: me.id, req,
      action: 'nav.propose',
      details: { role, draft_group_id: next_id, item_count: items.length }
    });
    res.json({ success: true, draft_group_id: next_id, role, item_count: items.length });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// ── GET /api/nav-admin/drafts — list pending drafts (Principal view)
router.get('/drafts', requireAuth, requireRole('principal','design_principal','it_admin','audit'),
  asyncHandler(async (req, res) => {
    const [rows] = await db.query(
      `SELECT draft_group_id, role, bucket, tab_key, sort_order, is_visible,
              proposed_at, note, proposed_by
         FROM role_nav_drafts
        WHERE status = 'pending_principal'
        ORDER BY draft_group_id, bucket, sort_order`
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(rows.map(r => r.proposed_by).filter(Boolean));
    rows.forEach(r => { r.proposed_by_name = users.get(r.proposed_by)?.full_name || null; });

    // Group by draft_group_id
    const groups = {};
    for (const r of rows) {
      if (!groups[r.draft_group_id]) {
        groups[r.draft_group_id] = {
          draft_group_id: r.draft_group_id,
          role: r.role,
          proposed_by: r.proposed_by_name,
          proposed_at: r.proposed_at,
          note: r.note,
          items: []
        };
      }
      groups[r.draft_group_id].items.push({
        bucket: r.bucket,
        tab_key: r.tab_key,
        sort_order: r.sort_order,
        is_visible: !!r.is_visible
      });
    }

    // Also attach the current nav for each role, so the frontend can render
    // a plain-English diff. One query per distinct role.
    const roles = [...new Set(rows.map(r => r.role))];
    for (const role of roles) {
      const [currentRows] = await db.query(
        `SELECT bucket, tab_key, sort_order, is_visible
           FROM role_nav WHERE role = ? ORDER BY bucket, sort_order`,
        [role]
      );
      // Attach to all groups of this role
      for (const g of Object.values(groups)) {
        if (g.role === role) g.current = currentRows;
      }
    }

    res.json({ drafts: Object.values(groups) });
  })
);

// ── POST /api/nav-admin/:id/approve — Principal approves a draft
router.post('/:draft_group_id/approve', requireAuth, requireRole('principal','design_principal'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const draftGroupId = parseInt(req.params.draft_group_id);
    if (!draftGroupId) return res.status(400).json({ error: 'Invalid draft_group_id' });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Load the draft rows
      const [drafts] = await conn.query(
        `SELECT role, bucket, tab_key, sort_order, is_visible, proposed_by
           FROM role_nav_drafts
          WHERE draft_group_id = ? AND status = 'pending_principal'
          FOR UPDATE`,
        [draftGroupId]
      );
      if (!drafts.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Draft not found or already resolved' });
      }

      const role = drafts[0].role;
      const proposedBy = drafts[0].proposed_by;

      // Delete the role's current nav rows — replaced below
      await conn.query('DELETE FROM role_nav WHERE role = ?', [role]);

      // Insert the approved items as live role_nav
      for (const d of drafts) {
        await conn.query(
          `INSERT INTO role_nav (role, bucket, tab_key, sort_order, is_visible)
           VALUES (?, ?, ?, ?, ?)`,
          [d.role, d.bucket, d.tab_key, d.sort_order, d.is_visible]
        );
      }

      // Mark the draft rows approved (state machine transitionMany)
      const [draftRows] = await conn.query(
        `SELECT id FROM role_nav_drafts WHERE draft_group_id = ? AND status = 'pending_principal'`,
        [draftGroupId]
      );
      if (draftRows.length) {
        const sm = require('../../../services/state-machines').roleNavDraft;
        await sm.transitionMany({
          ids: draftRows.map(r => r.id),
          from: 'pending_principal', to: 'approved',
          extraCols: { reviewed_by: me.id, reviewed_at: new Date() },
          conn,
        });
      }

      // Write audit snapshot
      await conn.query(
        `INSERT INTO role_nav_audit
           (draft_group_id, role, action, proposed_by, reviewed_by, snapshot_json)
         VALUES (?, ?, 'approved', ?, ?, ?)`,
        [draftGroupId, role, proposedBy, me.id, JSON.stringify(drafts)]
      );

      await conn.commit();
      await audit.log({
        userId: me.id, req,
        action: 'nav.approve',
        details: { role, draft_group_id: draftGroupId, item_count: drafts.length }
      });
      res.json({ success: true, role, item_count: drafts.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// ── POST /api/nav-admin/:id/reject — Principal rejects a draft
router.post('/:draft_group_id/reject', requireAuth, requireRole('principal','design_principal'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const draftGroupId = parseInt(req.params.draft_group_id);
    const reason = (req.body && req.body.reason) || null;
    if (!draftGroupId) return res.status(400).json({ error: 'Invalid draft_group_id' });

    // Verify draft exists and is pending
    const [[existing]] = await db.query(
      `SELECT role, proposed_by FROM role_nav_drafts
        WHERE draft_group_id = ? AND status = 'pending_principal' LIMIT 1`,
      [draftGroupId]
    );
    if (!existing) return res.status(404).json({ error: 'Draft not found or already resolved' });

    const [draftRows] = await db.query(
      `SELECT id FROM role_nav_drafts WHERE draft_group_id = ? AND status = 'pending_principal'`,
      [draftGroupId]
    );
    if (draftRows.length) {
      const sm = require('../../../services/state-machines').roleNavDraft;
      await sm.transitionMany({
        ids: draftRows.map(r => r.id),
        from: 'pending_principal', to: 'rejected',
        extraCols: { reviewed_by: me.id, reviewed_at: new Date(), reject_reason: reason },
      });
    }

    // Audit snapshot
    const [draftSnapshot] = await db.query(
      `SELECT role, bucket, tab_key, sort_order, is_visible
         FROM role_nav_drafts WHERE draft_group_id = ?`,
      [draftGroupId]
    );
    await db.query(
      `INSERT INTO role_nav_audit
         (draft_group_id, role, action, proposed_by, reviewed_by, snapshot_json, reject_reason)
       VALUES (?, ?, 'rejected', ?, ?, ?, ?)`,
      [draftGroupId, existing.role, existing.proposed_by, me.id,
       JSON.stringify(draftSnapshot), reason]
    );

    await audit.log({
      userId: me.id, req,
      action: 'nav.reject',
      details: { role: existing.role, draft_group_id: draftGroupId, reason }
    });
    res.json({ success: true });
  })
);

module.exports = router;
