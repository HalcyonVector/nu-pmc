#!/usr/bin/env node
// scripts/build-nav-prototype.js
//
// Generates nav-prototype.html — a standalone HTML prototype for navigation
// auditing that faithfully mirrors the real app structure:
//
//   - Real app.css inlined for pixel-faithful styling
//   - Real topbar structure (.topbar / .tb-left / .tb-ctx / .tb-brand)
//   - Real bottom nav (.bottom-nav / .bb-item / .bb-icon SVGs) from app.js:344
//   - Real horizontal tab strip (.tabs / .tab) from app.js:397
//   - Real accordion for buckets >5 items from app.js:437 with real TAB_ICONS
//   - Role-branched dashboard variants from renderDashboard:8247
//   - Role-gated screen content (canApprove, canRaise, isAudit, etc.)
//   - TAB_LABELS from app.js:27
//   - role_nav data from pv90-loaded.sql
//
// USAGE
//   node scripts/build-nav-prototype.js
//   open nav-prototype.html   # or share the file
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const CSS_PATH  = path.join(ROOT, 'public/css/app.css');
const PV90_PATH = path.join(ROOT, 'nu-pmc-install-20260502.sql');
const OUT_PATH  = path.join(ROOT, 'nav-prototype.html');

// ── 1. Real CSS ─────────────────────────────────────────────────────────────
const css = fs.readFileSync(CSS_PATH, 'utf8');

// ── 2. Parse role_nav ───────────────────────────────────────────────────────
const sql = fs.readFileSync(PV90_PATH, 'utf8');
const navBlock = sql.match(/INSERT INTO `role_nav` VALUES([\s\S]*?);/);
if (!navBlock) throw new Error('role_nav INSERT not found in pv90-loaded.sql');
const rows = [];
for (const m of navBlock[1].matchAll(/\((\d+),'([^']+)','([^']+)','([^']+)',(\d+),(\d+)/g)) {
  if (m[6] !== '1') continue;
  rows.push({ role: m[2], bucket: m[3], item: m[4], sort: parseInt(m[5], 10) });
}
const nav = {};
for (const r of rows) {
  (nav[r.role] = nav[r.role] || {});
  (nav[r.role][r.bucket] = nav[r.role][r.bucket] || []).push(r);
}
for (const role of Object.keys(nav)) {
  for (const bucket of Object.keys(nav[role])) {
    nav[role][bucket].sort((a, b) => a.sort - b.sort);
  }
}
const allRoles = Object.keys(nav).sort();

// ── 3. Data from app.js (copied verbatim) ───────────────────────────────────
// TAB_LABELS from app.js:27
const TAB_LABELS = {
  dashboard:'Dashboard', projects:'Projects', changes:'CNs',
  monthly:'Monthly Overview', project_detail:'Project Summary',
  budget:'Budget', payments:'Payments', payments_fin:'Payments',
  schedule_view:'Schedule', weekly_health:'Health', users:'Users',
  reports_daily:'Daily Reports', reports_weekly:'Weekly Reports',
  grn:'GRNs', issues:'Issues', meetings:'Meetings', labour:'Labour',
  drawings:'Drawings', register:'Register', delegations:'Delegations',
  signoff:'Weekly Sign-off', phototags:'Photo Review',
  issues_site:'Field Issues', tasks:'Tasks', photos:'Photos',
  pi:'Invoices', petty_cash:'Petty Cash', client_receipts:'Receipts',
  submittals:'Submittals', notifications:'Alerts', ncr:'NCRs',
  compliance:'Compliance', tally:'Tally', gst_statement:'GST',
  boq_mapping:'Vendor Allocation', budget_tree:'Budget Tree',
  clients:'Clients', vendors_master:'Vendors',
  finance_clearance:'Vendor Clearance', vendors:'Engagements',
  materials:'Materials', materials_site:'Materials',
  client_boq:'Client Contract', nav_editor:'Nav Editor',
  boq_versions:'BOQ Versions', governance:'Governance',
  account_setup:'Account Setup', errors_log:'Error Log',
  library:'Knowledge Library',
};

const ROLE_LABELS = {
  principal:'Principal', design_principal:'Design Principal',
  pmc_head:'PMC Head', design_head:'Design Head',
  services_head:'Services Head', team_lead:'Team Lead',
  jr_architect:'Jr. Architect', detailing:'Detailing',
  services_engineer:'Services Engineer', site_manager:'Site Manager',
  senior_site_manager:'Senior Site Manager', finance_admin:'Finance Admin',
  it_admin:'IT Admin', audit:'Audit', coordinator:'Coordinator',
  trainee:'Trainee',
};

// TAB_ICONS from app.js:443 — exact SVGs, same thin-stroke style as bottom nav
const TAB_ICONS = {
  reports:       '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  reports_daily: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  reports_weekly:'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  issues:        '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  issues_site:   '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  labour:        '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
  grn:           '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  tasks:         '<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  drawings:      '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
  register:      '<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  meetings:      '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  schedule_view: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="15" x2="16" y2="15"/></svg>',
  payments:      '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  payments_fin:  '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  vendors:       '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  vendors_master:'<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  budget:        '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  budget_tree:   '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  materials:     '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
  materials_site:'<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
  client_boq:    '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>',
  boq_mapping:   '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  approvals:     '<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  pending:       '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>',
  finance_clearance:'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  changes:       '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  photos:        '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  phototags:     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  ncr:           '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  submittals:    '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  notifications: '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>',
  weekly_health: '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  compliance:    '<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  users:         '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
  delegations:   '<svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
  governance:    '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
  account_setup: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  errors_log:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  nav_editor:    '<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  library:       '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  tally:         '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  gst_statement: '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  pi:            '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  petty_cash:    '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  client_receipts:'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V8z"/></svg>',
  clients:       '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  signoff:       '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  monthly:       '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
  projects:      '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  project_detail:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  dashboard:     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
};
const DEFAULT_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

// BUCKET_ICONS from app.js:344 — exact SVGs
const BUCKET_ICONS = {
  home:    '<svg viewBox="0 0 24 24"><path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg>',
  work:    '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>',
  money:   '<span class="bb-icon-rupee">₹</span>',
  pending: '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>',
  more:    '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>',
};

const NAV_JSON        = JSON.stringify(nav);
const TAB_LABELS_JSON = JSON.stringify(TAB_LABELS);
const TAB_ICONS_JSON  = JSON.stringify(TAB_ICONS);
const BUCKET_ICONS_JSON = JSON.stringify(BUCKET_ICONS);
const ROLE_LABELS_JSON  = JSON.stringify(ROLE_LABELS);

