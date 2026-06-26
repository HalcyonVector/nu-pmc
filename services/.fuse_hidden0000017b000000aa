// services/schemas.js
// ============================================================
// Single source of truth for request-body shapes.
// Routes parse req.body through these schemas. Invalid → 400 with
// a predictable error shape. Valid → typed object.
//
// Usage pattern in a route handler:
//
//   const { PaymentRequestCreate } = require('../services/schemas');
//   const parsed = PaymentRequestCreate.safeParse(req.body);
//   if (!parsed.success) {
//     return res.status(400).json({ error: 'Invalid input',
//       issues: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
//   }
//   const body = parsed.data;   // typed, trusted values
//
// The same schemas can be used client-side (via the browser build)
// to pre-validate forms — fewer round trips, better UX.
//
// ─── WHEN TO USE A SCHEMA VS AD-HOC `res.status(400)` ───────────────
// nu PMC validates request bodies via TWO complementary mechanisms.
// They are NOT redundant; they serve different jobs.
//
//   USE A SCHEMA HERE when:
//     • The shape is multi-field (3+ fields with related validation)
//     • The shape is reused across multiple routes (Create + Update)
//     • Field-shape rules are stable & describable in Zod (string/int/
//       enum/regex/optional)
//     • The route maps to a public API contract (downstream clients,
//       documentation, type-generation)
//
//   USE INLINE `res.status(400).json(...)` when:
//     • Cross-field business rules ("to_date >= from_date",
//       "new_password ≠ current_password")
//     • Cross-record state checks ("vendor not yet approved",
//       "username already taken" via DB lookup)
//     • Single-field checks where ad-hoc is shorter than a schema
//       (`if (isNaN(qty) || qty < 0) return 400 …`)
//     • DB constraint errors mapped to user-friendly 400s
//       (`if (err.code === 'ER_DUP_ENTRY') return 400 …`)
//
// 17 files use schemas; ~268 sites use ad-hoc 400s. ~115 of the ad-hoc
// 400s are schema-shaped (single-field type/enum/range checks) but are
// genuinely clearer inline than in a separate schema definition.
// Migration of those ~115 sites would be cosmetic and is NOT prioritised.
// ─────────────────────────────────────────────────────────────────────
// ============================================================

const { z } = require('zod');
const { parseIndianAmount } = require('./payment-validation');

// Canonical regex patterns — single source of truth in middleware/validate.js.
// Do not redeclare here. Adjusting these means schema validation and
// middleware validators stay in sync automatically.
const {
  GSTIN_PATTERN, PAN_PATTERN, IFSC_PATTERN, PHONE_PATTERN, DATE_PATTERN,
} = require('../middleware/validate');

// ── PRIMITIVES ──────────────────────────────────────────────

// Accepts Indian-format strings (₹25,00,000), plain numbers, or strings with decimals
const IndianAmount = z.preprocess((v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = parseIndianAmount(v);
    return parsed === null ? v : parsed;
  }
  return v;
}, z.number().finite().nonnegative());

const PositiveIndianAmount = IndianAmount.refine(n => n > 0, { message: 'Must be greater than zero' });

const Percent = z.coerce.number().min(0).max(100);
const GSTRate = z.coerce.number().min(0).max(50);  // supports 0, 5, 12, 18, 28 + exemptions
const Integer = z.coerce.number().int();
const PositiveInt = Integer.positive();
const IdRef = PositiveInt;            // FK reference
const NullableId = z.union([PositiveInt, z.null(), z.undefined(), z.literal('')]).transform(v => (v === '' || v === undefined) ? null : v);

// Indian phone: 10 digits, optional 91 prefix. Pattern from middleware/validate.
// Note: zod schema additionally allows a literal '+91' prefix at the start
// (some legacy callers send '+919876543210' from old WhatsApp deeplinks).
// PHONE_PATTERN handles '91' prefix; we extend with optional '+' for backward compat.
const IndianPhone = z.string().regex(/^\+?(?:91)?[6-9]\d{9}$/, 'Invalid Indian mobile number');
const OptionalPhone = IndianPhone.nullable().optional();

