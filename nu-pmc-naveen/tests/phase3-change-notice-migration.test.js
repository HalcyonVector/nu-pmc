// tests/phase3-change-notice-migration.test.js
// Prevent-return: change notice relay approval migrated to signoff-gate.
'use strict';
const fs   = require('fs');
const path = require('path');
const src  = fs.readFileSync(
  path.join(__dirname, '..', 'modules/workflow/routes/changes.js'), 'utf8'
);

describe('Phase 3 — change notice approval migrated to signoff-gate', () => {
  test('all-signed path calls triggerSignoff with change_notice', () => {
    expect(src).toMatch(/triggerSignoff\(\s*\n?\s*['"]change_notice['"]/);
  });

  test('passes documentRow with fields needed by predicates', () => {
    // source → strip_initiator; cn_origin → external_origin;
    // is_emergency → is_emergency; estimated_value → below_threshold
    expect(src).toMatch(/source:\s*cn\.source/);
    expect(src).toMatch(/cn_origin:\s*cn\.cn_origin/);
    expect(src).toMatch(/is_emergency:\s*cn\.is_emergency/);
    expect(src).toMatch(/estimated_value/);
  });

  test('passes initiatorUser for strip_initiator fallback', () => {
    expect(src).toMatch(/initiatorUser/);
  });

  test('does NOT call sendCNApprovalAlert via WhatsApp', () => {
    expect(src).not.toMatch(/sendCNApprovalAlert/);
  });
});
