// services/state-machines.js
// ============================================================
// Concrete state machines for payment_requests, change_notices,
// and weekly_reports. These are the enforcement points.
//
// Routes should import from here and call .transition({...})
// instead of writing UPDATE ... SET status='...' directly.
// ============================================================

const { createStateMachine } = require('./state-machine');

// ── PAYMENT REQUEST ──────────────────────────────────────────
// pending_pmc → principal_approved (fast-path, below threshold — PMC approves, no Principal review)
// pending_pmc → pending_principal → principal_approved → paid  (above threshold)
// pending_pmc → pmc_approved  (urgent auto-approve — bypasses PMC review)
// pending_pmc → pmc_rejected
// pending_principal → principal_rejected
// pmc_approved → principal_approved | paid
// principal_approved → paid
const paymentRequest = createStateMachine({
  name:  'payment_request',
  table: 'payment_requests',
  transitions: {
    pending_pmc:     ['pmc_approved', 'pending_principal', 'principal_approved', 'pmc_rejected'],
    pmc_approved:    ['principal_approved', 'paid'],
    pending_principal:  ['principal_approved', 'principal_rejected'],
    principal_approved: ['paid'],
  },
  terminal: ['pmc_rejected', 'principal_rejected', 'paid'],
});

// ── CHANGE NOTICE ────────────────────────────────────────────
// draft → pending_approval → approved               (3 sigs → approval → issue)
// draft → pending_approval → rejected
// Skip to approved is possible when the peer-approval path applies (below ₹1L)
const changeNotice = createStateMachine({
  name:  'change_notice',
  table: 'change_notices',
  transitions: {
    draft:             ['pending_approval'],
    pending_approval:  ['approved', 'rejected'],
  },
  terminal: ['approved', 'rejected'],
});

// ── WEEKLY REPORT ────────────────────────────────────────────
// Actual schema: status ENUM('draft','pending_approval','approved','sent')
// Flow:
//   draft → pending_approval  (all signoffs complete, awaiting PMC approval)
//   pending_approval → approved  (PMC approves)
//   approved → sent  (sent to client)
const weeklyReport = createStateMachine({
  name:  'weekly_report',
  table: 'weekly_reports',
  transitions: {
    draft:             ['pending_approval'],
    pending_approval:  ['approved'],
    approved:          ['sent'],
  },
  terminal: ['sent'],
});

// ── ISSUE ────────────────────────────────────────────────────
// Schema: status ENUM('draft','open','in_progress','resolved','closed','signed_off','accepted_by_client')
// Routes that act on this:
//   :144 draft→open       (confirm)
//   :215 open→resolved    (resolve)
//   :239 resolved→closed  (close)
//   :371 open→closed      (dismiss — PMC short-circuits to closed)
//   :516 *→closed         (RFI close — accepts open/in_progress/resolved)
//   :609 open→resolved    (NCR resolve)
//   :847 resolved→signed_off (multi-sig snag close)
//   :269 closed→open      (reopen)
//
// Notes on edges that exist in code but should be tightened:
//   - The `dismiss` route (:371) in the original code didn't gate on from-state,
//     so it could fire on any status. Real usage is from 'open'. The state
//     machine here enforces 'open' → 'closed' on dismiss; if a non-open issue
//     hits this path, the route gets a 400 instead of silently mutating.
//   - The reopen route (:269) accepts 'closed' or 'dismissed' as from-states
//     in code, but 'dismissed' is not in the ENUM (dead-code branch). Safe
//     to model as closed→open only.
//   - Routes that close RFIs (:516) can come from open/in_progress/resolved.
//     Modelled as edges from each.
const issue = createStateMachine({
  name:  'issue',
  table: 'issues',
  transitions: {
    draft:                 ['open'],
    open:                  ['in_progress', 'resolved', 'closed'],
    in_progress:           ['resolved', 'closed'],
    resolved:              ['closed', 'signed_off', 'open'],   // open is the reopen path; rare
    closed:                ['open'],                           // reopen
    signed_off:            ['accepted_by_client'],
  },
  terminal: ['accepted_by_client'],
});

