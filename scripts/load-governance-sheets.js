#!/usr/bin/env node
// scripts/load-governance-sheets.js
//
// Loads the 8 governance Excel sheets from ./governance_sheets/ into the DB.
// Called by scripts/seed-full.sh after all schema migrations have run.
//
// This is the SINGLE SOURCE OF TRUTH load path. The middleware
// (middleware/permissions.js) reads from the DB tables this script populates.
// There is no hardcoded fallback — if this script hasn't been run, all
// requirePermission() checks return 403 and the app effectively refuses to serve.
//
// Idempotent: uses INSERT ... ON DUPLICATE KEY UPDATE. Safe to re-run.
//
// Sheets loaded:
//   Sheet 1 → role_permissions        (15 roles × 105 actions)
//   Sheet 2 → workflow_transitions    (9 objects, happy + exception paths)
//   Sheet 3 → notification_triggers   (52 events × recipient roles)
// Sheets 4-8 are reference only and not yet wired into live behaviour.

'use strict';

const path = require('path');
const fs   = require('fs');
// Load .env before requiring middleware/db — db.js reads process.env at module
// load time, so the env must be populated first. Required for standalone runs
// (node scripts/load-governance-sheets.js) and for setup.sh; the app's entry
// point loads dotenv on its own, and dotenv won't override already-set vars.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx'));
const db   = require(path.join(__dirname, '..', 'middleware', 'db'));

const SHEETS_DIR = path.join(__dirname, '..', 'governance_sheets');

// ── Sheet 1: Permissions ──────────────────────────────────────────────────
const ROLE_SHEET_MAP = {
  'Principal':'principal','Design Principal':'design_principal',
  'PMC Head':'pmc_head','Design Head':'design_head',
  'Services Head':'services_head','Team Lead':'team_lead',
  'Jr Architect':'jr_architect','Detailing':'detailing',
  'Site Manager':'site_manager','Sr Site Manager':'senior_site_manager',
  'Finance Admin':'finance_admin','Coordinator':'coordinator',
  'Trainee':'trainee','Audit':'audit','IT Admin':'it_admin',
};

