// services/approvals.js
// ============================================================
// Per-domain approve/reject flows call into these helpers so that
// every pending approval is visible on the central /api/approvals dashboard.
//
// Two API surfaces co-exist (build-commit lock #7):
//
//   LEGACY ── register/close ──── writes to wa_pending_actions
//             Used by 7 modules. Single-approval-only. Kept for backward
//             compat. Migration of legacy callers is a future iteration,
//             not a blocker.
//
//   UNIFIED ── open/vote/get/pendingForUser ──── writes to approvals + approval_signoffs
//             Sheet 9 (approval_type_config) declares per-type:
//               - signers (which roles can sign)
//               - quorum (1 = single approval; N = multi-signer)
//               - scope (project / global)
//               - vendor confirmation requirement
//               - expiry hours
//             Adding a new approval workflow = uploading a Sheet 9 row.
//             Zero code changes per workflow.
//
// LEGACY example:
//   const approvals = require('../services/approvals');
//   await approvals.register({
//     projectId, requestType: 'cn_approval', title: `CN ${cnNumber}`,
//     refTable: 'change_notices', refId: cnId, raisedBy: me.id,
//   });
//   // ... later ...
//   await approvals.close({ refTable: 'change_notices', refId: cnId, actionedBy: me.id });
//
// UNIFIED example (multi-signer):
//   const approvalId = await approvals.open({
//     approvalType: 'handover_closure',  // quorum=4 per Sheet 9 seed
//     refTable: 'projects', refId: projectId, projectId,
//     raisedBy: me.id, raisedByRole: me.role,
//     title: `Project ${projectName} closure`,
//   });
//   // ... each signer separately ...
//   await approvals.vote({
//     approvalId, signerId: someUser.id, signerRole: someUser.role, vote: 'approve',
//   });
//   // After 4 distinct signers vote 'approve', status flips to 'approved'.
// ============================================================

const db = require('../middleware/db');

// Canonical firm-wide / project-scoped split. PROJECT_SCOPED_ROLES is the
// authoritative list owned by middleware/auth.js — every other role is
// effectively firm-wide for the purposes of approval signing (i.e. they
// cover all projects regardless of project_assignments table content).
//
// This matters because project-scoped approval types (cn_approval,
// schedule_change, vendor_payment, claim_invoice, budget_cost_head,
// handover_closure, weekly_report) include heads + finance + PMC in their
// signer lists — and those roles legitimately approve across all projects.
const { PROJECT_SCOPED_ROLES } = require('../modules/auth/middleware/auth');
function isFirmWideRole(role) {
  return !PROJECT_SCOPED_ROLES.includes(role);
}

// ── LEGACY: wa_pending_actions ───────────────────────────────
//
// TECH DEBT: this table has TWO FK columns that both point to users.id:
//   - `raised_by`   — used by THIS register() path (the dashboard pending-row flow)
//   - `user_id`     — used by services/wa-reply-actions.js + modules/workflow/routes/approvals.js
//                     (the wa-reply / app-action flow)
// Both mean roughly "who is this row about / for", but two writer paths
// have diverged and use different columns. Readers (modules/reporting/routes/dashboard.js
// + modules/workflow/routes/approvals.js) sometimes filter on one or the other.
// Cleanup requires:
//   1. Migration to consolidate into a single column (likely `raised_by`,
//      preserving FK semantics) + a separate `target_user_id` if
//      "who needs to action" is distinct from "who raised it".
//   2. Update all 5 writer call sites + 4 reader call sites in lockstep.
//   3. Backfill existing rows.
// Not done in this iteration — coordinated migration; risk of touching live data.
//
// Until then: every NEW writer should use `raised_by` (the canonical name)
// and we should NOT add new uses of `user_id`.

/**
 * register({...}) — queue a new pending approval for the dashboard.
 * If one already exists for (refTable, refId), returns existing id (idempotent).
 */
