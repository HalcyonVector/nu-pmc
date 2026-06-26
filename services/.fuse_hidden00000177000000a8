// services/payment-validation.js — Payment sanity checks (Indian format only)
// 1. Parse Indian-format input — strip ₹, Rs, INR, commas (at any position — Indian or otherwise)
// 2. Numeric validation — reject non-numeric, negative, zero (where zero is invalid)
// 3. Contract value check — request cannot exceed contract
// 4. Cumulative check — total approved + pending cannot exceed contract
// 5. Anomaly flag — unusually large request vs vendor history
//
// Input philosophy: accept anything a human might naturally type —
// "25,00,000", "₹25,00,000.50", "2500000", "Rs 25,00,000" — all parse to 2500000.
// Display philosophy: always emit Indian format via toLocaleString('en-IN').

const db = require('../middleware/db');

/**
 * Parse a user-entered amount string in Indian format (or plain number).
 * Returns a pure Number or null if unparseable.
 *
 * Handles:
 *   "25,00,000"           → 2500000
 *   "25,00,000.50"        → 2500000.50
 *   "₹25,00,000"          → 2500000
 *   "Rs. 25,00,000"       → 2500000
 *   "Rs 2500000"          → 2500000
 *   "INR 25,00,000.00"    → 2500000
 *   "  2,500,000  "       → 2500000   (US-style commas also accepted — same number)
 *   "2500000"             → 2500000
 *   "25.5 lakh"           → null      (unit keywords not supported — keeps us strict)
 *   "abc"                 → null
 *   ""                    → null
 */
function parseIndianAmount(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s) return null;

  // Strip common currency prefixes/suffixes
  s = s.replace(/^(?:₹|Rs\.?|INR|rs\.?|inr)\s*/i, '');
  s = s.replace(/\s*(?:₹|Rs\.?|INR|rs\.?|inr)$/i, '');
  s = s.trim();

  // Reject if ANY letters remain — no "lakh", "crore", "cr", "k", "mn" accepted
  // Keeps the API strict and predictable; the frontend handles formatting.
  if (/[a-zA-Z]/.test(s)) return null;

  // Strip all commas (position-agnostic — Indian, US, or malformed all resolve cleanly)
  s = s.replace(/,/g, '');

  // Strip whitespace that may be thousands separator in some locales
  s = s.replace(/\s/g, '');

  // Must now be a plain number — digits, optional dot, optional minus
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Validate a monetary amount input. Accepts Indian format.
 * Returns { ok, amount, error }. Amount is rounded to 2 decimals (paise).
 *
 * Options:
 *   allowZero: true to allow 0 (default false — most money fields must be > 0)
 *   min: lower bound (default 0, exclusive unless allowZero)
 *   max: upper bound (default 100 crore)
 *   fieldName: for error messages
 */
function validateAmount(raw, fieldName = 'Amount', opts = {}) {
  const {
    allowZero = false,
    min = 0,
    max = 1e10,     // ₹100 crore default ceiling per transaction
  } = opts;

  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: false, error: `${fieldName} is required` };
  }

  const n = parseIndianAmount(raw);
  if (n === null) {
    return { ok: false, error: `${fieldName} is not a valid number — got "${raw}". Use format like 25,00,000 or 2500000.` };
  }

  if (n < 0) {
    return { ok: false, error: `${fieldName} cannot be negative — got ${fmtINR(n)}` };
  }

  if (!allowZero && n === 0) {
    return { ok: false, error: `${fieldName} must be greater than zero` };
  }

  if (n < min) {
    return { ok: false, error: `${fieldName} must be at least ₹${fmtINR(min)} — got ₹${fmtINR(n)}` };
  }

  if (n > max) {
    return { ok: false, error: `${fieldName} exceeds ₹${fmtINR(max)} ceiling — please verify. If genuinely correct, split into multiple entries.` };
  }

  // Round to paise (2 decimals) to avoid float drift
  const rounded = Math.round(n * 100) / 100;

  return { ok: true, amount: rounded };
}

/**
 * Validate a percentage (0-100). Accepts "50", "50%", "50.5".
 */
function validatePercent(raw, fieldName = 'Percentage', opts = {}) {
  const { allowZero = true, max = 100 } = opts;
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, error: `${fieldName} is required` };
  }
  const s = String(raw).replace(/%/g, '').trim();
  const n = parseIndianAmount(s);
  if (n === null) {
    return { ok: false, error: `${fieldName} must be a number — got "${raw}"` };
  }
  if (n < 0) return { ok: false, error: `${fieldName} cannot be negative — got ${n}` };
  if (!allowZero && n === 0) return { ok: false, error: `${fieldName} must be greater than zero` };
  if (n > max) return { ok: false, error: `${fieldName} must be between 0 and ${max} — got ${n}` };
  return { ok: true, pct: Math.round(n * 100) / 100 };
}

/**
 * Validate a quantity (allows decimals, non-negative).
 */
function validateQuantity(raw, fieldName = 'Quantity', opts = {}) {
  const { allowZero = false, max = 1e9 } = opts;
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, error: `${fieldName} is required` };
  }
  const n = parseIndianAmount(raw);
  if (n === null) {
    return { ok: false, error: `${fieldName} must be a number — got "${raw}"` };
  }
  if (n < 0) return { ok: false, error: `${fieldName} cannot be negative` };
  if (!allowZero && n === 0) return { ok: false, error: `${fieldName} must be greater than zero` };
  if (n > max) return { ok: false, error: `${fieldName} is unreasonably large — got ${n}` };
  return { ok: true, qty: Math.round(n * 1000) / 1000 };   // 3 decimals for qty
}

