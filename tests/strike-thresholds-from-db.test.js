// tests/strike-thresholds-from-db.test.js
// Prevent-return guard for D12 / Decision 4 (May 2026):
//
// - Strike thresholds for vendor-payment-without-BOQ exceptions must be
//   read from per-project DB columns, not hardcoded as `=== 0` / `=== 1`.
// - Strike 1 alerts the project's PMC heads (not all principals).
// - Strike 2 alerts PMC heads + finance_admins (was: silent block).
// - Strike 3 stays as hard block requiring principal sign-off elsewhere.
//
// A regression that hardcodes the thresholds back, or sends to the wrong
// recipient role, would fail this guard.

'use strict';
const fs = require('fs');
const path = require('path');

describe('D12 — strike thresholds and recipients', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'modules/finance/routes/payments.js'), 'utf8'
  );

  test('reads strike_warn_until and strike_block_until from projects', () => {
    expect(src).toMatch(/SELECT\s+strike_warn_until,\s*strike_block_until\s+FROM\s+projects/);
  });

  test('uses DB-driven comparison, not hardcoded === 0 / === 1', () => {
    // Find the strike block; assert no `strikes === 0` or `strikes === 1`
    const block = src.match(/if\s*\(!hasBoq\)\s*\{[\s\S]+?\n\s{4}\}/);
    expect(block).not.toBeNull();
    expect(block[0]).not.toMatch(/strikes\s*===\s*0\b/);
    expect(block[0]).not.toMatch(/strikes\s*===\s*1\b/);
    // Should use the DB variables
    expect(block[0]).toMatch(/strikes\s*<=\s*warnUntil/);
    expect(block[0]).toMatch(/strikes\s*<=\s*blockUntil/);
  });

  test('Strike 1 alerts project PMC heads (not principals)', () => {
    // The strike-1 branch should call getPmcHeadsForProject, not principals()
    // Match the warnUntil branch
    const branch = src.match(/strikes\s*<=\s*warnUntil[\s\S]+?(?=\}\s*else if)/);
    expect(branch).not.toBeNull();
    expect(branch[0]).toMatch(/getPmcHeadsForProject/);
    expect(branch[0]).not.toMatch(/users\.principals/);
    expect(branch[0]).not.toMatch(/users\.principalPhones/);
  });

  test('Strike 2 alerts both PMC heads and finance_admins', () => {
    // The strike-2 branch (between warnUntil and blockUntil)
    const branch = src.match(/else if \(strikes <= blockUntil\)[\s\S]+?(?=\}\s*else)/);
    expect(branch).not.toBeNull();
    expect(branch[0]).toMatch(/getPmcHeadsForProject/);
    expect(branch[0]).toMatch(/financeAdmins/);
  });

  test('Strike 2 still returns 400 with requires_confirmation', () => {
    const branch = src.match(/else if \(strikes <= blockUntil\)[\s\S]+?(?=\}\s*else)/);
    expect(branch[0]).toMatch(/requires_confirmation:\s*true/);
    expect(branch[0]).toMatch(/strike:\s*2/);
  });

  test('Strike 3 still hard-blocks without alerting (override flow handles principals)', () => {
    // The else branch
    const elseBranch = src.match(/\}\s*else\s*\{[\s\S]+?HARD BLOCK[\s\S]+?\}/);
    expect(elseBranch).not.toBeNull();
    expect(elseBranch[0]).toMatch(/hard_block:\s*true/);
  });
});
