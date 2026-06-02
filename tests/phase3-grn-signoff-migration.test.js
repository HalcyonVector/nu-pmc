// tests/phase3-grn-signoff-migration.test.js
// ============================================================
// Phase 3 caller migration — prevent-return tests.
//
// Each module migrated from WhatsApp dispatch (waInteractive +
// waReply.registerPendingAction) to services/signoff-gate.triggerSignoff
// gets prevent-return tests here so a future refactor can't silently
// re-introduce the WhatsApp path for these workflows.
//
// Migrations covered:
//   - modules/site/routes/grn.js              → grn_approval
//   - modules/site/routes/issues.js           → issue_confirm
//   - modules/finance/routes/payment-requests → urgent_payment_fyi
//
// NOT migrated (deferred, see v5.34 comment):
//   - modules/workflow/routes/meetings.js     → mom_client_ack
//     (recipient is a client phone, not a users.id; needs
//     client_contacts populated at MOM create time first)
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('Phase 3 — GRN vendor confirmation migrated to signoff-gate', () => {
  // v6.02 audit decision: GRN reclassified as FYI-only.
  // Old workflow grn_approval (PMC poll) deactivated.
  // New workflow grn_vendor_confirm (vendor poll) takes its place.
  // PMC is now alerted only on vendor dispute via POST_COMPLETION_HOOK.
  const grnSrc = read('modules/site/routes/grn.js');

  test('GRN-create flow calls signoff-gate.triggerSignoff with grn_vendor_confirm', () => {
    expect(grnSrc).toMatch(/signoff-gate/);
    expect(grnSrc).toMatch(/triggerSignoff\(\s*\n?\s*['"]grn_vendor_confirm['"]/);
  });

  test('GRN-create flow no longer triggers grn_approval (deactivated v6.02)', () => {
    expect(grnSrc).not.toMatch(/triggerSignoff\(\s*\n?\s*['"]grn_approval['"]/);
  });

  test('GRN-create flow no longer calls waInteractive.sendGRNApproval', () => {
    expect(grnSrc).not.toMatch(/sendGRNApproval\s*\(/);
  });

  test('GRN-create flow no longer registers wa-reply pending actions', () => {
    expect(grnSrc).not.toMatch(/await\s+waReply\.registerPendingAction/);
  });

  test('GRN-create flow: no value-threshold approver-selection', () => {
    // Note: a separate 5%-of-budget check exists in the GRN-APPROVE
    // endpoint (POST /approve) which authorises whether a logged-in
    // senior_site_manager is allowed to act on this GRN. That's a
    // different concern (API authorisation, not approver selection).
    expect(grnSrc).not.toMatch(/approverRole\s*=.*senior_site_manager/);
    expect(grnSrc).not.toMatch(/getUsersByRole\(\s*approverRole/);
  });
});

describe('Phase 3 — Issue confirm migrated to signoff-gate', () => {
  const issuesSrc = read('modules/site/routes/issues.js');

  test('issue-create flow calls signoff-gate.triggerSignoff with issue_confirm', () => {
    expect(issuesSrc).toMatch(/signoff-gate/);
    expect(issuesSrc).toMatch(/triggerSignoff\(\s*\n?\s*['"]issue_confirm['"]/);
  });

  test('issue-create flow no longer calls waInteractive.sendIssueConfirm', () => {
    expect(issuesSrc).not.toMatch(/sendIssueConfirm\s*\(/);
  });

  test('issue-create flow no longer registers wa-reply pending actions', () => {
    // Match invocation, not comment mentions.
    expect(issuesSrc).not.toMatch(/await\s+waReply\.registerPendingAction/);
  });

  test('issue-create flow no longer loops over pmc_heads for dispatch', () => {
    // Pre-migration: for (const pmc of pmcHeads) { sendIssueConfirm(pmc.phone, ...) }
    // Post-migration: gate handles approver resolution; no per-pmc loop.
    expect(issuesSrc).not.toMatch(/for\s*\(\s*const\s+pmc\s+of\s+pmcHeads/);
  });
});

describe('Phase 3 — Urgent payment FYI migrated to signoff-gate', () => {
  const prSrc = read('modules/finance/routes/payment-requests.js');

  test('urgent-payment auto-approve flow calls triggerSignoff with urgent_payment_fyi', () => {
    expect(prSrc).toMatch(/signoff-gate/);
    expect(prSrc).toMatch(/triggerSignoff\(\s*\n?\s*['"]urgent_payment_fyi['"]/);
  });

  test('urgent-payment auto-approve flow no longer calls waInteractive.sendUrgentPaymentFYI', () => {
    expect(prSrc).not.toMatch(/sendUrgentPaymentFYI\s*\(/);
  });
});

describe('Phase 3 — Drawing approval migrated to signoff-gate (with thumbnail)', () => {
  const dwSrc = read('modules/design-services/routes/drawings.js');

  test('minor-revision drawing approval calls triggerSignoff with drawing_approval', () => {
    expect(dwSrc).toMatch(/signoff-gate/);
    expect(dwSrc).toMatch(/triggerSignoff\(\s*\n?\s*['"]drawing_approval['"]/);
  });

  test('minor-revision flow passes thumbnail via attachImage option', () => {
    // attachImage: drawingVersion.thumbnail_path keeps the inline visual
    // that the WhatsApp path provided.
    expect(dwSrc).toMatch(/attachImage:\s*drawingVersion\.thumbnail_path/);
  });

  test('minor-revision flow no longer calls waInt.sendButtons', () => {
    expect(dwSrc).not.toMatch(/waInt\.sendButtons/);
  });

  test('caller passes stream in documentRow so rules engine picks the right head', () => {
    // The is_services_stream / is_design_stream predicates read
    // documentRow.stream. If the caller stops passing it, the rules
    // can't trim the wrong head from the sequence.
    expect(dwSrc).toMatch(/stream,/);   // stream key in documentRow object
  });
});
