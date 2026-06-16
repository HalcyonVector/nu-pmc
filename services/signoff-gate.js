// services/signoff-gate.js
// ============================================================
// Sign-off gate — single entry point for all workflow sign-offs.
//
// Per nu-pmc-signoff-delta-brief.docx (1 May 2026) and Principal's
// abstraction principle ("we want to abstract and avoid many paths"):
//
//   ONE function:    triggerSignoff(workflowType, documentId, projectId)
//   ONE builder:     buildSequence(workflow, projectId, documentRow)
//   ONE resolver:    resolveApprover(roleToken, projectId, documentRow)
//   ONE registry:    PREDICATES (named functions returning bool)
//   ONE registry:    ACTIONS    (named functions mutating sequence array)
//
// The sequence is built by:
//   1. Read base sequence from signoff_workflows.sequence (CSV of role tokens)
//   2. Load all signoff_sequence_rules rows for the workflow_type
//   3. For each rule (priority order): if predicate true, apply action
//   4. Resolve each surviving role token to a concrete approver (user
//      row or client_contact row)
//
// Adding a new conditional rule = INSERT into signoff_sequence_rules.
// Adding a new predicate or action = code (registered handler).
// ============================================================

'use strict';

const db            = require('../middleware/db');
const matrixAdapter = require('./matrix-adapter');

class SignoffError extends Error {
  constructor(msg, { code = 'SIGNOFF_ERROR', status = 500 } = {}) {
    super(msg);
    this.name   = 'SignoffError';
    this.code   = code;
    this.status = status;
  }
}

// ── PREDICATE REGISTRY ───────────────────────────────────────────────
// Each predicate takes a context object {workflow, projectId, documentRow}
// and returns a Promise<boolean>. Adding a new predicate name in
// signoff_sequence_rules requires registering the evaluator here.