async function register({ projectId, requestType, title, details = null, driftDays = null, refTable, refId, raisedBy }) {
  if (!projectId || !requestType || !refTable || !refId) {
    throw new Error('approvals.register: projectId, requestType, refTable, refId all required');
  }

  // Idempotent: if a pending row already exists for this ref, return its id
  // with alreadyExisted=true. Symmetric with open() which uses the same shape
  // (B17 in the audit — both functions previously had divergent contracts:
  // register returned a bare integer, open threw a 409. Now both return
  // {id, alreadyExisted}.). Existing callers in drawings.js and claims.js
  // discard the return value entirely, so this is a non-breaking change.
  const [[existing]] = await db.query(
    "SELECT id FROM wa_pending_actions WHERE ref_table = ? AND ref_id = ? AND status = 'pending' LIMIT 1",
    [refTable, refId]
  );
  if (existing) return { id: existing.id, alreadyExisted: true };

  const [r] = await db.query(
    `INSERT INTO wa_pending_actions
       (project_id, request_type, title, details, drift_days, ref_table, ref_id,
        raised_by, channel, status, message_sent)
     VALUES (?,?,?,?,?,?,?,?,'app','pending',?)`,
    [projectId, requestType, title, details, driftDays, refTable, refId, raisedBy || null, title]
  );
  return { id: r.insertId, alreadyExisted: false };
}

/**
 * close({ refTable, refId, actionedBy, rejectionNote? })
 *   If rejectionNote given → status='rejected'; else → status='approved'.
 *   No-op if no matching pending row exists.
 */
async function close({ refTable, refId, actionedBy, rejectionNote = null }) {
  if (!refTable || !refId) return;
  const newStatus = rejectionNote ? 'rejected' : 'approved';
  await db.query(
    `UPDATE wa_pending_actions
        SET status = ?, actioned_by = ?, actioned_at = NOW(), rejection_note = ?
      WHERE ref_table = ? AND ref_id = ? AND status = 'pending'`,
    [newStatus, actionedBy || null, rejectionNote, refTable, refId]
  );
}

// ── UNIFIED: approvals + approval_signoffs ──────────────────

