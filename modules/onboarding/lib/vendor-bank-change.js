// modules/onboarding/lib/vendor-bank-change.js
// ============================================================
// V8 — Vendor Bank Detail Protection (Layers 2 + 3).
//
// One of FOUR vendor-data surfaces (healthy split — see routes/vendors.js
// header for the full map). This file = BANK-CHANGE helper. State machine
// + tx wrapper for "vendor wants to change their bank account." Called
// from BOTH the staff side (routes/vendors.js) and the vendor-public side
// (token confirmation in routes/vendor-public.js). Lives in /lib for that
// reason — shared by two routes.
//
// Dual-approval workflow for any change to bank_account / bank_ifsc / bank_name
// on an existing vendor (Layer 1 / B36 — auto-uncheck on bank change — was
// shipped earlier as the route's existing reset path).
//
// Allowed proposer roles:
//   finance_admin, pmc_head, design_head, services_head
//   (principal / design_principal can view but DO NOT propose per spec —
//    they only oversee. If they want a change, they ask one of the above.)
//
// Allowed approver roles depend on who proposed:
//   - finance_admin proposed   → principal | design_principal approves
//   - pmc/design/services head proposed → finance_admin approves
//                                          (principal / design_principal also OK,
//                                           gives them direct override path)
//
// Hard rule (separation of duties): proposer.user_id !== approver.user_id.
// ============================================================

'use strict';

const db = require('../../../middleware/db');
const audit = require('../../../services/audit');

// Roles allowed to propose. Principals are NOT in this list per spec —
// their entry is seeded into role_permissions for sheet consistency, but
// the route gate enforces role-based blocking.
const PROPOSER_ROLES = ['finance_admin', 'pmc_head', 'design_head', 'services_head'];

// Roles allowed to approve a proposal made by finance_admin
const APPROVER_FOR_FINANCE_PROPOSAL = ['principal', 'design_principal'];

// Roles allowed to approve a proposal made by a PMC/design/services head
const APPROVER_FOR_HEAD_PROPOSAL = ['principal', 'design_principal', 'finance_admin'];