const PREDICATES = {
  always: async () => true,

  is_emergency: async ({ documentRow }) =>
    !!(documentRow && documentRow.is_emergency),

  external_origin: async ({ documentRow }) =>
    documentRow?.cn_origin === 'external',

  below_threshold: async ({ workflow, projectId, documentRow }) => {
    if (!workflow.principal_threshold_pct) return false;
    if (!projectId || !documentRow) return false;
    const docValue = Number(
      documentRow.estimated_value
      ?? documentRow.amount
      ?? documentRow.total_value
      ?? 0
    );
    const [[proj]] = await db.query(
      `SELECT contract_value FROM projects WHERE id = ? LIMIT 1`,
      [projectId]
    );
    if (!proj || proj.contract_value == null || proj.contract_value <= 0) return false;
    const pct = (docValue / Number(proj.contract_value)) * 100;
    return pct < Number(workflow.principal_threshold_pct);
  },

  no_snags: async ({ projectId }) => {
    if (!projectId) return false;
    const [[r]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM issues
        WHERE project_id = ? AND issue_type IN ('snag','dlp_snag')`,
      [projectId]
    );
    return Number(r?.cnt || 0) === 0;
  },

  settlement_pending: async ({ projectId }) => {
    if (!projectId) return false;
    const [[r]] = await db.query(
      `SELECT id FROM signoff_instances
        WHERE project_id = ?
          AND workflow_type = 'final_settlement'
          AND status = 'completed'
        LIMIT 1`,
      [projectId]
    );
    return !r;   // pending if no completed final_settlement exists
  },

  is_services_stream: async ({ documentRow }) =>
    documentRow?.stream === 'services',

  is_design_stream: async ({ documentRow }) =>
    documentRow?.stream === 'design',
};

// ── ACTION REGISTRY ──────────────────────────────────────────────────
// Each action takes (sequence: string[], rule, ctx) and returns the new
// sequence. Pure functions where possible — DB writes go in side-channels
// owned by the caller (e.g. setting finance_step_blocked).

const ACTIONS = {
  skip_role: (sequence, rule) => {
    if (!rule.role_token) return sequence;
    return sequence.filter(r => r !== rule.role_token);
  },

  append_role: (sequence, rule) => {
    if (!rule.role_token) return sequence;
    if (sequence.includes(rule.role_token)) return sequence;
    return [...sequence, rule.role_token];
  },

  strip_initiator: (sequence, rule, ctx) => {
    const initiatorRole = _initiatorRoleFromDoc(ctx.documentRow, ctx.initiatorUser);
    if (!initiatorRole) return sequence;
    return sequence.filter(r => r !== initiatorRole);
  },
};

// Helper: derive the initiator role from the document row + initiator user.
//
// Two shapes are supported, in this order:
//   1. documentRow.source — used by change_notices ('site'|'design'|...)
//      mapped to a role token via _SOURCE_ROLE_MAP below.
//   2. documentRow.<initiator_role_field> — direct role string. The field
//      name varies by document type (vendor_bank_change_approvals uses
//      `proposed_by_role`). Anything matching the suffix _by_role is read.
//   3. initiatorUser.role — fallback when the document row carries no
//      role information.
//
// The function is data-driven from the row's columns rather than from a
// per-workflow if/else. New document shape with a 'someone_role'-style
// column gets picked up automatically.
const _SOURCE_ROLE_MAP = {
  client:    'client_rep',  // not in any base ladder, no-op
  site:      'site_manager',
  design:    'design_lead',
  statutory: 'design_lead', // statutory CNs flow through design (Principal, May 2026)
};

function _initiatorRoleFromDoc(documentRow, initiatorUser) {
  if (!documentRow) return initiatorUser?.role || null;
  if (documentRow.source && _SOURCE_ROLE_MAP[documentRow.source] !== undefined) {
    return _SOURCE_ROLE_MAP[documentRow.source];
  }
  // Look for any column ending in _by_role (proposed_by_role,
  // approved_by_role, etc). First match wins.
  for (const k of Object.keys(documentRow)) {
    if (k.endsWith('_by_role') && documentRow[k]) return documentRow[k];
  }
  return initiatorUser?.role || null;
}

// ── APPROVER RESOLVER ────────────────────────────────────────────────
//
// One internal helper, _findUser, executes any user lookup. The set of
// supported role tokens is expressed as DATA in APPROVER_RESOLVERS:
// each entry says what to look up. Three resolution strategies cover
// every role today:
//
//   role_global        — first active user with users.role = X
//   role_global_any    — first active user with users.role IN (X, Y, ...)
//   role_in_project    — first user with role X assigned to this project
//   from_doc           — read user_id from the document row
//   from_client_master — read from clients table via projects.client_id
//
// Adding a new role token is normally one DATA entry. A new STRATEGY
// is rare — last time we needed one was for client_rep.

const _USER_FIELDS = 'id, full_name, role, matrix_user_id, matrix_room_id, phone';

async function _findUser({ where, params = [] }) {
  const [[row]] = await db.query(
    `SELECT ${_USER_FIELDS} FROM users
       WHERE ${where} AND is_active = 1
       ORDER BY id ASC LIMIT 1`,
    params
  );
  return row || null;
}

const _STRATEGIES = {
  role_global: ({ role }) =>
    _findUser({ where: 'role = ?', params: [role] }),

  role_global_any: ({ roles }) => {
    const ph = roles.map(() => '?').join(',');
    return _findUser({ where: `role IN (${ph})`, params: roles });
  },

  role_in_project: async ({ role, projectId }) => {
    if (!projectId) return _findUser({ where: 'role = ?', params: [role] });
    const [[row]] = await db.query(
      `SELECT u.${_USER_FIELDS.split(', ').join(', u.')}
         FROM users u
         JOIN project_assignments pa ON pa.user_id = u.id
        WHERE pa.project_id = ? AND u.role = ?
          AND u.is_active = 1 AND pa.is_active = 1
        ORDER BY u.id ASC LIMIT 1`,
      [projectId, role]
    );
    return row || null;
  },

  // from_doc: look up a row in some table by a foreign key on the
  // document row. The existing 'recipient' role (initiator user) is
  // one shape of this; 'vendor_rep' (vendor on a GRN/payment) is
  // another. Strategy params:
  //   docField   — column on documentRow holding the FK (e.g. 'raised_by', 'vendor_id')
  //   table      — table to look up (e.g. 'users', 'vendors')
  //   activeCol  — column that must = 1 for the row to count (e.g. 'is_active')
  //   selectShape — 'user' | 'vendor' — which column projection to return
  //                 (kept named rather than free-form so the gate doesn't
  //                  end up with arbitrary SELECTs in config rows).
  from_doc: async ({ documentRow, docField, table = 'users', activeCol = 'is_active', selectShape = 'user' }) => {
    if (!documentRow) return null;
    const fields = (docField ? [docField] : ['raised_by','created_by','user_id']);
    let fk = null;
    for (const f of fields) { if (documentRow[f] != null) { fk = documentRow[f]; break; } }
    if (!fk) return null;

    if (selectShape === 'user' && table === 'users') {
      return _findUser({ where: `id = ?`, params: [fk] });
    }
    if (selectShape === 'vendor' && table === 'vendors') {
      // For bank-related workflows, route to the 'accounts' contact
      // (addendum A.2 line 137: bank confirmation poll → accounts contact).
      // Fall back to vendor master row if no accounts contact exists.
      const [[vc]] = await db.query(
        `SELECT vc.id, v.vendor_name AS full_name, vc.name AS contact_person,
                vc.phone, vc.whatsapp, vc.matrix_user_id, vc.matrix_room_id,
                1 AS _is_vendor
           FROM vendor_contacts vc
           JOIN vendors v ON v.id = vc.vendor_id
          WHERE vc.vendor_id = ? AND vc.role = 'accounts'
          LIMIT 1`,
        [fk]
      );
      if (vc) return vc;

      // Fallback: vendor master row
      const [[v]] = await db.query(
        `SELECT id, vendor_name AS full_name, contact_person, phone,
                matrix_user_id, matrix_room_id, 1 AS _is_vendor
           FROM vendors
          WHERE id = ? AND ${activeCol} = 1
          LIMIT 1`,
        [fk]
      );
      return v || null;
    }
    throw new SignoffError(`from_doc: unsupported selectShape/table combo: ${selectShape}/${table}`,
      { code: 'UNKNOWN_FROM_DOC' });
  },

  from_client_master: async ({ projectId }) => {
    if (!projectId) return null;
    // Project's client_id → clients row. Brief §3.5 said
    // "client_contacts" but that table doesn't exist; client contact
    // info lives on the clients master row. The matrix_room_id column
    // is added to clients in v5.31 (corrected from delta brief).
    const [[c]] = await db.query(
      `SELECT c.id, c.client_name AS full_name, c.contact_email AS email,
              c.contact_whatsapp AS phone, c.matrix_room_id, 1 AS _is_client
         FROM clients c
         JOIN projects p ON p.client_id = c.id
        WHERE p.id = ? AND c.is_active = 1
        LIMIT 1`,
      [projectId]
    );
    return c || null;
  },
};

// DATA — what each role token maps to. New role token = new entry here.
// New strategy = entry in _STRATEGIES above.
const APPROVER_RESOLVERS = {
  recipient:        { strategy: 'from_doc' },   // defaults: users via raised_by/created_by/user_id
  vendor_rep:       { strategy: 'from_doc', docField: 'vendor_id', table: 'vendors', activeCol: 'is_active', selectShape: 'vendor' },
  client_rep:       { strategy: 'from_client_master' },
  principal:           { strategy: 'role_global_any', roles: ['principal','design_principal'] },
  pmc:              { strategy: 'role_in_project', role: 'pmc_head' },
  pmc_head:         { strategy: 'role_in_project', role: 'pmc_head' },
  site_manager:     { strategy: 'role_in_project', role: 'site_manager' },
  principal:        { strategy: 'role_global', role: 'principal' },
  design_principal: { strategy: 'role_global', role: 'design_principal' },
  design_lead:      { strategy: 'role_global', role: 'design_head' },
  services_head:    { strategy: 'role_global', role: 'services_head' },
  finance:          { strategy: 'role_global', role: 'finance_admin' },
  finance_admin:    { strategy: 'role_global', role: 'finance_admin' },
};

async function resolveApprover(roleToken, projectId, ctx) {
  const spec = APPROVER_RESOLVERS[roleToken];
  if (!spec) {
    throw new SignoffError(`unknown role token: ${roleToken}`,
      { code: 'UNKNOWN_ROLE', status: 500 });
  }
  const strategyFn = _STRATEGIES[spec.strategy];
  if (!strategyFn) {
    throw new SignoffError(`unknown strategy: ${spec.strategy}`,
      { code: 'UNKNOWN_STRATEGY' });
  }
  return strategyFn({ ...spec, projectId, documentRow: ctx?.documentRow });
}

// ── POST-COMPLETION HOOKS ────────────────────────────────────────────
// When a signoff_instance reaches a terminal state (completed/approved
// or completed/rejected), zero-or-more follow-up actions can fire.
//
// Examples:
//   change_notice + approved + is_emergency → trigger cn_design_ratification
//                                              (delta brief §4.3)
//   final_settlement + approved → resume project_closure relays whose
//                                  Finance step was blocked (delta brief §5.3)
//
// Each hook is a function (instance, db) → Promise<void>. A workflow
// can have any number of hooks. Hooks fire in registration order. A
// hook that throws is logged but doesn't block other hooks or the
// completion itself.
//
// Adding a new hook = one entry in POST_COMPLETION_HOOKS. The hook body
// owns its predicate — fail-fast at the top if the trigger doesn't apply.

const POST_COMPLETION_HOOKS = {
  change_notice: [
    async function emergencyDesignRatification(inst) {
      if (inst.result !== 'approved') return;
      const [[cn]] = await db.query(
        `SELECT id, project_id, is_emergency
           FROM change_notices WHERE id = ? LIMIT 1`,
        [inst.document_id]
      );
      if (!cn || !cn.is_emergency) return;
      await triggerSignoff('cn_design_ratification', cn.id, cn.project_id, {
        question: `Emergency CN-${cn.id} approved — please ratify design impact`,
      });
    },

    // v6.02: vendor BOQ acceptance — fires when CN affects a vendor's scope.
    // PMC sets change_notices.affected_engagement_id at CN creation; on
    // approval, this hook sends the revised BOQ poll to the vendor.
    async function vendorBOQAcceptance(inst) {
      if (inst.result !== 'approved') return;
      const [[cn]] = await db.query(
        `SELECT cn.id, cn.cn_number, cn.project_id, cn.affected_engagement_id,
                cn.cost_impact, ve.vendor_id, v.vendor_name
           FROM change_notices cn
           LEFT JOIN vendor_engagements ve ON ve.id = cn.affected_engagement_id
           LEFT JOIN vendors v ON v.id = ve.vendor_id
          WHERE cn.id = ? LIMIT 1`,
        [inst.document_id]
      );
      if (!cn || !cn.affected_engagement_id || !cn.vendor_id) return;

      await triggerSignoff(
        'vendor_boq_acceptance',
        cn.affected_engagement_id,
        cn.project_id,
        {
          question: `${cn.vendor_name || 'Vendor'} — revised BOQ per ${cn.cn_number}. ` +
                    `Cost impact: ₹${Number(cn.cost_impact).toLocaleString('en-IN')}. Accept?`,
          documentRow: { id: cn.affected_engagement_id, vendor_id: cn.vendor_id },
          triggeredBy: null,
        }
      );
    },
  ],

  vendor_bank_vendor_confirm: [
    async function onVendorConfirmed(inst) {
      // Vendor voted YES → trigger peer approval.
      if (inst.result !== 'approved') return;

      const [[approval]] = await db.query(
        `SELECT vbca.*, v.vendor_name
           FROM vendor_bank_change_approvals vbca
           JOIN vendors v ON v.id = vbca.vendor_id
          WHERE vbca.id = ? LIMIT 1`,
        [inst.document_id]
      );
      if (!approval) return;

      await triggerSignoff(
        'vendor_bank_peer_approve',
        approval.id,
        null,
        {
          question: `${approval.vendor_name} bank change — vendor confirmed. Approve?`,
          documentRow: {
            id:               approval.id,
            vendor_id:        approval.vendor_id,
            proposed_by:      approval.proposed_by,
            proposed_by_role: approval.proposed_by_role,
          },
          initiatorUser: { id: approval.proposed_by, role: approval.proposed_by_role },
          triggeredBy:   approval.proposed_by,
        }
      );
    },

    async function onVendorRejected(inst) {
      // Vendor voted NO → cancel proposal, alert finance.
      if (inst.result !== 'rejected') return;

      const [[approval]] = await db.query(
        `SELECT vbca.*, v.vendor_name
           FROM vendor_bank_change_approvals vbca
           JOIN vendors v ON v.id = vbca.vendor_id
          WHERE vbca.id = ? LIMIT 1`,
        [inst.document_id]
      );
      if (!approval) return;

      // Cancel the proposal.
      await db.query(
        `UPDATE vendor_bank_change_approvals
            SET status = 'cancelled', resolved_at = NOW()
          WHERE id = ? AND status = 'pending'`,
        [approval.id]
      );

      // Alert finance — room type is configurable, not hardcoded.
      const [[roomCfg]] = await db.query(
        `SELECT config_value FROM security_config
          WHERE config_key = 'vendor_bank_rejection_alert_room' LIMIT 1`
      );
      const alertRoomType = roomCfg?.config_value || 'internal_finance';
      const financeRoomId = await matrixAdapter.getInternalRoomId(alertRoomType);
      if (financeRoomId) {
        await matrixAdapter.sendText({
          roomId: financeRoomId,
          body:   `⚠️ ${approval.vendor_name} REJECTED the bank detail change. ` +
                  `Proposal ${approval.id} cancelled. Please follow up with vendor.`,
        });
      }
    },
  ],

  vendor_bank_peer_approve: [
    async function principalFYIOnNonFinanceProposal(inst) {
      // V8 spec (V8-vendor-bank-protection-SPEC.md line 47-49):
      // Path 1: finance proposes → principal APPROVES (handled in sequence).
      // Path 2: pmc/design/services proposes → finance approves →
      //         principal NOTIFIED ONLY (not a signer).
      //
      // The gate already handled the approval. If the proposer was NOT
      // finance, principal was not in the sequence (strip_initiator
      // removed them or they were never in it for non-finance proposers).
      // This hook sends a read-only FYI to principal after peer approval.
      //
      // If the proposer WAS finance (Path 1), principal was the approver —
      // they already saw the poll. No FYI needed.
      if (inst.result !== 'approved') return;

      const [[approval]] = await db.query(
        `SELECT vbca.proposed_by_role, vbca.vendor_id,
                v.vendor_name,
                vbca.after_bank_account, vbca.after_bank_ifsc
           FROM vendor_bank_change_approvals vbca
           JOIN vendors v ON v.id = vbca.vendor_id
          WHERE vbca.id = ? LIMIT 1`,
        [inst.document_id]
      );
      if (!approval) return;

      // Finance proposer = Path 1 = principal already approved. No FYI.
      if (approval.proposed_by_role === 'finance_admin') return;

      // Non-finance proposer = Path 2 = send FYI to principal.
      const principal = await _findUser({
        where: 'role IN (?,?)', params: ['principal', 'design_principal'],
      });
      if (!principal?.matrix_room_id) return;

      await matrixAdapter.sendText({
        roomId: principal.matrix_room_id,
        body: `📄 FYI — ${approval.vendor_name} bank details approved by finance. ` +
              `Account: ...${String(approval.after_bank_account || '').slice(-4)}  ` +
              `IFSC: ${approval.after_bank_ifsc || '—'}. No action needed.`,
        recipientUid: principal.id,
      });
    },
  ],

  // final_settlement: when settlement completes, resume any project_closure
  // relays whose Finance step was deferred. Delta brief §5.3.
  //
  // Flow:
  //   1. project_closure was triggered while settlement was still pending.
  //      The settlement_pending predicate fired and Finance was filtered
  //      from the sequence. Caller set project_closures.finance_step_blocked
  //      = 1 to mark the deferred state.
  //   2. final_settlement completes with result='approved'. This hook
  //      finds matching closures, clears the flag, and re-triggers the
  //      closure sign-off. On the second trigger settlement_pending is
  //      false, so Finance is now in the sequence.
  //
  // The hook is a no-op when no closures are flagged — safe to fire on
  // every settlement completion regardless.
  final_settlement: [
    async function unblockClosureFinanceStep(inst) {
      if (inst.result !== 'approved') return;
      if (!inst.project_id) return;

      const [closures] = await db.query(
        `SELECT id, project_id, closure_block_id
           FROM project_closures
          WHERE project_id = ?
            AND finance_step_blocked = 1
            AND status IN ('pending','in_progress')`,
        [inst.project_id]
      );
      if (!closures.length) return;

      for (const closure of closures) {
        await db.query(
          `UPDATE project_closures
              SET finance_step_blocked = 0
            WHERE id = ?`,
          [closure.id]
        );
        // Re-trigger the closure sign-off. settlement_pending is now
        // false, so the rules engine will include Finance this time.
        try {
          await triggerSignoff('project_closure', closure.id, closure.project_id, {
            question: `Final settlement complete — please confirm Finance step on closure-${closure.id}`,
          });
        } catch (err) {
          console.warn('[gate] unblock closure trigger failed', closure.id, err.message);
        }
      }
    },
  ],

  // v6.02: NCR endorsement — when Principal endorses an NCR that descopes
  // a vendor, trigger vendor_boq_acceptance for the affected engagement.
  // PMC sets issues.descope_engagement_id at NCR creation.
  ncr_endorsement: [
    async function vendorBOQAcceptanceOnDescope(inst) {
      if (inst.result !== 'approved') return;
      const [[issue]] = await db.query(
        `SELECT i.id, i.issue_number, i.project_id, i.descope_engagement_id,
                i.title, ve.vendor_id, v.vendor_name
           FROM issues i
           LEFT JOIN vendor_engagements ve ON ve.id = i.descope_engagement_id
           LEFT JOIN vendors v ON v.id = ve.vendor_id
          WHERE i.id = ? LIMIT 1`,
        [inst.document_id]
      );
      if (!issue || !issue.descope_engagement_id || !issue.vendor_id) return;

      await triggerSignoff(
        'vendor_boq_acceptance',
        issue.descope_engagement_id,
        issue.project_id,
        {
          question: `${issue.vendor_name || 'Vendor'} — revised BOQ per ${issue.issue_number} (NCR descope). ` +
                    `${issue.title?.slice(0, 80) || ''}. Accept revised scope?`,
          documentRow: { id: issue.descope_engagement_id, vendor_id: issue.vendor_id },
          triggeredBy: null,
        }
      );
    },
  ],

  // v6.02 audit decision: GRN vendor confirmation.
  // Vendor votes ✅ Confirmed → no action (poll closes, FYI to PMC via digest).
  // Vendor votes ❌ Disputed → alert PMC immediately so they can investigate.
  grn_vendor_confirm: [
    async function alertPMCOnDispute(inst) {
      if (inst.result !== 'rejected') return;
      if (!inst.project_id) return;

      const [[grn]] = await db.query(
        `SELECT g.grn_number, g.quantity_received, g.unit, v.vendor_name
           FROM grns g
           LEFT JOIN vendor_engagements ve ON ve.id = g.engagement_id
           LEFT JOIN vendors v ON v.id = ve.vendor_id
          WHERE g.id = ? LIMIT 1`,
        [inst.document_id]
      );
      if (!grn) return;

      // Resolve PMC heads on this project, DM each.
      const [pmcHeads] = await db.query(
        `SELECT u.id, u.matrix_room_id
           FROM users u
           JOIN project_assignments pa ON pa.user_id = u.id AND pa.is_active = 1
          WHERE u.role = 'pmc_head' AND u.is_active = 1
            AND pa.project_id = ?
            AND u.matrix_room_id IS NOT NULL`,
        [inst.project_id]
      );

      const msg = `⚠️ GRN ${grn.grn_number} — ${grn.vendor_name || 'vendor'} disputed delivery ` +
                  `(${grn.quantity_received} ${grn.unit || 'units'}). ` +
                  `Please follow up. ${process.env.PWA_BASE_URL}/grns`;

      for (const pmc of pmcHeads) {
        await matrixAdapter.sendText({
          roomId: pmc.matrix_room_id,
          body:   msg,
          recipientUid: pmc.id,
        }).catch(e => console.warn('[grn dispute alert] send failed:', e.message));
      }
    },
  ],

  // v6.02 audit decision: vendor BOQ acceptance.
  // Vendor confirmed/disputed the revised BOQ post-CN-or-NCR.
  // ✅ Accepted → update vendor_engagements.contract_value with new value (already
  //               recorded by the upstream CN/NCR workflow on its document row).
  // ❌ Disputed → alert PMC; offline resolution, CN/NCR may be revised.
  vendor_boq_acceptance: [
    async function onAccept(inst) {
      if (inst.result !== 'approved') return;
      // Mark engagement BOQ as acknowledged. The actual contract value update
      // happens in the upstream CN/NCR completion (it owns the value math);
      // this hook just records the vendor's acknowledgement.
      await db.query(
        `UPDATE vendor_engagements
            SET boq_last_acknowledged_at = NOW()
          WHERE id = ?`,
        [inst.document_id]
      ).catch(e => console.warn('[boq accept] engagement update failed:', e.message));
    },

    async function onDispute(inst) {
      if (inst.result !== 'rejected') return;
      if (!inst.project_id) return;

      const [[eng]] = await db.query(
        `SELECT ve.id, v.vendor_name
           FROM vendor_engagements ve
           JOIN vendors v ON v.id = ve.vendor_id
          WHERE ve.id = ? LIMIT 1`,
        [inst.document_id]
      );
      if (!eng) return;

      const [pmcHeads] = await db.query(
        `SELECT u.id, u.matrix_room_id
           FROM users u
           JOIN project_assignments pa ON pa.user_id = u.id AND pa.is_active = 1
          WHERE u.role = 'pmc_head' AND u.is_active = 1
            AND pa.project_id = ?
            AND u.matrix_room_id IS NOT NULL`,
        [inst.project_id]
      );
      const msg = `⚠️ ${eng.vendor_name} disputed the revised BOQ. ` +
                  `Engagement #${eng.id} — please resolve offline and re-issue if needed. ` +
                  `${process.env.PWA_BASE_URL}/engagements/${eng.id}`;
      for (const pmc of pmcHeads) {
        await matrixAdapter.sendText({
          roomId: pmc.matrix_room_id,
          body:   msg,
          recipientUid: pmc.id,
        }).catch(e => console.warn('[boq dispute alert] send failed:', e.message));
      }
    },
  ],
};

