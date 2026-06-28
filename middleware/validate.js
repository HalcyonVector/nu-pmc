// middleware/validate.js — Input validation layer
// Reusable validators applied at route level before any DB write
// Returns 400 with clear message if validation fails

// ── CANONICAL FORMAT PATTERNS ────────────────────────────────────────
// Single source of truth for Indian-format regex patterns. All other code
// that needs to validate these formats imports from here — no inline copies,
// no module-local redeclarations.
//
// Migration history: v5.22 consolidated 3 divergent GSTIN regexes
// (one in services/schemas.js, one in modules/onboarding/routes/vendors.js,
// and the canonical one here in middleware/validate.js).
//
// GSTIN:  state-code-01-38 + 5 letters + 4 digits + entity letter + entity-type + 'Z' + checksum
// PAN:    5 letters + 4 digits + 1 letter
// IFSC:   4 letters + '0' + 6 alphanumerics
// PHONE:  optional 91 prefix, then [6-9] + 9 digits  (Indian mobile)
// EMAIL:  RFC 5322 simplified — local@domain.tld
const GSTIN_PATTERN = /^(0[1-9]|[1-2][0-9]|3[0-8])[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_PATTERN   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_PATTERN  = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PHONE_PATTERN = /^(?:91)?[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const HSN_PATTERN   = /^\d{4,8}$/;
const DATE_PATTERN  = /^\d{4}-\d{2}-\d{2}$/;

// ── PRIMITIVE VALIDATORS ─────────────────────────────────────────────

function isPositiveNumber(val) {
  if (val === null || val === undefined || val === '') return false;
  const n = parseFloat(val);
  if (isNaN(n) || !isFinite(n) || n < 0) return false;
  // Reject strings with non-numeric trailing chars e.g. '32abc' '75%' '1,000'
  return /^-?\d+\.?\d*$/.test(String(val).trim());
}

function isPositiveInteger(val) {
  const n = parseInt(val, 10);
  return !isNaN(n) && n > 0 && String(n) === String(val).trim();
}

function isPercentage(val) {
  if (val === null || val === undefined || val === '') return false;
  // Reject strings with non-numeric chars like '75%' or '75 percent'
  if (!/^-?\d+\.?\d*$/.test(String(val).trim())) return false;
  const n = parseFloat(val);
  return !isNaN(n) && n >= 0 && n <= 100;
}

function isValidDate(val) {
  if (!DATE_PATTERN.test(val)) return false;
  const [year, month, day] = val.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  // Check the date didn't roll over (e.g. Feb 29 in non-leap year → March 1)
  return d.getFullYear() === year &&
         d.getMonth()    === month - 1 &&
         d.getDate()     === day;
}

function isValidGSTIN(val) {
  return GSTIN_PATTERN.test(val?.trim().toUpperCase());
}

function isValidPAN(val) {
  if (!val) return false;
  const trimmed = val.trim();
  // PAN must be uppercase — reject lowercase
  if (trimmed !== trimmed.toUpperCase()) return false;
  return PAN_PATTERN.test(trimmed);
}

function isValidIFSC(val) {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed !== trimmed.toUpperCase()) return false;
  return IFSC_PATTERN.test(trimmed);
}

function isValidHSN(val) {
  return !val || HSN_PATTERN.test(val.trim());
}

function isValidPhone(val) {
  if (!val) return false;
  // Strip spaces and dashes; allow only digits (no + sign in DB)
  const clean = String(val).replace(/[\s-]/g, '');
  if (!/^\d{10,15}$/.test(clean)) return false;
  // Indian numbers: 10 digits starting 6-9, OR 12 digits starting 91 + 6-9
  if (clean.length === 10) return /^[6-9]/.test(clean);
  if (clean.length === 12) return /^91[6-9]/.test(clean);
  if (clean.length === 13) return /^091[6-9]/.test(clean);
  return true;  // allow other country codes
}

function isValidEmail(val) {
  if (!val) return false;
  // RFC 5322 simplified — local@domain.tld
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(val).trim());
}

function isValidDateRange(start, end, maxYearsApart = 10) {
  if (!isValidDate(start) || !isValidDate(end)) return false;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return false;
  const yearsApart = (e - s) / (365.25 * 86400000);
  if (yearsApart > maxYearsApart) return false;
  return true;
}

function isReasonableDate(val, { pastYears = 5, futureYears = 10 } = {}) {
  // Checks date is within a sensible window (not 1905, not 2099)
  if (!isValidDate(val)) return false;
  const d = new Date(val);
  const now = new Date();
  const minDate = new Date(now.getFullYear() - pastYears, 0, 1);
  const maxDate = new Date(now.getFullYear() + futureYears, 11, 31);
  return d >= minDate && d <= maxDate;
}

