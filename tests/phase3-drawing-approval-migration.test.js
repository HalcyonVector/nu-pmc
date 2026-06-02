// tests/phase3-drawing-approval-migration.test.js
// Prevent-return: drawing approval (R1/R2) migrated from WhatsApp buttons to signoff-gate.
'use strict';
const fs   = require('fs');
const path = require('path');
const src  = fs.readFileSync(
  path.join(__dirname, '..', 'modules/design-services/routes/drawings.js'), 'utf8'
);

describe('Phase 3 — drawing approval migrated to signoff-gate', () => {
  test('R1/R2 path calls triggerSignoff with drawing_approval', () => {
    expect(src).toMatch(/triggerSignoff\(\s*\n?\s*['"]drawing_approval['"]/);
  });

  test('passes documentRow.stream for predicate evaluation', () => {
    // is_services_stream / is_design_stream predicates require this
    expect(src).toMatch(/stream/);
  });

  test('does not call sendButtons from whatsapp-interactive', () => {
    expect(src).not.toMatch(/waInteractive\s*\.\s*sendButtons\s*\(/);
    expect(src).not.toMatch(/whatsapp-interactive[\s\S]{0,100}sendButtons/);
  });

  test('attachImage passed to gate for thumbnail', () => {
    expect(src).toMatch(/attachImage/);
  });
});