/**
 * Run all post-completion hooks for a just-completed instance.
 * Errors are logged, never propagated — completion has already been
 * recorded in the DB and the user has seen the result; a hook failure
 * is a degraded-functionality issue, not a transactional one.
 */
async function _runPostCompletionHooks(instance) {
  const hooks = POST_COMPLETION_HOOKS[instance.workflow_type] || [];
  for (const hook of hooks) {
    try {
      await hook(instance);
    } catch (err) {
      console.error(`[signoff-gate] post-completion hook failed`, {
        workflow_type: instance.workflow_type,
        instance_id:   instance.id,
        hook:          hook.name,
        error:         err.message,
      });
    }
  }
}

// ── DESTINATION RESOLVERS ────────────────────────────────────────────
//
// Three kinds of destination — picked by signoff_workflows.destination_kind.
// Each resolver returns { roomId, mention } where mention is an optional
// matrix_user_id to @-mention in the message body (for community rooms;
// null for personal rooms since only one recipient sees them).
//
// Principal's call (May 2026): bank notifications + individual BOQ sign-offs
// = personal. Everything else = community. The right room with the
// smallest audience that needs to see the message.
//
// Adding a new destination shape = one entry here.
const DESTINATION_RESOLVERS = {
  // Personal: DM the resolved entity in their own matrix_room_id.
  // qualifier = role token of the entity to address (defaults to current
  // approver). Only that one entity sees the message — no @mention needed.
  personal: async ({ approver }) => {
    if (!approver?.matrix_room_id) return { roomId: null, mention: null };
    return { roomId: approver.matrix_room_id, mention: null };
  },

  // Project room: post in #PV{code}-{qualifier}. qualifier = 'internal' or
  // 'finance'. Multiple people in the room — @mention the current approver
  // so they know it's their turn.
  project: async ({ projectId, qualifier, approver }) => {
    if (!projectId) {
      console.warn('[signoff-gate] project destination but no projectId');
      return { roomId: null, mention: null };
    }
    const roomId = await matrixAdapter.getProjectRoomId(projectId, qualifier || 'internal');
    return { roomId, mention: approver?.matrix_user_id || null };
  },

  // Org-wide room: #internal-principal, #internal-finance, etc. qualifier =
  // room_type slug. Also a multi-recipient room → @mention the approver.
  org: async ({ qualifier, approver }) => {
    if (!qualifier) {
      console.warn('[signoff-gate] org destination but no qualifier');
      return { roomId: null, mention: null };
    }
    const roomId = await matrixAdapter.getInternalRoomId(qualifier);
    return { roomId, mention: approver?.matrix_user_id || null };
  },
};

