// tests/recipient-lookup-lint.test.js
// Lint guard for D3 — recipient resolution must go through notification_triggers
// (governance-sheet editable) when the purpose is notification dispatch.
//
// Path B (services/users-lookup.js helpers — principals/pmcHeads/etc) is the
// WRONG substrate for notification recipient resolution. It hardcodes recipient
// roles in code, bypassing the governance-sheet-driven routing in
// notification_triggers. The CORRECT shape for notifications is:
//
//   await notifications.notifyXxx(...)   // calls _notifyByEvent internally
//
// not:
//
//   const principals = await users.principals();
//   for (const p of principals) await notify(p.id, ...);
//
// This test scans modules/ for that drift pattern and fails on any NEW
// occurrence outside the known-acceptable list.
//
// Pin format: { file, snippet, justification }. The snippet must be a
// short, unique substring at or very close to the helper call. Lint
// confirms exactly ONE match per pin. Code reshuffles don't break the
// allowlist as long as the snippet is still present at one site.

'use strict';
const fs = require('fs');
const path = require('path');

// Each entry pins a FILE with the COUNT of acceptable users.X helper
// calls for non-notification purposes (UI lookups, governance lists,
// admin tools). Lint counts actual calls; if the count exceeds the
// allowed total, every excess line is reported as an offender. Adding
// a new acceptable site means bumping the count + writing the
// justification — no line numbers, no snippet matching.
//
// Why count-based: line numbers shift on every refactor (we lived
// through this five times). Snippet matching breaks when two sites
// in the same file are textually identical (e.g. two
// `await users.principals()` calls in schedule.js). Counts are stable
// against both reshuffles and identical-call cases.
//
// The trade-off: a count-based pin can't distinguish "moved a
// legitimate call to a new site" from "added a new offender alongside
// the legitimate one" — both look like count-stays-equal. But the
// review-time surfacing happens when count CHANGES, which catches
// both adds and removes. That's what we actually want.
const KNOWN_OK = [
  { file: 'modules/auth/routes/user-management.js',           count: 1, justification: 'admin user-management — principal phone list for user-event notifications' },
  { file: 'modules/design-services/routes/schedule.js',       count: 2, justification: 'schedule editor — design / services head dropdowns' },
  { file: 'modules/finance/routes/budget.js',                 count: 1, justification: 'budget approval — principal selector' },
  { file: 'modules/finance/routes/claims.js',                 count: 2, justification: 'claims dashboard — finance + PMC dropdowns' },
  { file: 'modules/finance/routes/payment-requests.js',       count: 3, justification: 'PR detail screens — principal + finance lookups (2 sites for finance, 1 for principal)' },
  { file: 'modules/finance/routes/payments.js',               count: 1, justification: 'strike-2 alert finance_admins (Decision 4 — hardcoded by design, May 2026)' },
  { file: 'modules/finance/routes/urgent-payments.js',        count: 1, justification: 'urgent payment review — finance admins for Udupa-style alerts' },
  { file: 'modules/onboarding/routes/clients.js',             count: 1, justification: 'client onboarding — finance admin recipients' },
  { file: 'modules/onboarding/routes/project-setup.js',       count: 1, justification: 'project setup — principal selector' },
  { file: 'modules/reporting/routes/reports.js',              count: 2, justification: 'reports dashboard — principal lookups (2 sites)' },
  { file: 'modules/reporting/routes/weekly-health.js',        count: 2, justification: 'weekly health digest — principal recipient list (PDF cycle + /schedule endpoint, both DB-driven)' },
  { file: 'modules/site/routes/grn.js',                       count: 1, justification: 'NCR notification — secondary alert path, not the primary GRN approval (which is now signoff-gate)' },
  // changes.js CN principal-approval — pin removed after WA call was removed in prior session
];

function findRouteFiles(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) out.push(...findRouteFiles(path.join(dir, f.name)));
    else if (f.name.endsWith('.js') && !f.name.endsWith('.test.js')) out.push(path.join(dir, f.name));
  }
  return out;
}

describe('D3 — recipient resolution substrate discipline', () => {
  const HELPERS_RE = /\busers\.(principals|pmcHeads|financeAdmins|streamHeads|principalPhones)\(/;

  // file → expected acceptable count
  const expectedCount = new Map();
  for (const pin of KNOWN_OK) expectedCount.set(pin.file, pin.count);

  function actualCountInFile(absPath) {
    const src = fs.readFileSync(absPath, 'utf8');
    const lines = src.split('\n');
    let n = 0;
    for (const line of lines) if (HELPERS_RE.test(line)) n++;
    return n;
  }

  test('every KNOWN_OK pin is in sync with its file', () => {
    // For each pinned file, the actual count must equal the pinned count.
    // Count > pinned → potential new offender (caught by the second test).
    // Count < pinned → call removed; pin should be removed/decremented.
    const root = path.join(__dirname, '..');
    const issues = [];
    for (const pin of KNOWN_OK) {
      const fullPath = path.join(root, pin.file);
      if (!fs.existsSync(fullPath)) {
        issues.push(`${pin.file} — file does not exist`);
        continue;
      }
      const actual = actualCountInFile(fullPath);
      if (actual < pin.count) {
        issues.push(`${pin.file} — pinned count ${pin.count}, actual ${actual} (call removed; reduce or remove pin)`);
      } else if (actual > pin.count) {
        issues.push(`${pin.file} — pinned count ${pin.count}, actual ${actual} (new call added; bump pin if legit, or migrate to notifications.notifyXxx())`);
      }
    }
    if (issues.length) {
      throw new Error(
        `KNOWN_OK pins out of sync with code:\n\n` +
        issues.map(i => `  ${i}`).join('\n')
      );
    }
  });

  test('no users.<role-helper>() calls in modules/ outside known-OK files', () => {
    // For files NOT in the allowlist: any helper call is an offender.
    // For files IN the allowlist: count drift is caught by the test
    // above, so this test only flags the un-pinned files.
    const root = path.join(__dirname, '..');
    const files = findRouteFiles(path.join(root, 'modules'));
    const offenders = [];
    for (const f of files) {
      const rel = path.relative(root, f).replace(/\\/g, '/');
      if (expectedCount.has(rel)) continue;        // covered by sync test
      const src = fs.readFileSync(f, 'utf8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (HELPERS_RE.test(lines[i])) {
          offenders.push(`${rel}:${i + 1}  →  ${lines[i].trim()}`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} users.<role-helper>() call(s) in files not on the known-OK list:\n\n` +
        offenders.map(o => `  ${o}`).join('\n') + '\n\n' +
        `For NOTIFICATION recipient resolution, use services/notifications.notifyXxx() ` +
        `(governance-sheet editable via notification_triggers). For UI lookups (assignment ` +
        `dropdowns, approver lists, etc.), the helpers ARE correct — add { file, count, ` +
        `justification } to KNOWN_OK in this test.`
      );
    }
  });

  test('users-lookup.js header documents the dual-substrate situation', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'services/users-lookup.js'), 'utf8');
    expect(src).toMatch(/Path A.*notification_triggers/);
    expect(src).toMatch(/Path B.*helpers/);
    expect(src).toMatch(/COMMON DRIFT/);
  });
});
