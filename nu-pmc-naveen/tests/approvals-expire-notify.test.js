// tests/approvals-expire-notify.test.js
// Prevent-return guard for B16 — when expireOverdue() flips an approval
// to 'expired', the proposer must be notified. Earlier the function was a
// single bulk UPDATE with NO notification — proposers were silent-stranded.

'use strict';
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('B16 — expireOverdue notifies the proposer', () => {
  test('notifyApprovalExpired exists in services/notifications.js', () => {
    const src = read('services/notifications.js');
    expect(src).toMatch(/async function notifyApprovalExpired\(/);
    // Exported
    expect(src).toMatch(/notifyApprovalExpired,/);
  });

  test('expireOverdue references notifyApprovalExpired', () => {
    const src = read('services/approvals.js');
    // Must be a real call site, not a stale comment. Strip line-comments first.
    const expireFn = src.match(/async function expireOverdue\(\)\s*\{[\s\S]+?\n\}/)[0];
    const stripped = expireFn.replace(/^\s*\/\/.*$/gm, '');
    expect(stripped).toMatch(/notifyApprovalExpired/);
  });

  test('expireOverdue per-row UPDATE is race-safe (status=pending guard)', () => {
    const src = read('services/approvals.js');
    // The per-row UPDATE clause must include AND status = 'pending'
    const expireFn = src.match(/async function expireOverdue\(\)\s*\{[\s\S]+?\n\}/)[0];
    expect(expireFn).toMatch(/WHERE id = \? AND status = 'pending'/);
  });

  test('notify failures do not break expiry (best-effort wrapper)', () => {
    const src = read('services/approvals.js');
    const expireFn = src.match(/async function expireOverdue\(\)\s*\{[\s\S]+?\n\}/)[0];
    // Strip line comments before checking — a commented-out notify call must
    // still register as missing, not as present.
    const stripped = expireFn.replace(/^\s*\/\/.*$/gm, '');
    // The notify call must be a live `await ...notifyApprovalExpired(`
    expect(stripped).toMatch(/await\s+\w+\.notifyApprovalExpired\(/);
    // ...and must be inside a try { ... } catch block
    const m = stripped.match(/try\s*\{[^}]*notifyApprovalExpired[\s\S]*?\}\s*catch/);
    expect(m).not.toBeNull();
  });
});