// ── POLL DISPATCH ────────────────────────────────────────────────────
// Both triggerSignoff (first poll) and triggerNextRelayStep (relay
// advance) use this to send a poll. Reads workflow.destination_kind +
// destination_qualifier and routes accordingly.

async function _dispatchPoll({ approver, question, options, logTag, attachImage, attachMime, workflow, projectId }) {
  const kind = workflow?.destination_kind || 'personal';
  const resolver = DESTINATION_RESOLVERS[kind];
  if (!resolver) {
    console.warn(`[signoff-gate] ${logTag}: unknown destination_kind '${kind}'`);
    return { pollEventId: null, roomId: null };
  }
  const { roomId, mention } = await resolver({
    approver, projectId, qualifier: workflow?.destination_qualifier,
  });
  if (!roomId) {
    console.warn(`[signoff-gate] ${logTag}: no room resolved (kind=${kind} qualifier=${workflow?.destination_qualifier})`,
      { approver: approver?.id || approver?.email });

    // Tier B fallback: if the approver is a vendor (has phone, no matrix_room_id),
    // look up the external_comm_config row by workflow_type and create an assignment.
    if (approver?._is_vendor && approver?.phone && workflow?.workflow_type) {
      try {
        const [[extConfig]] = await db.query(
          `SELECT activity_type FROM external_comm_config
            WHERE workflow_type = ? AND active = 1 LIMIT 1`,
          [workflow.workflow_type]
        );
        if (extConfig?.activity_type) {
          const { assignExternalComm } = require('./external-comm');
          await assignExternalComm({
            activityType: extConfig.activity_type,
            vendorId:     approver.id,
            vendorPhone:  approver.phone,
            messageBody:  question,
          });
        }
      } catch (e) {
        console.warn('[signoff-gate] assignExternalComm fallback failed:', e.message);
      }
    }

    return { pollEventId: null, roomId: null };
  }

  // Attached image (e.g. drawing thumbnail) goes FIRST so the poll
  // sits right below it visually. Best-effort; failure doesn't block
  // the poll.
  if (attachImage) {
    try {
      const mxcUrl = await matrixAdapter.uploadMedia(attachImage, attachMime || 'image/jpeg');
      await matrixAdapter.sendImage({
        roomId, mxcUrl,
        caption: 'Reference attachment for the poll below',
      });
    } catch (err) {
      console.warn(`[signoff-gate] ${logTag}: attachImage failed`, err.message);
    }
  }

  // For community rooms, post a heads-up @mention text first so the
  // approver gets notified. The poll question itself is then standalone.
  // Personal rooms skip this — the poll is the message.
  if (mention) {
    try {
      await matrixAdapter.sendText({
        roomId,
        body: `${approver.full_name || 'Approver'}: ${question}`,
        recipientUid: mention,
      });
    } catch (err) {
      console.warn(`[signoff-gate] ${logTag}: heads-up text failed`, err.message);
    }
  }

  try {
    const res = await matrixAdapter.sendPoll({
      roomId, question,
      answers: options.map(o => o.text),
    });
    return { pollEventId: res?.eventId || null, roomId };
  } catch (err) {
    console.error(`[signoff-gate] ${logTag}: sendPoll failed`, err.message);
    return { pollEventId: null, roomId };
  }
}

