// routes/submittals.js — Submittal log, numbered register
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requirePMC, requireProjectScope, requireScopeFromEntity } = require('../../../middleware/auth');
const { requirePermission } = require('../../../middleware/permissions');
const { upload } = require('../../../middleware/upload');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const { insertWithRetry } = require('../../../services/sequence');
const router  = express.Router();

async function generateSubmittalNumber(projectId, db) {
  const [[count]] = await db.query('SELECT COUNT(*) AS cnt FROM submittals WHERE project_id = ?', [projectId]);
  return `SUB-${String(count.cnt + 1).padStart(3, '0')}`;
}

router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const [subs] = await db.query(
      `SELECT * FROM submittals WHERE project_id = ? ORDER BY submitted_at DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      subs.flatMap(s => [s.submitted_by, s.reviewed_by].filter(Boolean))
    );
    const Onboarding = require('../../onboarding/contract');
    const engs = await Onboarding.functions.getEngagementsByIds(subs.map(s => s.engagement_id));
    subs.forEach(s => {
      s.submitted_by_name = users.get(s.submitted_by)?.full_name || null;
      s.reviewed_by_name  = users.get(s.reviewed_by)?.full_name  || null;
      s.vendor_name       = engs.get(s.engagement_id)?.vendor_name || null;
    });
    res.json({ submittals: subs });
  }));

router.post('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { engagement_id, title, submittal_type } = req.body;
    if (!engagement_id || !title) return res.status(400).json({ error: 'Engagement and title required' });
    const canSubmit = ['pmc_head','site_manager','senior_site_manager',
                       'design_head','services_head','team_lead',
                       'jr_architect','services_engineer','jr_engineer','detailing',
                       'principal','design_principal'].includes(req.session.user.role);
    if (!canSubmit) return res.status(403).json({ error: 'Not authorised to raise submittals' });

    // S3: SELECT COUNT(*) → INSERT had no UNIQUE constraint and no retry.
    // v5.14 adds the UNIQUE; this wraps the count+insert pair in insertWithRetry
    // so a concurrent racer that hits ER_DUP_ENTRY regenerates the number.
    let result, num;
    await insertWithRetry(async () => {
      num = await generateSubmittalNumber(req.params.project_id, db);
      const [r] = await db.query(
        `INSERT INTO submittals (project_id, submittal_number, engagement_id, title, submittal_type, file_path, submitted_by)
         VALUES (?,?,?,?,?,?,?)`,
        [req.params.project_id, num, engagement_id, title, submittal_type||'shop_drawing',
         req.file?.path||null, req.session.user.id]
      );
      result = r;
    });

    audit.log({ userId: req.session.user.id, action: 'submittal.create',
      entityType: 'submittals', entityId: result.insertId,
      details: { project_id: parseInt(req.params.project_id, 10), submittal_number: num, engagement_id: parseInt(engagement_id, 10), submittal_type: submittal_type || 'shop_drawing' }, req });

    // PMC approval poll (B3, friction-reduction brief)
    try {
      const signoffGate = require('../../../services/signoff-gate');
      await signoffGate.triggerSignoff(
        'submittal_pmc_review',
        result.insertId,
        parseInt(req.params.project_id, 10),
        {
          question: `Submittal ${num} — ${title?.slice(0, 60) || submittal_type || 'shop drawing'} — review required.`,
          triggeredBy: req.session.user.id,
        }
      );
    } catch (e) {
      console.warn('[submittals] PMC review poll failed:', e.message);
    }

    // D2 — Design/Services Head poll based on submittal type
    // shop_drawing + product_data → design head. material_sample + test_report → services head.
    const designTypes    = ['shop_drawing', 'product_data'];
    const servicesTypes  = ['material_sample', 'test_report'];
    const headWorkflow   = designTypes.includes(submittal_type)   ? 'submittal_design_review'
                         : servicesTypes.includes(submittal_type) ? 'submittal_services_review'
                         : null;
    if (headWorkflow) {
      try {
        const signoffGate = require('../../../services/signoff-gate');
        await signoffGate.triggerSignoff(
          headWorkflow,
          result.insertId,
          parseInt(req.params.project_id, 10),
          {
            question: `Submittal ${num} — ${title?.slice(0, 60) || submittal_type} — ${headWorkflow.includes('design') ? 'Design' : 'Services'} Head review required.`,
            triggeredBy: req.session.user.id,
          }
        );
      } catch (e) {
        console.warn('[submittals] head review poll failed:', e.message);
      }
    }

    res.json({ success: true, id: result.insertId, submittal_number: num });
  }));

router.patch('/:id/review', requireAuth,
  requirePermission('workflow.submittal.review'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { status, review_comments } = req.body;
    const validStatuses = ['approved','approved_with_comments','resubmit_required','rejected'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const [[cur]] = await db.query('SELECT status FROM submittals WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Submittal not found' });
    const sm = require('../../../services/state-machines').submittal;
    try {
      await sm.transition({
        id: parseInt(req.params.id, 10), from: cur.status, to: status,
        extraCols: {
          reviewed_by: me.id, reviewed_at: new Date(),
          review_comments: review_comments || null,
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    if (status === 'resubmit_required') {
      await db.query('UPDATE submittals SET resubmit_count=resubmit_count+1 WHERE id=?', [req.params.id]);
    }
    audit.log({ userId: me.id, action: 'submittal.review',
      entityType: 'submittals', entityId: parseInt(req.params.id, 10),
      details: { from: cur.status, status, review_comments: review_comments || null }, req });
    res.json({ success: true });
  }));

module.exports = router;