/**
 * Validate a GST rate — must be one of India's slabs (0, 5, 12, 18, 28) or a reasonable custom value.
 */
function validateGSTRate(raw, fieldName = 'GST rate') {
  const { ok, error, pct } = validatePercent(raw, fieldName, { allowZero: true, max: 50 });
  if (!ok) return { ok: false, error };
  return { ok: true, pct };
}

/**
 * Check payment request against contract value and cumulative payments.
 * Returns { ok, error, warning, contractValue, alreadyCommitted, remaining }
 *
 * Pass engagementId OR ignore if adhoc (no contract to check against).
 */
async function checkPaymentSanity(engagementId, vendorId, amountRequested, currentPrId = null) {
  // Ad-hoc payments — no contract, skip check
  if (!engagementId) {
    return { ok: true, warning: 'Ad-hoc payment — no contract value to check against' };
  }

  // Get engagement contract value
  const [[eng]] = await db.query(
    `SELECT ve.id, ve.contract_value, ve.scope, v.vendor_name
     FROM vendor_engagements ve JOIN vendors v ON ve.vendor_id=v.id
     WHERE ve.id=?`,
    [engagementId]
  );

  if (!eng) {
    return { ok: false, error: 'Vendor engagement not found' };
  }

  const contractValue = parseFloat(eng.contract_value || 0);
  if (contractValue <= 0) {
    return {
      ok: true,
      warning: 'Engagement has no contract value set — cannot validate against ceiling',
    };
  }

  // HARD BLOCK: single request > contract value
  if (amountRequested > contractValue) {
    return {
      ok: false,
      error: `Request ₹${fmtINR(amountRequested)} exceeds ${eng.vendor_name} contract value of ₹${fmtINR(contractValue)}`,
      contractValue,
    };
  }

  // Sum approved + pending payments on this engagement (excluding current request if editing)
  const excludeClause = currentPrId ? 'AND id != ?' : '';
  const params = currentPrId ? [engagementId, currentPrId] : [engagementId];

  const [[sums]] = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('paid','principal_approved','pmc_approved')
                         AND payment_type NOT IN ('mobilisation_advance','material_advance','advance')
                         THEN amount_requested ELSE 0 END), 0) AS committed_bills,
       COALESCE(SUM(CASE WHEN status IN ('pending_pmc','pending_principal')
                         AND payment_type NOT IN ('mobilisation_advance','material_advance','advance')
                         THEN amount_requested ELSE 0 END), 0) AS pending_bills,
       COALESCE(SUM(CASE WHEN status='paid'
                         AND payment_type IN ('mobilisation_advance','material_advance','advance')
                         THEN amount_requested ELSE 0 END), 0) AS advances_paid
     FROM payment_requests
     WHERE engagement_id = ? ${excludeClause}`,
    params
  );

  const committed     = parseFloat(sums.committed_bills || 0);
  const pending       = parseFloat(sums.pending_bills || 0);
  const advances      = parseFloat(sums.advances_paid || 0);
  const totalExposure = committed + pending + amountRequested;
  const remaining     = contractValue - committed - pending;

  // HARD BLOCK: cumulative > contract value
  if (totalExposure > contractValue) {
    return {
      ok: false,
      error: `Total payments (₹${fmtINR(totalExposure)}) would exceed contract ₹${fmtINR(contractValue)}. ` +
             `Already committed: ₹${fmtINR(committed)}, pending: ₹${fmtINR(pending)}. ` +
             `Maximum you can request: ₹${fmtINR(Math.max(0, remaining))}.`,
      contractValue,
      committed,
      pending,
      remaining,
    };
  }

  // FLAG: request is > 50% of contract in one go (unusual for RA bills)
  let warning = null;
  if (amountRequested > contractValue * 0.5) {
    warning = `Request is ${((amountRequested / contractValue) * 100).toFixed(0)}% of contract value — confirm this is not an error`;
  }

  // FLAG: vendor historical anomaly — 3x typical bill
  const [[history]] = await db.query(
    `SELECT AVG(amount_requested) AS avg_amt
     FROM payment_requests
     WHERE engagement_id=? AND status='paid'
     AND payment_type IN ('running_account_bill','final_bill')`,
    [engagementId]
  );
  const avgBill = parseFloat(history?.avg_amt || 0);
  if (avgBill > 0 && amountRequested > avgBill * 3) {
    const pct = Math.round(amountRequested / avgBill);
    warning = (warning ? warning + '. ' : '') +
              `This request is ${pct}× this vendor's typical bill (avg ₹${fmtINR(avgBill)})`;
  }

  return {
    ok: true,
    warning,
    contractValue,
    committed,
    pending,
    advances,
    remaining,
  };
}

/**
 * Format any number as Indian currency. ALWAYS Indian lakh/crore grouping.
 * Examples:
 *   fmtINR(2500000)       → "25,00,000"
 *   fmtINR(29578355)      → "2,95,78,355"
 *   fmtINR(500)           → "500"
 *   fmtINR(null)          → "0"
 *   fmtINR(1234.5, 2)     → "1,234.50"
 */
function fmtINR(n, decimals = 0) {
  const num = typeof n === 'number' ? n : parseIndianAmount(n);
  if (num === null || !Number.isFinite(num)) return '0';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format with rupee symbol prefix. "₹25,00,000".
 */
function fmtRupee(n, decimals = 0) {
  return '₹' + fmtINR(n, decimals);
}

module.exports = {
  parseIndianAmount,
  validateAmount,
  validatePercent,
  validateQuantity,
  validateGSTRate,
  checkPaymentSanity,
  fmtINR,
  fmtRupee,
};
