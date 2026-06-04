// routes/grn.js — Goods Receipt Notes
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { validators } = require('../../../middleware/validate');
const { requireAuth, requireRole, requirePMC, requireProjectScope, requireScopeFromEntity } = require('../../../middleware/auth');
const { upload } = require('../../../middleware/upload');
const router     = express.Router();
// (waInteractive / waReply imports removed — only this file's GRN-create
// flow used them, and that flow now goes through services/signoff-gate.)
const notif         = require('../../../services/notifications');
const sequence      = require('../../../services/sequence');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const fileUrls = require('../../../services/file-url');

router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const [grns] = await db.query(`
      SELECT * FROM grns
      WHERE project_id = ? ORDER BY delivery_date DESC`, [req.params.project_id]
    );
    const Onboarding = require('../../onboarding/contract');
    const engs = await Onboarding.functions.getEngagementsByIds(grns.map(g => g.engagement_id));
    grns.forEach(g => {
      g.vendor_name = engs.get(g.engagement_id)?.vendor_name || null;
      g.delivery_note_url = fileUrls.fileUrl(g.delivery_note_path);
      g.invoice_url = fileUrls.fileUrl(g.invoice_path);
    });
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      grns.flatMap(g => [g.raised_by, g.approved_by].filter(Boolean))
    );
    grns.forEach(g => {
      g.raised_by_name   = users.get(g.raised_by)?.full_name   || null;
      g.approved_by_name = users.get(g.approved_by)?.full_name || null;
    });
    res.json({ grns });
  }));