// ── VENDOR ───────────────────────────────────────────────────
// Schema: clearance_status ENUM('pending','cleared','rejected')
// Routes:
//   modules/onboarding/routes/vendors.js:170 pending→cleared (PATCH /master/:id/clear)
//   modules/onboarding/routes/vendors.js:189 pending→rejected (PATCH /master/:id/reject)
// Future V8: bank-change re-validation flips back to pending — that's a
// reverse edge from cleared→pending (Layer 1 is shipped as B36; the
// state machine extension brings the existing behaviour under guard).
const vendor = createStateMachine({
  name:  'vendor',
  table: 'vendors',
  statusColumn: 'clearance_status',
  transitions: {
    pending: ['cleared', 'rejected'],
    cleared: ['pending'],         // bank-change re-validation (B36 Layer 1)
  },
  terminal: ['rejected'],
});

// ── GRN ──────────────────────────────────────────────────────
// Schema: status ENUM('pending','approved','rejected')
// Routes:
//   modules/site/routes/grn.js:201 pending→approved
//   modules/site/routes/grn.js:215 pending→rejected
//   modules/site/routes/grn.js:318 *→rejected (NCR-driven non-conformance)
const grn = createStateMachine({
  name:  'grn',
  table: 'grns',
  transitions: {
    pending:  ['approved', 'rejected'],
    approved: ['rejected'],   // NCR-driven non-conformance after approval
  },
  terminal: ['rejected'],
});

// ── VENDOR ENGAGEMENT — mobilisation status ──────────────────
// Schema: mobilisation_status ENUM('not_started','active','partially_complete','complete','off_site')
// Route: modules/onboarding/routes/vendors.js:583 (any→any — site managers update)
// Transitions are operational, not approval-gated. Model permissive but
// require explicit from-state.
const vendorEngagementMobilisation = createStateMachine({
  name:  'vendor_engagement_mobilisation',
  table: 'vendor_engagements',
  statusColumn: 'mobilisation_status',
  transitions: {
    not_started:        ['active', 'off_site'],
    active:             ['partially_complete', 'complete', 'off_site'],
    partially_complete: ['active', 'complete', 'off_site'],
    off_site:           ['active'],
  },
  terminal: ['complete'],
});

// ── VENDOR ENGAGEMENT — approval status ──────────────────────
// Schema: approval_status ENUM('pending','approved','rejected')
const vendorEngagementApproval = createStateMachine({
  name:  'vendor_engagement_approval',
  table: 'vendor_engagements',
  statusColumn: 'approval_status',
  transitions: {
    pending: ['approved', 'rejected'],
  },
  terminal: ['approved', 'rejected'],
});

// ── DRAWING VERSION ──────────────────────────────────────────
// Schema: status ENUM('pending_l1','pending_l2','issued','rejected','superseded')
// Routes:
//   :216 any-current → superseded   (new revision uploaded supersedes the previous)
//   :417 pending_l1 → pending_l2 | issued   (L1 review)
//        pending_l2 → issued                (L2 approve)
//   :513 pending_l1 | pending_l2 → rejected (reject, with note)
//   :517 superseded → "current"             (NOT a status change; flips is_current
//                                             on the next-newest superseded row to
//                                             restore it. Stays as audit-only edge.)
//   :559 pending_l1 | pending_l2 → pending_l2  (flag with hold=true)
//
// Notes:
//   - Supersede is a "from any non-terminal" edge. Modelled with explicit
//     edges from each pending state and from issued, since issued can also
//     be superseded by a later revision upload.
//   - The is_current=1 restore at :517 fires only when a rejection vacates
//     the current pointer — it does not change the status of the restored
//     row, just its is_current flag. That UPDATE stays raw (the audit
//     surfaces it but it isn't a state change).
const drawingVersion = createStateMachine({
  name:  'drawing_version',
  table: 'drawing_versions',
  transitions: {
    pending_l1: ['pending_l2', 'issued', 'rejected', 'superseded'],
    // Removed 'pending_l2' self-loop — a state transitioning to itself is
    // never a valid workflow step and produces ambiguous audit trail entries.
    // The flag-with-hold path (:559) stays in pending_l2 conceptually via
    // a hold column update, not a status change.
    pending_l2: ['issued', 'rejected', 'pending_l1', 'superseded'],
    issued:     ['superseded'],
  },
  terminal: ['rejected'],
  // 'superseded' is reachable from non-terminal states; it doesn't list
  // outgoing edges in `transitions`. The factory treats it as terminal-
  // looking (no outgoing edges).
});

