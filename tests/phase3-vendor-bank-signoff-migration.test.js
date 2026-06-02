// tests/phase3-vendor-bank-signoff-migration.test.js
'use strict';

const fs   = require('fs');
const path = require('path');

const v8Src = fs.readFileSync(
  path.join(__dirname, '..', 'modules/onboarding/lib/vendor-bank-change.js'), 'utf8'
);

describe('V8 propose() — fires vendor confirmation poll (step 1)', () => {
  test('propose() requires signoff-gate', () => {
    expect(v8Src).toMatch(/require\(['"][^'"]*\/signoff-gate['"]\)/);
  });

  test('propose() calls triggerSignoff with vendor_bank_vendor_confirm', () => {
    expect(v8Src).toMatch(/triggerSignoff\(\s*\n?\s*['"]vendor_bank_vendor_confirm['"]/);
  });

  test('propose() does NOT directly trigger vendor_bank_peer_approve', () => {
    const proposeBlock = v8Src.slice(
      v8Src.indexOf('async function propose('),
      v8Src.indexOf('\nasync function ', v8Src.indexOf('async function propose(') + 1)
    );
    expect(proposeBlock).not.toMatch(/vendor_bank_peer_approve/);
  });

  test('propose() passes vendor_id on documentRow', () => {
    expect(v8Src).toMatch(/vendor_id:\s*vendorId/);
  });

  test('signoff-gate failure is non-blocking (caught + logged)', () => {
    expect(v8Src).toMatch(/try \{[\s\S]*signoffGate.*triggerSignoff[\s\S]*\} catch/);
  });
});

describe('V8 new vendor creation — wired to proposeNewVendorBankDetails', () => {
  const vendorsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'modules/onboarding/routes/vendors.js'), 'utf8'
  );

  test('vendor create endpoint calls proposeNewVendorBankDetails when bank fields present', () => {
    expect(vendorsSrc).toMatch(/proposeNewVendorBankDetails/);
  });

  test('vendor create only triggers bank approval when bank fields provided', () => {
    expect(vendorsSrc).toMatch(/if\s*\(body\.bank_account\s*\|\|\s*body\.bank_ifsc\)/);
  });
});