// ── SEQUENCE BUILDER ─────────────────────────────────────────────────

/**
 * Build the resolved approver list for a workflow.
 * Returns an array of approver rows in relay order. Each entry has
 * either users.id or clients.id (with _is_client = 1).
 *
 * @param {object} workflow         signoff_workflows row
 * @param {number} projectId
 * @param {object} ctx
 * @param {object} [ctx.documentRow]  business doc; used for predicates
 *                                      and 'recipient' role resolution
 * @param {object} [ctx.initiatorUser] user row of the initiator; used
 *                                      by strip_initiator action when
 *                                      doc has no `source` column
 * @returns {Promise<{roles:string[], approvers:object[]}>}
 */
async function buildSequence(workflow, projectId, ctx = {}) {
  // 1. Base sequence from CSV column.
  let roles = String(workflow.sequence || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!roles.length) {
    throw new SignoffError(`workflow ${workflow.workflow_type} has empty base sequence`,
      { code: 'EMPTY_SEQUENCE' });
  }

  // 2. Load active rules for this workflow, in priority order.
  const [rules] = await db.query(
    `SELECT id, priority, predicate_name, action_name, role_token, notes
       FROM signoff_sequence_rules
      WHERE workflow_type = ? AND active = 1
      ORDER BY priority ASC, id ASC`,
    [workflow.workflow_type]
  );

  // 3. Apply each rule whose predicate is true.
  for (const rule of rules) {
    const predName = rule.predicate_name || 'always';
    const predFn = PREDICATES[predName];
    if (!predFn) {
      throw new SignoffError(`unknown predicate: ${predName}`,
        { code: 'UNKNOWN_PREDICATE' });
    }
    const ok = await predFn({ workflow, projectId, documentRow: ctx.documentRow });
    if (!ok) continue;

    const actionFn = ACTIONS[rule.action_name];
    if (!actionFn) {
      throw new SignoffError(`unknown action: ${rule.action_name}`,
        { code: 'UNKNOWN_ACTION' });
    }
    roles = actionFn(roles, rule, ctx);
  }

  if (!roles.length) {
    throw new SignoffError(
      `sequence reduced to empty for ${workflow.workflow_type}`,
      { code: 'NO_APPROVERS_AFTER_RULES' });
  }

  // 4. Resolve each role to an approver. If any role can't be resolved,
  // fail the trigger — the caller fixes data and retries.
  const approvers = [];
  for (const role of roles) {
    const u = await resolveApprover(role, projectId, ctx);
    if (!u) {
      throw new SignoffError(
        `could not resolve approver for role '${role}' on project ${projectId}`,
        { code: 'APPROVER_UNRESOLVED', status: 400 });
    }
    approvers.push(u);
  }

  return { roles, approvers };
}