// ── DRAWING REGISTER ENTRY ───────────────────────────────────
// Schema: status ENUM('pending','in_progress','issued')
// Routes:
//   :234 pending → in_progress | issued   (first version uploaded)
//   :425 in_progress → issued             (when underlying version becomes 'issued')
const drawingRegister = createStateMachine({
  name:  'drawing_register',
  table: 'drawing_register',
  transitions: {
    pending:     ['in_progress', 'issued'],
    in_progress: ['issued'],
  },
  terminal: ['issued'],
});

// ── SCHEDULE VERSION ─────────────────────────────────────────
// Schema: status ENUM('draft','pending_approval','approved','rejected')
// Routes (modules/design-services/contract.js):
//   promoteScheduleVersion() — demotes old current version via is_current=0
//                              (status stays 'approved'); promotes new version
//                              pending_approval → approved via SM.
// "Superseded" is expressed as is_current=0 on an approved row, not as a
// separate ENUM value. No raw UPDATE writes 'superseded' to the status column.
// The approved→rejected edge covers the edge case of revoking an already-
// approved version (handled in code, not a regular workflow step).
const scheduleVersion = createStateMachine({
  name:  'schedule_version',
  table: 'schedule_versions',
  transitions: {
    draft:            ['pending_approval'],
    pending_approval: ['approved', 'rejected'],
    approved:         ['rejected'],   // pre-existing edge in contract.js logic
  },
  terminal: ['rejected'],
});

// ── VENDOR PAYMENT ───────────────────────────────────────────
// Schema: status ENUM('pending','approved','processed','paid')
// Routes (modules/finance/routes/payments.js):
//   :222 pending → approved   (PMC approves with actual amount + adjustment reason)
//   :364 approved → processed (ICICI batch generated, payment_cycle_id assigned)
//   :521 processed → paid     (UTR number recorded after bank confirms)
const vendorPayment = createStateMachine({
  name:  'vendor_payment',
  table: 'vendor_payments',
  transitions: {
    pending:   ['approved'],
    approved:  ['processed'],
    processed: ['paid'],
  },
  terminal: ['paid'],
});

// ── DAILY REPORT ─────────────────────────────────────────────
// Schema: status ENUM('pending_review','approved','flagged','auto_locked')
// Routes:
//   modules/site/routes/daily-reports.js:314 → approved (single approve)
//   modules/site/routes/daily-reports.js:339 → approved (batch-approve)
//   modules/site/routes/daily-reports.js:387 → flagged  (PMC flag)
//   modules/site/contract.js:163             → approved (approveAllPendingDailyReports)
//   modules/site/contract.js:178             → flagged  (flagDailyReport)
// auto_locked is set by a cron job (overdue-checker) — modelled below.
const dailyReport = createStateMachine({
  name:  'daily_report',
  table: 'daily_reports',
  transitions: {
    pending_review: ['approved', 'flagged', 'auto_locked'],
    flagged:        ['approved'],     // PMC re-approves a flagged report after revision
    approved:       ['flagged'],      // PMC un-approves
  },
  terminal: ['auto_locked'],
});

// ── MEETING (MOM) ────────────────────────────────────────────
// Schema: status ENUM('draft','approved','issued','shared','acknowledged','closed')
// Routes (modules/workflow/routes/meetings.js):
//   :120 draft → approved   (PMC approves the MOM)
//   :222 approved → issued  (PMC issues to client)
//   :358 shared → issued    (re-issue after correcting; reuses the issued state)
const meeting = createStateMachine({
  name:  'meeting',
  table: 'meetings',
  transitions: {
    draft:        ['approved'],
    approved:     ['issued'],
    issued:       ['shared', 'acknowledged'],
    shared:       ['acknowledged', 'issued'],   // re-issue path after correction
    acknowledged: ['closed', 'issued'],         // unlock → reissue (W16 path)
  },
  terminal: ['closed'],
});

