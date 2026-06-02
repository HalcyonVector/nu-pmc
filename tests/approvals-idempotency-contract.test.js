// tests/approvals-idempotency-contract.test.js
// Prevent-return guard for B17 — open() and register() must use the same
// idempotency contract. Both return { id, alreadyExisted, ... }. Neither
// throws on duplicate. This is the "silent + flag" pattern; an old version
// of open() threw ApprovalError code APPROVAL_ALREADY_PENDING with HTTP 409.

'use strict';
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('B17 — open() and register() share an idempotency contract', () => {
  const src = read('services/approvals.js');

  // Strip /* … */ and // line comments for the throw-check so a
  // documentation-style "throws ..." in JSDoc doesn't trigger a false alarm.
  const stripComments = s =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  test('open() does NOT throw APPROVAL_ALREADY_PENDING on duplicate', () => {
    const openFn = src.match(/async function open\(opts\)\s*\{[\s\S]+?\n\}/)[0];
    const stripped = stripComments(openFn);
    expect(stripped).not.toMatch(/APPROVAL_ALREADY_PENDING/);
    // …and there's no `throw new ApprovalError(...)` for the duplicate branch
    expect(stripped).not.toMatch(/throw new ApprovalError\([^)]*pending/i);
  });

  test('open() returns { id, alreadyExisted, … } on both new and duplicate paths', () => {
    const openFn = src.match(/async function open\(opts\)\s*\{[\s\S]+?\n\}/)[0];
    expect(openFn).toMatch(/alreadyExisted:\s*true/);
    expect(openFn).toMatch(/alreadyExisted:\s*false/);
  });

  test('register() returns { id, alreadyExisted } not a bare integer', () => {
    const regFn = src.match(/async function register\(\{[\s\S]+?\n\}/)[0];
    expect(regFn).toMatch(/alreadyExisted:\s*true/);
    expect(regFn).toMatch(/alreadyExisted:\s*false/);
    // Must not return a bare `existing.id` or `r.insertId`
    const stripped = stripComments(regFn);
    expect(stripped).not.toMatch(/return\s+existing\.id\s*;/);
    expect(stripped).not.toMatch(/return\s+r\.insertId\s*;/);
  });
});