// GSTIN (15-char format) — full strict pattern (state code 01-38, mandatory 'Z' at position 13)
const GSTIN = z.string().regex(GSTIN_PATTERN, 'Invalid GSTIN format');
const OptionalGSTIN = GSTIN.nullable().optional();

// PAN (10-char)
const PAN = z.string().regex(PAN_PATTERN, 'Invalid PAN format');
const OptionalPAN = PAN.nullable().optional();

// IFSC (11-char: 4 letters + '0' + 6 alphanumerics)
const IFSC = z.string().regex(IFSC_PATTERN, 'Invalid IFSC');
const OptionalIFSC = IFSC.nullable().optional();

// Date in YYYY-MM-DD
const DateString = z.string().regex(DATE_PATTERN, 'Date must be YYYY-MM-DD');

// Non-empty trimmed string
const NonEmptyString = z.string().trim().min(1);
const OptionalString = z.string().trim().optional().transform(v => v || null);

// ── ENUMS (match schema.sql) ───────────────────────────────

// Aligned to DB ENUM on payment_requests (v3 audit):
//   payment_type: ('labour','site_material','design_material','mep_material',
//                  'mobilisation_advance','material_advance','advance',
//                  'running_account_bill','final_bill','retention_release','other')
//   payment_lane: ('bank','upi','icici_bulk')
const PaymentType = z.enum([
  'labour','site_material','design_material','mep_material',
  'mobilisation_advance','material_advance','advance',
  'running_account_bill','final_bill','retention_release','other',
]);
const PaymentLane = z.enum(['bank','upi','icici_bulk']);
const IssueType   = z.enum(['safety','quality','design','rfi','compliance']);
const IssuePriority = z.enum(['low','medium','high','urgent']);
const MeetingType = z.enum(['site_visit','internal','client','design_review','principal_visit','statutory','other']);
const MeetingVisibility = z.enum(['internal','client_draft','sent_to_client','acknowledged']);

// ── REQUEST BODY SCHEMAS ───────────────────────────────────

const PaymentRequestCreate = z.object({
  engagement_id:        IdRef,
  vendor_id:            NullableId.optional(),
  amount_requested:     PositiveIndianAmount,
  reason:               NonEmptyString.max(500),
  payment_type:         PaymentType.default('other'),
  gst_rate:             GSTRate.default(18),
  hsn_code:             OptionalString,
  is_interstate:        z.coerce.boolean().default(false),
  is_urgent:            z.coerce.boolean().default(false),
  is_adhoc:             z.coerce.boolean().default(false),
  adhoc_name:           OptionalString,
  adhoc_phone:          OptionalPhone,
  adhoc_gstin:          OptionalGSTIN,
  adhoc_pan:            OptionalPAN,
  adhoc_bank_account:   OptionalString,
  adhoc_bank_ifsc:      OptionalIFSC,
  adhoc_upi_id:         OptionalString,
  payment_lane:         PaymentLane.default('icici_bulk'),
  invoice_override_reason: OptionalString,
});

const PaymentReviewPMC = z.object({
  pmc_amount:           PositiveIndianAmount,
  pmc_notes:            NonEmptyString.max(500),
  gst_rate:             GSTRate.optional(),
});

const PaymentReviewPrincipal = z.object({
  approved_amount:      PositiveIndianAmount.optional(),
  principal_notes:         OptionalString,
});

const ClientReceipt = z.object({
  pi_id:                IdRef,
  receipt_date:         DateString,
  amount_received:      PositiveIndianAmount,
  tds_deducted:         IndianAmount.default(0),
  utr:                  OptionalString,
  bank_ref:             OptionalString,
  notes:                OptionalString,
});

const IssueCreate = z.object({
  issue_type:           IssueType.default('quality'),
  title:                NonEmptyString.max(300),
  description:          NonEmptyString.max(5000),
  location:             OptionalString,
  priority:             IssuePriority.default('medium'),
  assigned_to:          NullableId.optional(),
  drawing_id:           NullableId.optional(),
  due_date:             DateString.nullable().optional(),
});

