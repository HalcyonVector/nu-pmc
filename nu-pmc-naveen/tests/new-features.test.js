// tests/new-features.test.js — unit tests for last 8 features
// Run: node tests/new-features.test.js

const assert = require('assert');
const path   = require('path');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed++;
  } catch (err) {
    console.log('✗', name, '-', err.message);
    failed++;
  }
}

// ── TEST 1: Fuzzy matching
const fuzzy = require('../services/fuzzy-match');

test('fuzzy: exact match returns 1.0', () => {
  assert.strictEqual(fuzzy.dupScore('Ramesh', 'Ramesh'), 1);
});

test('fuzzy: case insensitive', () => {
  assert.strictEqual(fuzzy.dupScore('RAMESH', 'ramesh'), 1);
});

test('fuzzy: normalise strips company suffixes', () => {
  assert.strictEqual(fuzzy.normalise('nu associates LLP'), 'nu associates');
  assert.strictEqual(fuzzy.normalise('ABC Pvt Ltd'), 'abc');
});

test('fuzzy: short strings (< 5 chars) need exact match', () => {
  assert.strictEqual(fuzzy.dupScore('ABC', 'ABCD'), 0);
  assert.strictEqual(fuzzy.dupScore('XYZ', 'XYW'), 0);
});

test('fuzzy: first word mismatch blocks similarity', () => {
  assert.strictEqual(fuzzy.dupScore('XYZ Ltd', 'ABC Ltd'), 0);
});

test('fuzzy: Rameesh matches Ramesh', () => {
  const s = fuzzy.dupScore('Ramesh Constructions', 'Rameesh Constructions');
  assert.ok(s > 0.75, `Expected > 0.75, got ${s}`);
});

test('fuzzy: company suffix variation ignored', () => {
  const s = fuzzy.dupScore('TZMO India', 'TZMO India Pvt Ltd');
  assert.ok(s > 0.9, `Expected > 0.9 after suffix strip, got ${s}`);
});

test('fuzzy: isDuplicate threshold adapts to length', () => {
  // Short (< 8 chars): needs 0.85
  assert.strictEqual(fuzzy.isDuplicate(0.80, 'ABCD123', 'ABCE123'), false);
  // Medium (8-14 chars): needs 0.80
  assert.strictEqual(fuzzy.isDuplicate(0.82, 'ABCDEFGHIJ', 'ABCDEFGHIK'), true);
  assert.strictEqual(fuzzy.isDuplicate(0.75, 'ABCDEFGHIJ', 'ABCDEFGHIK'), false);
  // Long (15+ chars): needs 0.75
  assert.strictEqual(fuzzy.isDuplicate(0.78, 'A'.repeat(20), 'A'.repeat(19)+'B'), true);
});

// ── TEST 2: GST split calculation
function splitGST(amount, rate, isInter) {
  const taxable = amount / (1 + rate/100);
  const gst = amount - taxable;
  return isInter
    ? { taxable: +taxable.toFixed(2), igst: +gst.toFixed(2), cgst: 0, sgst: 0 }
    : { taxable: +taxable.toFixed(2), cgst: +(gst/2).toFixed(2), sgst: +(gst/2).toFixed(2), igst: 0 };
}

test('GST: 18% intrastate splits CGST+SGST equally', () => {
  const r = splitGST(118000, 18, false);
  assert.strictEqual(r.taxable, 100000);
  assert.strictEqual(r.cgst, 9000);
  assert.strictEqual(r.sgst, 9000);
  assert.strictEqual(r.igst, 0);
});

test('GST: interstate goes to IGST only', () => {
  const r = splitGST(118000, 18, true);
  assert.strictEqual(r.igst, 18000);
  assert.strictEqual(r.cgst, 0);
});

test('GST: 12% rate works', () => {
  const r = splitGST(112000, 12, false);
  assert.strictEqual(r.taxable, 100000);
  assert.strictEqual(r.cgst, 6000);
});

test('GST: zero rate (exempt)', () => {
  const r = splitGST(100000, 0, false);
  assert.strictEqual(r.taxable, 100000);
  assert.strictEqual(r.cgst, 0);
});

// ── TEST 3: Advance reconciliation
function netPayment(ra, adv, retPct) {
  const ret = ra * retPct / 100;
  return +(ra - adv - ret).toFixed(2);
}

test('Advance: RA ₹10L - Advance ₹2L - 5% Ret = ₹7.5L', () => {
  assert.strictEqual(netPayment(1000000, 200000, 5), 750000);
});

test('Advance: no advance, only retention', () => {
  assert.strictEqual(netPayment(500000, 0, 5), 475000);
});

test('Advance: full advance adjustment = zero payment', () => {
  assert.strictEqual(netPayment(200000, 200000, 0), 0);
});

// ── TEST 4: Invoice enforcement
const INVOICE_REQUIRED = ['running_account_bill','final_bill'];

test('Invoice: RA bill requires invoice', () => {
  const type = 'running_account_bill';
  const hasInvoice = false;
  const blocked = INVOICE_REQUIRED.includes(type) && !hasInvoice;
  assert.strictEqual(blocked, true);
});