function isSafeText(val, { allowNumbers = true, maxNumDensity = 0.8 } = {}) {
  // Rejects text that's suspiciously mostly numbers (e.g. vendor name = "12345")
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length === 0) return false;
  // Reject HTML tags
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return false;
  // Reject script-like content
  if (/javascript:|<script|onerror=|onclick=/i.test(trimmed)) return false;
  // If numbers not allowed, reject any digit
  if (!allowNumbers && /\d/.test(trimmed)) return false;
  // If allowed, ensure not purely numeric (typo detection)
  if (allowNumbers) {
    const digits = (trimmed.match(/\d/g) || []).length;
    const density = digits / trimmed.length;
    if (density > maxNumDensity) return false;
  }
  return true;
}

// ── FIELD VALIDATOR FACTORY ──────────────────────────────────────────

function makeValidator(rules) {
  return (req, res, next) => {
    const body   = req.body || {};
    const errors = [];

    for (const [field, checks] of Object.entries(rules)) {
      const raw = body[field];
      const val = raw !== undefined ? raw : null;

      // Required check
      if (checks.required && (val === null || val === undefined || val === '')) {
        errors.push(`${field}: required`);
        continue;
      }

      // Skip optional fields that weren't supplied
      if (!checks.required && (val === null || val === undefined || val === '')) continue;

      // Type checks
      if (checks.type === 'number' && !isPositiveNumber(val)) {
        errors.push(`${field}: must be a valid number (got "${val}")`);
      }

      if (checks.type === 'positiveInteger' && !isPositiveInteger(val)) {
        errors.push(`${field}: must be a positive whole number (got "${val}")`);
      }

      if (checks.type === 'percentage' && !isPercentage(val)) {
        errors.push(`${field}: must be between 0 and 100 (got "${val}")`);
      }

      if (checks.type === 'date' && !isValidDate(val)) {
        errors.push(`${field}: must be a valid date in YYYY-MM-DD format (got "${val}")`);
      }

      if (checks.type === 'string') {
        if (typeof val !== 'string' || val.trim() === '') {
          errors.push(`${field}: must be non-empty text`);
        }
      }

      // Length checks
      if (checks.maxLength && String(val).length > checks.maxLength) {
        errors.push(`${field}: too long — max ${checks.maxLength} characters`);
      }

      if (checks.minLength && String(val).trim().length < checks.minLength) {
        errors.push(`${field}: too short — min ${checks.minLength} characters`);
      }

      // Range checks
      if (checks.min !== undefined && parseFloat(val) < checks.min) {
        errors.push(`${field}: minimum value is ${checks.min} (got "${val}")`);
      }

      if (checks.max !== undefined && parseFloat(val) > checks.max) {
        errors.push(`${field}: maximum value is ${checks.max} (got "${val}")`);
      }

      // Enum check
      if (checks.enum && !checks.enum.includes(val)) {
        errors.push(`${field}: must be one of: ${checks.enum.join(', ')} (got "${val}")`);
      }

      // Pattern checks
      if (checks.pattern === 'gstin' && !isValidGSTIN(val)) {
        errors.push(`${field}: invalid GSTIN format (expected 15-char: e.g. 29AAAAA0000A1Z0)`);
      }

      if (checks.pattern === 'pan' && !isValidPAN(val)) {
        errors.push(`${field}: invalid PAN format (expected 10-char: e.g. AAVFN2055K)`);
      }

      if (checks.pattern === 'hsn' && !isValidHSN(val)) {
        errors.push(`${field}: invalid HSN code (must be 4-8 digits)`);
      }

      if (checks.type === 'phone' && !isValidPhone(val)) {
        errors.push(`${field}: invalid phone number (got "${val}") — use 10-15 digits, no + sign`);
      }

      if (checks.type === 'email' && !isValidEmail(val)) {
        errors.push(`${field}: invalid email format (got "${val}")`);
      }

      if (checks.type === 'reasonableDate' && !isReasonableDate(val, checks.dateRange)) {
        errors.push(`${field}: date out of reasonable range (got "${val}")`);
      }

      if (checks.type === 'safeText' && !isSafeText(val, checks.textOpts)) {
        if (val && /<[a-z]/i.test(val)) errors.push(`${field}: HTML tags not allowed`);
        else if (val && /^\d+$/.test(String(val).trim())) errors.push(`${field}: cannot be just numbers (got "${val}")`);
        else errors.push(`${field}: invalid text (got "${val}")`);
      }
    }

    // Cross-field: date range validation (start < end)
    if (rules._dateRange) {
      const { start, end, maxYears } = rules._dateRange;
      const sVal = body[start];
      const eVal = body[end];
      if (sVal && eVal && !isValidDateRange(sVal, eVal, maxYears || 10)) {
        errors.push(`${end} must be after ${start} and within ${maxYears || 10} years`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error:  'Validation failed',
        fields: errors
      });
    }

    next();
  };
}