// ── PUBLIC API ───────────────────────────────────────────────────────

/**
 * triggerSignoff — start a sign-off for a workflow.
 *
 * @param {string} workflowType   row in signoff_workflows
 * @param {number} documentId     PK of the business document
 * @param {number} projectId      project context (may be NULL for org-wide)
 * @param {object} [opts]
 * @param {object} [opts.documentRow]   pre-fetched business doc — required
 *                                       for predicate evaluation when the
 *                                       workflow has rules referencing
 *                                       document fields (is_emergency etc.)
 * @param {object} [opts.initiatorUser] pre-fetched users row of initiator
 * @param {string} [opts.question]      override default question
 * @param {Array}  [opts.options]       override default approve/reject
 * @param {number} [opts.triggeredBy]   user_id of the action causing this trigger
 * @returns {Promise<{instanceId, pollEventId, sequence}>}
 */
async function triggerSignoff(workflowType, documentId, projectId, opts = {}) {
  if (!workflowType) throw new SignoffError('workflowType required', { code: 'MISSING_TYPE' });
  if (!documentId)   throw new SignoffError('documentId required',   { code: 'MISSING_DOC' });

  // Load workflow row.
  const [[workflow]] = await db.query(
    `SELECT id, workflow_type, signoff_type, sequence, closing_minutes,
            quorum_required, principal_threshold_pct,
            destination_kind, destination_qualifier
       FROM signoff_workflows
      WHERE workflow_type = ? AND active = 1 LIMIT 1`,
    [workflowType]
  );
  if (!workflow) {
    throw new SignoffError(`workflow_type ${workflowType} not found`,
      { code: 'WORKFLOW_NOT_FOUND', status: 400 });
  }

  // Build the resolved approver sequence.
  const { roles, approvers } = await buildSequence(workflow, projectId, {
    documentRow:   opts.documentRow,
    initiatorUser: opts.initiatorUser,
  });

  // Cancel any prior in-progress instance for the same (type, doc).
  await db.query(
    `UPDATE signoff_instances
        SET status = 'cancelled', updated_at = NOW()
      WHERE workflow_type = ? AND document_id = ?
        AND status IN ('pending','in_progress')`,
    [workflowType, documentId]
  );

  // Build poll content.
  const question = opts.question || `${workflowType.replace(/_/g, ' ')} — #${documentId}`;
  const options  = opts.options  || [
    { id: 'yes', text: '✅ Approve' },
    { id: 'no',  text: '❌ Reject'  },
  ];

  const firstApprover = approvers[0];
  const remaining     = approvers.slice(1);
  const closesAt      = workflow.closing_minutes
    ? new Date(Date.now() + Number(workflow.closing_minutes) * 60_000)
    : null;

  // INSERT the instance first so we own a row even if matrix send fails.
  const [insertRes] = await db.query(
    `INSERT INTO signoff_instances (
       workflow_type, document_id, project_id,
       current_approver_id, remaining_approvers, full_sequence,
       question, options, status, closes_at, triggered_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?)`,
    [
      workflowType, documentId, projectId || null,
      firstApprover.id || null,
      JSON.stringify(remaining.map(a => a.id)),
      JSON.stringify(approvers.map(a => a.id)),
      question, JSON.stringify(options),
      closesAt, opts.triggeredBy || null,
    ]
  );
  const instanceId = insertRes.insertId;

  // Send the first poll. Dispatcher routes per workflow.destination_kind.
  // No room resolved → poll_event_id stays NULL (caller can wire mailto
  // fallback for handover_checklist client_rep step etc).
  const dispatch = await _dispatchPoll({
    approver: firstApprover, question, options,
    logTag: `triggerSignoff(${workflowType}/${documentId})`,
    attachImage: opts.attachImage,
    attachMime:  opts.attachMime,
    workflow, projectId,
  });
  const pollEventId = dispatch.pollEventId;

  if (pollEventId) {
    await db.query(
      `UPDATE signoff_instances
          SET poll_event_id = ?, poll_room_id = ?, updated_at = NOW()
        WHERE id = ?`,
      [pollEventId, dispatch.roomId, instanceId]
    );
  }

  return { instanceId, pollEventId, sequence: roles };
}