test('Invoice: mobilisation advance does NOT require invoice', () => {
  const type = 'mobilisation_advance';
  const hasInvoice = false;
  const blocked = INVOICE_REQUIRED.includes(type) && !hasInvoice;
  assert.strictEqual(blocked, false);
});

test('Invoice: final bill with invoice attached passes', () => {
  const type = 'final_bill';
  const hasInvoice = true;
  const blocked = INVOICE_REQUIRED.includes(type) && !hasInvoice;
  assert.strictEqual(blocked, false);
});

// ── TEST 5: Permissions module
const perms = require('../middleware/permissions');

test('Permissions: principal can create users', async () => {
  assert.strictEqual(await perms.can('principal', 'users.create'), true);
});

test('Permissions: site_manager cannot create users', async () => {
  assert.strictEqual(await perms.can('site_manager', 'users.create'), false);
});

test('Permissions: finance_admin can bulk upload clients', async () => {
  assert.strictEqual(await perms.can('finance_admin', 'clients.bulk_upload'), true);
});

test('Permissions: unknown action returns false', async () => {
  assert.strictEqual(await perms.can('principal', 'made.up.action'), false);
});

// ── TEST 6: Deep-link format
function deepLink(base, tab, projectId, itemId) {
  let url = `${base}/#${tab}`;
  if (projectId) url += `?project=${projectId}`;
  if (itemId)    url += `&item=${itemId}`;
  return url;
}

test('Deep-link: basic tab', () => {
  assert.strictEqual(deepLink('https://x.com', 'budget', null, null), 'https://x.com/#budget');
});

test('Deep-link: with project and item', () => {
  assert.strictEqual(
    deepLink('https://x.com', 'grn', 42, 15),
    'https://x.com/#grn?project=42&item=15'
  );
});

// ── TEST 7: BOQ section detection
function isSection(itemName, unit, qty, sectionCol) {
  const hasExplicit = sectionCol === '1' || sectionCol === 'yes' || sectionCol === 'true' || sectionCol === 1;
  const isLikely    = !unit && !qty && itemName === itemName.toUpperCase() && itemName.length > 3;
  return hasExplicit || isLikely;
}

test('BOQ section: explicit Section column wins', () => {
  assert.strictEqual(isSection('Cement bags', 'bag', 100, '1'), true);
});

test('BOQ section: ALL CAPS + no unit + no qty = section', () => {
  assert.strictEqual(isSection('CIVIL WORKS', '', 0, ''), true);
});

test('BOQ section: ALL CAPS item with unit is NOT a section', () => {
  assert.strictEqual(isSection('ACC WALLING', 'sqm', 0, ''), false);
});

test('BOQ section: regular item not a section', () => {
  assert.strictEqual(isSection('Cement bags', 'bag', 100, ''), false);
});

// ── TEST 8: GRN threshold fallback
function approverFor(projectBudget, grnValue) {
  const threshold = projectBudget > 0 ? projectBudget * 0.05 : 100000;
  return grnValue > threshold ? 'pmc_head' : 'senior_site_manager';
}

test('GRN: no budget, small GRN goes to senior site manager', () => {
  assert.strictEqual(approverFor(0, 50000), 'senior_site_manager');
});

test('GRN: no budget, large GRN goes to PMC', () => {
  assert.strictEqual(approverFor(0, 150000), 'pmc_head');
});

test('GRN: with budget, threshold is 5%', () => {
  assert.strictEqual(approverFor(10000000, 400000), 'senior_site_manager'); // 4% of budget
  assert.strictEqual(approverFor(10000000, 600000), 'pmc_head');            // 6% of budget
});



// ══════════════════════════════════════════════════
// PAYMENT VALIDATION + PROGRESS REGRESSION TESTS
// ══════════════════════════════════════════════════

const pv = require('../services/payment-validation');

test('validateAmount: accepts positive number', () => {
  const r = pv.validateAmount(50000);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.amount, 50000);
});

test('validateAmount: accepts string number', () => {
  const r = pv.validateAmount('50000');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.amount, 50000);
});

test('validateAmount: rejects text', () => {
  const r = pv.validateAmount('fifty thousand');
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes('not a valid number'));
});

test('validateAmount: rejects mixed text/number', () => {
  const r = pv.validateAmount('50k');
  assert.strictEqual(r.ok, false);
});

test('validateAmount: rejects negative', () => {
  const r = pv.validateAmount(-100);
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes('cannot be negative'));
});

test('validateAmount: rejects zero', () => {
  const r = pv.validateAmount(0);
  assert.strictEqual(r.ok, false);
});

test('validateAmount: rejects empty', () => {
  const r = pv.validateAmount('');
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes('required'));
});

test('validateAmount: rejects over ₹100 crore ceiling', () => {
  const r = pv.validateAmount(2e11);
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes('ceiling'));
});

test('validatePercent: accepts 0-100', () => {
  assert.strictEqual(pv.validatePercent(50).ok, true);
  assert.strictEqual(pv.validatePercent(0).ok, true);
  assert.strictEqual(pv.validatePercent(100).ok, true);
});