// ── PREDEFINED VALIDATORS FOR EACH MODULE ────────────────────────────

const validators = {

  // Schedule task update — Interpretation B: daily plan %
  taskUpdate: makeValidator({
    task_id:     { required: true,  type: 'positiveInteger' },
    pct_complete:{ required: true,  type: 'percentage' },
    report_date: { required: true,  type: 'date' },
    notes:       { required: false, type: 'string', maxLength: 500 },
  }),

  // Material request
  materialRequest: makeValidator({
    boq_item_id:    { required: true,  type: 'positiveInteger' },
    quantity_needed:{ required: true,  type: 'number', min: 0.001 },
    needed_by_date: { required: true,  type: 'date' },
    notes:          { required: false, type: 'string', maxLength: 300 },
  }),

  // Vendor BOQ item
  vendorBOQItem: makeValidator({
    boq_item_id:   { required: true,  type: 'positiveInteger' },
    our_cost_rate: { required: true,  type: 'number', min: 0 },
  }),

  // Non-BOQ vendor item
  nonBOQItem: makeValidator({
    project_id:    { required: true,  type: 'positiveInteger' },
    description:   { required: true,  type: 'string', maxLength: 300 },
    unit:          { required: true,  type: 'string', maxLength: 30 },
    quantity:      { required: false, type: 'number', min: 0.001 },
    our_cost_rate: { required: false, type: 'number', min: 0 },
    category:      { required: false, enum: ['site_overhead','temporary_works','extra_item','other'] },
  }),

  // Vendor payment request
  paymentRequest: makeValidator({
    payment_type:     { required: true, enum: ['advance','running_account_bill','final_bill','retention_release'] },
    amount_requested: { required: true, type: 'number', min: 1 },
    week_ending:      { required: true, type: 'date' },
    notes:            { required: false, type: 'string', maxLength: 500 },
  }),

  // Client BOQ rate
  clientBOQRate: makeValidator({
    client_rate: { required: true, type: 'number', min: 0 },
  }),

  // HSN code
  hsnCode: makeValidator({
    hsn_code: { required: false, pattern: 'hsn' },
  }),

  // Measurement record
  measurement: makeValidator({
    ra_bill_number:   { required: true,  type: 'string', maxLength: 20 },
    discipline:       { required: true,  type: 'string', maxLength: 50 },
    measurement_date: { required: true,  type: 'date' },
    notes:            { required: false, type: 'string', maxLength: 500 },
  }),

  // Measurement items
  measurementItem: (req, res, next) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array required' });
    }
    const errors = [];
    items.forEach((item, i) => {
      if (!isPositiveInteger(item.client_boq_item_id)) {
        errors.push(`items[${i}].client_boq_item_id: must be a valid ID`);
      }
      if (!isPositiveNumber(item.measured_qty)) {
        errors.push(`items[${i}].measured_qty: must be a valid number (got "${item.measured_qty}")`);
      }
    });
    if (errors.length) return res.status(400).json({ error: 'Validation failed', fields: errors });
    next();
  },

  // Client claim
  clientClaim: makeValidator({
    ra_bill_number: { required: true,  type: 'string', maxLength: 20 },
    discipline:     { required: true,  type: 'string', maxLength: 50 },
  }),

  // Client master
  clientMaster: makeValidator({
    client_name: { required: true,  type: 'safeText', maxLength: 200, textOpts: { allowNumbers: true, maxNumDensity: 0.3 } },
    gstin:       { required: true,  pattern: 'gstin' },
    state_code:  { required: false, type: 'positiveInteger', min: 1, max: 38 },
    state_name:  { required: false, type: 'safeText', maxLength: 50, textOpts: { allowNumbers: false } },
    pan:         { required: false, pattern: 'pan' },
    payment_terms_days: { required: false, type: 'positiveInteger', min: 1, max: 365 },
  }),

  // Project creation
  project: makeValidator({
    code:           { required: true,  type: 'string', maxLength: 20 },
    name:           { required: true,  type: 'safeText', maxLength: 200 },
    client:         { required: true,  type: 'safeText', maxLength: 200 },
    r0_start_date:  { required: true,  type: 'reasonableDate' },
    r0_end_date:    { required: true,  type: 'reasonableDate' },
    _dateRange:     { start: 'r0_start_date', end: 'r0_end_date', maxYears: 10 },
  }),

  // Change notice
  changeNotice: makeValidator({
    title:       { required: true,  type: 'string', maxLength: 200 },
    description: { required: true,  type: 'string', maxLength: 2000 },
    source:      { required: false, enum: ['client','design','site','statutory'] },
    schedule_impact_days: { required: false, type: 'number', min: 0, max: 365 },
  }),

  // Drawing query
  drawingQuery: makeValidator({
    question: { required: true, type: 'string', minLength: 10, maxLength: 1000 },
  }),

  // Invoice number
  invoiceNumber: makeValidator({
    invoice_number: { required: true, type: 'string', maxLength: 50 },
    invoice_date:   { required: false, type: 'date' },
  }),


  // User creation
  userCreate: makeValidator({
    username:  { required: true,  type: 'string', minLength: 2, maxLength: 50 },
    full_name: { required: true,  type: 'safeText', maxLength: 100, textOpts: { allowNumbers: true, maxNumDensity: 0.3 } },
    role:      { required: true,  enum: ['principal','design_principal','design_head','team_lead','services_head','jr_architect','jr_engineer','services_engineer','coordinator','pmc_head','site_manager','senior_site_manager','finance_admin','trainee','audit','it_admin','detailing'] },
    phone:     { required: false, type: 'phone' },
    email:     { required: false, type: 'email' },
    stream:    { required: false, enum: ['design','services','pmc','site','all'] },
  }),

  // Vendor master
  vendorMaster: makeValidator({
    vendor_name:   { required: true, type: 'safeText', maxLength: 200, textOpts: { allowNumbers: true, maxNumDensity: 0.3 } },
    trade:         { required: true, type: 'string', maxLength: 50 },
    contact_person:{ required: false, type: 'safeText', maxLength: 100, textOpts: { allowNumbers: false } },
    phone:         { required: false, type: 'phone' },
    email:         { required: false, type: 'email' },
    gstin:         { required: false, pattern: 'gstin' },
    pan:           { required: false, pattern: 'pan' },
    bank_account:  { required: false, type: 'string', minLength: 8, maxLength: 20 },
    bank_ifsc:     { required: false, type: 'string', minLength: 11, maxLength: 11 },
  }),

  // Client receipt
  clientReceipt: makeValidator({
    pi_id:           { required: true, type: 'positiveInteger' },
    receipt_date:    { required: true, type: 'reasonableDate' },
    amount_received: { required: true, type: 'number', min: 1 },
    tds_deducted:    { required: false, type: 'number', min: 0 },
    utr:             { required: false, type: 'string', maxLength: 50 },
  }),

  // Vendor engagement
  vendorEngagement: makeValidator({
    vendor_id:      { required: true, type: 'positiveInteger' },
    scope:          { required: true, type: 'string', minLength: 10, maxLength: 500 },
    contract_value: { required: false, type: 'number', min: 0, max: 1e11 },
  }),

  // GRN
  grn: makeValidator({
    engagement_id:     { required: true,  type: 'positiveInteger' },
    delivery_date:     { required: true,  type: 'reasonableDate' },
    description:       { required: true,  type: 'string', minLength: 5, maxLength: 500 },
    quantity_received: { required: true,  type: 'number', min: 0.001 },
    unit:              { required: true,  type: 'string', maxLength: 30 },
    unit_rate:         { required: false, type: 'number', min: 0 },
    delivery_note_ref: { required: false, type: 'string', maxLength: 50 },
  }),

  // Issue / NCR
  issue: makeValidator({
    issue_type:  { required: true, enum: ['safety','quality','design','schedule','other'] },
    title:       { required: true, type: 'string', minLength: 5, maxLength: 200 },
    description: { required: true, type: 'string', minLength: 10, maxLength: 2000 },
    location:    { required: false, type: 'string', maxLength: 200 },
    due_date:    { required: false, type: 'reasonableDate' },
  }),

  // MOM
  momCreate: makeValidator({
    meeting_date:     { required: true,  type: 'reasonableDate' },
    meeting_type:     { required: true,  enum: ['design_coordination','client_review','site_inspection','statutory','internal','site_review','other'] },
    attendees:        { required: false, type: 'string', maxLength: 1000 },
    venue:            { required: false, type: 'string', maxLength: 200 },
    agenda:           { required: false, type: 'string', maxLength: 2000 },
  }),

  // Schedule task update (post-body)
  scheduleUpdate: makeValidator({
    task_id:           { required: true,  type: 'positiveInteger' },
    pct_complete:      { required: true,  type: 'percentage' },
    notes:             { required: false, type: 'string', maxLength: 500 },
    regression_reason: { required: false, type: 'string', maxLength: 300 },
  }),
};

module.exports = { validators, makeValidator,
  // Canonical regex patterns — import these instead of redeclaring
  GSTIN_PATTERN, PAN_PATTERN, IFSC_PATTERN, PHONE_PATTERN, EMAIL_PATTERN,
  HSN_PATTERN, DATE_PATTERN,
  isPositiveNumber, isPositiveInteger, isPercentage, isValidDate,
  isValidGSTIN, isValidPAN, isValidIFSC, isValidHSN,
  isValidPhone, isValidEmail, isValidDateRange, isReasonableDate, isSafeText };