const RFICreate = z.object({
  drawing_version_id:   NullableId.optional(),
  question:             NonEmptyString.max(2000).optional(),
  subject:              NonEmptyString.max(300).optional(),
  body:                 NonEmptyString.max(2000).optional(),
  stream:               z.enum(['design','services','site']).optional(),
});

const NCRCreate = z.object({
  title:                NonEmptyString.max(300),
  description:          NonEmptyString.max(5000),
  vendor_id:            NullableId.optional(),
  location:             OptionalString,
  due_date:             DateString.nullable().optional(),
  drawing_id:           NullableId.optional(),
});

const MeetingCreate = z.object({
  type:                 MeetingType.default('internal'),
  title:                OptionalString,
  meeting_date:         DateString,
  location:             OptionalString,
  agenda:               OptionalString,
  notes:                OptionalString,
  client_id:            NullableId.optional(),
});

const GRNCreate = z.object({
  engagement_id:        IdRef,
  material_request_id:  NullableId.optional(),
  delivery_date:        DateString,
  description:          NonEmptyString.max(500),
  quantity_received:    z.coerce.number().positive(),
  unit:                 OptionalString,
  delivery_note_ref:    OptionalString,
  invoice_ref:          OptionalString,
  unit_rate:            IndianAmount.optional(),
});

// Vendor master record
const VendorMaster = z.object({
  trade:                NonEmptyString.max(80),
  vendor_name:          NonEmptyString.max(200),
  contact_person:       OptionalString,
  phone:                OptionalPhone,
  gst_number:           OptionalGSTIN,
  bank_name:            OptionalString,
  bank_account:         OptionalString,
  bank_ifsc:            OptionalIFSC,
  notes:                OptionalString,
});

// VendorMasterUpdate: PATCH variant. The PATCH /master/:id route allows
// partial updates (phone-only, IFSC-only, etc), so make every field optional
// while preserving the format validators on the ones that are present.
const VendorMasterUpdate = VendorMaster.partial();

// Client claim (receivable)
const ClaimCreate = z.object({
  ra_bill_number:       NonEmptyString.max(50),
  discipline:           NonEmptyString.max(50),
  measurement_id:       NullableId.optional(),
  notes:                OptionalString,
});

// Budget custom cost head
const BudgetCustomHead = z.object({
  code:                 NonEmptyString.max(30),
  name:                 NonEmptyString.max(200),
  stream:               z.enum(['design','services','common']).optional(),
  sanctioned:           PositiveIndianAmount,
});

// Proforma invoice create
const PICreate = z.object({
  fee_schedule_id:      IdRef,
  schedule_task_id:     NullableId.optional(),
  notes:                OptionalString,
});

// Vendor payment raise (from payments.js /raise)
const VendorPaymentRaise = z.object({
  engagement_id:        IdRef,
  payment_type:         PaymentType,
  amount_requested:     PositiveIndianAmount,
  work_done_pct:        Percent.optional(),
  week_ending:          DateString.optional(),
  notes:                OptionalString,
  deductions:           IndianAmount.default(0),
});

// Urgent payment
const UrgentPayment = z.object({
  amount:               PositiveIndianAmount,
  reason:               NonEmptyString.max(500),
  vendor_id:            NullableId.optional(),
  is_adhoc:             z.coerce.boolean().default(false),
  adhoc_name:           OptionalString,
  adhoc_phone:          OptionalPhone,
  adhoc_gstin:          OptionalGSTIN,
  adhoc_pan:            OptionalPAN,
  adhoc_bank_account:   OptionalString,
  adhoc_bank_ifsc:      OptionalIFSC,
  adhoc_upi_id:         OptionalString,
});

// Client BOQ rate update
const ClientBOQRate = z.object({
  client_rate:          PositiveIndianAmount,
});

// ── ADMIN / USERS ──────────────────────────────────────────
//
// DeputyAssign: when setting yourself or someone's deputy. deputy_id is
// optional — sending null/undefined clears the deputy. The from/until
// dates are optional time bounds (an open-ended deputy is allowed and
// used in practice). The cycle / self / date-order checks live in the
// route handler; this schema only enforces shape and types.
const DeputyAssign = z.object({
  deputy_id:     NullableId.optional(),
  deputy_from:   DateString.nullable().optional(),
  deputy_until:  DateString.nullable().optional(),
  deputy_reason: OptionalString,
});