router.post('/:project_id', requireAuth, requireProjectScope(), requireRole('site_manager','senior_site_manager','pmc_head','principal','design_principal'), upload.fields([
  { name: 'delivery_note', maxCount: 1 },
  { name: 'invoice', maxCount: 1 },
]), async (req, res) => {
  try {
    const { GRNCreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(GRNCreate, req, res);
    if (!body) return;

    // Cross-entity invariant (L3c I3): GRN can only be raised against an
    // ACTIVE vendor engagement in APPROVED status. Pending / rejected /
    // inactive engagements should not accept deliveries (or the delivery
    // bypasses the principal-approval gate for vendor engagement).
    const Onboarding = require('../../onboarding/contract');
    const engMap = await Onboarding.functions.getEngagementsByIds([body.engagement_id]);
    const engCheck = engMap.get(body.engagement_id);
    if (!engCheck) {
      return res.status(400).json({ error: 'Vendor engagement not found' });
    }
    if (parseInt(engCheck.project_id) !== parseInt(req.params.project_id)) {
      return res.status(400).json({ error: 'Engagement does not belong to this project' });
    }
    if (engCheck.is_active === 0) {
      return res.status(400).json({
        error: 'Cannot raise GRN against an inactive vendor engagement',
      });
    }
    if (engCheck.approval_status !== 'approved') {
      return res.status(400).json({
        error: `Engagement has approval_status='${engCheck.approval_status}'. GRN can only be raised against approved engagements.`,
      });
    }

    const validQty      = body.quantity_received;
    const validUnitRate = body.unit_rate || 0;

    const isUnplanned = !body.material_request_id ? 1 : 0;

    // Atomic number generation — regen on ER_DUP_ENTRY (concurrent creates)
    let num, result;
    await sequence.insertWithRetry(async () => {
      num = await sequence.generate({
        table: 'grns', numberCol: 'grn_number', projectId: req.params.project_id,
        prefix: 'GRN-', pad: 3,
      });
      const [r] = await db.query(
        `INSERT INTO grns (project_id, grn_number, engagement_id, material_request_id,
         delivery_date, description, quantity_received, unit, delivery_note_ref, invoice_ref,
         delivery_note_path, invoice_path, is_unplanned, raised_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.params.project_id, num, body.engagement_id, body.material_request_id,
         body.delivery_date, body.description, validQty, body.unit,
         body.delivery_note_ref, body.invoice_ref,
         req.files?.delivery_note?.[0]?.path||null,
         req.files?.invoice?.[0]?.path||null,
         isUnplanned, req.session.user.id]
      );
      result = r;
    });

    const grnId = result.insertId;

    // Send interactive button to approver
    try {
      const eng = engCheck;  // already fetched above
      const grnValue      = validQty * validUnitRate;
      const deliveryNotePath = req.files?.delivery_note?.[0]?.path;
      const deliveryNoteUrl = deliveryNotePath
        ? fileUrls.fileUrl(deliveryNotePath, { absolute: true })
        : null;

      // v6.02 audit decision: GRN is FYI only — no PMC approval poll.
      // Payment has no link to GRN (payment is on work done, not material receipts).
      // GRN serves PMC purely for materials planning — what came in, what's still needed.
      // Vendor confirmation poll (F3) below provides the independent check.
      // PMC sees disputes via the vendor's poll response, and weekly digest.
      if (deliveryNoteUrl) {
        console.log('[grn] delivery note URL', { grnId, url: deliveryNoteUrl });
      }
    } catch(_e) { /* non-blocking */ }

    audit.log({ userId: req.session.user.id, action: 'grn.create',
      entityType: 'grns', entityId: grnId,
      details: { project_id: parseInt(req.params.project_id), grn_number: num, engagement_id: body.engagement_id, quantity_received: validQty, unit_rate: validUnitRate, is_unplanned: !!isUnplanned }, req });

    // Vendor confirmation poll (F3, friction-reduction brief — v6.02 update)
    // Vendor confirms delivery matches GRN. Poll: ✅ Confirmed / ❌ Disputed
    // Routed through signoff-gate so vendor's vote is captured and the
    // dispute path triggers POST_COMPLETION_HOOK alerting PMC.
    // (Direct notifyVendor send was fire-and-forget — no vote correlation.)
    if (eng?.vendor_id) {
      try {
        const signoffGate = require('../../../services/signoff-gate');
        const amt = `₹${(validQty * validUnitRate).toLocaleString('en-IN')}`;
        await signoffGate.triggerSignoff(
          'grn_vendor_confirm',
          grnId,
          parseInt(req.params.project_id, 10),
          {
            question: `GRN ${num} — ${validQty} ${body.unit || 'units'} received — ${amt}. Confirm delivery matches?`,
            documentRow: { id: grnId, vendor_id: eng.vendor_id, raised_by: req.session.user.id },
            triggeredBy: req.session.user.id,
          }
        );
      } catch (e) {
        console.warn('[grn] vendor confirmation poll failed:', e.message);
      }
    }

    res.json({
      success: true, id: grnId, grn_number: num,
      is_unplanned: isUnplanned === 1,
      message: isUnplanned
        ? `GRN ${num} raised — flagged as unplanned delivery. Vendor confirmation pending.`
        : `GRN ${num} raised — vendor confirmation pending.`,
    });
  } catch (_err) { res.status(500).json({ error: 'Failed to create GRN' }); }
});

router.patch('/:id/approve', requireAuth, requireScopeFromEntity('grns'), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[grn]] = await db.query(
      `SELECT g.*,
              (SELECT SUM(bch.sanctioned) FROM budget_cost_heads bch
               WHERE bch.project_id = g.project_id AND bch.status = 'approved') AS project_budget
       FROM grns g
       WHERE g.id = ?`, [req.params.id]
    );
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    const Onboarding = require('../../onboarding/contract');
    const grnEng = await Onboarding.functions.getEngagementsByIds([grn.engagement_id]);
    grn.contract_value = grnEng.get(grn.engagement_id)?.contract_value || null;

    // State machine guard: only 'pending' GRNs can be approved.
    // Blocks: (a) double-approval races overwriting approved_at,
    //         (b) silent resurrection of rejected GRNs back to approved.
    if (grn.status === 'approved') {
      return res.status(200).json({ success: true, message: 'GRN already approved',
        approved_by: grn.approved_by, approved_at: grn.approved_at });
    }
    if (grn.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot approve GRN from status '${grn.status}'. Only pending GRNs can be approved.`,
      });
    }

    const isSeniorSite = me.role === 'senior_site_manager';
    const isPMC        = me.role === 'pmc_head';
    const isPrincipal  = ['principal','design_principal'].includes(me.role);

    if (!isSeniorSite && !isPMC && !isPrincipal) {
      return res.status(403).json({ error: 'Only PMC Head or Senior Site Manager can approve GRNs' });
    }

    // Senior site manager can only approve below 5% of project budget
    if (isSeniorSite) {
      const projectBudget  = parseFloat(grn.project_budget || 0);
      const threshold      = projectBudget * 0.05;
      const grnValue       = parseFloat(grn.quantity_received * (grn.unit_rate || 0));
      if (projectBudget > 0 && grnValue > threshold) {
        return res.status(403).json({
          error: `GRN value exceeds 5% of project budget (₹${threshold.toLocaleString('en-IN')}). PMC Head approval required.`,
          requires_pmc: true,
        });
      }
    }

    const sm = require('../../../services/state-machines').grn;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: grn.status, to: 'approved',
        extraCols: { approved_by: me.id, approved_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    const approvals = require('../../../services/approvals');
    await approvals.close({ refTable: 'grns', refId: parseInt(req.params.id), actionedBy: req.session.user.id }).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
    audit.log({ userId: me.id, action: 'grn.approve',
      entityType: 'grns', entityId: parseInt(req.params.id),
      details: { from: grn.status, to: 'approved', approver_role: me.role }, req });
    res.json({ success: true });
  }));

router.patch('/:id/reject', requireAuth, requireScopeFromEntity('grns'), requirePMC, asyncHandler(async (req, res) => {
    const { rejection_reason } = req.body;
    const [[cur]] = await db.query('SELECT status FROM grns WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'GRN not found' });
    const sm = require('../../../services/state-machines').grn;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: cur.status, to: 'rejected',
        extraCols: {
          approved_by: req.session.user.id, approved_at: new Date(),
          rejection_reason: rejection_reason || null,
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    const approvals = require('../../../services/approvals');
    await approvals.close({ refTable: 'grns', refId: parseInt(req.params.id), actionedBy: req.session.user.id, rejectionNote: req.body.reason || 'Rejected' }).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
    audit.log({ userId: req.session.user.id, action: 'grn.reject',
      entityType: 'grns', entityId: parseInt(req.params.id),
      details: { rejection_reason: rejection_reason || null }, req });
    res.json({ success: true });
  }));

// PATCH /api/grn/:id/flag-nonconformance — site manager flags material as non-conforming
// Helper: fetch GRN with vendor/project context
async function getGRNWithContext(grnId) {
  const [[grn]] = await db.query(
    `SELECT * FROM grns WHERE id = ?`, [grnId]
  );
  if (grn) {
    const Onboarding = require('../../onboarding/contract');
    const [proj, engMap] = await Promise.all([
      Onboarding.functions.getProject(grn.project_id),
      Onboarding.functions.getEngagementsByIds([grn.engagement_id]),
    ]);
    const eng = engMap.get(grn.engagement_id);
    grn.project_name  = proj?.name || null;
    grn.vendor_name   = eng?.vendor_name || null;
    grn.vendor_phone  = eng?.vendor_phone || null;
  }
  return grn;
}

// GET /api/grn/:id/flag-nonconformance/preview — shows what will happen if we flag this GRN
// No state change. UI shows confirmation modal with recipient list.
router.get('/:id/flag-nonconformance/preview', requireAuth,
  requireScopeFromEntity('grns'),
  requireRole('site_manager', 'senior_site_manager', 'pmc_head', 'principal', 'design_principal'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;

    const { reason, material_type } = req.query;
    if (!reason) return res.status(400).json({ error: 'reason query param required' });

    const grn = await getGRNWithContext(req.params.id);
    if (!grn) return res.status(404).json({ error: 'GRN not found' });

    const headRole = material_type === 'services' ? 'services_head' : 'design_head';
    const [pmcHeads] = await db.query("SELECT id, full_name FROM users WHERE role='pmc_head' AND is_active=1");
    const [heads]    = await db.query('SELECT id, full_name FROM users WHERE role=? AND is_active=1', [headRole]);

    res.json({
      grn: {
        grn_number: grn.grn_number,
        description: grn.description,
        vendor_name: grn.vendor_name,
        vendor_phone: grn.vendor_phone,
        project_name: grn.project_name,
      },
      would_happen: {
        status_change: 'rejected (NCR raised)',
        ncr_created: true,
        vendor_whatsapp: grn.vendor_phone ? {
          to: grn.vendor_phone,
          body: `Material non-conformance at delivery ${grn.grn_number}: ${reason}`,
        } : null,
        internal_notifications: [
          ...pmcHeads.map(u => ({ role: 'pmc_head', name: u.full_name })),
          ...heads.map(u => ({ role: headRole, name: u.full_name })),
        ],
      },
      warning: 'Flagging non-conformance will send a formal NCR notice to the vendor. This cannot be undone via the app — you would need to raise a retraction memo manually.',
      confirmation_required: true,
    });
  }));

// PATCH /api/grn/:id/flag-nonconformance — APPLY flag (send to vendor, create NCR, notify internal heads)
// Body MUST include: { confirmation: 'FLAG_NCR', grn_number: '<exact>', reason, material_type }
router.patch('/:id/flag-nonconformance', requireAuth,
  requireScopeFromEntity('grns'),
  requireRole('site_manager', 'senior_site_manager', 'pmc_head', 'principal', 'design_principal'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;

    const { reason, material_type, confirmation, grn_number } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason required for non-conformance flag' });
    if (confirmation !== 'FLAG_NCR') {
      return res.status(400).json({
        error: "Must pass { confirmation: 'FLAG_NCR', grn_number: '<exact>', reason, material_type }",
        code: 'CONFIRMATION_MISSING'
      });
    }

    const grn = await getGRNWithContext(req.params.id);
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    if (grn_number && grn_number !== grn.grn_number) {
      return res.status(400).json({
        error: `GRN number mismatch: you confirmed ${grn_number} but this is ${grn.grn_number}`,
        code: 'GRN_NUMBER_MISMATCH'
      });
    }

    // Atomic: GRN rejection + NCR creation
    await db.tx(async (conn) => {
      const sm = require('../../../services/state-machines').grn;
      await sm.transition({
        id: parseInt(req.params.id), from: grn.status, to: 'rejected',
        extraCols: {
          rejection_reason: 'NON-CONFORMANCE: ' + reason,
          approved_by: me.id, approved_at: new Date(),
        },
        conn,
      });

      // NCR number via sequence helper with ER_DUP_ENTRY retry (concurrency-safe).
      // issues.engagement_id is not a column — dropped from INSERT list.
      await sequence.insertWithRetry(async () => {
        const ncrNumber = await sequence.generate({
          table: 'issues', numberCol: 'ncr_number', projectId: grn.project_id,
          prefix: 'NCR-', pad: 3, where: "AND issue_type='quality'"
        });
        await conn.query(
          `INSERT INTO issues (project_id, ncr_number, description, raised_by, status, issue_type)
           VALUES (?,?,?,?,'open','quality')`,
          [grn.project_id, ncrNumber,
           `Material non-conformance at GRN ${grn.grn_number}: ${reason}`,
           me.id]
        );
      });
    });

    // Audit log BEFORE external send
    audit.log({
      userId: me.id,
      action: 'ncr_raised_to_vendor',
      entityType: 'grns',
      entityId: req.params.id,
      details: {
        grn_number: grn.grn_number,
        vendor_name: grn.vendor_name,
        vendor_phone: grn.vendor_phone,
        reason, material_type,
      },
      req
    });

    // Internal notifications (queue to DB)
    const pmcHeads = await users.pmcHeads();
    for (const p of pmcHeads) {
      await notif.notify(p.id, 'ncr', `Non-conformance flagged at GRN ${grn.grn_number} — ${grn.vendor_name}. Reason: ${reason}`);
    }
    const headRole = material_type === 'services' ? 'services_head' : 'design_head';
    const [heads] = await db.query('SELECT id FROM users WHERE role=? AND is_active=1', [headRole]);
    for (const h of heads) {
      await notif.notify(h.id, 'ncr', `Non-conformance flagged — ${grn.vendor_name} / ${grn.grn_number}. NCR raised. Your review needed.`);
    }

    // External send to vendor — surface result
    let vendorNotified = false;
    if (grn.vendor_phone) {
      try {
        const wa = require('../../../services/whatsapp');
        await notif.notifyVendorDefectRaised(grn.vendor_phone, grn.project_id,
          `Material non-conformance at delivery ${grn.grn_number}: ${reason}`);
        vendorNotified = true;
      } catch (sendErr) {
        console.error('Vendor NCR send error:', sendErr.message);
      }
    }

    res.json({
      success: true,
      vendor_notified: vendorNotified,
      message: vendorNotified
        ? `NCR raised, ${grn.vendor_name} notified via WhatsApp, PMC and ${headRole.replace('_',' ')} notified.`
        : `NCR raised internally. Vendor WhatsApp failed — please follow up manually.`,
    });
  }));

module.exports = router;
