// routes/gst-statement.js — Monthly GST statement for CA reconciliation
// Payments with GST split, advances separate, HSN-wise summary, receipts separate

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requireFinance } = require('../../../middleware/auth');
const xl      = require('../../../middleware/excel');
const path    = require('path');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// GST split calculation
function splitGST(amount, gstRate, isInterstate) {
  const taxable = amount / (1 + gstRate / 100);
  const gstAmt  = amount - taxable;
  return {
    taxable:  +taxable.toFixed(2),
    igst:     isInterstate ? +gstAmt.toFixed(2)       : 0,
    cgst:     isInterstate ? 0                         : +(gstAmt / 2).toFixed(2),
    sgst:     isInterstate ? 0                         : +(gstAmt / 2).toFixed(2),
    total_tax: +gstAmt.toFixed(2),
  };
}

// GET /api/gst-statement?month=YYYY-MM — generate monthly GST statement
router.get('/', requireAuth, requireFinance, asyncHandler(async (req, res) => {
    // Role gated by requireFinance middleware — no inline check needed.
    const { month, project_id, format } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month required — format YYYY-MM' });
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2,'0')}-01`;
    // Last day of month — IST-safe: construct YYYY-MM-DD directly
    const daysInMonth = new Date(year, mon, 0).getDate();
    const endDate     = `${year}-${String(mon).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

    const projectFilter = project_id ? 'AND project_id = ?' : '';
    const params        = project_id ? [startDate, endDate, project_id] : [startDate, endDate];

    // ── VENDOR PAYMENTS (RA bills and final bills — have GST)
    const [payments] = await db.query(
      `SELECT id, payment_type, amount_requested, pmc_amount,
              gst_rate, hsn_code, is_interstate, utr_number,
              payment_date, reason, project_id, engagement_id
       FROM payment_requests
       WHERE status='paid'
       AND payment_date BETWEEN ? AND ?
       AND payment_type IN ('running_account_bill','final_bill')
       ${projectFilter}
       ORDER BY payment_date`,
      params
    );

    // ── ADVANCE PAYMENTS (no GST)
    const [advances] = await db.query(
      `SELECT id, payment_type, amount_requested, pmc_amount,
              utr_number, payment_date, reason, project_id, engagement_id
       FROM payment_requests
       WHERE status='paid'
       AND payment_date BETWEEN ? AND ?
       AND payment_type IN ('advance','mobilisation_advance','material_advance')
       ${projectFilter}
       ORDER BY payment_date`,
      params
    );

    // ── CLIENT RECEIPTS
    const [receipts] = await db.query(
      `SELECT cr.*,
              pi.pi_number, fs.milestone_name AS milestone_description,
              c.client_name, c.gstin AS client_gstin
       FROM client_receipts cr
       JOIN proforma_invoices pi ON cr.pi_id=pi.id
       LEFT JOIN fee_schedule fs ON pi.fee_schedule_id=fs.id
       LEFT JOIN projects p ON cr.project_id=p.id
       LEFT JOIN clients c ON p.client_id=c.id
       WHERE cr.receipt_date BETWEEN ? AND ?
       ${project_id ? 'AND cr.project_id=?' : ''}
       ORDER BY cr.receipt_date`,
      params
    );

    // Bulk-hydrate project names across all 3 result sets
    const Onboarding = require('../../onboarding/contract');
    const allProjIds = [
      ...payments.map(r => r.project_id),
      ...advances.map(r => r.project_id),
      ...receipts.map(r => r.project_id),
    ].filter(Boolean);
    const gstProjs = await Onboarding.functions.getProjectsByIds(allProjIds);
    [payments, advances, receipts].forEach(arr =>
      arr.forEach(r => { r.project_name = gstProjs.get(r.project_id)?.name || null; }));

    // Bulk-hydrate vendor info from engagement helper (for payments + advances)
    const allEngIds = [...payments.map(r => r.engagement_id), ...advances.map(r => r.engagement_id)].filter(Boolean);
    const gstEngs = await Onboarding.functions.getEngagementsByIds(allEngIds);
    payments.forEach(r => {
      const e = gstEngs.get(r.engagement_id);
      r.vendor_name   = e?.vendor_name || null;
      r.vendor_gstin  = e?.gst_number || null;
    });
    advances.forEach(r => { r.vendor_name = gstEngs.get(r.engagement_id)?.vendor_name || null; });

    // Secondary sort by vendor_name within each payment_date (preserves original ORDER BY payment_date, v.vendor_name)
    const bySecondary = (a, b) => {
      if (a.payment_date < b.payment_date) return -1;
      if (a.payment_date > b.payment_date) return 1;
      return (a.vendor_name || '').localeCompare(b.vendor_name || '');
    };
    payments.sort(bySecondary);
    advances.sort(bySecondary);

    // Build payment rows with GST split
    const paymentRows = payments.map(p => {
      const amount  = parseFloat(p.pmc_amount || p.amount_requested);
      const rate    = parseFloat(p.gst_rate || 18);
      const gst     = splitGST(amount, rate, p.is_interstate === 1);
      return {
        date:         p.payment_date,
        project:      p.project_name,
        vendor:       p.vendor_name,
        gstin:        p.vendor_gstin || '—',
        type:         p.payment_type.replace(/_/g,' '),
        hsn:          p.hsn_code || '—',
        total:        amount,
        taxable:      gst.taxable,
        gst_rate:     rate,
        cgst:         gst.cgst,
        sgst:         gst.sgst,
        igst:         gst.igst,
        utr:          p.utr_number || '—',
        reason:       (p.reason||'').substring(0,60),
      };
    });

    // HSN-wise summary
    const hsnMap = {};
    paymentRows.forEach(r => {
      const key = r.hsn + '|' + r.gst_rate;
      if (!hsnMap[key]) hsnMap[key] = { hsn: r.hsn, rate: r.gst_rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, count: 0 };
      hsnMap[key].taxable += r.taxable;
      hsnMap[key].cgst    += r.cgst;
      hsnMap[key].sgst    += r.sgst;
      hsnMap[key].igst    += r.igst;
      hsnMap[key].count++;
    });
    const hsnSummary = Object.values(hsnMap);

    // Totals
    const totalPaid    = paymentRows.reduce((s,r) => s + r.total, 0);
    const totalTaxable = paymentRows.reduce((s,r) => s + r.taxable, 0);
    const totalCGST    = paymentRows.reduce((s,r) => s + r.cgst, 0);
    const totalSGST    = paymentRows.reduce((s,r) => s + r.sgst, 0);
    const totalIGST    = paymentRows.reduce((s,r) => s + r.igst, 0);
    const totalAdv     = advances.reduce((s,a) => s + parseFloat(a.pmc_amount||a.amount_requested), 0);
    const totalReceipt = receipts.reduce((s,r) => s + parseFloat(r.amount_received||r.amount||0), 0);

    const data = {
      month, year, mon,
      payments: paymentRows,
      advances: advances.map(a => ({
        date:    a.payment_date,
        project: a.project_name,
        vendor:  a.vendor_name,
        type:    a.payment_type.replace(/_/g,' '),
        amount:  parseFloat(a.pmc_amount||a.amount_requested),
        utr:     a.utr_number||'—',
        note:    (a.reason||'').substring(0,60),
      })),
      receipts: receipts.map(r => ({
        date:        r.receipt_date,
        project:     r.project_name,
        client:      r.client_name||'—',
        client_gstin:r.client_gstin||'—',
        pi_number:   r.pi_number||'—',
        milestone:   (r.milestone_description||'').substring(0,50),
        amount:      parseFloat(r.amount_received||r.amount||0),
        tds:         parseFloat(r.tds_deducted||0),
        net:         parseFloat(r.net_received||r.amount_received||0),
        mode:        r.mode||'—',
        reference:   r.utr||r.bank_ref||r.reference||'—',
      })),
      hsn_summary: hsnSummary,
      totals: {
        payments: { total: +totalPaid.toFixed(2), taxable: +totalTaxable.toFixed(2),
          cgst: +totalCGST.toFixed(2), sgst: +totalSGST.toFixed(2), igst: +totalIGST.toFixed(2) },
        advances: { total: +totalAdv.toFixed(2) },
        receipts: { total: +totalReceipt.toFixed(2) },
      },
    };

    // Return JSON or Excel
    if (format === 'excel') {
      const wb = await buildGSTExcel(data);
      const filename = `nu_GST_Statement_${month}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.sendFile(path.resolve(wb));
    } else {
      res.json(data);
    }
  }));

async function buildGSTExcel(data) {
  // Build multi-sheet Excel
  const rows = {
    'Vendor Payments': [
      ['Date','Project','Vendor','GSTIN','Type','HSN','Total Amount','Taxable','GST%','CGST','SGST','IGST','UTR'],
      ...data.payments.map(r => [
        r.date, r.project, r.vendor, r.gstin, r.type, r.hsn,
        r.total, r.taxable, r.gst_rate, r.cgst, r.sgst, r.igst, r.utr
      ]),
      [],
      ['TOTALS','','','','','',
        data.totals.payments.total, data.totals.payments.taxable, '',
        data.totals.payments.cgst, data.totals.payments.sgst, data.totals.payments.igst, ''],
    ],
    'Advance Payments': [
      ['Date','Project','Vendor','Type','Amount','UTR','Note'],
      ...data.advances.map(r => [r.date, r.project, r.vendor, r.type, r.amount, r.utr, r.note]),
      [],
      ['TOTAL','','','', data.totals.advances.total,'',''],
    ],
    'Client Receipts': [
      ['Date','Project','Client','GSTIN','PI Number','Milestone','Gross Amount','TDS','Net Received','Mode','Reference'],
      ...data.receipts.map(r => [
        r.date, r.project, r.client, r.client_gstin, r.pi_number,
        r.milestone, r.amount, r.tds, r.net, r.mode, r.reference
      ]),
      [],
      ['TOTAL','','','','','', data.totals.receipts.total,'',''],
    ],
    'HSN Summary': [
      ['HSN Code','GST Rate %','Taxable Value','CGST','SGST','IGST','Transactions'],
      ...data.hsn_summary.map(h => [h.hsn, h.rate, +h.taxable.toFixed(2), +h.cgst.toFixed(2), +h.sgst.toFixed(2), +h.igst.toFixed(2), h.count]),
    ],
  };

  const outPath = path.join(process.env.UPLOAD_DIR || '/tmp', `GST_${data.month}_${Date.now()}.xlsx`);
  await xl.writeMultiSheet(rows, outPath);
  return outPath;
}

module.exports = router;