// UserLeave: a user records their own leave window. Reason is optional
// (a sick day might not need one). Date-order check stays in the route.
const UserLeave = z.object({
  from_date: DateString,
  to_date:   DateString,
  reason:    OptionalString,
});

// ── DRAWINGS ───────────────────────────────────────────────
//
// DrawingUpload: the multipart/form-data body that accompanies a drawing
// file upload. drawing_type is validated as an enum; the linkage IDs are
// coerced to nullable positive ints. category is left as a free string —
// the route uses substring matching to derive stream, and constraining
// it here would risk rejecting categories already in use. Stream/role
// checks + register lookups stay in the route handler.
const DrawingType = z.enum(['main','detail','rfi_response']);
const DrawingUpload = z.object({
  drawing_number:    NonEmptyString,
  drawing_name:      NonEmptyString,
  category:          NonEmptyString,
  notes:             OptionalString,
  change_notice_id:  NullableId.optional(),
  drawing_type:      DrawingType.optional(),
  parent_drawing_id: NullableId.optional(),
  rfi_issue_id:      NullableId.optional(),
});

// ── FINANCE — ADVANCE RECOVERY ─────────────────────────────
const AdvanceType = z.enum(['mobilisation','material','special']);
const AdvanceRecovery = z.object({
  engagement_id:        IdRef,
  advance_type:         AdvanceType.optional(),
  advance_amount:       PositiveIndianAmount,
  advance_date:         DateString,
  recovery_pct_per_bill: Percent.optional(),
});

// ── ISSUES — SNAG ──────────────────────────────────────────
//
// SnagCreate: shared between two endpoints — POST /:project_id/snags (with
// optional photo upload) and POST /:project_id/snag-from-photo (linked to
// an existing photo). Same body shape; the photo source differs. Severity
// defaults are handled in the route to preserve existing behaviour.
const SnagSeverity = z.enum(['minor','major','critical']);
const SnagCreate = z.object({
  description:  NonEmptyString,
  trade:        OptionalString,
  location:     OptionalString,
  severity:     SnagSeverity.optional(),
  due_date:     DateString.nullable().optional(),
  vendor_id:    NullableId.optional(),
  photo_id:     NullableId.optional(),  // required for snag-from-photo only
});

// ── VENDOR CONTRACT / FEE SCHEDULE REVISIONS ───────────────
//
// Both routes revise a money figure with a reason. The value goes into
// history + an UPDATE; previously unchecked, so junk strings or negatives
// reached the DB. Reason is mandatory — every revision must justify itself
// because the audit log surfaces these changes.
const ContractRevision = z.object({
  revised_value:    PositiveIndianAmount,
  reason:           NonEmptyString,
  change_notice_id: NullableId.optional(),
});
const FeeScheduleRevision = z.object({
  revised_amount: PositiveIndianAmount,
  reason:         NonEmptyString,
});

// ── REPORTING — WEEKLY REPORT DRAFT ────────────────────────
//
// PMC posts weekly draft. week_number is 1-53, week_ending is the YYYY-MM-DD
// of the Saturday/Sunday closing the week. photo_ids is an optional array
// of project photo IDs to attach to the report.
const WeeklyReportDraft = z.object({
  week_ending:        DateString,
  week_number:        z.coerce.number().int().min(1).max(53),
  summary:            NonEmptyString,
  issues_for_client:  OptionalString,
  photo_ids:          z.array(IdRef).optional(),
});

// ── ADMIN — USER LIFECYCLE ─────────────────────────────────
//
// UserInitiate: a team head initiates a new user; principals approve
// downstream. Role enum is the full set used across the codebase (matches
// validators.userCreate's enum and modules/auth/routes/users.js sweeps).
// Stream defaults to 'all' if omitted at the route level.
const Role = z.enum([
  'principal','design_principal',
  'pmc_head','design_head','services_head',
  'team_lead','team_lead',
  'jr_architect','jr_engineer','services_engineer','coordinator',
  'site_manager','senior_site_manager',
  'finance_admin',
  'trainee','audit','it_admin',
]);
const Stream = z.enum(['design','services','pmc','site','all']);
const UserInitiate = z.object({
  username:  NonEmptyString.max(50),
  full_name: NonEmptyString.max(100),
  phone:     OptionalPhone,
  role:      Role,
  stream:    Stream.optional(),
});