// ── MEETING ACTION (MOM action item) ─────────────────────────
// Schema: status ENUM('pending','acknowledged','in_progress','completed','overdue')
// Routes:
//   :463 pending → acknowledged   (assignee acknowledges)
//   :479 acknowledged → in_progress (countersigner approves the ack)
//   :487 in_progress → pending   (rejects countersign — back to assignee)
//   :507 in_progress | acknowledged → completed (assignee marks done)
//
// Recovery from overdue: overdue is NOT terminal. The cron that marks items
// overdue fires while the item is still active; once the assignee acts on
// an overdue item it must be able to move forward. Marking overdue as
// terminal would trap those items permanently.
const meetingAction = createStateMachine({
  name:  'meeting_action',
  table: 'meeting_actions',
  transitions: {
    pending:      ['acknowledged', 'overdue'],
    acknowledged: ['in_progress', 'completed', 'overdue'],
    in_progress:  ['completed', 'pending', 'overdue'],
    overdue:      ['pending', 'acknowledged', 'in_progress'],  // assignee resumes work
  },
  terminal: ['completed'],
});

// ── SUBMITTAL ────────────────────────────────────────────────
// Schema: status ENUM('submitted','under_review','approved','approved_with_comments',
//                     'resubmit_required','rejected')
// Routes (modules/workflow/routes/submittals.js):
//   :73 submitted | under_review | resubmit_required → various review outcomes
const submittal = createStateMachine({
  name:  'submittal',
  table: 'submittals',
  transitions: {
    submitted:         ['under_review', 'approved', 'approved_with_comments',
                        'resubmit_required', 'rejected'],
    under_review:      ['approved', 'approved_with_comments',
                        'resubmit_required', 'rejected'],
    resubmit_required: ['under_review', 'approved', 'approved_with_comments',
                        'rejected'],
    approved_with_comments: ['approved'],
  },
  terminal: ['approved', 'rejected'],
});

// ── MEASUREMENT ──────────────────────────────────────────────
// Schema: status ENUM('draft','rs_signed','client_accepted')
// Routes (modules/workflow/routes/measurements.js):
//   :124 draft → rs_signed   (stream head signs)
//   :150 rs_signed → client_accepted   (client formally accepts — uploads signed cert)
const measurement = createStateMachine({
  name:  'measurement',
  table: 'measurements',
  transitions: {
    draft:     ['rs_signed'],
    rs_signed: ['client_accepted'],
  },
  terminal: ['client_accepted'],
});

// ── CLIENT CLAIM ─────────────────────────────────────────────
// Schema: status ENUM('draft','pending_approval','approved','invoiced')
// Routes (modules/finance/routes/claims.js):
//   pmc-signoff + rs-signoff → both recorded as columns (pmc_signoff/rs_signoff).
//   When BOTH columns are set, recordClaimSignoff() transitions draft → pending_approval.
//   :216 pending_approval → approved  (principal final approval)
//   :288 approved → invoiced          (invoice number recorded)
//
// Governance Sheet 02 labels the intermediate sign-off states as 'pmc_signed'
// and 'stream_signed', but those are NOT status values — they are column
// flags (pmc_signoff/rs_signoff). The status ENUM only has the four values
// above. The SM correctly models the ENUM.
const clientClaim = createStateMachine({
  name:  'client_claim',
  table: 'client_claims',
  transitions: {
    draft:            ['pending_approval', 'approved'],
    pending_approval: ['approved'],
    approved:         ['invoiced'],
  },
  terminal: ['invoiced'],
});

// ── MATERIAL REQUEST ─────────────────────────────────────────
// Schema: status TINYINT(3) UNSIGNED — state encoded as integer 1-5
//   1 = raised      (request submitted)
//   2 = ordered     (PO placed)
//   3 = dispatched
//   4 = received
//   5 = validated   (terminal)
// Routes (modules/design-services/routes/materials.js):
//   :222 — PMC updates status, sets the appropriate timestamp/actor for that step
const materialRequest = createStateMachine({
  name:  'material_request',
  table: 'material_requests',
  transitions: {
    1: [2],
    2: [3],
    3: [4],
    4: [5],
  },
  terminal: [5],
});

