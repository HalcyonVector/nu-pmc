// scripts/add-money-checks.js
// Adds CHECK constraints to enforce money sanity at the DB level.
// Each CHECK is idempotent — re-running is safe (uses CONSTRAINT names).

const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'schema.sql');
let sql = fs.readFileSync(FILE, 'utf8');

const CHECKS = [
  // payment_requests — amount_requested must be > 0
  ['payment_requests',  'chk_pr_amount',         'amount_requested > 0'],
  ['payment_requests',  'chk_pr_pmc_amount',     'pmc_amount IS NULL OR pmc_amount > 0'],
  ['payment_requests',  'chk_pr_actual_paid',    'actual_paid IS NULL OR actual_paid >= 0'],
  ['payment_requests',  'chk_pr_gst',            'gst_rate BETWEEN 0 AND 50'],
  ['payment_requests',  'chk_pr_work_pct',       'work_done_pct IS NULL OR (work_done_pct BETWEEN 0 AND 100)'],

  // vendor_engagements — contract value non-negative
  ['vendor_engagements','chk_ve_contract',       'contract_value IS NULL OR contract_value >= 0'],

  // vendor_payments — actuals must be non-negative
  ['vendor_payments',   'chk_vp_amount',         'actual_amount IS NULL OR actual_amount >= 0'],

  // proforma_invoices — ex-GST amount must be > 0, GST sensible, total ≥ ex
  ['proforma_invoices', 'chk_pi_amount_ex',      'amount_ex_gst > 0'],
  ['proforma_invoices', 'chk_pi_gst',            'gst_pct BETWEEN 0 AND 50'],
  ['proforma_invoices', 'chk_pi_amount_total',   'amount_total >= amount_ex_gst'],

  // change_notices — values non-negative, revised differs from previous conceptually
  ['change_notices',    'chk_cn_prev',           'previous_value >= 0'],
  ['change_notices',    'chk_cn_revised',        'revised_value >= 0'],

  // budget_cost_heads — sanctioned non-negative
  ['budget_cost_heads', 'chk_bch_sanctioned',    'sanctioned >= 0'],

  // grns — quantity must be positive
  ['grns',              'chk_grn_qty',           'quantity > 0'],

  // measurements — sqft_area non-negative if set
  ['measurements',      'chk_m_sqft',            'sqft_area IS NULL OR sqft_area >= 0'],

  // claim_items — previous_amount / revised_amount non-negative
  ['claim_items',       'chk_ci_prev',           'previous_amount >= 0'],
  ['claim_items',       'chk_ci_rev',            'revised_amount >= 0'],
];

let added = 0, skipped = 0;
for (const [table, name, expr] of CHECKS) {
  const tableRe = new RegExp('(CREATE TABLE ' + table + '\\s*\\([\\s\\S]*?)(\\n\\) ENGINE=InnoDB)', 'm');
  const m = sql.match(tableRe);
  if (!m) { console.warn('  SKIP — no table:', table); skipped++; continue; }
  if (m[1].includes('CONSTRAINT ' + name)) { skipped++; continue; }  // already added
  sql = sql.replace(tableRe, (full, body, end) =>
    body.replace(/\n$/, '') + `,\n  CONSTRAINT ${name} CHECK (${expr})` + end
  );
  added++;
}

fs.writeFileSync(FILE, sql);
console.log(`── CHECK constraints: ${added} added, ${skipped} already present ──`);