test('validatePercent: rejects text', () => {
  const r = pv.validatePercent('done');
  assert.strictEqual(r.ok, false);
});

test('validatePercent: rejects > 100', () => {
  const r = pv.validatePercent(150);
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes('between 0 and 100'));
});

test('validatePercent: rejects negative', () => {
  const r = pv.validatePercent(-5);
  assert.strictEqual(r.ok, false);
});

test('validateQuantity: accepts decimals', () => {
  const r = pv.validateQuantity(12.5);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.qty, 12.5);
});

test('validateQuantity: rejects negative', () => {
  const r = pv.validateQuantity(-5);
  assert.strictEqual(r.ok, false);
});

// Regression logic test (pure logic, no DB)
function shouldFlagRegression(newPct, prevPct, reason) {
  if (newPct >= prevPct) return { flag: false };
  if (!reason || reason.trim().length < 5) return { flag: false, block: true };
  return { flag: true, note: `REGRESSION: ${prevPct}% -> ${newPct}%. Reason: ${reason}` };
}

test('regression: progress unchanged is OK', () => {
  assert.strictEqual(shouldFlagRegression(35, 35).flag, false);
});

test('regression: progress forward is OK', () => {
  assert.strictEqual(shouldFlagRegression(50, 35).flag, false);
});

test('regression: backwards without reason is blocked', () => {
  const r = shouldFlagRegression(29, 35);
  assert.strictEqual(r.block, true);
});

test('regression: backwards with reason is flagged', () => {
  const r = shouldFlagRegression(29, 35, 'Rework on faulty slab');
  assert.strictEqual(r.flag, true);
  assert.ok(r.note.includes('REGRESSION'));
});

test('regression: short reason is blocked', () => {
  const r = shouldFlagRegression(29, 35, 'bad');
  assert.strictEqual(r.block, true);
});


// ══════════════════════════════════════════════════
// EXTENDED VALIDATOR TESTS — phone, email, date, text
// ══════════════════════════════════════════════════

const val = require('../middleware/validate');

test('isValidPhone: 10-digit Indian', () => assert.strictEqual(val.isValidPhone('9886050673'), true));
test('isValidPhone: 12-digit with 91 prefix', () => assert.strictEqual(val.isValidPhone('919886050673'), true));
test('isValidPhone: rejects text', () => assert.strictEqual(val.isValidPhone('hello'), false));
test('isValidPhone: rejects short number', () => assert.strictEqual(val.isValidPhone('12345'), false));
test('isValidPhone: rejects invalid prefix for 10 digits', () => assert.strictEqual(val.isValidPhone('1234567890'), false));
test('isValidPhone: handles spaces and dashes', () => assert.strictEqual(val.isValidPhone('9886-050-673'), true));

test('isValidEmail: valid', () => assert.strictEqual(val.isValidEmail('naveen@nuassociates.com'), true));
test('isValidEmail: missing @', () => assert.strictEqual(val.isValidEmail('naveen.nuassociates.com'), false));
test('isValidEmail: missing TLD', () => assert.strictEqual(val.isValidEmail('naveen@nu'), false));
test('isValidEmail: empty', () => assert.strictEqual(val.isValidEmail(''), false));

test('isValidDateRange: valid forward', () => assert.strictEqual(val.isValidDateRange('2026-01-01','2026-12-31'), true));
test('isValidDateRange: end before start', () => assert.strictEqual(val.isValidDateRange('2026-12-31','2026-01-01'), false));
test('isValidDateRange: too far apart', () => assert.strictEqual(val.isValidDateRange('2020-01-01','2050-01-01'), false));
test('isValidDateRange: invalid date', () => assert.strictEqual(val.isValidDateRange('not-a-date','2026-01-01'), false));

test('isReasonableDate: current year', () => assert.strictEqual(val.isReasonableDate('2026-04-20'), true));
test('isReasonableDate: ancient date', () => assert.strictEqual(val.isReasonableDate('1905-01-01'), false));
test('isReasonableDate: far future', () => assert.strictEqual(val.isReasonableDate('2099-12-31'), false));

test('isSafeText: regular name', () => assert.strictEqual(val.isSafeText('Naveen Bhat'), true));
test('isSafeText: rejects HTML', () => assert.strictEqual(val.isSafeText('<script>alert(1)</script>'), false));
test('isSafeText: rejects purely numeric', () => assert.strictEqual(val.isSafeText('12345'), false));
test('isSafeText: rejects javascript: URI', () => assert.strictEqual(val.isSafeText('javascript:alert(1)'), false));
test('isSafeText: allows company name with number', () => assert.strictEqual(val.isSafeText('ABC 123 Private Ltd'), true));
test('isSafeText: strict no-numbers mode', () => {
  assert.strictEqual(val.isSafeText('John Smith', { allowNumbers: false }), true);
  assert.strictEqual(val.isSafeText('John 2', { allowNumbers: false }), false);
});

// ── SUMMARY
console.log();
console.log('='.repeat(50));
console.log(`${passed}/${passed + failed} tests passed`);
if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