// ── PROFORMA INVOICE ─────────────────────────────────────────
// Schema: status ENUM('draft','sent','acknowledged','paid')
// Routes:
//   modules/finance/routes/finance.js:188      → paid          (mark paid)
//   modules/finance/routes/invoices.js:218     → sent | acknowledged | paid (PATCH /:id/status)
//   modules/finance/routes/invoices.js:224     → ?              (mark sent)
const proformaInvoice = createStateMachine({
  name:  'proforma_invoice',
  table: 'proforma_invoices',
  transitions: {
    draft:        ['sent'],
    sent:         ['acknowledged', 'paid'],
    acknowledged: ['paid'],
  },
  terminal: ['paid'],
});

// ── PROJECT ──────────────────────────────────────────────────
// Schema: status ENUM('initialising','active','on_hold','completed')
// Routes:
//   modules/readiness-gate/service.js:75       initialising → active   (auto-activate when ready)
//   modules/site/routes/handover.js:179        active → completed      (4 closure signoffs in)
const project = createStateMachine({
  name:  'project',
  table: 'projects',
  transitions: {
    initialising: ['active'],
    active:       ['on_hold', 'completed'],
    on_hold:      ['active', 'completed'],
  },
  terminal: ['completed'],
});

// ── BUDGET COST HEAD ─────────────────────────────────────────
// Schema: status ENUM('pending','approved')
// Routes: modules/finance/routes/budget.js:238
const budgetCostHead = createStateMachine({
  name:  'budget_cost_head',
  table: 'budget_cost_heads',
  transitions: { pending: ['approved'] },
  terminal: ['approved'],
});

// ── FORM TEMPLATE ────────────────────────────────────────────
// Schema: status ENUM('draft','approved','archived')
// Routes: modules/site/routes/forms.js:73
const formTemplate = createStateMachine({
  name:  'form_template',
  table: 'form_templates',
  transitions: {
    draft:    ['approved', 'archived'],
    approved: ['archived'],
  },
  terminal: ['archived'],
});

// ── USER PENDING ─────────────────────────────────────────────
// Schema: status ENUM('pending','approved','rejected')
// Routes: modules/auth/routes/user-management.js:105 (approve), :140 (reject)
const userPending = createStateMachine({
  name:  'user_pending',
  table: 'user_pending',
  transitions: { pending: ['approved', 'rejected'] },
  terminal: ['approved', 'rejected'],
});

// ── ROLE NAV DRAFT ───────────────────────────────────────────
// Schema (from migrations/v4.2-it-admin-nav-editor.sql):
//   status ENUM('pending_principal','approved','rejected')
// Routes: modules/system/routes/nav-admin.js
//   :129 — supersede older drafts when a new one is proposed (pending → rejected)
//   :262 — principal approves    (pending_principal → approved)
//   :309 — principal rejects     (pending_principal → rejected)
const roleNavDraft = createStateMachine({
  name:  'role_nav_draft',
  table: 'role_nav_drafts',
  transitions: {
    pending_principal: ['approved', 'rejected'],
  },
  terminal: ['approved', 'rejected'],
});

// ── MOM ITEM ─────────────────────────────────────────────────
// Schema (install v5.21): status ENUM('open','closed') DEFAULT 'open'
// Routes (modules/workflow/contract.js:108): upsertMomItem
//
// The ENUM has exactly two values: 'open' and 'closed'. Any JSDoc or
// comment elsewhere that mentions 'in_progress' as a valid status is stale
// and wrong — do not add that value without a migration that widens the ENUM.
const momItem = createStateMachine({
  name:  'mom_item',
  table: 'mom_items',
  transitions: {
    open: ['closed'],
  },
  terminal: ['closed'],
});

module.exports = {
  paymentRequest,
  changeNotice,
  weeklyReport,
  issue,
  vendor,
  grn,
  vendorEngagementMobilisation,
  vendorEngagementApproval,
  drawingVersion,
  drawingRegister,
  scheduleVersion,
  vendorPayment,
  dailyReport,
  meeting,
  meetingAction,
  submittal,
  measurement,
  clientClaim,
  materialRequest,
  proformaInvoice,
  project,
  budgetCostHead,
  formTemplate,
  userPending,
  roleNavDraft,
  momItem,
};