async function loadPermissions(conn) {
  const file = path.join(SHEETS_DIR, '01_Role_Permission_Matrix.xlsx');
  if (!fs.existsSync(file)) return { added: 0, errors: ['Sheet 1 not found at ' + file] };
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  let added = 0, errors = [];

  for (const [sheetName, roleKey] of Object.entries(ROLE_SHEET_MAP)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let currentGroup = '';

    for (let i = 4; i < rows.length; i++) {
      const [cg, ca, cv] = rows[i];
      if (!ca) continue;
      if (cg && !cv) { currentGroup = String(cg).trim(); continue; }

      const group  = String(cg || currentGroup).trim();
      const action = String(ca).trim();
      const access = String(cv || '').trim();
      if (!action || action === 'Action / Responsibility') continue;

      // Raw-key detection: if the label already looks like an action key
      // ("vendors.create"), use it verbatim. Otherwise derive from group+label.
      const isRawKey = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/.test(action);
      const actionKey = isRawKey ? action
        : `${group.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.${action.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
      // Access level must be exactly W, R, A, or empty (no permission). Anything
      // else — typos like 'WR', 'X', 'Yes' — is a sheet-author mistake we surface
      // rather than silently coerce to ''. Same defensive pattern as Sheet 9 quorum
      // validation: refuse-then-report beats silent-accept.
      let level;
      if (access === '' || access === '—' || access === '-' || access === '–' || access === 'W' || access === 'R' || access === 'A') {
        level = (access === '—' || access === '-' || access === '–') ? '' : access;
      } else {
        errors.push(`${sheetName} row ${i+1}: invalid access level '${access}' (must be W, R, A, or empty)`);
        continue;
      }

      try {
        await conn.query(
          `INSERT INTO role_permissions (role, action, level, group_name, label)
           VALUES (?,?,?,?,?)
           ON DUPLICATE KEY UPDATE level=VALUES(level), group_name=VALUES(group_name), label=VALUES(label)`,
          [roleKey, actionKey, level, group, action]
        );
        added++;
      } catch (e) { errors.push(`${sheetName} row ${i+1}: ${e.message}`); }
    }
  }
  return { added, errors };
}

// ── Sheet 2: Workflows ───────────────────────────────────────────────────
async function loadWorkflows(conn) {
  const file = path.join(SHEETS_DIR, '02_Workflow_Status_Transitions.xlsx');
  if (!fs.existsSync(file)) return { added: 0, errors: ['Sheet 2 not found'] };
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  const OBJECT_MAP = {
    'Claims':'claims','Measurements':'measurements','Snags':'snags',
    'Weekly Reports':'weekly_reports','Payment Requests':'payment_requests',
    'Issues':'issues','Change Notices':'change_notices','Drawings':'drawings',
    'Submittals':'submittals',
  };
  const toSnake = s => String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  let added = 0, errors = [];

  for (const [sheetName, objectType] of Object.entries(OBJECT_MAP)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const stepRows = [], exRows = [];
    let inEx = false;

    for (let i = 8; i < rows.length; i++) {
      const row = rows[i];
      const stepMark = String(row[0] || '').trim();
      const fromState = String(row[2] || '').trim();
      const who = String(row[3] || '').trim();
      const what = String(row[4] || '').trim();
      const colF = String(row[5] || '').trim();

      if (stepMark.toLowerCase().includes('exception')) { inEx = true; continue; }
      if (!fromState || fromState === 'Technical state' ||
          fromState === 'Technical name (for reference)') continue;
      if (!who) continue;

      if (!inEx) stepRows.push({ i, fromState, who, what, colF });
      else {
        const toState = toSnake(colF);
        if (toState) exRows.push({ i, fromState, toState, who, what });
      }
    }

    // Happy path: to_state = next row's col C; terminal step: derive from col F
    for (let si = 0; si < stepRows.length; si++) {
      const { i, fromState, who, what, colF } = stepRows[si];
      const toState = si + 1 < stepRows.length ? stepRows[si + 1].fromState : toSnake(colF);
      if (!toState) continue;
      try {
        await conn.query(
          `INSERT INTO workflow_transitions (object_type, from_state, to_state, roles_who, label, is_exception, sort_order)
           VALUES (?,?,?,?,?,0,?)
           ON DUPLICATE KEY UPDATE roles_who=VALUES(roles_who), label=VALUES(label)`,
          [objectType, fromState, toState, who, what || who, si + 1]
        );
        added++;
      } catch (e) { errors.push(`${sheetName} step ${si+1}: ${e.message}`); }
    }
    for (const { i, fromState, toState, who, what } of exRows) {
      try {
        await conn.query(
          `INSERT INTO workflow_transitions (object_type, from_state, to_state, roles_who, label, is_exception, sort_order)
           VALUES (?,?,?,?,?,1,?)
           ON DUPLICATE KEY UPDATE roles_who=VALUES(roles_who), label=VALUES(label), is_exception=1`,
          [objectType, fromState, toState, who, what || who, i]
        );
        added++;
      } catch (e) { errors.push(`${sheetName} exception: ${e.message}`); }
    }
  }
  return { added, errors };
}

// ── Sheet 3: Notifications ───────────────────────────────────────────────
async function loadNotifications(conn) {
  const file = path.join(SHEETS_DIR, '03_Notification_Trigger_Map.xlsx');
  if (!fs.existsSync(file)) return { added: 0, errors: ['Sheet 3 not found'] };
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  const ws = wb.Sheets['Notification Triggers'];
  if (!ws) return { added: 0, errors: ['Tab "Notification Triggers" missing in Sheet 3'] };
  const ROLE_COLS = ['principal','design_principal','pmc_head','design_head','services_head',
                     'team_lead','site_manager','senior_site_manager','finance_admin','coordinator','trainee'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let added = 0, errors = [], curMod = '';

  // Channels supported by the messaging layer. Anything outside this set
  // would silently insert and then fail at runtime when notifyUser tries to
  // route. Same defensive pattern as Sheet 9.
  const ALLOWED_CHANNELS = new Set(['whatsapp', 'matrix', 'email', 'sms', 'in_app']);

  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    const mod = String(row[0] || '').trim();
    const event = String(row[1] || '').trim();
    const ch = String(row[13] || 'whatsapp').trim().toLowerCase() || 'whatsapp';
    const src = String(row[15] || '').trim();
    if (mod && !event) { curMod = mod; continue; }
    if (!event || event === 'Event') continue;
    if (!ALLOWED_CHANNELS.has(ch)) {
      errors.push(`row ${i+1}: invalid channel '${ch}' (allowed: ${[...ALLOWED_CHANNELS].join(', ')})`);
      continue;
    }

    const m = mod || curMod;
    const ek = `${m.toLowerCase().replace(/[^a-z0-9]+/g,'.')}.${event.toLowerCase().replace(/[^a-z0-9]+/g,'.')}`;
    for (let ci = 0; ci < ROLE_COLS.length; ci++) {
      const v = String(row[ci + 2] || '').trim();
      if (v !== '✓' && v !== 'Y' && v !== 'yes') continue;
      try {
        await conn.query(
          `INSERT INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE event_label=VALUES(event_label), source_ref=VALUES(source_ref)`,
          [m, ek, event, ROLE_COLS[ci], ch, src || null]
        );
        added++;
      } catch (e) { errors.push(`row ${i+1} ${ROLE_COLS[ci]}: ${e.message}`); }
    }
  }
  return { added, errors };
}

// ── Sheet 9: Approval Type Config ────────────────────────────────────────
// Per build-commit lock #7: declares per-type signer roles, quorum, scope,
// vendor-confirm requirement, and expiry. Adding a new approval workflow
// = uploading a row here. Zero code changes per workflow.
//
// Tab name expected: 'Approval Types'
// Columns (case-insensitive header match):
//   - approval_type           e.g. 'cn_approval'
//   - label                   human-readable e.g. 'Change Notice approval'
//   - description             optional free text
//   - signer_roles            comma-separated list e.g. 'principal,design_principal'
//   - quorum                  integer 1..N
//   - scope                   'project' | 'global'
//   - requires_vendor_confirm 0 | 1 | yes | no | ✓
//   - expires_after_hours     integer or blank for "no expiry"
//   - active                  0 | 1 | yes | no | ✓ (default 1)
//
// If the Sheet 9 file doesn't exist, this loader is a no-op — the v5.24
// migration already seeded 8 default rows. Production teams who haven't
// uploaded a sheet yet still get a working approvals system.
async function loadApprovalTypes(conn) {
  const file = path.join(SHEETS_DIR, '09_Approval_Type_Config.xlsx');
  if (!fs.existsSync(file)) {
    return {
      added: 0,
      errors: [],
      skipped_reason: 'Sheet 9 file not found — using v5.24 migration seed values',
    };
  }
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  const ws = wb.Sheets['Approval Types'];
  if (!ws) return { added: 0, errors: ['Tab "Approval Types" missing in Sheet 9'] };

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  let added = 0, errors = [];

  const truthy = (v) => {
    if (v === 1 || v === '1') return 1;
    if (v === 0 || v === '0') return 0;
    const s = String(v || '').trim().toLowerCase();
    if (['yes','y','true','✓','x'].includes(s)) return 1;
    return 0;
  };
  const norm = (s) => String(s || '').trim().toLowerCase();
  // header lookup is case-insensitive: build a row picker that finds keys
  // regardless of exact spelling (e.g. "Approval Type" vs "approval_type").
  function pick(row, ...candidates) {
    const keys = Object.keys(row);
    for (const c of candidates) {
      const wanted = norm(c).replace(/[^a-z0-9]/g, '');
      const k = keys.find(k => norm(k).replace(/[^a-z0-9]/g, '') === wanted);
      if (k && row[k] !== '') return row[k];
    }
    return '';
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const at = String(pick(row, 'approval_type', 'Approval Type') || '').trim();
    if (!at) continue;
    if (at.toLowerCase() === 'approval_type') continue; // header echoed

    try {
      const label  = String(pick(row, 'label', 'Label') || '').trim() || at;
      const descr  = String(pick(row, 'description', 'Description') || '').trim() || null;
      const signersRaw = String(pick(row, 'signer_roles', 'signers', 'Signer Roles') || '')
        .split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      // Dedupe — the role-membership check on the consumer side uses .includes,
      // so duplicates don't affect correctness, but they're noise in the data.
      const signers = [...new Set(signersRaw)];
      if (!signers.length) {
        errors.push(`row ${i+2}: ${at} — no signer_roles given`);
        continue;
      }
      const quorumRaw = pick(row, 'quorum', 'Quorum');
      // Reject decimals: parseInt('4.5',10) silently truncates to 4. Force
      // exact-integer parsing by checking for a leading-decimal pattern.
      if (quorumRaw !== '' && quorumRaw != null && /\./.test(String(quorumRaw))) {
        errors.push(`row ${i+2}: ${at} — quorum must be an integer (got '${quorumRaw}')`);
        continue;
      }
      const quorum = quorumRaw === '' || quorumRaw == null
        ? 1
        : parseInt(quorumRaw, 10);
      if (!Number.isFinite(quorum) || quorum < 1) {
        errors.push(`row ${i+2}: ${at} — invalid quorum`);
        continue;
      }
      // Reject unreachable quorum (more signers required than the signer pool
      // contains). Without this, the approval can never reach quorum and
      // sits pending until expiry. Likely a typo in the upload sheet.
      if (quorum > signers.length) {
        errors.push(`row ${i+2}: ${at} — quorum (${quorum}) exceeds signer count (${signers.length})`);
        continue;
      }
      const scopeRaw = norm(pick(row, 'scope', 'Scope')) || 'project';
      if (!['project','global'].includes(scopeRaw)) {
        errors.push(`row ${i+2}: ${at} — scope must be 'project' or 'global'`);
        continue;
      }
      const requiresVendor = truthy(pick(row, 'requires_vendor_confirm', 'Requires Vendor Confirm'));
      const expHrsRaw = pick(row, 'expires_after_hours', 'Expires After Hours');
      const expiresAfterHours = expHrsRaw === '' || expHrsRaw == null
        ? null
        : (parseInt(expHrsRaw, 10) || null);
      const activeRaw = pick(row, 'active', 'Active');
      const active = activeRaw === '' ? 1 : truthy(activeRaw);

      await conn.query(
        `INSERT INTO approval_type_config
           (approval_type, signer_roles_json, quorum, scope, requires_vendor_confirm,
            expires_after_hours, label, description, sheet_source, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sheet9_xlsx', ?)
         ON DUPLICATE KEY UPDATE
           signer_roles_json       = VALUES(signer_roles_json),
           quorum                  = VALUES(quorum),
           scope                   = VALUES(scope),
           requires_vendor_confirm = VALUES(requires_vendor_confirm),
           expires_after_hours     = VALUES(expires_after_hours),
           label                   = VALUES(label),
           description             = VALUES(description),
           sheet_source            = VALUES(sheet_source),
           active                  = VALUES(active)`,
        [at, JSON.stringify(signers), quorum, scopeRaw, requiresVendor,
         expiresAfterHours, label, descr, active]
      );
      added++;
    } catch (e) {
      errors.push(`row ${i+2}: ${at} — ${e.message}`);
    }
  }

  return { added, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('Loading governance sheets from', SHEETS_DIR);

  if (!fs.existsSync(SHEETS_DIR)) {
    console.error('✗ governance_sheets/ directory not found');
    process.exit(2);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const p = await loadPermissions(conn);
    const w = await loadWorkflows(conn);
    const n = await loadNotifications(conn);
    const a = await loadApprovalTypes(conn);

    const totalErrors = [...p.errors, ...w.errors, ...n.errors, ...a.errors];
    if (totalErrors.length) {
      totalErrors.slice(0, 10).forEach(e => console.log('  ERR:', e));
      await conn.rollback();
      console.error('✗ Rolled back — fix sheet errors and retry');
      process.exit(3);
    }

    await conn.commit();
    console.log(`✓ role_permissions:     ${p.added} rows`);
    console.log(`✓ workflow_transitions: ${w.added} rows`);
    console.log(`✓ notification_triggers:${n.added} rows`);
    if (a.skipped_reason) {
      console.log(`⊘ approval_type_config: skipped — ${a.skipped_reason}`);
    } else {
      console.log(`✓ approval_type_config: ${a.added} rows`);
    }
  } catch (e) {
    await conn.rollback();
    console.error('FATAL:', e.message);
    process.exit(1);
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}

// Run main only when invoked as a script. When required as a module
// (e.g. by tests), expose the individual loaders.
if (require.main === module) {
  main();
}

module.exports = {
  loadPermissions,
  loadWorkflows,
  loadNotifications,
  loadApprovalTypes,
};