/**
 * triggerNextRelayStep — advance a relay to the next approver.
 *
 * Called by the poll-vote reader when a vote is received and the
 * current approver's vote is recorded. If remaining_approvers is empty,
 * closes the instance. Otherwise sends the next poll.
 *
 * Idempotent: the UPDATE that advances current_approver_id includes
 * a guard that the row still has the same poll_event_id we expected.
 * Concurrent vote-receivers cannot both advance the relay.
 *
 * @param {number} instanceId
 * @returns {Promise<{advanced:boolean, completed:boolean, nextApproverId:number|null}>}
 */
async function triggerNextRelayStep(instanceId) {
  const [[inst]] = await db.query(
    `SELECT * FROM signoff_instances WHERE id = ? LIMIT 1`,
    [instanceId]
  );
  if (!inst) {
    throw new SignoffError(`signoff_instance ${instanceId} not found`,
      { code: 'INSTANCE_NOT_FOUND' });
  }
  if (inst.status !== 'in_progress') {
    return { advanced: false, completed: inst.status === 'completed', nextApproverId: null };
  }

  const remaining = JSON.parse(inst.remaining_approvers || '[]');

  // No more approvers → relay complete (approved).
  if (!remaining.length) {
    await db.query(
      `UPDATE signoff_instances
          SET status = 'completed', result = 'approved',
              completed_at = NOW(), updated_at = NOW()
        WHERE id = ? AND status = 'in_progress'`,
      [instanceId]
    );
    // Fire follow-up workflows (e.g. emergency CN → design ratification).
    // Re-fetch the row so the hook sees the terminal status it'll
    // predicate on.
    const [[completed]] = await db.query(
      `SELECT * FROM signoff_instances WHERE id = ? LIMIT 1`,
      [instanceId]
    );
    if (completed) await _runPostCompletionHooks(completed);
    return { advanced: false, completed: true, nextApproverId: null };
  }

  // Send next poll to the next approver.
  const nextId = remaining[0];
  const newRemaining = remaining.slice(1);
  const next = await _findUser({ where: 'id = ?', params: [nextId] });
  if (!next) {
    throw new SignoffError(
      `next approver user_id ${nextId} not found / inactive`,
      { code: 'NEXT_APPROVER_MISSING' });
  }

  const options = JSON.parse(inst.options || 'null') || [
    { id: 'yes', text: '✅ Approve' },
    { id: 'no',  text: '❌ Reject'  },
  ];

  // Note: relay steps don't re-attach the image that triggerSignoff may
  // have sent on the first poll. Each step is a fresh DM to a different
  // approver — the original image is in their predecessor's history,
  // not theirs. Adding it here would mean uploading to every approver's
  // room. If a relay-step-level attachment is needed in future, it
  // should be a separate field on signoff_instances populated at
  // trigger time (e.g. attached_image_path) so each step decides.
  // Look up workflow row for destination_kind/qualifier so the relay
  // advance dispatches to the same room shape as the first poll.
  // signoff_instances has workflow_type (string), NOT workflow_id.
  const [[workflow]] = await db.query(
    `SELECT id, workflow_type, destination_kind, destination_qualifier
       FROM signoff_workflows WHERE workflow_type = ? LIMIT 1`,
    [inst.workflow_type]
  );

  const dispatch = await _dispatchPoll({
    approver: next, question: inst.question, options,
    logTag: `triggerNextRelayStep(${instanceId})`,
    workflow, projectId: inst.project_id || null,
  });
  const pollEventId = dispatch.pollEventId;

  // Advance state. The status='in_progress' guard makes this safe
  // against concurrent vote-receivers.
  const [updRes] = await db.query(
    `UPDATE signoff_instances
        SET current_approver_id   = ?,
            remaining_approvers   = ?,
            poll_event_id         = ?,
            poll_room_id          = ?,
            updated_at            = NOW()
      WHERE id = ? AND status = 'in_progress'`,
    [
      nextId,
      JSON.stringify(newRemaining),
      pollEventId,
      dispatch.roomId,
      instanceId,
    ]
  );

  return {
    advanced:        updRes.affectedRows === 1,
    completed:       false,
    nextApproverId:  nextId,
  };
}

/**
 * Mark a signoff_instance as completed/rejected and fire post-completion
 * hooks. Used by the vote handler when an approver votes 'no'.
 *
 * Idempotent — second call on a terminal row is a no-op.
 *
 * @param {number} instanceId
 * @returns {Promise<{terminal:boolean}>}
 */
async function markRejected(instanceId) {
  const [updRes] = await db.query(
    `UPDATE signoff_instances
        SET status = 'completed', result = 'rejected',
            completed_at = NOW(), updated_at = NOW()
      WHERE id = ? AND status = 'in_progress'`,
    [instanceId]
  );
  if (updRes.affectedRows === 0) {
    return { terminal: false };
  }
  const [[completed]] = await db.query(
    `SELECT * FROM signoff_instances WHERE id = ? LIMIT 1`,
    [instanceId]
  );
  if (completed) await _runPostCompletionHooks(completed);
  return { terminal: true };
}

module.exports = {
  triggerSignoff,
  triggerNextRelayStep,
  markRejected,
  buildSequence,
  resolveApprover,
  // Exposed for tests + extensibility
  PREDICATES,
  ACTIONS,
  APPROVER_RESOLVERS,
  POST_COMPLETION_HOOKS,
  SignoffError,
};
