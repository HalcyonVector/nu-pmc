// tests/event10-budget-custom-head-approved.test.js
// Prevent-return guard for Event 10 (Decision May 2026):
// budget_custom_head APPROVED notification goes to finance_admin (who books
// against the new head), NOT to principals (who just approved it and don't
// need to be told they approved).
//
// The REQUEST event (budget.js:211) still goes to principals — that's a
// separate event for principal approval. This test only covers the
// post-approval notification.

'use strict';
const fs = require('fs');
const path = require('path');

describe('Event 10 — budget_custom_head approved → finance_admin', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'modules/finance/routes/budget.js'), 'utf8'
  );

  // Find the approve route (PATCH or POST that ends with custom_head_approve)
  const approveBlock = src.match(/budget\.custom_head_approve[\s\S]+?\}\)\);/);

  test('approve route exists and notifies', () => {
    expect(approveBlock).not.toBeNull();
  });

  test('approve route resolves finance_admin role for notification', () => {
    expect(approveBlock[0]).toMatch(/usersByRole\(['"`]finance_admin['"`]/);
  });

  test('approve route does NOT call users.principals() for the post-approval notification', () => {
    // The approve block (post-audit-log) sends to finance, not principals
    // Look for anywhere in the approve block that calls users.principals()
    expect(approveBlock[0]).not.toMatch(/users\.principals\(\)/);
  });

  test('notifies with budget_custom_head event key', () => {
    expect(approveBlock[0]).toMatch(/notify\([^,]+,\s*['"`]budget_custom_head['"`]/);
  });
});