// ── Screen content (role-aware placeholders) ─────────────────────────────────
// Screens are defined as JS functions in the HTML — they reference currentRole
// and the helpers (isPrincipal, isSite, isAudit, etc.) which mirror app.js logic.
const SCREENS_JS = `
// ── permission helpers (mirror app.js patterns) ─────────────────────────
function isPrincipal() { return ['principal','design_principal'].includes(currentRole); }
function isPMC()       { return ['pmc_head','senior_site_manager'].includes(currentRole); }
function isSite()      { return ['site_manager','senior_site_manager'].includes(currentRole); }
function isFinance()   { return currentRole === 'finance_admin'; }
function isDesign()    { return ['design_head','services_head'].includes(currentRole); }
function isAudit()     { return currentRole === 'audit'; }
function isITAdmin()   { return currentRole === 'it_admin'; }

function auditBanner() {
  return isAudit()
    ? '<div style="background:rgba(89,106,126,0.1);border-left:3px solid var(--steel);padding:8px 12px;font-size:12px;color:var(--text2);border-radius:4px;margin-bottom:14px">📖 Audit role — read-only. No approve/reject actions.</div>'
    : '';
}
function approveBtn(label) { return isAudit() ? '' : '<button class="btn-approve" style="min-height:44px">' + label + '</button>'; }
function rejectBtn(label)  { return isAudit() ? '' : '<button class="btn-reject"  style="min-height:44px">' + label + '</button>'; }

// ── Dashboard variants — mirror renderDashboard:8247 ─────────────────────
function screenDashboard() {
  if (isFinance()) return dashFinance();
  if (isSite())    return dashSite();
  if (isPMC())     return dashPMC();
  if (isDesign())  return dashDesign();
  return dashPrincipal();
}

// renderFinanceDashboard:8434 — 4-tile grid only, no site/PMC content
function dashFinance() {
  return '<div class="sec-label">Finance Dashboard</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">' +
    '<button class="btn-secondary" style="padding:14px;text-align:center;min-height:44px">💳<div style="font-size:12px;margin-top:4px">Payments</div></button>' +
    '<button class="btn-secondary" style="padding:14px;text-align:center;min-height:44px">🧾<div style="font-size:12px;margin-top:4px">Invoices</div></button>' +
    '<button class="btn-secondary" style="padding:14px;text-align:center;min-height:44px">💵<div style="font-size:12px;margin-top:4px">Petty Cash</div></button>' +
    '<button class="btn-secondary" style="padding:14px;text-align:center;min-height:44px">📤<div style="font-size:12px;margin-top:4px">Tally Export</div></button>' +
    '</div>';
}

// renderSiteDashboard:8326 — project banner + stat row + 4 quick-action buttons
function dashSite() {
  return '<div class="card" style="background:var(--navy);border:none;margin-bottom:16px">' +
    '<div style="color:rgba(255,255,255,.7);font-size:11px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em">Friday, 2 May</div>' +
    '<div style="color:var(--white);font-size:22px;font-weight:700;margin-top:4px">PV90 — Bangalore Penthouse</div>' +
    '</div>' +
    '<div class="stat-row">' +
    '<button class="stat-card"><span class="stat-val">3</span><span class="stat-lbl">Active Tasks</span></button>' +
    '<button class="stat-card"><span class="stat-val" style="color:var(--red)">1</span><span class="stat-lbl">Issues</span></button>' +
    '<button class="stat-card"><span class="stat-val">0</span><span class="stat-lbl">GRNs</span></button>' +
    '</div>' +
    '<div class="sec-label">Quick Actions</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
    '<button class="action-card"><span style="font-size:24px;margin-bottom:6px">📊</span><span style="font-size:13px;font-weight:600">Update Tasks</span></button>' +
    '<button class="action-card"><span style="font-size:24px;margin-bottom:6px">📦</span><span style="font-size:13px;font-weight:600">Raise GRN</span></button>' +
    '<button class="action-card"><span style="font-size:24px;margin-bottom:6px">⚠️</span><span style="font-size:13px;font-weight:600">Raise Issue</span></button>' +
    '<button class="action-card"><span style="font-size:24px;margin-bottom:6px">📐</span><span style="font-size:13px;font-weight:600">Drawing Query</span></button>' +
    '</div>';
}

// renderPMCDashboard:8266 — "Today’s Priorities" + Project Snapshot stat row
function dashPMC() {
  return '<div class="sec-label">Today’s Priorities</div>' +
    '<button class="action-item c-red" style="min-height:44px"><div class="ai-icon">⚠️</div><div class="ai-body"><div class="ai-title">Report anomalies flagged</div><div class="ai-meta">1 needs review</div></div><span class="badge b-red">1</span></button>' +
    '<button class="action-item c-amber" style="min-height:44px"><div class="ai-icon">📦</div><div class="ai-body"><div class="ai-title">GRNs pending approval</div><div class="ai-meta">2 awaiting sign-off</div></div><span class="badge b-amber">2</span></button>' +
    '<button class="action-item c-red" style="min-height:44px"><div class="ai-icon">🦺</div><div class="ai-body"><div class="ai-title">Safety issues open</div><div class="ai-meta">1 needs confirmation</div></div><span class="badge b-red">ACTION</span></button>' +
    '<button class="action-item c-amber" style="min-height:44px"><div class="ai-icon">💰</div><div class="ai-body"><div class="ai-title">Budget variance flagged</div><div class="ai-meta">Civil over threshold 2.4%</div></div><span class="badge b-amber">ALERT</span></button>' +
    '<div class="sec-label" style="margin-top:18px">Project Snapshot</div>' +
    '<div class="stat-row">' +
    '<div class="stat-card"><span class="stat-val" style="color:var(--red)">3</span><span class="stat-lbl">Issues</span></div>' +
    '<div class="stat-card"><span class="stat-val">2</span><span class="stat-lbl">GRNs</span></div>' +
    '<div class="stat-card"><span class="stat-val">2</span><span class="stat-lbl">Payments</span></div>' +
    '</div>';
}

// renderDesignDashboard:8380 — pending drawing approvals + drawing queries by stream
function dashDesign() {
  var stream = currentRole === 'design_head' ? 'Design' : 'Services';
  return '<div class="sec-label">Pending — ' + stream + ' Stream</div>' +
    '<button class="action-item c-navy" style="min-height:44px"><div class="ai-icon">📐</div><div class="ai-body"><div class="ai-title">A-501 — Master Bathroom Layout</div><div class="ai-meta">Rev 4 · PV90 · submitted by Team Lead</div></div><span class="badge b-amber">Approve</span></button>' +
    '<button class="action-item c-navy" style="min-height:44px"><div class="ai-icon">📐</div><div class="ai-body"><div class="ai-title">A-301 — Block A Section</div><div class="ai-meta">Rev 2 · PV90 · submitted by Sushmitha</div></div><span class="badge b-amber">Approve</span></button>' +
    '<div class="sec-label">Drawing Queries</div>' +
    '<div class="card"><div class="card-title" style="color:var(--red)">A-201 — door swing direction</div><div class="card-meta">Suleman · 4 days ago</div></div>' +
    '<div class="card"><div class="card-title">S-301 — slab thickness Block A</div><div class="card-meta">Anjaneya · 1 day ago</div></div>';
}

// Original dashboard (principal/design_principal/audit/others) — portfolio view
function dashPrincipal() {
  return auditBanner() +
    '<div class="sec-label">Action Centre</div>' +
    '<button class="action-item c-red" style="min-height:44px"><div class="ai-icon">🔴</div><div class="ai-body"><div class="ai-title">Drawing queries — overdue</div><div class="ai-meta">2 unanswered 3+ days</div></div><span class="badge b-red">OVERDUE</span></button>' +
    '<button class="action-item c-amber" style="min-height:44px"><div class="ai-icon">✍️</div><div class="ai-body"><div class="ai-title">CNs awaiting sign-off</div><div class="ai-meta">2 pending Principal</div></div><span class="badge b-amber">2</span></button>' +
    '<button class="action-item c-blue" style="min-height:44px"><div class="ai-icon">💰</div><div class="ai-body"><div class="ai-title">Payment batches awaiting approval</div><div class="ai-meta">₹6,10,700 total</div></div><span class="badge b-blue">2</span></button>' +
    '<div class="sec-label" style="margin-top:18px">Portfolio Snapshot</div>' +
    '<div class="kpi-grid">' +
    '<div class="kpi"><div class="kpi-label">Active projects</div><div class="kpi-value">3</div></div>' +
    '<div class="kpi"><div class="kpi-label">This month spend</div><div class="kpi-value">₹40.27L</div></div>' +
    '<div class="kpi"><div class="kpi-label">Open issues</div><div class="kpi-value">3</div></div>' +
    '<div class="kpi"><div class="kpi-label">Reports overdue</div><div class="kpi-value" style="color:var(--red)">1</div></div>' +
    '</div>';
}

// ── Per-screen content ───────────────────────────────────────────────────────
var SCREENS = {
  dashboard:     function() { return screenDashboard(); },
  monthly: function() {
    return '<div class="sec-label">May 2026 — All Projects</div>' +
      '<div class="card"><div class="card-title">PV90 — Bangalore Penthouse</div><div class="card-meta">Site: Suleman · Design: Team Lead · Spend: ₹14,32,000 / ₹85,00,000</div><div style="margin-top:8px"><span class="badge b-green">On track</span> <span class="badge b-amber">2 pending</span></div></div>' +
      '<div class="card"><div class="card-title">NW22 — Whitefield Villa</div><div class="card-meta">Site: Anjaneya · Design: Sushmitha · Spend: ₹3,80,000 / ₹62,00,000</div><div style="margin-top:8px"><span class="badge b-red">Report overdue</span></div></div>' +
      '<div class="card"><div class="card-title">SR15 — Sarjapur Residence</div><div class="card-meta">Site: Prajwal · Design: Team Lead · Spend: ₹22,15,000 / ₹98,00,000</div><div style="margin-top:8px"><span class="badge b-green">On track</span></div></div>';
  },
  projects: function() {
    if (isSite()) return '<div class="sec-label">My Project</div><button class="card" style="display:block;width:100%;text-align:left;min-height:44px"><div class="card-title">PV90 — Bangalore Penthouse</div><div class="card-meta">Block A — slab in progress</div></button>';
    return '<div class="sec-label">Active Projects (3)</div>' +
      ['PV90 — Bangalore Penthouse','NW22 — Whitefield Villa','SR15 — Sarjapur Residence'].map(function(n,i) {
        return '<button class="card" style="display:block;width:100%;text-align:left;min-height:44px"><div class="card-title">' + n + '</div><div class="card-meta">' + ['₹14.32L / ₹85L · 16.8%','₹3.80L / ₹62L · 6.1%','₹22.15L / ₹98L · 22.6%'][i] + '</div></button>';
      }).join('');
  },
  project_detail: function() {
    return '<div class="card" style="margin-bottom:16px"><div style="display:flex;align-items:center;justify-content:space-between"><strong>PV90 — Bangalore Penthouse</strong><span style="color:var(--muted);font-size:13px">Switch ›</span></div></div>' +
      '<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Spend</div><div class="kpi-value">₹14.32L</div><div class="kpi-meta">of ₹85L</div></div><div class="kpi"><div class="kpi-label">Days</div><div class="kpi-value">62</div><div class="kpi-meta">of 240</div></div><div class="kpi"><div class="kpi-label">Float</div><div class="kpi-value" style="color:var(--amber)">2 days</div></div><div class="kpi"><div class="kpi-label">Issues</div><div class="kpi-value">3</div></div></div>' +
      '<div class="sec-label" style="margin-top:18px">This Week</div>' +
      '<div class="card"><div class="card-title">Slab pour — Block A</div><div class="card-meta">Tomorrow · 06:00 AM</div></div>' +
      '<div class="card"><div class="card-title">Plumbing rough-in — Floor 2</div><div class="card-meta">Wednesday · ongoing</div></div>';
  },
  reports_daily: function() {
    var b = auditBanner();
    if (isSite()) return b + '<button class="btn-primary" style="margin-bottom:14px;min-height:44px">+ Submit Today’s Report</button>' +
      '<div class="sec-label">My Recent Reports</div>' +
      '<div class="card"><div class="card-title">2 May — Pending PMC approval</div><div class="card-meta">Slab progress · 3 photos · 8 workers</div></div>' +
      '<div class="card"><div class="card-title">1 May — Approved by Praveen</div><div class="card-meta">Pour completed by 11AM</div></div>';
    if (isPMC() || isPrincipal()) return b +
      '<div class="sec-label">Pending Approval (3)</div>' +
      '<div class="action-item c-navy" style="margin-bottom:14px;min-height:44px"><div class="ai-icon">✅</div><div class="ai-body"><div class="ai-title">Approve all 3 reports</div><div class="ai-meta">Batch approve</div></div>' + approveBtn('Approve All') + '</div>' +
      ['2 May — Suleman','1 May — Suleman','30 Apr — Anjaneya'].map(function(d) {
        return '<div class="grn-item pending"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="grn-num">' + d + '</div><div class="grn-vendor">PV90 · 8 workers · 3 photos</div></div><span class="badge b-amber">Pending</span></div><div class="btn-row" style="margin-top:10px">' + approveBtn('Approve') + rejectBtn('Flag') + '</div></div>';
      }).join('') +
      '<div class="sec-label" style="margin-top:14px">Approved (last 7 days)</div>' +
      '<div class="card"><div class="card-title">29 Apr — Suleman</div><div class="card-meta">Approved by Praveen · 30 Apr 6:15 PM</div></div>';
    return b + '<div class="sec-label">Daily Reports — last 7 days</div>' +
      '<div class="card"><div class="card-title">2 May — PV90 — Suleman</div><div class="card-meta">Pending approval</div></div>' +
      '<div class="card"><div class="card-title">1 May — PV90 — Suleman</div><div class="card-meta">Approved · 1 May 7:30 PM</div></div>';
  },
  reports_weekly: function() {
    return auditBanner() +
      '<div class="sec-label">Weekly Reports</div>' +
      '<div class="card"><div class="card-title">Week 28 Apr — 4 May</div><div class="card-meta">PV90 · 5 reports · approved</div><div style="margin-top:8px"><button class="btn-sm" style="min-height:44px">View PDF</button></div></div>' +
      '<div class="card"><div class="card-title">Week 21 Apr — 27 Apr</div><div class="card-meta">PV90 · 5 reports · approved</div></div>';
  },
  grn: function() {
    var b = auditBanner();
    var canRaise   = ['site_manager','senior_site_manager','pmc_head'].includes(currentRole);
    var canApprove = ['senior_site_manager','pmc_head','principal','design_principal'].includes(currentRole);
    var html = b;
    if (canRaise) html += '<button class="btn-primary" style="margin-bottom:16px;min-height:44px">+ Raise GRN</button>';
    if (canApprove) html += '<div class="sec-label">Pending Approval (2)</div>' +
      '<div class="grn-item pending"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="grn-num">GRN-012</div><div class="grn-vendor">ABC Construction — Cement</div><div class="grn-detail">120 bags @ ₹420 = ₹50,400</div></div><div class="grn-amount">₹50,400</div></div><div class="btn-row" style="margin-top:10px">' + approveBtn('Approve') + rejectBtn('Reject') + '</div></div>' +
      '<div class="grn-item pending"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="grn-num">GRN-013</div><div class="grn-vendor">Kumar Electricals — Cable</div><div class="grn-detail">500m @ ₹38 = ₹19,000</div></div><div class="grn-amount">₹19,000</div></div><div class="btn-row" style="margin-top:10px">' + approveBtn('Approve') + rejectBtn('Reject') + '</div></div>';
    html += '<div class="sec-label" style="margin-top:14px">Recent GRNs</div>' +
      '<div class="grn-item approved"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="grn-num">GRN-011</div><div class="grn-vendor">ABC Construction — Sand</div><div class="grn-detail">5 cu.m · 28 Apr</div></div><div><div class="grn-amount">₹14,000</div><span class="badge b-green">Approved</span></div></div></div>';
    return html;
  },
  issues: function() {
    var b = auditBanner();
    var canRaise = ['site_manager','senior_site_manager','pmc_head','design_head','services_head'].includes(currentRole);
    return b + (canRaise ? '<button class="btn-primary" style="margin-bottom:14px;min-height:44px">+ Raise Issue</button>' : '') +
      '<div class="sec-label">Open (3)</div>' +
      '<div class="card"><div class="card-title" style="color:var(--red)">🔴 Drawing query overdue — A-501</div><div class="card-meta">Raised by Suleman 4 days ago</div></div>' +
      '<div class="card"><div class="card-title">Material delay — terrazzo tile</div><div class="card-meta">Lead time 3 weeks · scheduling impact under review</div></div>' +
      '<div class="card"><div class="card-title">RFI #12 — kitchen counter height</div><div class="card-meta">Pending client confirmation · 2 days old</div></div>' +
      '<div class="sec-label" style="margin-top:14px">Resolved (this week)</div>' +
      '<div class="card"><div class="card-title">Bathroom layout revision</div><div class="card-meta">Closed by Team Lead · 1 May</div></div>';
  },
  issues_site: function() { return SCREENS.issues(); },
  meetings: function() {
    return auditBanner() +
      '<div class="sec-label">Upcoming</div>' +
      '<div class="card"><div class="card-title">Client interim review</div><div class="card-meta">Thursday · 11:00 AM · Site office</div></div>' +
      '<div class="card"><div class="card-title">Vendor coordination — electrical</div><div class="card-meta">Friday · 3:00 PM · Kumar Electricals</div></div>' +
      '<div class="sec-label" style="margin-top:14px">Recent (2)</div>' +
      '<div class="card"><div class="card-title">28 Apr — Design review</div><div class="card-meta">MOM circulated · client acknowledged</div></div>';
  },
  labour: function() {
    return auditBanner() + '<div class="sec-label">Labour — May 2026</div>' +
      '<table class="data-table"><thead><tr><th>Date</th><th>Skilled</th><th>Unskilled</th><th>Total</th></tr></thead><tbody>' +
      '<tr><td>2 May</td><td>4</td><td>8</td><td>12</td></tr><tr><td>1 May</td><td>4</td><td>7</td><td>11</td></tr><tr><td>30 Apr</td><td>3</td><td>8</td><td>11</td></tr>' +
      '</tbody></table>' +
      '<div class="kpi-grid" style="margin-top:14px"><div class="kpi"><div class="kpi-label">Avg/day</div><div class="kpi-value">11.3</div></div><div class="kpi"><div class="kpi-label">Min (threshold)</div><div class="kpi-value" style="color:var(--amber)">8</div><div class="kpi-meta">at threshold</div></div></div>';
  },
  tasks: function() {
    if (isSite()) return '<div class="sec-label">Today\u2019s Tasks (PV90)</div>' +
      '<div class="card"><div class="card-title">Slab pour — Block A</div><div class="card-meta">Pour at 06:00 AM · update progress %</div><div style="margin-top:8px"><button class="btn-sm" style="min-height:44px">Update %</button></div></div>' +
      '<div class="card"><div class="card-title">Plumbing rough-in — Floor 2</div><div class="card-meta">60% complete</div><div style="margin-top:8px"><button class="btn-sm" style="min-height:44px">Update %</button></div></div>';
    return auditBanner() +
      '<div class="sec-label">My Tasks (4)</div>' +
      '<div class="card"><div class="card-title">Approve daily report — PV90 — 2 May</div><div class="card-meta">Pending · raised today</div></div>' +
      '<div class="card"><div class="card-title">Review BOQ revision — NW22</div><div class="card-meta">Pending · 1 day ago</div></div>' +
      '<div class="card"><div class="card-title">Sign change notice CN-007</div><div class="card-meta">Pending · 2 days ago</div></div>';
  },
  budget: function() {
    return auditBanner() + '<div class="sec-label">Budget — PV90</div>' +
      '<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Approved</div><div class="kpi-value">₹85L</div></div><div class="kpi"><div class="kpi-label">Spent</div><div class="kpi-value">₹14.32L</div></div><div class="kpi"><div class="kpi-label">Committed</div><div class="kpi-value">₹38.50L</div></div><div class="kpi"><div class="kpi-label">Available</div><div class="kpi-value" style="color:var(--green)">₹32.18L</div></div></div>' +
      '<div class="sec-label" style="margin-top:18px">By Trade</div>' +
      '<table class="data-table"><thead><tr><th>Trade</th><th>Approved</th><th>Spent</th><th>%</th></tr></thead><tbody>' +
      '<tr><td>Civil</td><td>₹35L</td><td>₹8.20L</td><td>23%</td></tr><tr><td>Electrical</td><td>₹12L</td><td>₹2.10L</td><td>17%</td></tr><tr><td>Plumbing</td><td>₹8L</td><td>₹1.40L</td><td>17%</td></tr><tr><td>Finishes</td><td>₹22L</td><td>₹2.62L</td><td>12%</td></tr>' +
      '</tbody></table>';
  },
  budget_tree: function() { return SCREENS.budget(); },
  payments: function() {
    var b = auditBanner();
    var canApprove = ['pmc_head','principal','design_principal'].includes(currentRole);
    if (canApprove) return b +
      '<div class="action-item c-navy" style="margin-bottom:16px;min-height:44px"><div class="ai-icon">✅</div><div class="ai-body"><div class="ai-title">Approve all — ₹6,10,700</div><div class="ai-meta">2 vendors waiting</div></div>' + approveBtn('Approve All') + '</div>' +
      '<div class="sec-label">Payment Queue</div>' +
      '<div class="pay-item"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="pay-vendor">ABC Construction</div><div class="pay-scope">cement + sand</div><div class="pay-meta">2 May · ' + (isPrincipal() ? 'PMC approved' : 'Pending PMC') + '</div></div><div class="pay-amount">₹4,23,500</div></div></div>' +
      '<div class="pay-item"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="pay-vendor">Kumar Electricals</div><div class="pay-scope">wiring + switches</div><div class="pay-meta">1 May · ' + (isPrincipal() ? 'PMC approved' : 'Pending PMC') + '</div></div><div class="pay-amount">₹1,87,200</div></div></div>';
    if (isDesign()) return b + '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Showing advance + final billings only</div>' +
      '<div class="pay-item"><div style="display:flex;justify-content:space-between"><div><div class="pay-vendor">XYZ Pvt Ltd</div><div class="pay-scope">advance payment</div></div><div class="pay-amount">₹2,15,000</div></div></div>';
    return b + '<div class="sec-label">Payment Queue (read-only)</div>' +
      '<div class="card"><div class="card-title">2 May — ABC Construction</div><div class="card-meta">₹4,23,500 · pending PMC approval</div></div>' +
      '<div class="card"><div class="card-title">1 May — Kumar Electricals</div><div class="card-meta">₹1,87,200 · pending PMC approval</div></div>';
  },
  payments_fin: function() {
    return '<div class="sec-label">Saturday Payment Workflow</div>' +
      '<div class="stat-row" style="grid-template-columns:1fr 1fr"><div class="stat-card"><span class="stat-val">2</span><span class="stat-lbl">Vendors</span></div><div class="stat-card"><span class="stat-val">₹6.1L</span><span class="stat-lbl">Total</span></div></div>' +
      '<div class="sec-label">Steps</div>' +
      '<div class="card" style="margin-bottom:8px"><div class="card-title">Step 1 — Run pre-upload check</div><div class="card-meta">Validates account numbers, checks duplicates</div><button class="btn-secondary" style="margin-top:10px;width:100%;min-height:44px">Run Validation Check</button></div>' +
      '<div class="card" style="margin-bottom:8px"><div class="card-title">Step 2 — Download ICICI Excel</div><div class="card-meta">19-column PAB bulk payment format</div><button class="btn-primary" style="margin-top:10px;min-height:44px">⬇ Download ICICI Excel</button></div>' +
      '<div class="card"><div class="card-title">Step 3 — Upload to ICICI portal</div><div class="card-meta">ICICI Corporate → Bulk Payments → Upload file. UTRs auto-pushed back.</div></div>' +
      '<div class="sec-label">Payments</div>' +
      '<div class="pay-item"><div style="display:flex;justify-content:space-between"><div><div class="pay-vendor">ABC Construction</div><div class="pay-meta">XXXX0000001 · FT</div></div><div class="pay-amount">₹4,23,500</div></div></div>' +
      '<div class="pay-item"><div style="display:flex;justify-content:space-between"><div><div class="pay-vendor">Kumar Electricals</div><div class="pay-meta">XXXX0000002 · NEFT</div></div><div class="pay-amount">₹1,87,200</div></div></div>';
  },
  vendors_master: function() {
    return auditBanner() + '<div class="sec-label">Vendors (28)</div>' +
      ['ABC Construction','Kumar Electricals','XYZ Pvt Ltd','Modular Kitchens India','Sterling Lighting'].map(function(n) {
        return '<button class="card" style="display:block;width:100%;text-align:left;min-height:44px"><div class="card-title">' + n + '</div><div class="card-meta">GSTIN verified · PAN verified · 2 active engagements</div></button>';
      }).join('');
  },
  vendors: function() {
    return auditBanner() +
      '<div class="sec-label">Engagements (3)</div>' +
      '<div class="card"><div class="card-title">ABC Construction — RA Bill #4</div><div class="card-meta">₹4,23,500 · raised 28 Apr · awaiting GRN</div></div>' +
      '<div class="card"><div class="card-title">Kumar Electricals — wiring batch</div><div class="card-meta">₹1,87,200 · GRN approved 1 May</div></div>';
  },
  finance_clearance: function() {
    return auditBanner() + '<div class="sec-label">Pending Clearance (2)</div>' +
      '<div class="grn-item pending"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="grn-num">XYZ Vendors</div><div class="grn-vendor">GSTIN: 29AAAAA0000A1Z0</div><div class="grn-detail">PAN pending verification</div></div></div><div class="btn-row" style="margin-top:10px">' + approveBtn('Validate PAN') + '</div></div>' +
      '<div class="grn-item pending"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="grn-num">Sterling Lighting</div><div class="grn-vendor">GSTIN: 27AAAAA0000B1Z0</div><div class="grn-detail">Bank details pending</div></div></div><div class="btn-row" style="margin-top:10px">' + approveBtn('Verify bank') + '</div></div>' +
      '<div class="sec-label" style="margin-top:14px">Cleared (this week)</div>' +
      '<div class="card"><div class="card-title">ABC Construction — all checks complete</div><div class="card-meta">Cleared 1 May</div></div>';
  },
  clients: function() {
    return auditBanner() + '<div class="sec-label">Clients (8)</div>' +
      ['Mr & Mrs Reddy — PV90','Mr Kumar — NW22','Mrs Iyer — SR15'].map(function(n) {
        return '<button class="card" style="display:block;width:100%;text-align:left;min-height:44px"><div class="card-title">' + n + '</div><div class="card-meta">Contract signed · payments on track</div></button>';
      }).join('');
  },
  client_boq: function() {
    return auditBanner() + '<div class="sec-label">PV90 — Client Contract</div>' +
      '<table class="data-table"><thead><tr><th>Item</th><th>Rate</th><th>Total</th></tr></thead><tbody>' +
      '<tr><td>Civil works (Block A)</td><td>lump sum</td><td>₹35,00,000</td></tr>' +
      '<tr><td>MEP package</td><td>lump sum</td><td>₹20,00,000</td></tr>' +
      '<tr><td>Finishes</td><td>lump sum</td><td>₹22,00,000</td></tr>' +
      '<tr><td>PMC fees</td><td>lump sum</td><td>₹8,00,000</td></tr>' +
      '<tr><td><strong>Total</strong></td><td></td><td><strong>₹85,00,000</strong></td></tr>' +
      '</tbody></table>';
  },
  boq_mapping: function() {
    return auditBanner() + '<div class="sec-label">Vendor Allocation — PV90</div>' +
      '<div class="card"><div class="card-title">Civil — Block A → ABC Construction</div><div class="card-meta">₹35L · contract signed 15 Mar · 23% billed</div></div>' +
      '<div class="card"><div class="card-title">Electrical → Kumar Electricals</div><div class="card-meta">₹12L · contract signed 1 Apr</div></div>' +
      '<div class="card"><div class="card-title">Plumbing → Sterling Plumbing</div><div class="card-meta">₹8L · awaiting contract signature</div></div>';
  },
  pi: function() {
    return auditBanner() + '<div class="sec-label">Invoices Out</div>' +
      '<div class="pay-item"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="pay-vendor">PI-2026-04 · PV90 client</div><div class="pay-scope">Milestone 1 — foundation complete</div><div class="pay-meta">28 Apr · Paid 30 Apr</div></div><div><div class="pay-amount">₹15,00,000</div><span class="badge b-green">Paid</span></div></div></div>' +
      '<div class="pay-item"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="pay-vendor">PI-2026-05 · NW22 client</div><div class="pay-scope">Advance — foundation</div><div class="pay-meta">1 May · Pending</div></div><div><div class="pay-amount">₹6,20,000</div><span class="badge b-amber">Pending</span></div></div></div>' +
      (isAudit() ? '' : '<button class="btn-primary" style="margin-top:14px;min-height:44px">+ Raise Invoice</button>');
  },
  petty_cash: function() {
    return auditBanner() + '<div class="sec-label">Petty Cash — May 2026</div>' +
      '<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Float</div><div class="kpi-value">₹50,000</div></div><div class="kpi"><div class="kpi-label">Balance</div><div class="kpi-value" style="color:var(--green)">₹31,600</div></div></div>' +
      '<div class="sec-label" style="margin-top:14px">Recent Vouchers</div>' +
      '<div class="card"><div class="card-title">Site stationery — ₹420</div><div class="card-meta">2 May · Suleman</div></div>' +
      '<div class="card"><div class="card-title">Tea for client visit — ₹860</div><div class="card-meta">28 Apr · Suleman</div></div>' +
      (isPrincipal() ? '<button class="btn-secondary" style="margin-top:10px;min-height:44px">Replenish</button>' : '');
  },
  client_receipts: function() {
    return auditBanner() + '<div class="sec-label">Client Receipts</div>' +
      '<div class="card"><div class="card-title">PV90 — ₹15,00,000</div><div class="card-meta">RTGS · UTR ICIC2026043011 · 30 Apr</div></div>' +
      '<div class="card"><div class="card-title">NW22 — ₹3,00,000</div><div class="card-meta">Cheque · 22 Apr · cleared</div></div>' +
      (isAudit() ? '' : '<button class="btn-primary" style="margin-top:14px;min-height:44px">+ Record Receipt</button>');
  },
  gst_statement: function() {
    return auditBanner() + '<div class="sec-label">GST — April 2026</div>' +
      '<table class="data-table"><thead><tr><th>Type</th><th>Taxable</th><th>CGST</th><th>SGST</th></tr></thead><tbody>' +
      '<tr><td>Outward</td><td>₹15,00,000</td><td>₹1,35,000</td><td>₹1,35,000</td></tr>' +
      '<tr><td>Inward</td><td>₹4,80,000</td><td>₹43,200</td><td>₹43,200</td></tr>' +
      '<tr><td><strong>Net</strong></td><td></td><td><strong>₹91,800</strong></td><td><strong>₹91,800</strong></td></tr>' +
      '</tbody></table>' +
      '<button class="btn-secondary" style="margin-top:14px;min-height:44px">Export for filing</button>';
  },
  tally: function() {
    return '<div class="sec-label">Tally Export</div>' +
      '<div class="card"><div class="card-title">April 2026</div><div class="card-meta">432 vouchers · downloaded 1 May</div></div>' +
      '<button class="btn-secondary" style="margin-top:14px;min-height:44px">Export Current Month</button>';
  },
  drawings: function() {
    var b = auditBanner();
    var canApprove = ['design_head','services_head','design_principal','principal'].includes(currentRole);
    return b +
      (canApprove ? '<div class="action-item c-amber" style="min-height:44px;margin-bottom:12px"><div class="ai-icon">📐</div><div class="ai-body"><div class="ai-title">A-501 Rev 4 — pending approval</div><div class="ai-meta">Submitted by Team Lead</div></div>' + approveBtn('Approve') + '</div>' : '') +
      '<div class="sec-label">Drawings — PV90</div>' +
      '<div class="card"><div class="card-title">A-101 — Floor Plan Block A</div><div class="card-meta">Rev 3 · issued 28 Apr</div><div style="margin-top:6px"><span class="badge b-green">Issued</span></div></div>' +
      '<div class="card"><div class="card-title">A-201 — Elevations</div><div class="card-meta">Rev 2 · query open from site</div><div style="margin-top:6px"><span class="badge b-amber">Query open</span></div></div>';
  },
  register: function() {
    return auditBanner() + '<div class="sec-label">Drawing Register — PV90</div>' +
      '<table class="data-table"><thead><tr><th>Sheet</th><th>Title</th><th>Rev</th><th>Status</th></tr></thead><tbody>' +
      '<tr><td>A-101</td><td>Floor Plan Block A</td><td>3</td><td><span class="badge b-green">Issued</span></td></tr>' +
      '<tr><td>A-201</td><td>Elevations</td><td>2</td><td><span class="badge b-amber">Query</span></td></tr>' +
      '<tr><td>S-301</td><td>RCC Slab Block A</td><td>1</td><td><span class="badge b-green">Issued</span></td></tr>' +
      '</tbody></table>';
  },
  submittals: function() {
    return auditBanner() + '<div class="sec-label">Submittals (4)</div>' +
      '<div class="card"><div class="card-title">Tile sample — bathroom</div><div class="card-meta">Submitted 1 May · awaiting client</div></div>' +
      '<div class="card"><div class="card-title">Switch plate finish</div><div class="card-meta">Approved 28 Apr</div><div style="margin-top:6px"><span class="badge b-green">Approved</span></div></div>' +
      (isAudit() ? '' : '<button class="btn-primary" style="margin-top:14px;min-height:44px">+ New Submittal</button>');
  },
  ncr: function() {
    return auditBanner() + '<div class="sec-label">NCRs (2)</div>' +
      '<div class="card"><div class="card-title">NCR-001 — Concrete cover insufficient</div><div class="card-meta">30 Apr · pending design response</div></div>' +
      '<div class="card"><div class="card-title">NCR-002 — Slab finish irregular</div><div class="card-meta">Closed 28 Apr · re-screeded</div><div style="margin-top:6px"><span class="badge b-green">Closed</span></div></div>';
  },
  changes: function() {
    var b = auditBanner();
    var canSign = isPrincipal() || isPMC() || ['design_head','services_head'].includes(currentRole);
    return b + '<div class="sec-label">Change Notices (3)</div>' +
      '<div class="card"><div class="card-title">CN-007 — Kitchen counter material</div><div class="card-meta">Cost +₹65,000 · client-initiated · pending Principal</div>' +
      (canSign ? '<div class="btn-row" style="margin-top:8px">' + approveBtn('Sign off') + '</div>' : '') + '</div>' +
      '<div class="card"><div class="card-title">CN-006 — Bathroom layout revision</div><div class="card-meta">Cost +₹0 · approved</div><div style="margin-top:6px"><span class="badge b-green">Approved</span></div></div>';
  },
  approvals: function() {
    return auditBanner() + '<div class="sec-label">My Approvals (5)</div>' +
      '<div class="card"><div class="card-title">Daily report PV90 — 2 May</div><div class="card-meta">Submitted by Suleman · 2 hours ago</div><div class="btn-row" style="margin-top:8px">' + approveBtn('Approve') + rejectBtn('Flag') + '</div></div>' +
      '<div class="card"><div class="card-title">GRN — Cement (120 bags)</div><div class="card-meta">ABC Construction · ₹50,400</div><div class="btn-row" style="margin-top:8px">' + approveBtn('Approve') + rejectBtn('Reject') + '</div></div>';
  },
  delegations: function() {
    return auditBanner() +
      '<div class="sec-label">Active Delegations</div>' +
      '<div class="card"><div class="card-title">PV90 → Praveen</div><div class="card-meta">5 May — 9 May · daily reports + GRNs</div></div>' +
      (isAudit() ? '' : '<button class="btn-primary" style="margin-top:14px;min-height:44px">+ New Delegation</button>');
  },
  signoff: function() {
    return auditBanner() + '<div class="sec-label">Weekly Sign-off (28 Apr)</div>' +
      '<div class="grn-item pending"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="grn-num">PV90 — Health: Green</div><div class="grn-vendor">Schedule on track · Budget 16% · 1 issue</div></div><span class="badge b-amber">Awaiting</span></div><div class="btn-row" style="margin-top:10px">' + approveBtn('Sign off') + '</div></div>' +
      '<div class="grn-item pending"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="grn-num">NW22 — Health: Amber</div><div class="grn-vendor">2 days behind · Budget 6%</div></div><span class="badge b-amber">Awaiting</span></div><div class="btn-row" style="margin-top:10px">' + approveBtn('Sign off') + '</div></div>';
  },
  phototags: function() {
    return auditBanner() + '<div class="sec-label">Photos to Tag (12)</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px">' +
      Array.from({length:9}).map(function() { return '<div style="background:#cdd3dc;height:90px;border-radius:6px"></div>'; }).join('') +
      '</div>' + (isAudit() ? '' : '<button class="btn-primary" style="min-height:44px">Open Tagging</button>');
  },
  photos: function() {
    return '<div class="sec-label">Photos — PV90</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' +
      Array.from({length:12}).map(function() { return '<div style="background:#cdd3dc;height:90px;border-radius:6px"></div>'; }).join('') +
      '</div>';
  },
  materials: function() {
    return auditBanner() +
      (isSite() || isPMC() ? '<button class="btn-primary" style="margin-bottom:12px;min-height:44px">+ Request Material</button>' : '') +
      '<table class="data-table"><thead><tr><th>Material</th><th>Qty</th><th>Status</th></tr></thead><tbody>' +
      '<tr><td>Cement (OPC 53)</td><td>120 bags</td><td><span class="badge b-green">Received</span></td></tr>' +
      '<tr><td>Sand</td><td>10 cu.m</td><td><span class="badge b-amber">Ordered</span></td></tr>' +
      '<tr><td>Terrazzo tile</td><td>800 sq.ft</td><td><span class="badge b-red">Delayed</span></td></tr>' +
      '</tbody></table>';
  },
  materials_site: function() { return SCREENS.materials(); },
  schedule_view: function() {
    return auditBanner() + '<div class="sec-label">Schedule — PV90</div>' +
      '<div class="card"><div class="card-title" style="color:var(--amber)">⚠ Zero float — Slab Block A</div><div class="card-meta">Starts Thursday · no buffer</div></div>' +
      '<div class="card"><div class="card-title">This week</div><div class="card-meta">Slab pour · plumbing rough-in · MEP first fix</div></div>' +
      '<div class="card"><div class="card-title">Next 2 weeks</div><div class="card-meta">Block A finishes · electrical conduit Block B</div></div>';
  },
  weekly_health: function() {
    return auditBanner() + '<div class="sec-label">Weekly Health — 28 Apr</div>' +
      '<div class="card"><div class="card-title">PV90 — 🟢 Green</div><div class="card-meta">Schedule on track · Budget 16% · 1 issue</div></div>' +
      '<div class="card"><div class="card-title">NW22 — 🟡 Amber</div><div class="card-meta">2 days behind · Budget 6%</div></div>' +
      '<div class="card"><div class="card-title">SR15 — 🟢 Green</div><div class="card-meta">On track · Budget 22%</div></div>';
  },
  compliance: function() {
    return auditBanner() + '<div class="sec-label">Schedule Compliance</div>' +
      '<div class="kpi-grid"><div class="kpi"><div class="kpi-label">On-time delivery</div><div class="kpi-value">87%</div></div><div class="kpi"><div class="kpi-label">Daily reports</div><div class="kpi-value">94%</div><div class="kpi-meta">last 30 days</div></div></div>';
  },
  users: function() {
    return auditBanner() + '<div class="sec-label">Users (38)</div>' +
      ['principal — Principal','finance_admin — Finance Admin','design_principal — Design Principal','pmc_head — PMC Head','team_lead — Team Lead'].map(function(u) {
        return '<div class="card"><div class="card-title">' + u + '</div><div class="card-meta">Active · last login 2 May</div></div>';
      }).join('') +
      (isPrincipal() || isITAdmin() ? '<button class="btn-primary" style="margin-top:14px;min-height:44px">+ Add User</button>' : '');
  },
  notifications: function() {
    return '<div class="sec-label">Recent Alerts</div>' +
      '<div class="card"><div class="card-title">🔴 Drawing query overdue — A-501</div><div class="card-meta">PV90 · 2 hours ago</div></div>' +
      '<div class="card"><div class="card-title">⚠ Daily report not submitted — NW22</div><div class="card-meta">This morning</div></div>' +
      '<div class="card"><div class="card-title">💰 Payment approval pending</div><div class="card-meta">ABC Construction · ₹4,23,500</div></div>';
  },
  pending: function() {
    return auditBanner() + '<div class="sec-label">Pending Sign-offs (4)</div>' +
      '<div class="card"><div class="card-title">Daily report — PV90 — 2 May</div><div class="card-meta">From Suleman · awaiting approval</div><div class="btn-row" style="margin-top:8px">' + approveBtn('Approve') + '</div></div>' +
      '<div class="card"><div class="card-title">Change notice CN-007</div><div class="card-meta">Sequence: now at Principal</div><div class="btn-row" style="margin-top:8px">' + approveBtn('Sign off') + '</div></div>' +
      '<div class="card"><div class="card-title">Payment batch — ₹4,23,500</div><div class="card-meta">PMC approved · awaiting Principal</div><div class="btn-row" style="margin-top:8px">' + approveBtn('Approve') + '</div></div>' +
      '<div class="card"><div class="card-title">Vendor bank change — XYZ Pvt Ltd</div><div class="card-meta">Awaiting your confirmation</div><div class="btn-row" style="margin-top:8px">' + approveBtn('Confirm') + '</div></div>';
  },
  governance: function() {
    return auditBanner() + '<div class="sec-label">Governance Sheets</div>' +
      '<div class="card"><div class="card-title">role_permissions.xlsx</div><div class="card-meta">156 rows · 1 May · checksum match</div></div>' +
      '<div class="card"><div class="card-title">role_nav.xlsx</div><div class="card-meta">184 rows · 1 May · checksum match</div></div>' +
      (isPrincipal() ? '<button class="btn-primary" style="margin-top:14px;min-height:44px">Upload sheet</button>' : '');
  },
  account_setup: function() {
    var canEdit = isPrincipal();
    return auditBanner() + '<div class="sec-label">Account Setup — Company Entities</div>' +
      '<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="margin-bottom:4px"><span class="badge b-steel">LLP</span> <span class="badge b-green">Active</span></div><div class="card-title">YOUR COMPANY LLP</div><div class="card-meta">GSTIN: 29AAAAA0000A1Z0</div><div class="card-meta">💰 ···· XXXX · XXXX0000001</div></div>' +
      (canEdit ? '<div style="display:flex;flex-direction:column;gap:6px"><button class="btn-sm" style="min-height:44px">Edit</button></div>' : '') + '</div></div>' +
      (canEdit ? '<button class="btn-primary" style="margin-top:10px;min-height:44px">+ Add Company</button>' : '');
  },
  errors_log: function() {
    return '<div class="sec-label">Error Log (last 7 days)</div>' +
      '<div class="card"><div class="card-title">429 — Rate limit exceeded</div><div class="card-meta">/api/payments/utr-webhook · 28 Apr 09:32</div></div>' +
      '<div class="card"><div class="card-title">503 — DB connection refused</div><div class="card-meta">Restarted automatically · 1 May 03:10</div></div>';
  },
  nav_editor: function() {
    return '<div class="sec-label">Nav Editor</div>' +
      '<table class="data-table"><thead><tr><th>Role</th><th>Bucket</th><th>Item</th><th>Sort</th></tr></thead><tbody>' +
      '<tr><td>principal</td><td>home</td><td>dashboard</td><td>1</td></tr>' +
      '<tr><td>principal</td><td>home</td><td>monthly</td><td>2</td></tr>' +
      '<tr><td>principal</td><td>more</td><td>account_setup</td><td>16</td></tr>' +
      '</tbody></table>';
  },
  library: function() {
    return '<div class="sec-label">Knowledge Library</div>' +
      '<div class="card"><div class="card-title">Daily reports — best practices</div><div class="card-meta">Article · 4 min read</div></div>' +
      '<div class="card"><div class="card-title">How to handle change notices</div><div class="card-meta">Article · 6 min read</div></div>';
  },
};
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>nu PMC — Navigation Audit Prototype</title>
<style>
${css}

/* ── prototype-only overrides ── */
#role-picker {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 100vh;
  padding: 40px 20px; background: var(--bg);
}
.rp-card {
  background: var(--white); border-radius: 12px; padding: 32px;
  box-shadow: var(--shadow2); max-width: 420px; width: 100%;
}
.rp-card h1 { font-size: 24px; color: var(--navy); margin-bottom: 8px; }
.rp-card p  { color: var(--muted); font-size: 14px; line-height: 1.5; margin-bottom: 16px; }
.rp-card select {
  width: 100%; padding: 12px; font-size: 16px;
  border: 1px solid var(--border); border-radius: 8px;
  margin-bottom: 14px; font-family: var(--sans);
  background: var(--white); color: var(--navy);
}
.rp-card .rp-enter {
  width: 100%; padding: 14px; font-size: 16px;
  background: var(--navy); color: white; border: none;
  border-radius: 8px; cursor: pointer; font-weight: 600;
  min-height: 44px;
}
.proto-bar {
  background: rgba(176,125,26,0.12); border-bottom: 1px solid rgba(176,125,26,0.25);
  padding: 6px 14px; font-size: 11px; color: var(--text2);
  display: flex; align-items: center; gap: 8px; z-index: 300;
  position: sticky; top: 52px;
}
.proto-role-tag {
  background: var(--navy); color: white; padding: 2px 8px;
  border-radius: 10px; font-size: 10px; font-weight: 600;
}
.proto-switch {
  margin-left: auto; padding: 4px 10px; font-size: 11px;
  background: var(--white); border: 1px solid var(--border);
  border-radius: 5px; cursor: pointer; font-family: var(--sans);
  min-height: 28px;
}
/* Extra helpers for prototype screens */
.kpi-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
.kpi { background: var(--white); padding: 14px; border-radius: 8px; box-shadow: var(--shadow); }
.kpi-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
.kpi-value { font-size: 22px; font-weight: 600; color: var(--navy); margin-top: 4px; }
.kpi-meta  { font-size: 11px; color: var(--muted); margin-top: 2px; }
.stat-row  { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 14px; }
.stat-card { background: var(--white); padding: 14px; border-radius: 8px; text-align: center;
  box-shadow: var(--shadow); border: none; cursor: pointer; font-family: var(--sans); }
.stat-val  { font-size: 22px; font-weight: 600; color: var(--navy); display: block; }
.stat-lbl  { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
.data-table { width: 100%; background: var(--white); border-radius: 8px; border-collapse: collapse;
  box-shadow: var(--shadow); font-size: 13px; margin-bottom: 8px; }
.data-table th { background: #F2F4F7; padding: 10px 12px; text-align: left; font-weight: 600; color: var(--text2); }
.data-table td { padding: 10px 12px; border-top: 1px solid var(--border); color: var(--text); }
.btn-primary   { display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; background: var(--navy); color: white; border: none;
  border-radius: 6px; cursor: pointer; font-size: 14px; font-family: var(--sans); }
.btn-secondary { display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 14px; background: var(--white); color: var(--navy);
  border: 1px solid var(--border); border-radius: 6px; cursor: pointer;
  font-size: 13px; font-family: var(--sans); }
</style>
</head>
<body>

<!-- ── Role picker ── -->
<div id="role-picker">
  <div class="rp-card">
    <h1>nu PMC — Navigation Audit</h1>
    <p>Mirrors the real app: bottom bucket-bar, horizontal tab strip (≤5 items) or accordion (>5 items), real SVG icons, role-branched dashboards, approval gating.</p>
    <p style="font-size:11px;padding:8px 10px;background:rgba(176,125,26,0.08);border-left:3px solid var(--amber);border-radius:4px;color:var(--text2)"><strong>Prototype:</strong> placeholder data — role nav, icons, and screen structure mirror live code.</p>
    <select id="role-select">
      ${allRoles.map(r => `<option value="${r}">${ROLE_LABELS[r] || r}</option>`).join('\n      ')}
    </select>
    <button class="rp-enter" onclick="enterApp()">Enter prototype</button>
  </div>
</div>

<!-- ── App shell ── -->
<div id="app-shell" style="display:none">

  <!-- Topbar — mirrors .topbar / .tb-left / .tb-brand / .tb-ctx from app.js:8487 -->
  <div class="topbar">
    <div class="tb-left">
      <div class="tb-brand">nu <span>PMC</span></div>
      <div class="tb-sep"></div>
      <div class="tb-ctx">
        <div class="tb-who" id="tb-who"></div>
        <div class="tb-proj">PV90 — Bangalore Penthouse</div>
      </div>
    </div>
  </div>

  <!-- Prototype banner + switch button -->
  <div class="proto-bar">
    Prototype · placeholder data
    <span class="proto-role-tag" id="proto-role-tag"></span>
    <button class="proto-switch" onclick="switchRole()">Switch role</button>
  </div>

  <!-- Tab strip — .tabs / .tab — mirrors _renderBucketTabs -->
  <div class="tabs" id="tabs-bar"></div>

  <!-- Content area -->
  <div class="content" id="content"></div>

  <!-- Bottom nav — .bottom-nav / .bb-item — mirrors bottom-nav from app.js:381 -->
  <nav class="bottom-nav" id="bottom-nav"></nav>

</div>

<script>
const NAV          = ${NAV_JSON};
const TAB_LABELS   = ${TAB_LABELS_JSON};
const TAB_ICONS    = ${TAB_ICONS_JSON};
const BUCKET_ICONS = ${BUCKET_ICONS_JSON};
const ROLE_LABELS  = ${ROLE_LABELS_JSON};

const BUCKET_ORDER  = ['home','work','money','pending','more'];
const BUCKET_LABELS = { home:'Home', work:'Work', money:'Money', pending:'Pending', more:'More' };
const ACCORDION_THRESHOLD = 5;

let currentRole   = null;
let activeBucket  = null;
let activeTab     = null;

${SCREENS_JS}

// ── enterApp ────────────────────────────────────────────────────────────────
function enterApp() {
  currentRole = document.getElementById('role-select').value;
  document.getElementById('role-picker').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  document.getElementById('tb-who').textContent =
    (ROLE_LABELS[currentRole] || currentRole) + ' · PV90';
  document.getElementById('proto-role-tag').textContent = ROLE_LABELS[currentRole] || currentRole;

  const buckets = NAV[currentRole];
  activeBucket = BUCKET_ORDER.find(b => buckets[b]) || Object.keys(buckets)[0];
  renderBottomNav();
  switchBucket(activeBucket);
}

function switchRole() {
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('role-picker').style.display = 'flex';
}

// ── Bottom nav — mirrors _renderNavFromDB:381 ────────────────────────────────
function renderBottomNav() {
  const buckets = NAV[currentRole];
  const visible = BUCKET_ORDER.filter(b => buckets[b]);
  document.getElementById('bottom-nav').innerHTML = visible.map(b =>
    '<button class="bb-item' + (b === activeBucket ? ' active' : '') + (b === 'pending' ? ' pending' : '') +
    '" data-bucket="' + b + '" style="min-height:52px">' +
    '<div class="bb-icon">' + (BUCKET_ICONS[b] || '') + '</div>' +
    '<div class="bb-label">' + (BUCKET_LABELS[b] || b) + '</div>' +
    '</button>'
  ).join('');
  document.getElementById('bottom-nav').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-bucket]');
    if (btn) switchBucket(btn.dataset.bucket);
  }, { once: false });
}

// ── switchBucket — mirrors switchBucket in app.js ───────────────────────────
function switchBucket(bucket) {
  activeBucket = bucket;
  // Update bottom nav active state
  document.querySelectorAll('.bb-item').forEach(el => {
    el.classList.toggle('active', el.dataset.bucket === bucket);
  });
  const items = NAV[currentRole][bucket] || [];
  if (items.length > ACCORDION_THRESHOLD) {
    renderAccordion(bucket, items);
  } else {
    renderTabStrip(bucket, items);
    // Navigate to first tab
    if (items.length > 0) switchTab(items[0].item);
  }
}

// ── Tab strip — mirrors _renderBucketTabs:419 ────────────────────────────────
function renderTabStrip(bucket, items) {
  const tabsEl = document.getElementById('tabs-bar');
  tabsEl.innerHTML = items.map(it =>
    '<button class="tab' + (it.item === activeTab ? ' active' : '') +
    '" data-tab="' + it.item + '" style="min-height:44px">' +
    (TAB_LABELS[it.item] || it.item) + '</button>'
  ).join('');
  tabsEl.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-tab]');
    if (btn) switchTab(btn.dataset.tab);
  }, { once: false });
}

// ── switchTab ────────────────────────────────────────────────────────────────
function switchTab(item) {
  activeTab = item;
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === item);
  });
  renderScreen(item);
}

// ── Accordion — mirrors _renderBucketAccordion:437 ───────────────────────────
// Shows bucket header + collapsible rows with SVG icon + label + caret.
// Tapping a row navigates to that screen (mirrors "View all" in real app).
function renderAccordion(bucket, items) {
  const bucketLabel = BUCKET_LABELS[bucket] || bucket;
  document.getElementById('tabs-bar').innerHTML =
    '<button class="breadcrumb-bar" data-bucket="' + bucket + '" style="min-height:44px">' +
    '<span class="bc-bucket">' + bucketLabel + '</span></button>';
  document.getElementById('tabs-bar').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-bucket]');
    if (btn) switchBucket(btn.dataset.bucket);
  }, { once: false });

  document.getElementById('content').innerHTML =
    '<div class="bucket-header">' +
    '<div class="bh-ctx">PV90 — Bangalore Penthouse</div>' +
    '<div class="bh-name">' + bucketLabel + '</div>' +
    '<div class="bh-section-count">' + items.length + ' sections — tap to open</div>' +
    '</div>' +
    '<div id="acc-list">' +
    items.map(function(it) {
      var icon  = TAB_ICONS[it.item] || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      var label = TAB_LABELS[it.item] || it.item;
      return '<div class="acc-item" id="acc-' + it.item + '">' +
        '<button class="acc-hdr" style="min-height:44px" data-acc="' + it.item + '">' +
        '<div class="acc-icon">' + icon + '</div>' +
        '<div class="acc-body"><div class="acc-title">' + label + '</div><div class="acc-meta">Tap to view</div></div>' +
        '<div class="acc-badge grey">—</div>' +
        '<div class="acc-caret"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></div>' +
        '</button>' +
        '<div class="acc-content" id="acc-content-' + it.item + '"></div>' +
        '</div>';
    }).join('') +
    '</div>';

  document.getElementById('acc-list').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-acc]');
    if (btn) accTap(btn.dataset.acc);
  });
}

function accTap(item) {
  var el = document.getElementById('acc-' + item);
  var content = document.getElementById('acc-content-' + item);
  if (!el || !content) return;
  var isOpen = el.classList.contains('open');
  // Close all
  document.querySelectorAll('.acc-item.open').forEach(function(a) { a.classList.remove('open'); });
  if (!isOpen) {
    el.classList.add('open');
    var fn = SCREENS[item];
    content.innerHTML = fn
      ? '<div style="padding:12px 14px">' + fn() + '</div>'
      : '<div style="padding:20px;color:var(--muted);text-align:center">Screen not yet stubbed</div>';
  }
}

// ── renderScreen ─────────────────────────────────────────────────────────────
function renderScreen(item) {
  var fn  = SCREENS[item];
  var label = TAB_LABELS[item] || item;
  var el  = document.getElementById('content');
  if (fn) {
    el.innerHTML = '<div style="padding-bottom:20px">' +
      '<div class="sec-label" style="padding:0 0 4px;border-bottom:1px solid var(--border);margin-bottom:14px">' + label + '</div>' +
      fn() + '</div>';
  } else {
    el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted)">' +
      '<div style="font-size:32px;margin-bottom:8px">⚠</div>' +
      '<div style="font-weight:600">' + label + '</div>' +
      '<div style="font-size:12px;margin-top:6px">Screen not yet stubbed in prototype</div></div>';
  }
  window.scrollTo(0, 0);
}
</script>

</body>
</html>`;

fs.writeFileSync(OUT_PATH, html);
console.log(`✓ Wrote ${OUT_PATH}`);
console.log(`  ${(html.length / 1024).toFixed(1)} KB`);
console.log(`  ${allRoles.length} roles  ${rows.length} nav rows  bucket-bar + tab-strip + accordion`);