class ApprovalError extends Error {
  constructor(msg, { code = 'APPROVAL_ERROR', status = 400 } = {}) {
    super(msg);
    this.name = 'ApprovalError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Look up an approval_type_config row. Returns the config or throws if
 * the type is unknown / inactive.
 */
async function _getTypeConfig(approvalType, conn = db) {
  const [[cfg]] = await conn.query(
    `SELECT approval_type, signer_roles_json, quorum, scope,
            requires_vendor_confirm, expires_after_hours, label, active
       FROM approval_type_config WHERE approval_type = ? LIMIT 1`,
    [approvalType]
  );
  if (!cfg) {
    throw new ApprovalError(`Unknown approval_type '${approvalType}'`, {
      code: 'TYPE_UNKNOWN', status: 400,
    });
  }
  if (!cfg.active) {
    throw new ApprovalError(`approval_type '${approvalType}' is not active`, {
      code: 'TYPE_INACTIVE', status: 400,
    });
  }
  // signer_roles_json is stored as JSON; MariaDB returns it as a string
  const roles = typeof cfg.signer_roles_json === 'string'
    ? JSON.parse(cfg.signer_roles_json)
    : cfg.signer_roles_json;
  return { ...cfg, signer_roles: roles };
}

/**
 * Open a new approval instance.
 *
 * @param {object} opts
 * @param {string} opts.approvalType    must match a row in approval_type_config
 * @param {string} opts.refTable        what's being approved (table name)
 * @param {number} opts.refId           id within that table
 * @param {number} [opts.projectId]     required when scope='project'
 * @param {number} opts.raisedBy        users.id of proposer
 * @param {string} opts.raisedByRole    role of proposer (snapshot)
 * @param {string} opts.title
 * @param {string} [opts.details]
 * @param {number} [opts.vendorId]      for approval types that bind to a vendor
 * @returns {Promise<{id:number, expiresAt:Date|null, config:object}>}
 */
async function open(opts) {
  const {
    approvalType, refTable, refId, projectId = null,
    raisedBy, raisedByRole, title, details = null, vendorId = null,
  } = opts;

  if (!approvalType) throw new ApprovalError('approvalType required', { code: 'MISSING_TYPE' });
  if (!refTable)     throw new ApprovalError('refTable required',     { code: 'MISSING_REF_TABLE' });
  if (!refId)        throw new ApprovalError('refId required',        { code: 'MISSING_REF_ID' });
  if (!raisedBy)     throw new ApprovalError('raisedBy required',     { code: 'MISSING_RAISER' });
  if (!raisedByRole) throw new ApprovalError('raisedByRole required', { code: 'MISSING_ROLE' });
  if (!title)        throw new ApprovalError('title required',        { code: 'MISSING_TITLE' });

  return await db.tx(async (conn) => {
    const cfg = await _getTypeConfig(approvalType, conn);

    if (cfg.scope === 'project' && !projectId) {
      throw new ApprovalError(
        `approval_type '${approvalType}' is project-scoped — projectId required`,
        { code: 'PROJECT_REQUIRED' }
      );
    }

    // Idempotency: if a pending approval already exists for this (refTable,
    // refId), return its id with alreadyExisted=true instead of throwing.
    //
    // Earlier this function threw ApprovalError code 'APPROVAL_ALREADY_PENDING'
    // (HTTP 409). The legacy register() function already used silent-return
    // for the same scenario; having two different idempotency contracts in
    // the same service surfaced as B17 in the audit. Callers that want the
    // duplicate signal check `alreadyExisted` on the returned object.
    const [[existing]] = await conn.query(
      `SELECT id, expires_at FROM approvals
        WHERE ref_table = ? AND ref_id = ? AND status = 'pending' LIMIT 1`,
      [refTable, refId]
    );
    if (existing) {
      return {
        id: existing.id,
        alreadyExisted: true,
        expiresAt: existing.expires_at,
        config: cfg,
      };
    }

    const expiresAt = cfg.expires_after_hours
      ? new Date(Date.now() + cfg.expires_after_hours * 3600 * 1000)
      : null;

    const [r] = await conn.query(
      `INSERT INTO approvals
         (approval_type, ref_table, ref_id, project_id, raised_by, raised_by_role,
          title, details, status, expires_at, vendor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [approvalType, refTable, refId, projectId, raisedBy, raisedByRole,
       title, details, expiresAt, vendorId]
    );

    return { id: r.insertId, alreadyExisted: false, expiresAt, config: cfg };
  });
}

/**
 * Cast a vote on an approval. Records a signoff and re-evaluates
 * status based on quorum + reject-veto rule.
 *
 * Rules:
 *   - Reject-veto: any 'reject' vote → status='rejected' immediately
 *   - Quorum: when N distinct 'approve' signoffs accrued (N = config.quorum),
 *     status='approved'
 *   - Self-vote: the proposer cannot vote on their own approval
 *   - Role gate: signer's role must be in approval_type_config.signer_roles_json
 *   - Scope gate: for scope='project', signer must be assigned to the project
 *   - One vote per signer (UNIQUE constraint on approval_signoffs)
 *
 * @param {object} opts
 * @param {number} opts.approvalId
 * @param {number} opts.signerId
 * @param {string} opts.signerRole
 * @param {'approve'|'reject'} opts.vote
 * @param {string} [opts.comment]
 * @returns {Promise<{ approvalId, newStatus, quorumProgress:{approves:number, quorum:number} }>}
 */
async function vote(opts) {
  const { approvalId, signerId, signerRole, vote: voteValue, comment = null } = opts;

  if (!approvalId)             throw new ApprovalError('approvalId required',  { code: 'MISSING_APPROVAL' });
  if (!signerId)               throw new ApprovalError('signerId required',    { code: 'MISSING_SIGNER' });
  if (!signerRole)             throw new ApprovalError('signerRole required',  { code: 'MISSING_ROLE' });
  if (!['approve','reject'].includes(voteValue)) {
    throw new ApprovalError(`vote must be 'approve' or 'reject', got '${voteValue}'`, { code: 'BAD_VOTE' });
  }

  return await db.tx(async (conn) => {
    // Lock the approval row so concurrent votes don't race quorum evaluation
    const [[a]] = await conn.query(
      `SELECT id, approval_type, project_id, raised_by, status, row_version
         FROM approvals WHERE id = ? FOR UPDATE`,
      [approvalId]
    );
    if (!a) throw new ApprovalError('Approval not found', { code: 'NOT_FOUND', status: 404 });
    if (a.status !== 'pending') {
      throw new ApprovalError(`Approval is ${a.status}, no longer accepting votes`, {
        code: 'NOT_PENDING', status: 409,
      });
    }
    if (a.raised_by === signerId) {
      throw new ApprovalError('Proposer cannot vote on their own approval', {
        code: 'SELF_VOTE', status: 403,
      });
    }

    const cfg = await _getTypeConfig(a.approval_type, conn);
    if (!cfg.signer_roles.includes(signerRole)) {
      throw new ApprovalError(
        `Role '${signerRole}' is not a permitted signer for approval_type '${a.approval_type}'`,
        { code: 'ROLE_NOT_PERMITTED', status: 403 }
      );
    }

    // Project-scoped: signer must be assigned. Firm-wide roles bypass —
    // "firm-wide" = anything that isn't in PROJECT_SCOPED_ROLES (i.e.
    // principal, design_principal, pmc_head, design_head, services_head,
    // finance_admin, audit, it_admin). These roles cover all projects and
    // wouldn't normally appear in project_assignments rows.
    if (cfg.scope === 'project' && a.project_id) {
      if (!isFirmWideRole(signerRole)) {
        const [[m]] = await conn.query(
          `SELECT 1 AS ok FROM project_assignments
            WHERE project_id = ? AND user_id = ? AND is_active = 1 LIMIT 1`,
          [a.project_id, signerId]
        );
        if (!m) {
          throw new ApprovalError(
            `Signer is not assigned to project ${a.project_id}`,
            { code: 'NOT_ON_PROJECT', status: 403 }
          );
        }
      }
    }

    // Insert signoff. UNIQUE (approval_id, signer_id) prevents double-vote.
    try {
      await conn.query(
        `INSERT INTO approval_signoffs (approval_id, signer_id, signer_role, vote, comment)
         VALUES (?, ?, ?, ?, ?)`,
        [approvalId, signerId, signerRole, voteValue, comment]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || /Duplicate/i.test(err.message || '')) {
        throw new ApprovalError('Signer has already voted on this approval', {
          code: 'ALREADY_VOTED', status: 409,
        });
      }
      throw err;
    }

    // Re-evaluate approval status from all signoffs (extracted into helper
    // so vendor-confirm endpoint can also trigger re-evaluation when it sets
    // vendor_confirmed_at — without that, requires_vendor_confirm approvals
    // would sit pending forever even after every signer voted + vendor
    // confirmed, because nothing would re-run the quorum check).
    const evalResult = await _reevaluate(conn, approvalId, signerId, a.row_version);
    return {
      approvalId,
      newStatus: evalResult.newStatus,
      quorumProgress: evalResult.quorumProgress,
    };
  });
}

/**
 * Re-evaluate an approval's status given its current signoffs and
 * vendor_confirmed_at timestamp. Used by:
 *   - vote() after inserting a new signoff
 *   - vendor-public.handleAction after setting vendor_confirmed_at
 *
 * Caller MUST hold a row lock on the approval (FOR UPDATE) before calling
 * to prevent concurrent re-evaluation. resolverId is the user_id to record
 * as resolved_by when status flips; for vendor-confirm callers, pass the
 * approval's last signer (or null for system-resolved).
 *
 * Optional rowVersion enables optimistic-lock check on the UPDATE; pass
 * the version captured under FOR UPDATE for vote(), or omit (caller
 * already holds lock) for vendor-confirm.
 *
 * @param {object} conn       — db connection holding the row lock
 * @param {number} approvalId
 * @param {number|null} resolverId   user.id to record as resolved_by
 * @param {number|null} rowVersion   if set, included in WHERE for optimistic check
 * @returns {{newStatus, quorumProgress: {approves, quorum, rejects}}}
 */
async function _reevaluate(conn, approvalId, resolverId, rowVersion = null) {
  const [[a]] = await conn.query(
    `SELECT a.approval_type, a.status, a.row_version, a.vendor_confirmed_at,
            atc.quorum, atc.requires_vendor_confirm
       FROM approvals a
       JOIN approval_type_config atc ON atc.approval_type = a.approval_type
      WHERE a.id = ?`,
    [approvalId]
  );
  if (!a) throw new ApprovalError('Approval not found', { code: 'NOT_FOUND', status: 404 });
  // Only re-evaluate pending approvals — terminal states (approved/rejected/
  // cancelled/expired) are immutable.
  if (a.status !== 'pending') {
    return {
      newStatus: a.status,
      quorumProgress: { approves: 0, quorum: a.quorum, rejects: 0 },
    };
  }

  const [allVotes] = await conn.query(
    `SELECT vote FROM approval_signoffs WHERE approval_id = ?`,
    [approvalId]
  );
  const approves = allVotes.filter(v => v.vote === 'approve').length;
  const rejects  = allVotes.filter(v => v.vote === 'reject').length;

  let newStatus = 'pending';
  let resolutionNote = null;
  if (rejects > 0) {
    newStatus = 'rejected';
    resolutionNote = `Vetoed by ${rejects} signer(s)`;
  } else if (approves >= a.quorum) {
    if (a.requires_vendor_confirm && !a.vendor_confirmed_at) {
      newStatus = 'pending';
      resolutionNote = null;
    } else {
      newStatus = 'approved';
      resolutionNote = `Quorum reached (${approves}/${a.quorum})`;
    }
  }

  if (newStatus !== 'pending') {
    const versionCheck = rowVersion != null ? 'AND row_version = ?' : '';
    const params = rowVersion != null
      ? [newStatus, resolverId, resolutionNote, approvalId, rowVersion]
      : [newStatus, resolverId, resolutionNote, approvalId];
    const [upd] = await conn.query(
      `UPDATE approvals
          SET status = ?, resolved_at = NOW(), resolved_by = ?,
              resolution_note = ?, row_version = row_version + 1
        WHERE id = ? ${versionCheck}`,
      params
    );
    if (upd.affectedRows === 0) {
      throw new ApprovalError('Approval row version mismatch — please retry', {
        code: 'STALE_VERSION', status: 409,
      });
    }
  }

  return {
    newStatus,
    quorumProgress: { approves, quorum: a.quorum, rejects },
  };
}

/**
 * Mark an approval as vendor-confirmed (sets vendor_confirmed_at = NOW())
 * and re-evaluate. Called from the public vendor confirmation endpoint
 * AFTER the vendor has tapped 'Confirm' on the wa.me link.
 *
 * Idempotent: if the approval is already approved/rejected/cancelled, this
 * just stamps the column for audit and returns the current status.
 *
 * @param {object} opts
 * @param {number} opts.approvalId
 * @returns {Promise<{newStatus, quorumProgress}>}
 */
async function recordVendorConfirm({ approvalId }) {
  if (!approvalId) throw new ApprovalError('approvalId required', { code: 'MISSING_APPROVAL' });

  return await db.tx(async (conn) => {
    // Lock + stamp. FOR UPDATE serialises against concurrent vote() calls.
    const [[a]] = await conn.query(
      `SELECT id, status, vendor_confirmed_at FROM approvals WHERE id = ? FOR UPDATE`,
      [approvalId]
    );
    if (!a) throw new ApprovalError('Approval not found', { code: 'NOT_FOUND', status: 404 });
    if (!a.vendor_confirmed_at) {
      await conn.query(
        `UPDATE approvals SET vendor_confirmed_at = NOW() WHERE id = ?`,
        [approvalId]
      );
    }
    // Re-evaluate. If approval was already terminal (e.g. rejected before
    // vendor confirmed), _reevaluate sees status != 'pending' and returns
    // current status unchanged. resolverId=null because no human resolved it.
    return await _reevaluate(conn, approvalId, null);
  });
}

/**
 * Cancel an open approval (proposer withdraws, e.g. CN edited so the proposal
 * no longer applies). Idempotent: rejected/approved/cancelled approvals are no-ops.
 */
async function cancel({ approvalId, cancelledBy, reason = null }) {
  if (!approvalId)   throw new ApprovalError('approvalId required',  { code: 'MISSING_APPROVAL' });
  if (!cancelledBy)  throw new ApprovalError('cancelledBy required', { code: 'MISSING_USER' });

  const [r] = await db.query(
    `UPDATE approvals
        SET status = 'cancelled', resolved_at = NOW(), resolved_by = ?,
            resolution_note = ?, row_version = row_version + 1
      WHERE id = ? AND status = 'pending'`,
    [cancelledBy, reason, approvalId]
  );
  return { cancelled: r.affectedRows > 0 };
}

/**
 * Fetch a single approval by id, joined with its signoffs.
 *
 * @returns {Promise<{ approval:object, signoffs:Array, config:object } | null>}
 */
async function get(approvalId) {
  if (!approvalId) throw new ApprovalError('approvalId required', { code: 'MISSING_APPROVAL' });

  const [[a]] = await db.query(
    `SELECT a.*, atc.label, atc.quorum, atc.scope, atc.signer_roles_json,
            atc.requires_vendor_confirm, atc.expires_after_hours,
            ru.full_name AS raised_by_name
       FROM approvals a
       LEFT JOIN approval_type_config atc ON atc.approval_type = a.approval_type
       LEFT JOIN users ru ON ru.id = a.raised_by
      WHERE a.id = ?`,
    [approvalId]
  );
  if (!a) return null;

  const [signoffs] = await db.query(
    `SELECT s.*, u.full_name AS signer_name
       FROM approval_signoffs s
       LEFT JOIN users u ON u.id = s.signer_id
      WHERE s.approval_id = ?
      ORDER BY s.voted_at`,
    [approvalId]
  );

  // Parse signer_roles_json once
  const signerRoles = a.signer_roles_json
    ? (typeof a.signer_roles_json === 'string' ? JSON.parse(a.signer_roles_json) : a.signer_roles_json)
    : [];

  return {
    approval: {
      id: a.id, approval_type: a.approval_type,
      ref_table: a.ref_table, ref_id: a.ref_id,
      project_id: a.project_id, raised_by: a.raised_by,
      raised_by_role: a.raised_by_role, raised_by_name: a.raised_by_name,
      raised_at: a.raised_at, title: a.title, details: a.details,
      status: a.status, resolved_at: a.resolved_at, resolved_by: a.resolved_by,
      resolution_note: a.resolution_note, expires_at: a.expires_at,
      vendor_id: a.vendor_id, vendor_confirmed_at: a.vendor_confirmed_at,
      row_version: a.row_version,
    },
    signoffs,
    config: {
      label: a.label, quorum: a.quorum, scope: a.scope,
      signer_roles: signerRoles,
      requires_vendor_confirm: !!a.requires_vendor_confirm,
      expires_after_hours: a.expires_after_hours,
    },
  };
}

/**
 * List approvals the user can vote on right now — pending, role-eligible,
 * not yet signed off by this user, not their own proposal, project-eligible.
 *
 * @param {object} opts
 * @param {number} opts.userId
 * @param {string} opts.role
 * @param {Array<number>} [opts.projectIds]   user's project assignments
 * @returns {Promise<Array<object>>}
 */
async function pendingForUser({ userId, role, projectIds = [] }) {
  if (!userId) throw new ApprovalError('userId required', { code: 'MISSING_USER' });
  if (!role)   throw new ApprovalError('role required',   { code: 'MISSING_ROLE' });

  // Pull all pending approvals + their type config in one go. Cheaper than
  // walking every type and filtering — the pending set is bounded.
  const [rows] = await db.query(
    `SELECT a.id, a.approval_type, a.ref_table, a.ref_id, a.project_id,
            a.raised_by, a.raised_by_role, a.raised_at, a.title, a.details,
            a.expires_at, a.vendor_id,
            atc.label, atc.quorum, atc.scope, atc.signer_roles_json,
            ru.full_name AS raised_by_name
       FROM approvals a
       JOIN approval_type_config atc ON atc.approval_type = a.approval_type
       LEFT JOIN users ru ON ru.id = a.raised_by
      WHERE a.status = 'pending' AND atc.active = 1`
  );

  const projectSet = new Set(projectIds);

  const pending = rows.filter((r) => {
    // Role gate
    const allowedRoles = typeof r.signer_roles_json === 'string'
      ? JSON.parse(r.signer_roles_json)
      : (r.signer_roles_json || []);
    if (!allowedRoles.includes(role)) return false;
    // Self-vote gate
    if (r.raised_by === userId) return false;
    // Scope gate — firm-wide roles see project-scoped approvals across
    // all projects; project-scoped roles only see approvals for projects
    // they're explicitly assigned to.
    if (r.scope === 'project') {
      if (!isFirmWideRole(role) && !projectSet.has(r.project_id)) return false;
    }
    return true;
  });

  if (!pending.length) return [];

  // Filter out approvals the user has already voted on
  const ids = pending.map(p => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const [voted] = await db.query(
    `SELECT approval_id FROM approval_signoffs
      WHERE signer_id = ? AND approval_id IN (${placeholders})`,
    [userId, ...ids]
  );
  const votedSet = new Set(voted.map(v => v.approval_id));

  return pending
    .filter(p => !votedSet.has(p.id))
    .map(p => ({
      id: p.id,
      approval_type: p.approval_type,
      ref_table: p.ref_table,
      ref_id: p.ref_id,
      project_id: p.project_id,
      raised_by: p.raised_by,
      raised_by_role: p.raised_by_role,
      raised_by_name: p.raised_by_name,
      raised_at: p.raised_at,
      title: p.title,
      details: p.details,
      expires_at: p.expires_at,
      vendor_id: p.vendor_id,
      label: p.label,
      quorum: p.quorum,
    }));
}

/**
 * Sweep expired pending approvals. Called by the scheduler.
 *
 * Two-phase to support per-row notification:
 *   1. SELECT id+raised_by+title+label of every overdue pending approval
 *   2. For each, run UPDATE → notify proposer (best-effort)
 *
 * Notification failures are logged + swallowed so a notify outage cannot
 * prevent the status flip. Previously this function was a single bulk
 * UPDATE with NO notification — proposers never knew their approval had
 * expired (B16 in the audit).
 */
async function expireOverdue() {
  // Phase 1: find candidates (snapshot raised_by + title + label for the notify)
  const [candidates] = await db.query(
    `SELECT a.id, a.raised_by, a.title, atc.label
       FROM approvals a
       LEFT JOIN approval_type_config atc ON atc.approval_type = a.approval_type
      WHERE a.status = 'pending'
        AND a.expires_at IS NOT NULL
        AND a.expires_at < NOW()`
  );

  if (!candidates.length) return { expired: 0, notified: 0 };

  let expired = 0;
  let notified = 0;
  // Lazy-require to avoid a circular dependency between approvals ↔ notifications
  // ↔ messaging at module-load. Lazy require also lets tests mock via
  // jest.mock without depending on require order.
  let notifMod = null;
  try { notifMod = require('./notifications'); } catch (_) { /* tests may mock or omit */ }

  for (const a of candidates) {
    // Per-row UPDATE — guarded by status='pending' so a concurrent vote that
    // already resolved the approval doesn't get clobbered by the sweeper.
    let upd;
    try {
      [upd] = await db.query(
        `UPDATE approvals
            SET status = 'expired', resolved_at = NOW(),
                resolution_note = 'Auto-expired (past expires_at)',
                row_version = row_version + 1
          WHERE id = ? AND status = 'pending'`,
        [a.id]
      );
    } catch (err) {
      console.error('[approvals.expireOverdue] UPDATE failed for', a.id, '—', err.message);
      continue;
    }
    if (upd.affectedRows === 0) continue;   // raced with vote()/cancel(); nothing to notify
    expired++;

    // Best-effort notify. Failures must not block other expiries.
    if (notifMod && a.raised_by) {
      try {
        await notifMod.notifyApprovalExpired(a.raised_by, a.label, a.title);
        notified++;
      } catch (err) {
        console.warn('[approvals.expireOverdue] notify failed for approval', a.id, '—', err.message);
      }
    }
  }

  return { expired, notified };
}

module.exports = {
  // Legacy
  register,
  close,
  // Unified (build-commit lock #7)
  open,
  vote,
  cancel,
  get,
  pendingForUser,
  expireOverdue,
  recordVendorConfirm,
  ApprovalError,
};
