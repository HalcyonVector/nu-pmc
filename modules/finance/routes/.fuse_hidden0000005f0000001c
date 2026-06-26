// routes/vendor-documents.js
// F7 — Purchase Order generation + delivery to vendor Matrix room
// F9 — Final Settlement PDF delivery to vendor Matrix room
//
// F7 flow:
//   PMC flags po_required on vendor_engagements via PATCH /api/engagements/:id/po-flag
//   Finance approves via POST /api/vendor-documents/po/:engagement_id/approve
//   On approval — PDF generated, sent to vendor's Matrix room, po_generated_at stamped.
//
// F9 flow:
//   Finance/PMC triggers POST /api/vendor-documents/settlement/:engagement_id
//   PDF generated from engagement + DLP data, sent to vendor's Matrix room.
//   Also triggers the final_settlement signoff relay via signoff-gate.

'use strict';

const express      = require('express');
const db           = require('../../../middleware/db');
const PDFDoc       = require('pdfkit');
const { requireAuth, requirePMC, requireFinance } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit        = require('../../../services/audit');
const router       = express.Router();

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateStr = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Helper: generate PDF to buffer, upload to Matrix, return mxc:// URI
async function generateAndUploadPDF(buildFn, filename) {
  const buffer = await new Promise((resolve, reject) => {
    const doc    = new PDFDoc({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    buildFn(doc);
    doc.end();
  });
  const matrixAdapter = require('../../../services/matrix-adapter');
  return await matrixAdapter.uploadMedia(buffer, { filename, contentType: 'application/pdf' });
}

// ── PATCH /api/vendor-documents/engagements/:id/po-flag
// PMC flags an engagement as requiring a PO.
router.patch('/engagements/:id/po-flag', requireAuth, requirePMC, asyncHandler(async (req, res) => {
  const { po_required } = req.body;
  await db.execute(
    'UPDATE vendor_engagements SET po_required = ? WHERE id = ?',
    [po_required ? 1 : 0, req.params.id]
  );
  audit.log({ userId: req.session.user.id, action: 'engagement.po_flag',
    entityType: 'vendor_engagements', entityId: parseInt(req.params.id),
    details: { po_required: !!po_required }, req });
  res.json({ success: true });
}));

// ── POST /api/vendor-documents/po/:engagement_id/approve — F7
// Finance approves the PO. Generates PDF and sends to vendor's Matrix room.
router.post('/po/:engagement_id/approve', requireAuth, requireFinance, asyncHandler(async (req, res) => {
  const engId = parseInt(req.params.engagement_id, 10);
  const me = req.session.user;

  const [[eng]] = await db.query(
    `SELECT ve.id, ve.vendor_id, ve.project_id, ve.scope, ve.contract_value,
            ve.po_required, ve.po_approved_by, ve.po_generated_at,
            v.vendor_name, v.trade, v.gst_number, v.matrix_room_id,
            p.code AS project_code, p.name AS project_name
       FROM vendor_engagements ve
       JOIN vendors v ON v.id = ve.vendor_id
       JOIN projects p ON p.id = ve.project_id
      WHERE ve.id = ?`,
    [engId]
  );
  if (!eng) return res.status(404).json({ error: 'Engagement not found' });
  if (!eng.po_required) return res.status(400).json({ error: 'PO not flagged as required for this engagement' });
  if (eng.po_generated_at) return res.status(409).json({ error: 'PO already generated', generated_at: eng.po_generated_at });
  if (!eng.matrix_room_id) return res.status(400).json({ error: 'Vendor does not have a Matrix room — onboard vendor first' });

  // Generate PO PDF
  const poNumber = `PO-${eng.project_code}-${String(engId).padStart(3, '0')}`;
  const today    = new Date();

  const mxcUri = await generateAndUploadPDF((doc) => {
    // Header
    doc.fontSize(20).fillColor('#1A2E44').text('PURCHASE ORDER', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#888').text(`${poNumber}  |  ${dateStr(today)}`, { align: 'center' });
    doc.moveDown(1);

    // Parties
    doc.fontSize(11).fillColor('#1A2E44').text('nu Associates PMC', { continued: true });
    doc.fontSize(11).fillColor('#888').text(`  →  ${eng.vendor_name}`);
    doc.moveDown(0.5);

    // Project
    doc.fontSize(10).fillColor('#333')
      .text(`Project: ${eng.project_code} — ${eng.project_name}`)
      .text(`Trade: ${eng.trade || '—'}`)
      .text(`GSTIN (Vendor): ${eng.gst_number || '—'}`);
    doc.moveDown(1);

    // Scope
    doc.fontSize(11).fillColor('#1A2E44').text('Scope of Work');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333').text(eng.scope || '(As per engagement agreement)', { width: 500 });
    doc.moveDown(1);

    // Contract value
    doc.fontSize(11).fillColor('#1A2E44').text('Contract Value');
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor('#1A2E44').text(inr(eng.contract_value));
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#888').text('(Inclusive of GST, subject to GRN verification and retention terms)');
    doc.moveDown(1.5);

    // Legal chain note
    doc.fontSize(9).fillColor('#888')
      .text('Legal chain: This PO + commencement of work + GRN receipts + payment records constitute the formal contract.', { width: 500 });
    doc.moveDown(1);

    // Signature block
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#DDD');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#888').text('Authorised by nu Associates PMC');
  }, `PO-${poNumber}.pdf`);

  // Stamp approval on engagement
  await db.execute(
    `UPDATE vendor_engagements
        SET po_approved_by = ?, po_approved_at = NOW(), po_generated_at = NOW(), po_matrix_event_id = NULL
      WHERE id = ?`,
    [me.id, engId]
  );

  // Send PDF to vendor's Matrix room
  const matrixAdapter = require('../../../services/matrix-adapter');
  const eventId = await matrixAdapter.sendFile({
    roomId:   eng.matrix_room_id,
    mxcUri,
    filename: `${poNumber}.pdf`,
    mimeType: 'application/pdf',
    body:     `📄 Purchase Order — ${eng.project_code}\n${poNumber} — ${dateStr(today)}\nScope: ${(eng.scope || '').slice(0, 100)}`,
  });

  // Store event ID
  if (eventId) {
    await db.execute(
      'UPDATE vendor_engagements SET po_matrix_event_id = ? WHERE id = ?',
      [eventId, engId]
    );
  }

  audit.log({ userId: me.id, action: 'po.generated',
    entityType: 'vendor_engagements', entityId: engId,
    details: { po_number: poNumber, vendor_id: eng.vendor_id, mxc_uri: mxcUri }, req });

  res.json({ success: true, po_number: poNumber, mxc_uri: mxcUri });
}));

// ── POST /api/vendor-documents/settlement/:engagement_id — F9 + final_settlement relay
// Generates final settlement PDF and sends to vendor's Matrix room.
// Also triggers the final_settlement signoff relay so the relay reaches Principal.
router.post('/settlement/:engagement_id', requireAuth, requirePMC, asyncHandler(async (req, res) => {
  const engId = parseInt(req.params.engagement_id, 10);
  const me    = req.session.user;
  const { dlp_deduction, notes } = req.body;

  const [[eng]] = await db.query(
    `SELECT ve.id, ve.vendor_id, ve.project_id, ve.scope, ve.contract_value,
            v.vendor_name, v.trade, v.gst_number, v.matrix_room_id,
            p.code AS project_code, p.name AS project_name
       FROM vendor_engagements ve
       JOIN vendors v ON v.id = ve.vendor_id
       JOIN projects p ON p.id = ve.project_id
      WHERE ve.id = ?`,
    [engId]
  );
  if (!eng) return res.status(404).json({ error: 'Engagement not found' });
  if (!eng.matrix_room_id) return res.status(400).json({ error: 'Vendor does not have a Matrix room' });

  const contractValue  = parseFloat(eng.contract_value || 0);
  const dlpDeduction   = parseFloat(dlp_deduction || 0);
  const finalPayable   = contractValue - dlpDeduction;
  const today          = new Date();
  const settlementRef  = `FS-${eng.project_code}-${String(engId).padStart(3, '0')}`;

  // Generate final settlement PDF
  const mxcUri = await generateAndUploadPDF((doc) => {
    doc.fontSize(20).fillColor('#1A2E44').text('FINAL SETTLEMENT STATEMENT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#888').text(`${settlementRef}  |  ${dateStr(today)}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#1A2E44').text('Vendor: ', { continued: true });
    doc.fillColor('#333').text(eng.vendor_name);
    doc.fillColor('#1A2E44').text('Project: ', { continued: true });
    doc.fillColor('#333').text(`${eng.project_code} — ${eng.project_name}`);
    doc.fillColor('#1A2E44').text('Trade: ', { continued: true });
    doc.fillColor('#333').text(eng.trade || '—');
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#DDD').moveDown(0.5);

    doc.fontSize(11).fillColor('#1A2E44').text('Settlement Summary');
    doc.moveDown(0.5);

    const rows = [
      ['Contract Value',           inr(contractValue)],
      ['DLP Deduction',            dlpDeduction > 0 ? `(${inr(dlpDeduction)})` : '—'],
      ['FINAL PAYABLE',            inr(finalPayable)],
    ];
    for (const [label, value] of rows) {
      doc.fontSize(10).fillColor('#555').text(label, 50, doc.y, { continued: true, width: 300 });
      doc.fillColor('#1A2E44').text(value, { align: 'right' });
    }
    doc.moveDown(1);

    if (notes) {
      doc.fontSize(10).fillColor('#888').text('Notes: ', { continued: true }).fillColor('#333').text(notes, { width: 500 });
      doc.moveDown(0.5);
    }

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#DDD').moveDown(1);
    doc.fontSize(9).fillColor('#888')
      .text('Physical signed copy is the legal record. This document is for reference only.', { width: 500 });
    doc.moveDown(1);

    // Signature blocks
    doc.fontSize(9).fillColor('#888').text('Acknowledged by (Vendor):', 50, doc.y);
    doc.fontSize(9).fillColor('#888').text('For nu Associates PMC:', 300, doc.y - doc.currentLineHeight());
    doc.moveDown(2.5);
    doc.moveTo(50, doc.y).lineTo(200, doc.y).stroke('#AAA');
    doc.moveTo(300, doc.y).lineTo(450, doc.y).stroke('#AAA');
  }, `FS-${settlementRef}.pdf`);

  // Send PDF to vendor's Matrix room
  const matrixAdapter = require('../../../services/matrix-adapter');
  await matrixAdapter.sendFile({
    roomId:   eng.matrix_room_id,
    mxcUri,
    filename: `${settlementRef}.pdf`,
    mimeType: 'application/pdf',
    body:     `📄 Final Settlement — ${eng.project_code}\n${settlementRef}\nContract: ${inr(contractValue)}  DLP: (${inr(dlpDeduction)})  Final payable: ${inr(finalPayable)}`,
  });

  // Trigger final_settlement signoff relay so Principal receives the terminal poll
  try {
    const signoffGate = require('../../../services/signoff-gate');
    await signoffGate.triggerSignoff(
      'final_settlement',
      engId,
      eng.project_id,
      {
        question: `Final settlement — ${eng.vendor_name} — ${eng.project_code} — ${inr(finalPayable)} payable. Approve?`,
        triggeredBy: me.id,
      }
    );
  } catch (e) {
    console.warn('[vendor-documents] final_settlement signoff trigger failed:', e.message);
  }

  audit.log({ userId: me.id, action: 'final_settlement.generated',
    entityType: 'vendor_engagements', entityId: engId,
    details: { settlement_ref: settlementRef, vendor_id: eng.vendor_id, contract_value: contractValue, dlp_deduction: dlpDeduction, final_payable: finalPayable, mxc_uri: mxcUri }, req });

  res.json({ success: true, settlement_ref: settlementRef, final_payable: finalPayable, mxc_uri: mxcUri });
}));

module.exports = router;
