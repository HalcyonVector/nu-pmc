// tests/d11-notification-triggers-naming.test.js
// Prevent-return guard for D11 (Decision May 2026):
// notification_triggers event_key strings MUST match what route code passes
// to notify(userId, eventKey, msg). Earlier the table seeded dotted names
// (e.g. 'schedule.version-uploaded') while code used underscored names
// (e.g. 'schedule_change'). Result: zero matches, fallback always fired,
// the whole governance-driven routing was dead weight.
//
// Migration v5.26 renamed the table to match code. This test guards the
// invariant going forward: every event_key code uses with notify() must
// have a corresponding row in notification_triggers seeds (either
// v4.6 originally or v5.26 INSERT IGNORE).

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readAll(dir, exts = ['.js']) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === 'node_modules' || f.name === 'tests') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) out.push(...readAll(p, exts));
    else if (exts.some(e => f.name.endsWith(e))) out.push(p);
  }
  return out;
}

describe('D11 — notification_triggers event_keys match code', () => {
  test('every notify(_, eventKey, _) in modules/ has a trigger row OR is allowlisted', () => {
    const files = [
      ...readAll(path.join(ROOT, 'modules')),
      ...readAll(path.join(ROOT, 'services')),
    ];

    const codeKeys = new Set();
    const NOTIFY_RE = /\bnotify\(\s*[^,)]+,\s*['"]([a-z][a-z_]+)['"]/g;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      let m;
      while ((m = NOTIFY_RE.exec(src)) !== null) {
        codeKeys.add(m[1]);
      }
    }

    // Read the v4.6 + v5.26 migrations to find seeded event_key values.
    // Stricter than "any quoted lowercase string" — only match strings that
    // appear in actual SQL data positions (UPDATE SET event_key = '…' or
    // INSERT VALUES tuples whose 2nd column is event_key).
    const seedFiles = [
      'migrations/v4.6-governance-tables.sql',
      'migrations/v5.26-notification-triggers-rename.sql',
    ];
    const seededKeys = new Set();
    for (const sf of seedFiles) {
      const src = fs.readFileSync(path.join(ROOT, sf), 'utf8');
      // Strip line comments to avoid matching example keys in comments
      const stripped = src.replace(/^\s*--.*$/gm, '');
      // (1) UPDATE notification_triggers SET event_key = 'X' — captures the new name only
      for (const m of stripped.matchAll(/SET\s+event_key\s*=\s*'([a-z][a-z_]+)'/gi)) {
        seededKeys.add(m[1]);
      }
      // (2) INSERT INTO notification_triggers ... VALUES tuples: 2nd column is event_key
      for (const m of stripped.matchAll(/\(\s*'[^']+'\s*,\s*'([a-z][a-z_]+)'\s*,/g)) {
        seededKeys.add(m[1]);
      }
    }

    // Allowlist: code uses these event_keys but they're either intentionally
    // not in triggers (single-recipient direct sends) or pending future seed.
    const ALLOWLIST = new Set([
      'utr_consolidated',         // batch confirmation, project-scoped, can stay direct
      'engagement_pending_approval', // currently hardcoded principal-only — not in tonight's queue
      'engagement_approved',      // notifies raiser only — single user, no role list
      'engagement_rejected',      // notifies raiser only — single user, no role list
      'pmc_digest',               // internal cron-driven digest, not event-keyed
      'mom_client_revision',      // not yet seeded
      'missing_report',           // not yet seeded
      'task_rejected',            // not yet seeded
      'ncr_disputed',             // not yet seeded
      'approval_expired',         // approvals expiry — not yet seeded
      'weekly_report_ready',      // weekly_report covers this; alias
    ]);

    const missing = [];
    for (const k of codeKeys) {
      if (seededKeys.has(k)) continue;
      if (ALLOWLIST.has(k)) continue;
      missing.push(k);
    }
    if (missing.length) {
      throw new Error(
        `${missing.length} event_key(s) used in code but NOT in notification_triggers seeds:\n\n` +
        missing.map(m => `  ${m}`).join('\n') + '\n\n' +
        `Either add to a migration's INSERT INTO notification_triggers, or add to the ALLOWLIST in this test ` +
        `with a one-line justification.`
      );
    }
  });

  test('no NEW dotted event_keys appear (seeds use underscored convention)', () => {
    const v526 = fs.readFileSync(
      path.join(ROOT, 'migrations/v5.26-notification-triggers-rename.sql'),
      'utf8'
    );
    // Look at INSERT INTO notification_triggers lines and check no
    // dotted event_keys are being seeded fresh.
    const insertBlock = v526.match(/INSERT IGNORE INTO notification_triggers[\s\S]+?;/g) || [];
    const offenders = [];
    for (const ins of insertBlock) {
      // Match "'event.key'," shape — dotted
      const dotted = [...ins.matchAll(/,\s*'([a-z][a-z_-]+\.[a-z_-]+)'\s*,/g)];
      offenders.push(...dotted.map(m => m[1]));
    }
    expect(offenders).toEqual([]);
  });

  test('migration v5.26 exists and is syntactically a SQL file', () => {
    const p = path.join(ROOT, 'migrations/v5.26-notification-triggers-rename.sql');
    expect(fs.existsSync(p)).toBe(true);
    const src = fs.readFileSync(p, 'utf8');
    expect(src).toMatch(/UPDATE notification_triggers SET event_key/);
    expect(src).toMatch(/INSERT IGNORE INTO notification_triggers/);
    // No reference to the dead AiSensy provider that previous migrations
    // still mentioned (paranoia check).
    expect(src.toLowerCase()).not.toMatch(/aisensy/);
  });
});
