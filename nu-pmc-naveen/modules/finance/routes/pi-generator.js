// routes/pi-generator.js — Proforma Invoice PDF + Tally Prime XML generation
const express  = require('express');
const db       = require('../../../middleware/db');
const dateUtil = require('../../../services/date-util');
const { requireAuth, requirePMC, requireFinance } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const router   = express.Router();

// Indian number format
const inr = (n) => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── GET /api/pi/:id/pdf — generate PI PDF (HTML rendered)
router.get('/:id/pdf', requireAuth, requireFinance, asyncHandler(async (req, res) => {
    const [[pi]] = await db.query(
      `SELECT pi.*, fs.milestone_name, p.name AS project_name, p.code AS project_code,
              p.billing_account,
              c.client_name AS client_name, c.address AS client_address, c.gstin AS client_gstin,
              NULL AS po_number, NULL AS po_date,
              ce.legal_name AS firm_name, ce.address_line1 AS firm_address,
              ce.gstin AS firm_gstin, ce.state_code AS firm_state_code,
              ce.email_primary AS firm_email, ce.phone AS firm_phone,
              ce.sac_code AS firm_sac,
              ce.bank_name, ce.bank_account_no, ce.bank_ifsc,
              ce.bank_account_holder, ce.bank_branch, ce.upi_id,
              ce.bank2_name, ce.bank2_account_no, ce.bank2_ifsc,
              ce.bank2_account_holder, ce.bank2_branch
       FROM proforma_invoices pi
       JOIN fee_schedule fs ON pi.fee_schedule_id = fs.id
       JOIN projects p ON pi.project_id = p.id
       JOIN company_entities ce ON p.entity_id = ce.id
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE pi.id = ?`,
      [req.params.id]
    );
    if (!pi) return res.status(404).json({ error: 'PI not found' });
    if (pi.raised_by) {
      const Auth = require('../../auth/contract');
      const users = await Auth.functions.getUsers([pi.raised_by]);
      pi.raised_by_name = users.get(pi.raised_by)?.full_name || null;
    }

    const cgst = parseFloat(pi.gst_pct) / 2;
    const sgst = cgst;
    const amtEx = parseFloat(pi.amount_ex_gst);
    const cgstAmt = Math.round(amtEx * cgst / 100 * 100) / 100;
    const sgstAmt = cgstAmt;
    const total   = amtEx + cgstAmt + sgstAmt;
    const date    = new Date(pi.raised_at).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
    const poDate  = pi.po_date ? new Date(pi.po_date).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : '—';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1A1A1A; padding: 20mm 18mm 20mm 25mm; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; padding-bottom:12px; border-bottom:3px solid #C8A55A; }
  .logo-box { width:120px; height:60px; border:1px solid #CCC; display:flex; align-items:center; justify-content:center; color:#BBB; font-size:10px; }
  .firm { text-align:center; }
  .firm h1 { font-size:22px; color:#1A2E44; }
  .firm p { font-size:10px; color:#888; }
  .pi-title { text-align:center; margin:16px 0 12px; }
  .pi-title h2 { font-size:16px; color:#1A2E44; letter-spacing:2px; }
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px; }
  .meta-block { background:#F5F3EF; padding:8px 10px; }
  .meta-block label { font-size:9px; color:#888; display:block; margin-bottom:3px; }
  .meta-block span { font-size:11px; font-weight:bold; color:#1A2E44; }
  table { width:100%; border-collapse:collapse; margin-bottom:12px; }
  th { background:#1A2E44; color:#FFF; padding:6px 8px; text-align:left; font-size:10px; }
  td { padding:6px 8px; border-bottom:1px solid #EEE; font-size:11px; }
  .tr-amt { text-align:right; }
  .total-row td { font-weight:bold; background:#F5F3EF; border-top:2px solid #1A2E44; }
  .total-row .grand { font-size:14px; color:#1A2E44; }
  .bank { margin:12px 0; padding:10px; border:1px solid #DDD; }
  .bank h3 { font-size:10px; color:#888; margin-bottom:6px; }
  .bank p { font-size:11px; line-height:1.6; }
  .sig { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:20px; padding-top:12px; border-top:1px solid #DDD; }
  .sig-block p { font-size:9px; color:#888; margin-bottom:24px; }
  .sig-block .name { font-size:13px; font-weight:bold; color:#1A2E44; margin-bottom:4px; }
  .sig-block .role { font-size:10px; color:#888; }
  .footer { margin-top:16px; text-align:center; font-size:9px; color:#AAA; border-top:1px solid #EEE; padding-top:8px; }
  .hsn { font-size:9px; color:#888; }
</style></head><body>

<div class="hdr">
  <div class="logo-box">nu associates<br>[LOGO]</div>
  <div class="firm">
    <h1>${pi.firm_name}</h1>
    <p>Architecture · Engineering · PMC</p>
    <p>${pi.firm_address}</p>
    <p>GSTIN: ${pi.firm_gstin} · State: Karnataka (${pi.firm_state_code})</p>
    <p>Email: finance@nuassociates.com</p>
  </div>
  <div class="logo-box">${pi.client_name||'Client'}<br>[LOGO]</div>
</div>

<div class="pi-title"><h2>PROFORMA INVOICE</h2></div>

<div class="meta">
  <div class="meta-block"><label>PI Number</label><span>${pi.pi_number}</span></div>
  <div class="meta-block"><label>Date</label><span>${date}</span></div>
  <div class="meta-block"><label>Project</label><span>${pi.project_name}</span></div>
  <div class="meta-block"><label>Client</label><span>${pi.client_name||'—'}</span></div>
  <div class="meta-block"><label>Client PO Number</label><span>${pi.po_number||'—'}</span></div>
  <div class="meta-block"><label>PO Date</label><span>${poDate}</span></div>
</div>

<table>
  <tr><th>Description of Service</th><th class="tr-amt">HSN</th><th class="tr-amt">Amount (₹)</th></tr>
  <tr>
    <td>${pi.milestone_name}<br><span class="hsn">Architectural / PMC Services — ${pi.project_name}</span></td>
    <td class="tr-amt">998311</td>
    <td class="tr-amt">${inr(amtEx)}</td>
  </tr>
  <tr><td colspan="2">CGST @ ${cgst}%</td><td class="tr-amt">${inr(cgstAmt)}</td></tr>
  <tr><td colspan="2">SGST @ ${sgst}%</td><td class="tr-amt">${inr(sgstAmt)}</td></tr>
  <tr class="total-row"><td colspan="2"><strong>Total Amount Payable</strong></td><td class="tr-amt grand">₹ ${inr(total)}</td></tr>
</table>

<div class="bank">
  <h3>PAYMENT DETAILS</h3>
  <p>
    Bank: ${pi.bank_name} &nbsp;|&nbsp; Account Name: ${pi.bank_account_holder}<br>
    Account Number: ${pi.bank_account_no} &nbsp;|&nbsp; IFSC: ${pi.bank_ifsc}<br>
    Branch: ${pi.bank_branch || 'Banashankari, Bengaluru'}${pi.upi_id ? '<br>UPI: ' + pi.upi_id : ''}
  </p>
</div>

<div class="sig">
  <div class="sig-block">
    <p>Prepared by</p>
    <div class="name">${pi.raised_by_name}</div>
    <div class="role">nu associates</div>
  </div>
  <div class="sig-block">
    <p>For NU ASSOCIATES LLP</p>
    <div class="name">Naveen Kumar Bhat</div>
    <div class="role">Principal · nu associates</div>
    <p style="margin-top:20px; border-top:1px solid #CCC; padding-top:4px; font-size:9px; color:#CCC;">Authorised Signatory</p>
  </div>
</div>

<div class="footer">
  This is a Proforma Invoice. Tax Invoice will be raised upon approval.<br>
  ${pi.firm_name} · GSTIN: ${pi.firm_gstin} · SAC ${pi.firm_sac || 998311}
</div>

</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }));

// ── GET /api/pi/:id/tally — generate Tally Prime XML (both vouchers)
router.get('/:id/tally', requireAuth, requireFinance, asyncHandler(async (req, res) => {
    const voucherType = req.query.type || 'sales'; // sales or receipt
    const [[pi]] = await db.query(
      `SELECT pi.*, fs.milestone_name
       FROM proforma_invoices pi
       JOIN fee_schedule fs ON pi.fee_schedule_id = fs.id
       WHERE pi.id = ?`,
      [req.params.id]
    );
    if (!pi) return res.status(404).json({ error: 'PI not found' });
    const Onboarding = require('../../onboarding/contract');
    const piProj = await Onboarding.functions.getProject(pi.project_id);
    const piClient = await Onboarding.functions.getClient(pi.project_id);
    pi.project_name  = piProj?.name || null;
    pi.client_name   = piClient?.client_name || null;
    pi.client_gstin  = piClient?.gstin || null;

    const amtEx   = parseFloat(pi.amount_ex_gst);
    const cgst    = parseFloat(pi.gst_pct) / 2;
    const cgstAmt = Math.round(amtEx * cgst / 100 * 100) / 100;
    const sgstAmt = cgstAmt;
    const total   = amtEx + cgstAmt + sgstAmt;
    const _date   = dateUtil.dateIST(new Date(pi.raised_at));
    const tallyDate = new Date(pi.raised_at).toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'}).replace(/ /g,'-');

    let xml = '';

    if (voucherType === 'sales') {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>NU ASSOCIATES LLP</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${pi.pi_number}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${pi.client_name||'Client'}</PARTYLEDGERNAME>
            <NARRATION>${pi.milestone_name} — ${pi.project_name}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${pi.client_name||'Client'}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Architectural / PMC Services</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amtEx.toFixed(2)}</AMOUNT>
              <STOCKITEMNAME></STOCKITEMNAME>
              <GSTTAXABILITY>Taxable</GSTTAXABILITY>
              <HSNCODE>998311</HSNCODE>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST @ ${cgst}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${cgstAmt.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST @ ${cgst}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${sgstAmt.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    } else {
      // Receipt voucher
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>NU ASSOCIATES LLP</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>REC-${pi.pi_number}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${pi.client_name||'Client'}</PARTYLEDGERNAME>
            <NARRATION>Receipt against ${pi.pi_number} — ${pi.milestone_name}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>ICICI Bank</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${pi.client_name||'Client'}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=Tally_${voucherType}_${pi.pi_number}.xml`);
    res.send(xml);
  }));

// GET /api/pi-generator/all/:project_id/tally — export all paid PIs for a project
router.get('/all/:project_id/tally', requireAuth, requireFinance, asyncHandler(async (req, res) => {
    const [pis] = await db.query(
      "SELECT id FROM proforma_invoices WHERE project_id=? AND status='paid' ORDER BY raised_at",
      [req.params.project_id]
    );
    if (!pis.length) return res.status(404).json({ error: 'No paid invoices found' });
    // Return list of tally URLs for client to download individually
    const urls = pis.map(p => `/api/pi-generator/${p.id}/tally`);
    res.json({ success: true, count: pis.length, tally_urls: urls,
      message: `${pis.length} invoices available — download each using the URLs provided` });
  }));

module.exports = router;