class BankChangeError extends Error {
  constructor(msg, { code = 'BANK_CHANGE_INVALID', status = 400 } = {}) {
    super(msg);
    this.name = 'BankChangeError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Propose a bank-detail change for a vendor.
 * Validates the proposer's role, snapshots before/after, writes a pending
 * approval row, and emits a vendor_alerts row of type bank_change.proposed.
 *
 * Layer 1 (B36 reset on bank-change) is preserved via the existing PATCH
 * /master/:id handler. This propose endpoint is for explicit dual-approval
 * mode and does NOT itself flip clearance_status — the commit step does.
 *
 * @param {object} opts
 * @param {object} opts.proposer            { id, role, full_name }
 * @param {number} opts.vendorId
 * @param {object} opts.changes             new values; only bank_* fields read
 * @param {string} [opts.changes.bank_name]
 * @param {string} [opts.changes.bank_account]
 * @param {string} [opts.changes.bank_ifsc]
 * @param {string} [opts.reason]            free text (required for audit)
 * @param {object} [opts.req]               for audit-log IP/UA
 *
 * @returns {Promise<{ approvalId:number, alertId:number }>}
 */
async function propose(opts) {
  const { proposer, vendorId, changes, reason, req = null } = opts;

  // 1. Role check — proposer must be in PROPOSER_ROLES
  if (!proposer || !proposer.role) {
    throw new BankChangeError('Proposer identity required', { code: 'PROPOSER_MISSING', status: 401 });
  }
  if (!PROPOSER_ROLES.includes(proposer.role)) {
    throw new BankChangeError(
      `Role '${proposer.role}' may not propose bank changes. Ask finance_admin or PMC/design/services head.`,
      { code: 'PROPOSER_ROLE_DENIED', status: 403 }
    );
  }

  // 2. Reason is required (audit trail)
  if (!reason || String(reason).trim().length < 5) {
    throw new BankChangeError('Reason for the change is required (min 5 chars)', { code: 'REASON_MISSING' });
  }

  // 3. Read current vendor state — provides BEFORE snapshot + change detection
  const [[v]] = await db.query(
    `SELECT id, vendor_name, bank_name, bank_account, bank_ifsc, clearance_status
       FROM vendors WHERE id = ?`,
    [vendorId]
  );
  if (!v) throw new BankChangeError('Vendor not found', { code: 'VENDOR_NOT_FOUND', status: 404 });

  // 4. Compute AFTER snapshot. Only bank_* fields are tracked here. Anything
  //    not in `changes` is preserved as-is (so a partial proposal is allowed).
  const after = {
    bank_name:    changes.bank_name    !== undefined ? (changes.bank_name    || null) : v.bank_name,
    bank_account: changes.bank_account !== undefined ? (changes.bank_account || null) : v.bank_account,
    bank_ifsc:    changes.bank_ifsc    !== undefined ? (changes.bank_ifsc    || null) : v.bank_ifsc,
  };

  // 5. Reject no-op proposals — at least one field must actually change
  const noChange =
    after.bank_name    === v.bank_name &&
    after.bank_account === v.bank_account &&
    after.bank_ifsc    === v.bank_ifsc;
  if (noChange) {
    throw new BankChangeError('No bank fields are changing', { code: 'NO_CHANGE' });
  }

  // 6. Reject if a pending proposal already exists for this vendor
  //    (prevents two concurrent proposals competing — second proposer gets
  //    a 409 and a hint that the existing one needs resolving first).
  const [[existing]] = await db.query(
    `SELECT id, proposed_by FROM vendor_bank_change_approvals
      WHERE vendor_id = ? AND status = 'pending' LIMIT 1`,
    [vendorId]
  );
  if (existing) {
    throw new BankChangeError(
      `A bank-change proposal for this vendor is already pending (id ${existing.id}). It must be approved or rejected first.`,
      { code: 'PROPOSAL_PENDING', status: 409 }
    );
  }

  // 7. Insert approval row + alert row in a transaction
  const result = await db.tx(async (conn) => {
    const [insApproval] = await conn.query(
      `INSERT INTO vendor_bank_change_approvals
         (vendor_id, status, proposed_by, proposed_by_role, proposed_at,
          proposal_reason,
          before_bank_name, before_bank_account, before_bank_ifsc,
          after_bank_name,  after_bank_account,  after_bank_ifsc)
       VALUES (?, 'pending', ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, proposer.id, proposer.role, String(reason).trim(),
       v.bank_name, v.bank_account, v.bank_ifsc,
       after.bank_name, after.bank_account, after.bank_ifsc]
    );
    const approvalId = insApproval.insertId;

    const payload = {
      approval_id: approvalId,
      vendor_id: vendorId,
      vendor_name: v.vendor_name,
      proposer: { id: proposer.id, role: proposer.role, name: proposer.full_name || null },
      reason: String(reason).trim(),
      before: { bank_name: v.bank_name, bank_account: v.bank_account, bank_ifsc: v.bank_ifsc },
      after:  after,
      vendor_clearance_status_before: v.clearance_status,
    };
    const [insAlert] = await conn.query(
      `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
       VALUES (?, 'bank_change.proposed', ?)`,
      [vendorId, JSON.stringify(payload)]
    );
    return { approvalId, alertId: insAlert.insertId };
  });

  audit.log({
    userId: proposer.id,
    action: 'vendor.bank_change.propose',
    entityType: 'vendor_bank_change_approvals',
    entityId: result.approvalId,
    details: {
      vendor_id: vendorId,
      changed_fields: Object.entries(after).filter(([k, val]) => val !== v[k]).map(([k]) => k),
      reason: String(reason).trim(),
    },
    req,
  });

  // Step 1: send confirmation poll to vendor's personal Matrix room.
  // Peer approval fires only AFTER vendor confirms (handled by vote reader).
  // Non-blocking.
  try {
    const signoffGate = require('../../../services/signoff-gate');
    await signoffGate.triggerSignoff(
      'vendor_bank_vendor_confirm',
      result.approvalId,
      null,
      {
        question: `${v.vendor_name} — bank details change requested. Please confirm this is correct.`,
        documentRow: { id: result.approvalId, vendor_id: vendorId },
        triggeredBy: proposer.id,
      }
    );
  } catch (err) {
    console.error('[vendor-bank-change.propose vendor-confirm]', err.message);
  }

  return result;
}

/**
 * Approve a pending bank-change proposal. Commits the change to the vendor
 * row, flips clearance_status → pending (vendor must be re-cleared by
 * finance after the bank change lands), and emits two alerts:
 *   bank_change.approved   — moment of approval
 *   bank_change.committed  — when the vendor row is actually updated
 *
 * Hard rule: approver.user_id !== proposer.user_id (separation of duties).
 *
 * @param {object} opts
 * @param {object} opts.approver  { id, role, full_name }
 * @param {number} opts.approvalId
 * @param {object} [opts.req]
 * @returns {Promise<{ committed: true }>}
 */
async function approve(opts) {
  const { approver, approvalId, req = null } = opts;

  if (!approver || !approver.role) {
    throw new BankChangeError('Approver identity required', { code: 'APPROVER_MISSING', status: 401 });
  }

  // 1. Read the proposal — must be 'pending'
  const [[ap]] = await db.query(
    `SELECT * FROM vendor_bank_change_approvals WHERE id = ?`,
    [approvalId]
  );
  if (!ap) throw new BankChangeError('Proposal not found', { code: 'PROPOSAL_NOT_FOUND', status: 404 });
  if (ap.status !== 'pending') {
    throw new BankChangeError(
      `Proposal is already ${ap.status}`,
      { code: 'PROPOSAL_NOT_OPEN', status: 409 }
    );
  }

  // 2. Approver role check based on who proposed
  const allowed = ap.proposed_by_role === 'finance_admin'
    ? APPROVER_FOR_FINANCE_PROPOSAL
    : APPROVER_FOR_HEAD_PROPOSAL;
  if (!allowed.includes(approver.role)) {
    throw new BankChangeError(
      `Role '${approver.role}' may not approve a proposal made by '${ap.proposed_by_role}'. Allowed: ${allowed.join(', ')}.`,
      { code: 'APPROVER_ROLE_DENIED', status: 403 }
    );
  }

  // 3. Separation of duties — same user cannot propose AND approve
  if (ap.proposed_by === approver.id) {
    throw new BankChangeError(
      'You cannot approve a change you proposed yourself. A different user must approve.',
      { code: 'SELF_APPROVAL_DENIED', status: 403 }
    );
  }

  // 4. Commit transaction: flip approval status, apply change to vendor row,
  //    flip clearance_status to 'pending' via state machine, emit alerts.
  await db.tx(async (conn) => {
    // 4a. Flip approval row pending → approved (with row_version concurrency guard)
    const [upd] = await conn.query(
      `UPDATE vendor_bank_change_approvals
          SET status = 'approved',
              approved_by = ?, approved_by_role = ?, approved_at = NOW(),
              row_version = row_version + 1
        WHERE id = ? AND status = 'pending' AND row_version = ?`,
      [approver.id, approver.role, approvalId, ap.row_version]
    );
    if (upd.affectedRows === 0) {
      // Another approver got there first OR row_version drifted
      throw new BankChangeError(
        'Proposal was modified or already approved — reload and try again',
        { code: 'PROPOSAL_RACE', status: 409 }
      );
    }

    // 4b. Apply the AFTER snapshot to vendors row
    await conn.query(
      `UPDATE vendors SET bank_name = ?, bank_account = ?, bank_ifsc = ?
        WHERE id = ?`,
      [ap.after_bank_name, ap.after_bank_account, ap.after_bank_ifsc, ap.vendor_id]
    );

    // 4c. Reset clearance_status to 'pending' if vendor was cleared.
    //     Use the existing vendor state machine — cleared → pending edge.
    const [[curVen]] = await conn.query(
      'SELECT clearance_status FROM vendors WHERE id = ?', [ap.vendor_id]
    );
    if (curVen && curVen.clearance_status === 'cleared') {
      const sm = require('../../../services/state-machines').vendor;
      await sm.transition({
        id: ap.vendor_id, from: 'cleared', to: 'pending',
        extraCols: { cleared_by: null, cleared_at: null },
        conn,
      });
    }

    // 4d. Stamp committed_at on approval row
    await conn.query(
      `UPDATE vendor_bank_change_approvals SET committed_at = NOW() WHERE id = ?`,
      [approvalId]
    );

    // 4e. Emit alerts: approved + committed
    const approvedPayload = {
      approval_id: approvalId, vendor_id: ap.vendor_id,
      approver: { id: approver.id, role: approver.role, name: approver.full_name || null },
      proposer: { id: ap.proposed_by, role: ap.proposed_by_role },
    };
    await conn.query(
      `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
       VALUES (?, 'bank_change.approved', ?)`,
      [ap.vendor_id, JSON.stringify(approvedPayload)]
    );

    const committedPayload = {
      ...approvedPayload,
      after: {
        bank_name:    ap.after_bank_name,
        bank_account: ap.after_bank_account,
        bank_ifsc:    ap.after_bank_ifsc,
      },
      clearance_status_after: 'pending',  // because we always reset on commit
    };
    await conn.query(
      `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
       VALUES (?, 'bank_change.committed', ?)`,
      [ap.vendor_id, JSON.stringify(committedPayload)]
    );
  });

  audit.log({
    userId: approver.id,
    action: 'vendor.bank_change.approve',
    entityType: 'vendor_bank_change_approvals',
    entityId: approvalId,
    details: {
      vendor_id: ap.vendor_id,
      proposer_id: ap.proposed_by, proposer_role: ap.proposed_by_role,
    },
    req,
  });

  return { committed: true };
}

/**
 * Reject a pending bank-change proposal. Does NOT modify the vendor row.
 * Emits a vendor_alerts row of type bank_change.rejected.
 */
async function reject(opts) {
  const { approver, approvalId, reason, req = null } = opts;

  if (!approver || !approver.role) {
    throw new BankChangeError('Approver identity required', { code: 'APPROVER_MISSING', status: 401 });
  }
  if (!reason || String(reason).trim().length < 5) {
    throw new BankChangeError('Rejection reason is required (min 5 chars)', { code: 'REASON_MISSING' });
  }

  const [[ap]] = await db.query(
    `SELECT * FROM vendor_bank_change_approvals WHERE id = ?`,
    [approvalId]
  );
  if (!ap) throw new BankChangeError('Proposal not found', { code: 'PROPOSAL_NOT_FOUND', status: 404 });
  if (ap.status !== 'pending') {
    throw new BankChangeError(`Proposal is already ${ap.status}`, { code: 'PROPOSAL_NOT_OPEN', status: 409 });
  }

  const allowed = ap.proposed_by_role === 'finance_admin'
    ? APPROVER_FOR_FINANCE_PROPOSAL
    : APPROVER_FOR_HEAD_PROPOSAL;
  if (!allowed.includes(approver.role)) {
    throw new BankChangeError(
      `Role '${approver.role}' may not reject a proposal made by '${ap.proposed_by_role}'. Allowed: ${allowed.join(', ')}.`,
      { code: 'APPROVER_ROLE_DENIED', status: 403 }
    );
  }
  if (ap.proposed_by === approver.id) {
    throw new BankChangeError(
      'You cannot reject a change you proposed yourself.',
      { code: 'SELF_REJECT_DENIED', status: 403 }
    );
  }

  await db.tx(async (conn) => {
    const [upd] = await conn.query(
      `UPDATE vendor_bank_change_approvals
          SET status = 'rejected',
              approved_by = ?, approved_by_role = ?, approved_at = NOW(),
              rejection_reason = ?,
              row_version = row_version + 1
        WHERE id = ? AND status = 'pending' AND row_version = ?`,
      [approver.id, approver.role, String(reason).trim(),
       approvalId, ap.row_version]
    );
    if (upd.affectedRows === 0) {
      throw new BankChangeError(
        'Proposal was modified or already actioned — reload and try again',
        { code: 'PROPOSAL_RACE', status: 409 }
      );
    }

    const payload = {
      approval_id: approvalId, vendor_id: ap.vendor_id,
      approver: { id: approver.id, role: approver.role, name: approver.full_name || null },
      proposer: { id: ap.proposed_by, role: ap.proposed_by_role },
      rejection_reason: String(reason).trim(),
    };
    await conn.query(
      `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
       VALUES (?, 'bank_change.rejected', ?)`,
      [ap.vendor_id, JSON.stringify(payload)]
    );
  });

  audit.log({
    userId: approver.id,
    action: 'vendor.bank_change.reject',
    entityType: 'vendor_bank_change_approvals',
    entityId: approvalId,
    details: {
      vendor_id: ap.vendor_id, reason: String(reason).trim(),
      proposer_id: ap.proposed_by, proposer_role: ap.proposed_by_role,
    },
    req,
  });

  return { rejected: true };
}

/**
 * Cancel a pending proposal. Only the original proposer can cancel.
 * Useful when the proposer realises the change isn't needed.
 */
async function cancel(opts) {
  const { caller, approvalId, req = null } = opts;
  if (!caller || !caller.id) {
    throw new BankChangeError('Caller identity required', { code: 'CALLER_MISSING', status: 401 });
  }
  const [[ap]] = await db.query(
    `SELECT * FROM vendor_bank_change_approvals WHERE id = ?`,
    [approvalId]
  );
  if (!ap) throw new BankChangeError('Proposal not found', { code: 'PROPOSAL_NOT_FOUND', status: 404 });
  if (ap.status !== 'pending') {
    throw new BankChangeError(`Proposal is already ${ap.status}`, { code: 'PROPOSAL_NOT_OPEN', status: 409 });
  }
  if (ap.proposed_by !== caller.id) {
    throw new BankChangeError(
      'Only the original proposer can cancel a pending proposal',
      { code: 'NOT_PROPOSER', status: 403 }
    );
  }

  await db.tx(async (conn) => {
    const [upd] = await conn.query(
      `UPDATE vendor_bank_change_approvals
          SET status = 'cancelled', row_version = row_version + 1
        WHERE id = ? AND status = 'pending' AND row_version = ?`,
      [approvalId, ap.row_version]
    );
    if (upd.affectedRows === 0) {
      throw new BankChangeError(
        'Proposal was modified or already actioned — reload and try again',
        { code: 'PROPOSAL_RACE', status: 409 }
      );
    }
    await conn.query(
      `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
       VALUES (?, 'bank_change.cancelled', ?)`,
      [ap.vendor_id, JSON.stringify({ approval_id: approvalId, vendor_id: ap.vendor_id, cancelled_by: caller.id })]
    );
  });

  audit.log({
    userId: caller.id,
    action: 'vendor.bank_change.cancel',
    entityType: 'vendor_bank_change_approvals',
    entityId: approvalId,
    details: { vendor_id: ap.vendor_id },
    req,
  });

  return { cancelled: true };
}

/**
 * List pending bank-change proposals (for the approval dashboard).
 * Optionally filtered to those approvable by a specific role.
 */
async function listPending({ approverRole = null } = {}) {
  const [rows] = await db.query(
    `SELECT a.id, a.vendor_id, v.vendor_name, a.proposed_by, u.full_name AS proposer_name,
            a.proposed_by_role, a.proposed_at, a.proposal_reason,
            a.before_bank_name, a.before_bank_account, a.before_bank_ifsc,
            a.after_bank_name,  a.after_bank_account,  a.after_bank_ifsc
       FROM vendor_bank_change_approvals a
       JOIN vendors v ON v.id = a.vendor_id
       JOIN users   u ON u.id = a.proposed_by
      WHERE a.status = 'pending'
      ORDER BY a.proposed_at DESC`
  );
  if (!approverRole) return rows;
  // Filter by who-can-approve-what
  return rows.filter(r => {
    const allowed = r.proposed_by_role === 'finance_admin'
      ? APPROVER_FOR_FINANCE_PROPOSAL
      : APPROVER_FOR_HEAD_PROPOSAL;
    return allowed.includes(approverRole);
  });
}

/**
 * Propose bank details for a brand-new vendor (V8 spec line 57-61).
 * Same two-person approval as a bank detail change — only difference is
 * there are no "before" values (vendor was just created).
 */
async function proposeNewVendorBankDetails({ proposer, vendorId, vendorName, bankAccount, bankIfsc, bankName }) {
  const [insApproval] = await db.query(
    `INSERT INTO vendor_bank_change_approvals
       (vendor_id, status, proposed_by, proposed_by_role, proposed_at,
        proposal_reason,
        before_bank_name, before_bank_account, before_bank_ifsc,
        after_bank_name,  after_bank_account,  after_bank_ifsc)
     VALUES (?, 'pending', ?, ?, NOW(), ?, NULL, NULL, NULL, ?, ?, ?)`,
    [vendorId, proposer.id, proposer.role,
     'New vendor — initial bank details require dual approval',
     bankName || null, bankAccount || null, bankIfsc || null]
  );
  const approvalId = insApproval.insertId;

  const signoffGate = require('../../../services/signoff-gate');
  await signoffGate.triggerSignoff(
    'vendor_bank_vendor_confirm',
    approvalId,
    null,
    {
      question: `${vendorName} — new vendor bank details added. Please confirm this is correct.`,
      documentRow: { id: approvalId, vendor_id: vendorId },
      triggeredBy: proposer.id,
    }
  );

  return { approvalId };
}

module.exports = {
  PROPOSER_ROLES,
  APPROVER_FOR_FINANCE_PROPOSAL,
  APPROVER_FOR_HEAD_PROPOSAL,
  BankChangeError,
  propose,
  proposeNewVendorBankDetails,
  approve,
  reject,
  cancel,
  listPending,
};
