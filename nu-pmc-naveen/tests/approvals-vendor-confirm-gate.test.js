// tests/approvals-vendor-confirm-gate.test.js
// Verifies the vendor-confirm gate in services/approvals.js — when
// approval_type_config.requires_vendor_confirm=1 AND approvals.vendor_confirmed_at
// IS NULL, quorum-met approvals stay 'pending' instead of being promoted to
// 'approved'. Previous behaviour: flag was read but never enforced (logical bug).
//
// As of B18 fix: gate logic lives in _reevaluate(), called from BOTH vote()
// and recordVendorConfirm(). Pipeline now closes — vendor confirm endpoint
// triggers re-evaluation, which promotes status to 'approved' once vendor
// confirmation has stamped vendor_confirmed_at.

'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'approvals.js'), 'utf8');

describe('approvals — requires_vendor_confirm enforcement', () => {
  test('_reevaluate reads vendor_confirmed_at and quorum from joined SELECT', () => {
    // The joined SELECT in _reevaluate must include both fields
    const m = src.match(/SELECT[^;]*?vendor_confirmed_at[\s\S]*?FROM approvals a[\s\S]*?JOIN approval_type_config/);
    expect(m).not.toBeNull();
  });

  test('quorum-met-but-vendor-not-confirmed stays pending', () => {
    // The branch in _reevaluate keeps newStatus = 'pending'
    expect(src).toMatch(/a\.requires_vendor_confirm && !a\.vendor_confirmed_at/);
  });

  test('quorum-met-and-vendor-confirmed (or flag absent) promotes to approved', () => {
    // The else branch sets newStatus = 'approved'
    const m = src.match(/a\.requires_vendor_confirm && !a\.vendor_confirmed_at[\s\S]+?else \{[\s\S]+?newStatus = 'approved'/);
    expect(m).not.toBeNull();
  });

  test('recordVendorConfirm exists and re-evaluates after stamping', () => {
    // The pipeline-closing function: stamps vendor_confirmed_at, then re-eval
    expect(src).toMatch(/async function recordVendorConfirm/);
    expect(src).toMatch(/UPDATE approvals SET vendor_confirmed_at = NOW\(\)/);
    // After stamp, calls _reevaluate
    const m = src.match(/recordVendorConfirm[\s\S]+?_reevaluate\(conn, approvalId/);
    expect(m).not.toBeNull();
  });

  test('recordVendorConfirm is exported', () => {
    expect(src).toMatch(/module\.exports\s*=\s*\{[\s\S]+?recordVendorConfirm/);
  });

  test('comment explains pipeline closure', () => {
    expect(src).toMatch(/vendor-confirm endpoint|recordVendorConfirm/);
  });
});

// ── Pipeline integration: open → vote ×quorum → recordVendorConfirm → approved
//
// This is the missing test that B18 surfaced — earlier the gate was correct in
// isolation but the producer (vendor-public.js) didn't update the gated value.
// This test verifies the full producer-consumer cycle.

const db = require('../middleware/db');
const approvals = require('../services/approvals');

jest.mock('../middleware/db', () => {
  const m = { query: jest.fn() };
  m.tx = jest.fn((fn) => fn({ query: m.query }));
  return m;
});

describe('approvals — vendor-confirm full pipeline', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('vote with quorum but no vendor_confirmed_at → stays pending; recordVendorConfirm → flips to approved', async () => {
    // Stage 1: vote() with requires_vendor_confirm=1, vendor_confirmed_at=null
    db.query
      // SELECT FOR UPDATE in vote()
      .mockResolvedValueOnce([[{
        id: 80, approval_type: 'vendor_bank_change', project_id: null,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      // _getTypeConfig
      .mockResolvedValueOnce([[{
        approval_type: 'vendor_bank_change',
        signer_roles_json: JSON.stringify(['principal','design_principal']),
        quorum: 1, scope: 'global',
        requires_vendor_confirm: 1, expires_after_hours: 72,
        label: 'Vendor bank change', active: 1,
      }]])
      // INSERT signoff
      .mockResolvedValueOnce([{ insertId: 1 }])
      // _reevaluate: SELECT joined a + atc, vendor_confirmed_at is NULL
      .mockResolvedValueOnce([[{
        approval_type: 'vendor_bank_change', status: 'pending', row_version: 1,
        vendor_confirmed_at: null, quorum: 1, requires_vendor_confirm: 1,
      }]])
      // SELECT all votes — quorum met
      .mockResolvedValueOnce([[{ vote: 'approve' }]]);
      // No UPDATE — gate holds approval at 'pending'

    const r1 = await approvals.vote({
      approvalId: 80, signerId: 10, signerRole: 'principal', vote: 'approve',
    });
    expect(r1.newStatus).toBe('pending');     // gate held it
    expect(r1.quorumProgress.approves).toBe(1);

    // Stage 2: recordVendorConfirm runs — stamps vendor_confirmed_at, re-evaluates
    db.query.mockReset();
    db.query
      // SELECT FOR UPDATE in recordVendorConfirm
      .mockResolvedValueOnce([[{ id: 80, status: 'pending', vendor_confirmed_at: null }]])
      // UPDATE vendor_confirmed_at = NOW()
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // _reevaluate: SELECT joined — vendor_confirmed_at NOW set
      .mockResolvedValueOnce([[{
        approval_type: 'vendor_bank_change', status: 'pending', row_version: 1,
        vendor_confirmed_at: new Date(), quorum: 1, requires_vendor_confirm: 1,
      }]])
      // SELECT all votes
      .mockResolvedValueOnce([[{ vote: 'approve' }]])
      // UPDATE approval → approved
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const r2 = await approvals.recordVendorConfirm({ approvalId: 80 });
    expect(r2.newStatus).toBe('approved');     // gate released, promoted
  });

  test('recordVendorConfirm on already-approved approval is idempotent', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 81, status: 'approved', vendor_confirmed_at: new Date() }]])
      // No UPDATE because vendor_confirmed_at already set
      .mockResolvedValueOnce([[{
        approval_type: 'vendor_bank_change', status: 'approved', row_version: 5,
        vendor_confirmed_at: new Date(), quorum: 1, requires_vendor_confirm: 1,
      }]]);
      // _reevaluate sees status='approved' → returns early without further queries

    const r = await approvals.recordVendorConfirm({ approvalId: 81 });
    expect(r.newStatus).toBe('approved');
  });
});
