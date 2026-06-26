// services/roles.js
// ============================================================
// Single source of truth for role-group constants used in
// authorisation checks. Eliminates the v2/v3 hazard where
// `STREAM_HEADS` meant different things in different files
// (in budget.js it excluded principals, in claims.js it
// included them). Each constant below has ONE meaning.
//
// ── Migration plan for Guru ────────────────────────────────
// 1. When editing a route, delete any local `const STREAM_HEADS = [...]`
//    or similar and `const roles = require('../services/roles')`.
// 2. Replace uses with the named constant that matches the role set.
// 3. When adding a new role-gate, pick the constant whose name
//    reads correctly at the call site. If none fit, add a new one
//    HERE — never inline the array.
// ============================================================

// Individual roles (for readability / typo-proofing)
const R = Object.freeze({
  PRINCIPAL:        'principal',
  DESIGN_PRINCIPAL: 'design_principal',
  PMC_HEAD:         'pmc_head',
  DESIGN_HEAD:      'design_head',
  SERVICES_HEAD:    'services_head',
  FINANCE_ADMIN:    'finance_admin',
  SITE_MANAGER:     'site_manager',
  SENIOR_SITE_MANAGER: 'senior_site_manager',
  // DETAILING_HEAD removed — merged into team_lead,
  JR_ARCHITECT:     'jr_architect',
  SERVICES_ENGINEER:'services_engineer',
  TEAM_LEAD:        'team_lead',
  JR_ENGINEER:      'jr_engineer',
  COORDINATOR:      'coordinator',
  TRAINEE:          'trainee',
  IT_ADMIN:         'it_admin',
  AUDIT:            'audit',    // Read-only test account — bypasses role gates on GET, blocked on writes
});

// ── GROUPS ────────────────────────────────────────────────
// Each constant below is a sealed array. Name describes the
// SEMANTIC role it plays at the call site, not just who's in it.

// The two people who founded the firm (Principal + Design Principal).
const PRINCIPALS = Object.freeze([R.PRINCIPAL, R.DESIGN_PRINCIPAL]);

// Principals + the PMC Head. Used wherever "most senior decision-maker
// in the room" is needed (e.g. petty cash replenish, deputy assignment).
const PMC_PRINCIPAL = Object.freeze([R.PMC_HEAD, R.PRINCIPAL, R.DESIGN_PRINCIPAL]);

// Alias kept for readability at call sites that think "PMC-level roles".
const PMC_ROLES = PMC_PRINCIPAL;

// ONLY stream heads — no principals. Used where authority is
// explicitly delegated to the head of a single stream (design/services)
// and must NOT leak to principals. Previously this was the meaning of
// STREAM_HEADS in budget.js (incl. 2 people only).
const STREAM_HEADS_ONLY = Object.freeze([R.DESIGN_HEAD, R.SERVICES_HEAD]);

// Stream heads OR principals. This is what STREAM_HEADS meant in
// claims.js, client-boq.js, measurements.js, issues.js (incl. 4 people).
// Use this when the check reads "someone senior enough on a stream".
const STREAM_HEADS_OR_PRINCIPAL = Object.freeze([
  R.DESIGN_HEAD, R.SERVICES_HEAD, R.PRINCIPAL, R.DESIGN_PRINCIPAL,
]);

// Everyone who can review a claim (stream heads, PMC, principals).
const CLAIM_REVIEWERS = Object.freeze([
  R.PRINCIPAL, R.DESIGN_PRINCIPAL, R.PMC_HEAD, R.DESIGN_HEAD, R.SERVICES_HEAD,
]);

// Everyone who can edit client-facing BOQ rates.
const CLIENT_RATE_ROLES = CLAIM_REVIEWERS;

// Semantic alias for CLAIM_REVIEWERS — used where the check reads
// "any senior head" regardless of claim/rate context (e.g. meetings
// peer-review routing, generic head-level visibility gates).
const ALL_HEADS = CLAIM_REVIEWERS;

// Finance admins + principals + PMC head (any finance action gate).
const FINANCE_ROLES = Object.freeze([
  R.PRINCIPAL, R.DESIGN_PRINCIPAL, R.PMC_HEAD, R.FINANCE_ADMIN,
]);

// ALL_HEADS + finance_admin. Used on finance gates that must also
// let the full head-level cohort see/act (e.g. client-receipts view).
const HEADS_WITH_FINANCE = Object.freeze([
  R.PRINCIPAL, R.DESIGN_PRINCIPAL, R.PMC_HEAD, R.DESIGN_HEAD, R.SERVICES_HEAD, R.FINANCE_ADMIN,
]);

// Site managers (both grades).
const SITE_MANAGERS = Object.freeze([R.SITE_MANAGER, R.SENIOR_SITE_MANAGER]);

// ── EXPORTS ───────────────────────────────────────────────
module.exports = {
  R,
  PRINCIPALS,
  PMC_PRINCIPAL,
  PMC_ROLES,
  STREAM_HEADS_ONLY,
  STREAM_HEADS_OR_PRINCIPAL,
  CLAIM_REVIEWERS,
  CLIENT_RATE_ROLES,
  ALL_HEADS,
  FINANCE_ROLES,
  HEADS_WITH_FINANCE,
  SITE_MANAGERS,
};
