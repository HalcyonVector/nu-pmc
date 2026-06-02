// tests/dispatch-substrate-lint.test.js
// Lint guard for D2 — outbound dispatch must use the right substrate.
//
// Path A (notifications.js): role-based, event-driven, governance-editable.
// Path B (whatsapp-interactive.js): button-based, recipient by phone.
// Path C (whatsapp.send direct): only for external recipients (vendors/clients)
//        or for callers paired with wa-reply-actions.js correlation rows.
//
// This test scans modules/ for wa.send / whatsapp.send / wa2.send calls
// and fails if a NEW one appears in a file not on the known-acceptable
// list, OR if a known file's count drifts above the pinned value.
//
// Pin format: { file, count, justification }. No line numbers — they
// shifted on every refactor (we lived through this enough times to
// switch). Counts are stable against code reshuffles; new acceptable
// site = bump the count + extend the justification.

'use strict';
const fs = require('fs');
const path = require('path');

const KNOWN_OK = [
  // admin-reset.js — migrated to Matrix DM in this session
  // payments.js — migrated to Matrix in this session
  // issues.js — photo RFI migrated to Matrix DM in this session
];

function findRouteFiles(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) out.push(...findRouteFiles(path.join(dir, f.name)));
    else if (f.name.endsWith('.js') && !f.name.endsWith('.test.js')) out.push(path.join(dir, f.name));
  }
  return out;
}

describe('D2 — outbound dispatch substrate discipline', () => {
  // wa.send( or wa2.send( or whatsapp.send( — but not wa-reply-actions itself
  const SEND_RE = /(?:^|[^a-zA-Z])(wa|wa2|whatsapp)\.send\(/;

  const expectedCount = new Map();
  for (const pin of KNOWN_OK) expectedCount.set(pin.file, pin.count);

  function actualCountInFile(absPath) {
    const src = fs.readFileSync(absPath, 'utf8');
    const lines = src.split('\n');
    let n = 0;
    for (const line of lines) if (SEND_RE.test(line)) n++;
    return n;
  }

  test('every KNOWN_OK pin is in sync with its file', () => {
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
        issues.push(`${pin.file} — pinned count ${pin.count}, actual ${actual} (new direct-send added; bump pin if legit, or migrate to notifications/notifyXxx)`);
      }
    }
    if (issues.length) {
      throw new Error(
        `KNOWN_OK pins out of sync with code:\n\n` +
        issues.map(i => `  ${i}`).join('\n')
      );
    }
  });

  test('no direct wa.send / wa2.send calls in modules/ outside known-OK files', () => {
    const root = path.join(__dirname, '..');
    const files = findRouteFiles(path.join(root, 'modules'));
    const offenders = [];
    for (const f of files) {
      const rel = path.relative(root, f);
      if (expectedCount.has(rel)) continue;        // covered by sync test
      const src = fs.readFileSync(f, 'utf8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (SEND_RE.test(lines[i])) {
          offenders.push(`${rel}:${i + 1}  →  ${lines[i].trim()}`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} direct wa.send/wa2.send call(s) in files not on the known-OK list:\n\n` +
        offenders.map(o => `  ${o}`).join('\n') + '\n\n' +
        `Use services/notifications.notify(userId, eventKey, msg) for role-based sends ` +
        `(governance-sheet editable), or services/whatsapp-interactive for button messages, ` +
        `or — if the recipient is genuinely external (vendor/client) with no event_key fit — ` +
        `add { file, count, justification } to KNOWN_OK in this test.`
      );
    }
  });

  test('notifications.js header documents the three-substrate split', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'services/notifications.js'), 'utf8');
    expect(src).toMatch(/Path A.*notify\(\)/);
    expect(src).toMatch(/Path B.*whatsapp-interactive/);
    expect(src).toMatch(/Path C.*whatsapp.*send/);
  });
});
