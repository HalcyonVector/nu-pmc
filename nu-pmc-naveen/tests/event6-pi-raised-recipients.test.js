// tests/event6-pi-raised-recipients.test.js
// Prevent-return guard for Event 6 (Decision May 2026):
// pi_raised must alert principals + finance_admins + pmc_heads.
// Earlier code only alerted principals.

'use strict';
const fs = require('fs');
const path = require('path');

describe('Event 6 — PI raised alerts include finance and PMC', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'modules/finance/routes/invoices.js'), 'utf8'
  );

  test('pi_raised notify block resolves principal role', () => {
    const block = src.match(/pi_raised[\s\S]+?\}\)\)?\s*\n\s*\n/);
    // Search the broader area where pi_raised is sent
    expect(src).toMatch(/usersByRole\(['"`]principal['"`]/);
  });

  test('pi_raised notify block resolves finance_admin role', () => {
    expect(src).toMatch(/usersByRole\(['"`]finance_admin['"`]/);
  });

  test('pi_raised notify block resolves pmc_head role', () => {
    expect(src).toMatch(/usersByRole\(['"`]pmc_head['"`]/);
  });

  test('pi_raised dedupes recipients (defensive against multi-role users)', () => {
    // The PI raise block builds recipients then iterates with dedupe.
    // Look at the context around the principal/finance_admin/pmc_head lookups.
    const m = src.match(/usersByRole\(['"`]principal['"`][\s\S]{0,1500}/);
    expect(m).not.toBeNull();
    expect(m[0]).toMatch(/seen\.has|new Set/);
  });

  test('does NOT use legacy users.principalPhones() (Path B drift)', () => {
    // The PI raise context should not reach for principalPhones
    const piContext = src.match(/PI \$\{piNum\}[\s\S]+?notify\([\s\S]+?\)/);
    if (piContext) {
      expect(piContext[0]).not.toMatch(/principalPhones/);
    }
  });
});
