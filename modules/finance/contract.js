// modules/finance/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// M5 FINANCE MODULE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// Owns the money side of nu PMC:
//   - Vendor payment workflow (request → PMC approve → principal approve → pay)
//   - Budget planning + variance tracking
//   - Client billing (fee schedule, proforma invoices, claims)
//   - Statutory (GST statement, TDS tracking)
//   - Petty cash + principal direct payments + client receipts
//   - BOQ mapping (client BOQ ↔ vendor engagement pricing)
//
// Major cross-module read: Site module's getApprovedGRNs(), to raise payments
// only against delivered material.
// ═══════════════════════════════════════════════════════════════════════════

const db = require('../../middleware/db');

module.exports = {
  version: '1.0.0',

  // ── FUNCTIONS (async helpers other modules may call) ────────────────────
  functions: {
    /** Pending payment requests for dashboard counters / audit. */
    async getPaymentsPendingApproval(projectId) {
      const [rows] = await db.query(
        `SELECT pr.id, pr.project_id, pr.vendor_id, pr.engagement_id,
                pr.amount_requested, pr.reason, pr.payment_type, pr.status,
                pr.requested_by, pr.raised_at,
                v.vendor_name
         FROM payment_requests pr
         LEFT JOIN vendors v ON pr.vendor_id = v.id
         WHERE pr.project_id = ?
           AND pr.status IN ('pending_pmc', 'pmc_approved')
         ORDER BY pr.raised_at DESC`,
        [projectId]
      );
      return rows;
    },

    /** Specific payment request by id — for audit, receipts, linking. */
    async getPaymentByRequestId(requestId) {
      const [rows] = await db.query(
        `SELECT pr.*, v.vendor_name
         FROM payment_requests pr
         LEFT JOIN vendors v ON pr.vendor_id = v.id
         WHERE pr.id = ?`,
        [requestId]
      );
      return rows[0] || null;
    },

    /** Project budget summary — used by reporting + project health.
     *  Budget cost heads use `code` (trade identifier), `name` (human-readable),
     *  and `sanctioned` (budgeted amount). */
    async getProjectBudget(projectId) {
      const [rows] = await db.query(
        `SELECT id, project_id, code, name, sanctioned, status,
                created_by, created_at
         FROM budget_cost_heads
         WHERE project_id = ?
         ORDER BY display_order, code`,
        [projectId]
      );
      return rows;
    },

    /**
     * Budget variance — sanctioned vs actual spend.
     * Actual spend is the sum of approved/paid vendor payments joined to cost heads
     * through the engagement's BOQ items (bi.trade = bch.code).
     */
    async getBudgetVariance(projectId) {
      const [rows] = await db.query(
        `SELECT bch.code AS cost_head,
                bch.name,
                bch.sanctioned AS allocated,
                COALESCE(
                  (SELECT SUM(vp.recommended_amount)
                   FROM vendor_payments vp
                   JOIN vendor_engagements ve ON vp.engagement_id = ve.id
                   WHERE ve.project_id = bch.project_id
                     AND vp.status IN ('paid','approved')
                     AND EXISTS (
                       SELECT 1 FROM vendor_boq_items vbi
                       JOIN boq_items bi ON vbi.boq_item_id = bi.id
                       WHERE vbi.engagement_id = ve.id AND bi.trade = bch.code
                     )), 0
                ) AS actual
         FROM budget_cost_heads bch
         WHERE bch.project_id = ? AND bch.status = 'approved'
         ORDER BY bch.display_order, bch.code`,
        [projectId]
      );
      return rows;
    },

    /** Client receipts (money in) for a project — for reconciliation. */
    async getClientReceipts(projectId) {
      const [rows] = await db.query(
        `SELECT id, project_id, amount_received, tds_deducted, net_received,
                receipt_date, utr, bank_ref, notes, recorded_by, recorded_at
         FROM client_receipts
         WHERE project_id = ?
         ORDER BY receipt_date DESC`,
        [projectId]
      );
      return rows;
    },
  },

  // ── ROUTE MOUNTS (server.js uses these) ─────────────────────────────────
  routes: {
    payments:         require('./routes/payments'),
    paymentRequests:  require('./routes/payment-requests'),
    invoices:         require('./routes/invoices'),
    budget:           require('./routes/budget'),
    claims:           require('./routes/claims'),
    finance:          require('./routes/finance'),
    gstStatement:     require('./routes/gst-statement'),
    piGenerator:      require('./routes/pi-generator'),
    urgentPayments:   require('./routes/urgent-payments'),
    boqMapping:       require('./routes/boq-mapping'),
    vendorDocuments:  require('./routes/vendor-documents'),
    externalComms:    require('./routes/external-comms'),
  },

  // ── TABLES OWNED BY THIS MODULE ─────────────────────────────────────────
  tables: [
    'payment_requests',
    'payment_request_evidence',
    'vendor_payments',
    'vendor_payment_cycles',
    'vendor_payment_exceptions',
    'vendor_boq_items',
    'principal_direct_payments',
    'advance_recovery_schedule',
    'tds_records',
    'budget_cost_heads',
    'budget_flags',
    'proforma_invoices',
    'fee_schedule',
    'fee_schedule_history',
    'client_receipts',
    'client_claims',
    'claim_items',
    'petty_cash_transactions',
    'vendor_boq_mapping',
  ],
};
