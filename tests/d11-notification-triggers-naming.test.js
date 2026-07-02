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

// May 2026 deploy bundle: individual migration files were collapsed into
// nu-pmc-install-<date>.sql at repo root. The v4.6 + v5.26 sections still
// exist verbatim inside it, demarcated by `-- ── v<X.Y>-...` headers.
function _resolveInstallSql() {
  const matches = fs.readdirSync(ROOT).filter(f => /^nu-pmc-install-\d+\.sql$/.test(f));
  if (matches.length === 0) {
    throw new Error('no nu-pmc-install-<date>.sql at repo root');
  }
  matches.sort();
  return path.join(ROOT, matches[matches.length - 1]);
}

// Slice the section starting at `-- ── <tag>-` up to the next `-- ── v` header.
// Returns '' if the tag isn't found, which lets callers detect missing sections.
function _sliceMigrationSection(sql, tag) {
  const startRe = new RegExp(`^-- ── ${tag.replace(/\./g, '\\.')}-`, 'm');
  const startMatch = sql.match(startRe);
  if (!startMatch) return '';
  const start = startMatch.index;
  const tail = sql.slice(start);
  // Next header — skip our own header line, then find the next one.
  const nextHeaderRe = /\n-- ── v\d+\.\d+-/;
  const nextMatch = tail.slice(1).match(nextHeaderRe);
  return nextMatch ? tail.slice(0, 1 + nextMatch.index) : tail;
}

function _readMigrationSection(tag) {
  const installSql = fs.readFileSync(_resolveInstallSql(), 'utf8');
  const slice = _sliceMigrationSection(installSql, tag);
  if (!slice) {
    throw new Error(`section ${tag} not found in install SQL`);
  }
  return slice;
}

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

    // Read the v5.26 section from the collapsed install SQL. The v4.6 base
    // data (dotted keys) is in mysqldump format without a section header, but
    // all dotted keys are renamed to underscored by v5.26 UPDATE statements,
    // so the v5.26 section alone captures the full seeded set.
    const seededKeys = new Set();
    for (const tag of ['v5.26']) {
      const src = _readMigrationSection(tag);
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
      'task_flag',                // direct send to a single assignee — no role list
      'measurement',              // direct send to a single recipient — no role list
      'countersign_needed',       // MOM action-item: direct DM to the named countersigner
      'countersign_disagreed',    // MOM action-item: direct DM to the assignee on reissue
      'claim_raised',             // claim draft created — FYI to PMC heads, no governance row yet
      'claim_invoiced',           // claim invoiced — FYI to finance admins, no governance row yet
      'grn_raised',               // GRN recorded — materials-planning FYI to PMC heads (v6.02: FYI only)
      'grn_approved',             // GRN approved — direct confirmation to the raiser
      'report_auto_locked',       // daily report auto-locked by cron — FYI to site mgr + PMC
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
    const v526 = _readMigrationSection('v5.26');
    const insertBlock = v526.match(/INSERT IGNORE INTO notification_triggers[\s\S]+?;/g) || [];
    const offenders = [];
    for (const ins of insertBlock) {
      const dotted = [...ins.matchAll(/,\s*'([a-z][a-z_-]+\.[a-z_-]+)'\s*,/g)];
      offenders.push(...dotted.map(m => m[1]));
    }
    expect(offenders).toEqual([]);
  });

  test('migration v5.26 exists in install SQL and is syntactically correct', () => {
    // After May 2026 collapse, "exists" means: present as a delimited section
    // inside the install SQL — not as a standalone file.
    const src = _readMigrationSection('v5.26');
    expect(src).toMatch(/UPDATE notification_triggers SET event_key/);
    expect(src).toMatch(/INSERT IGNORE INTO notification_triggers/);
    expect(src.toLowerCase()).not.toMatch(/aisensy/);
  });
});