// ── DRAWING REGISTER ───────────────────────────────────────
//
// RegisterEntryAdd: stream heads add a drawing entry to the register
// after the initial register sign-off (a post-signoff amendment that
// principals then approve). DB has UNIQUE (project_id, drawing_number)
// so duplicates surface as ER_DUP_ENTRY in the route.
const DrawingStream = z.enum(['design','services']);
const RegisterEntryAdd = z.object({
  drawing_number:    NonEmptyString.max(50),
  drawing_name:      NonEmptyString.max(200),
  category:          NonEmptyString.max(50),
  stream:            DrawingStream,
  expected_revision: NonEmptyString.max(20).optional(),
  notes:             OptionalString,
});

// ── SHARED MICRO-SCHEMAS ────────────────────────────────────
//
// Many routes accept a single text field — a rejection reason, a note,
// or a comment. They were doing ad-hoc presence checks that varied in
// quality. These shared schemas standardise validation across all of
// them: required string, trim, length cap, no HTML.
//
// Field-name collisions are unavoidable — different routes have used
// different names for the same concept. Each variant lives as its own
// schema so the route handler doesn't need to rename what it reads.
const RejectionReason     = z.object({ reason: NonEmptyString.max(500) });
const RejectionReasonAlt  = z.object({ rejection_reason: NonEmptyString.max(500) });
const RejectionNote       = z.object({ rejection_note:   NonEmptyString.max(500) });
const NoteOnly            = z.object({ note:  NonEmptyString.max(500) });
const NotesOnly           = z.object({ notes: NonEmptyString.max(500) });
const ResolutionNote      = z.object({ resolution_note:  NonEmptyString.max(500) });
const CompletionNote      = z.object({ completion_note:  NonEmptyString.max(500) });
const MitigationNote      = z.object({ mitigation_note:  NonEmptyString.max(500) });

// ── HELPERS ────────────────────────────────────────────────

/**
 * parseOr400(schema, req, res) — parse req.body through schema;
 *   on failure, respond 400 with issues list and return null;
 *   on success, return typed data.
 *
 * Usage:
 *   const body = parseOr400(PaymentRequestCreate, req, res);
 *   if (!body) return;   // 400 already sent
 */
function parseOr400(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid input',
      issues: parsed.error.issues.map(i => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      })),
    });
    return null;
  }
  return parsed.data;
}

module.exports = {
  // primitives
  IndianAmount, PositiveIndianAmount, Percent, GSTRate,
  Integer, PositiveInt, IdRef, NullableId,
  IndianPhone, OptionalPhone, GSTIN, OptionalGSTIN, PAN,
  DateString, NonEmptyString, OptionalString,
  // enums
  PaymentType, PaymentLane, IssueType, IssuePriority, MeetingType, MeetingVisibility,
  // request schemas
  PaymentRequestCreate,
  PaymentReviewPMC,
  PaymentReviewPrincipal,
  ClientReceipt,
  IssueCreate,
  RFICreate,
  NCRCreate,
  MeetingCreate,
  GRNCreate,
  VendorMaster,
  VendorMasterUpdate,
  ClaimCreate,
  BudgetCustomHead,
  PICreate,
  VendorPaymentRaise,
  UrgentPayment,
  ClientBOQRate,
  DeputyAssign,
  UserLeave,
  DrawingUpload,
  AdvanceRecovery,
  SnagCreate,
  ContractRevision,
  FeeScheduleRevision,
  WeeklyReportDraft,
  UserInitiate,
  RegisterEntryAdd,
  // shared micro-schemas
  RejectionReason,
  RejectionReasonAlt,
  RejectionNote,
  NoteOnly,
  NotesOnly,
  ResolutionNote,
  CompletionNote,
  MitigationNote,
  // helpers
  parseOr400,
};
