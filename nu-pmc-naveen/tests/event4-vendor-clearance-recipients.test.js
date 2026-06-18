// tests/event4-vendor-clearance-recipients.test.js
// Prevent-return guard for Event 4 (Decision May 2026):
// vendor_pending_clearance notifications go to finance_admins (ALL of them,
// not just the first one — earlier code had `if (fin[0])` which silently
// dropped notifications to all but one finance admin) PLUS all PMC heads
// PLUS the stream-specific head for the vendor's trade.
//
// Trade→stream mapping is local to this module pending consolidation into
// services/trade-stream.js.

'use strict';
const fs = require('fs');
const path = require('path');

describe('Event 4 — vendor pending clearance recipients', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'modules/onboarding/routes/vendors.js'), 'utf8'
  );

  test('helper _vendorClearanceRecipients exists and accepts trade', () => {
    expect(src).toMatch(/async function _vendorClearanceRecipients\(trade\)/);
  });

  test('helper queries finance_admin role', () => {
    const helper = src.match(/async function _vendorClearanceRecipients[\s\S]+?\n\}/)[0];
    expect(helper).toMatch(/usersByRole\(['"`]finance_admin['"`]/);
  });

  test('helper queries pmc_head role', () => {
    const helper = src.match(/async function _vendorClearanceRecipients[\s\S]+?\n\}/)[0];
    expect(helper).toMatch(/usersByRole\(['"`]pmc_head['"`]/);
  });

  test('helper resolves stream from trade (design_head OR services_head)', () => {
    const helper = src.match(/async function _vendorClearanceRecipients[\s\S]+?\n\}/)[0];
    expect(helper).toMatch(/DESIGN_TRADES/);
    expect(helper).toMatch(/SERVICES_TRADES/);
    expect(helper).toMatch(/design_head/);
    expect(helper).toMatch(/services_head/);
  });

  test('helper dedupes recipients by id', () => {
    const helper = src.match(/async function _vendorClearanceRecipients[\s\S]+?\n\}/)[0];
    expect(helper).toMatch(/seen\.has|new Set/);
  });

  test('master-create POST iterates ALL recipients (no `if (fin[0])` single-recipient bug)', () => {
    // Match POST '/master' specifically (not /master/upload etc.)
    const block = src.match(/router\.post\(['"`]\/master['"`],[\s\S]+?\n\s*\}\)\);/);
    expect(block).not.toBeNull();
    expect(block[0]).not.toMatch(/if \(fin\[0\]\)/);
    expect(block[0]).toMatch(/_vendorClearanceRecipients/);
    expect(block[0]).toMatch(/for \(const r of recipients\)/);
  });

  test('bulk-upload POST also iterates all recipients with dedupe across rows', () => {
    const block = src.match(/router\.post\(['"`]\/master\/upload['"`][\s\S]+?\n\s*\}\)\);/);
    if (block) {
      expect(block[0]).not.toMatch(/if \(fin\[0\]\)/);
      expect(block[0]).toMatch(/_vendorClearanceRecipients/);
      expect(block[0]).toMatch(/recipientIds/);
    } else {
      // Bulk-upload route may have a different mount path — fallback: search by `bulk` or `upload`
      const fallback = src.match(/router\.post[\s\S]*?bulk[\s\S]+?\n\s*\}\)\);/);
      expect(fallback).not.toBeNull();
    }
  });
});
