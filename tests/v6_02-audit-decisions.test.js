// tests/v6_02-audit-decisions.test.js
// ============================================================
// v6.02 audit decisions (4 May 2026) — prevent-return tests.
//
// Each decision is pinned here so a future refactor can't silently
// re-introduce the old behaviour. If you intentionally revisit one
// of these, update the test and document the new decision.
//
// Decisions:
//   (1) GRN reclassified as FYI-only — no PMC approval poll.
//       Vendor confirmation poll routes through signoff-gate so a
//       'rejected' vote (dispute) fires POST_COMPLETION_HOOK alerting PMC.
//   (2) Vendor BOQ acceptance — fires from change_notice and
//       ncr_endorsement post-completion hooks.
//   (3) Add New Vendor — role-scoped initiation (stream gate),
//       vendor_onboarding signoff to Finance + Principal.
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('v6.02 — GRN reclassified as FYI', () => {
  const grnSrc = read('modules/site/routes/grn.js');
  const sqlSrc = read('nu-pmc-install-20260502.sql');

  test('GRN route does not call grn_approval (deactivated)', () => {
    expect(grnSrc).not.toMatch(/triggerSignoff\(\s*\n?\s*['"]grn_approval['"]/);
  });

  test('GRN route uses grn_vendor_confirm via signoff-gate', () => {
    expect(grnSrc).toMatch(/triggerSignoff\(\s*\n?\s*['"]grn_vendor_confirm['"]/);
  });

  test('grn_approval workflow is deactivated in install SQL', () => {
    expect(sqlSrc).toMatch(/UPDATE signoff_workflows SET active = 0 WHERE workflow_type = 'grn_approval'/);
  });

  test('grn_vendor_confirm workflow seeded with vendor_rep + personal destination', () => {
    expect(sqlSrc).toMatch(/'grn_vendor_confirm'[^,]*,[^,]*,[^,]*,[^,]*,[^,]*'vendor_rep'[^,]*,[^,]*'personal'/);
  });
});

describe('v6.02 — Vendor BOQ acceptance from CN and NCR', () => {
  const gateSrc = read('services/signoff-gate.js');
  const sqlSrc  = read('nu-pmc-install-20260502.sql');

  test('change_notice POST_COMPLETION_HOOKS includes vendorBOQAcceptance', () => {
    expect(gateSrc).toMatch(/change_notice:\s*\[/);
    expect(gateSrc).toMatch(/vendorBOQAcceptance/);
    expect(gateSrc).toMatch(/triggerSignoff\(\s*\n?\s*['"]vendor_boq_acceptance['"]/);
  });

  test('ncr_endorsement POST_COMPLETION_HOOKS triggers vendor_boq_acceptance', () => {
    expect(gateSrc).toMatch(/ncr_endorsement:\s*\[/);
    expect(gateSrc).toMatch(/vendorBOQAcceptanceOnDescope/);
  });

  test('vendor_boq_acceptance workflow seeded', () => {
    expect(sqlSrc).toMatch(/'vendor_boq_acceptance'[^,]*,[^,]*,[^,]*,[^,]*,[^,]*'vendor_rep'/);
  });

  test('change_notices.affected_engagement_id column added', () => {
    expect(sqlSrc).toMatch(/ALTER TABLE change_notices[\s\S]*affected_engagement_id/);
  });

  test('issues.descope_engagement_id column added for NCR descope', () => {
    expect(sqlSrc).toMatch(/ALTER TABLE issues[\s\S]*descope_engagement_id/);
  });

  test('vendor_engagements.boq_last_acknowledged_at column added', () => {
    expect(sqlSrc).toMatch(/boq_last_acknowledged_at/);
  });
});

describe('v6.02 — Add New Vendor with role-scoped initiation', () => {
  const vendorsSrc = read('modules/onboarding/routes/vendors.js');
  const sqlSrc     = read('nu-pmc-install-20260502.sql');

  test('vendor creation enforces stream gate for design_head/services_head', () => {
    expect(vendorsSrc).toMatch(/TRADE_STREAM_MISMATCH/);
    expect(vendorsSrc).toMatch(/design_head|services_head/);
  });

  test('vendor creation triggers vendor_onboarding signoff', () => {
    expect(vendorsSrc).toMatch(/triggerSignoff\(\s*\n?\s*['"]vendor_onboarding['"]/);
  });

  test('vendor_onboarding workflow seeded with finance,principal sequence', () => {
    expect(sqlSrc).toMatch(/'vendor_onboarding'[^,]*,[^,]*,[^,]*,[^,]*,[^,]*'finance,principal'/);
  });
});

describe('v6.02 — Materials filtered by stream for design/services heads', () => {
  const matSrc = read('modules/design-services/routes/materials.js');

  test('material requests filter by stream for design_head/services_head', () => {
    expect(matSrc).toMatch(/design_head|services_head/);
    expect(matSrc).toMatch(/DESIGN_TRADES[\s\S]*SERVICES_TRADES/);
    expect(matSrc).toMatch(/filtered\s*=\s*requests\.filter/);
  });

  test('BOQ items list filters by stream for design_head/services_head', () => {
    expect(matSrc).toMatch(/filtered\s*=\s*items\.filter/);
  });
});

describe('v6.02 — Drawing queries filtered by stream', () => {
  const issuesSrc = read('modules/site/routes/issues.js');

  test('RFI/drawing-query list filters by drawing.stream for design_head/services_head', () => {
    expect(issuesSrc).toMatch(/drawing_stream/);
    expect(issuesSrc).toMatch(/r\.drawing_stream === expected/);
  });
});
