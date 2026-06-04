// routes/weekly-signoff.js
// ===========================================================
// Weekly client report — 3-way sign-off chain:
//   PMC Head signs PMC section      \
//   Design Head signs design section  >  then Principal approves  →  PDF generated  →  locked
//   Services Head signs services sec /
// All three stream sign-offs required before Principal can approve.
// PDF is generated only on Principal approval; photos referenced in the report
// are locked at that moment (is_locked=1, locked_by_report_id=report.id).
// ===========================================================

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requireRole } = require('../../../middleware/auth');
const { hasEffectiveRole, requireGovernanceAuthority } = require('../../../middleware/delegation');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const { PRINCIPALS } = require('../../../services/roles');
const fileUrls = require('../../../services/file-url');
const router  = express.Router();


// GET /api/weekly-signoff/:report_id — get full state for sign-off UI
router.get('/:report_id', requireAuth, asyncHandler(async (req, res) => {
    const [[report]] = await db.query(
      `SELECT * FROM weekly_reports WHERE id = ?`,
      [req.params.report_id]
    );
    if (!report) return res.status(404).json({ error: 'Weekly report not found' });

    const Onboarding = require('../../onboarding/contract');
    const proj = await Onboarding.functions.getProject(report.project_id);
    report.project_name = proj?.name || null;
    report.project_code = proj?.code || null;

    // Hydrate 5 user names via Auth contract
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers([
      report.drafted_by, report.sig_pmc_by, report.sig_design_by,
      report.sig_services_by, report.approved_by,
    ].filter(Boolean));
    report.drafted_by_name    = users.get(report.drafted_by)?.full_name    || null;
    report.sig_pmc_name       = users.get(report.sig_pmc_by)?.full_name    || null;
    report.sig_design_name    = users.get(report.sig_design_by)?.full_name || null;
    report.sig_services_name  = users.get(report.sig_services_by)?.full_name || null;
    report.approved_by_name   = users.get(report.approved_by)?.full_name   || null;
    report.pdf_url            = fileUrls.fileUrl(report.pdf_path);

    // Photos linked to this report
    const [photos] = await db.query(
      `SELECT pp.*, pt.caption AS tag_caption, st.task_name
       FROM weekly_report_photos wrp
       JOIN project_photos pp ON wrp.photo_id = pp.id
       LEFT JOIN photo_tags pt ON pp.id = pt.photo_id AND pt.is_current = 1
       LEFT JOIN schedule_tasks st ON pt.task_id = st.id
       WHERE wrp.weekly_report_id = ?
       ORDER BY pp.photo_date`,
      [req.params.report_id]
    );
    photos.forEach(p => { p.file_url = fileUrls.fileUrl(p.file_path); });

    res.json({ report, photos });
  }));

// POST /api/weekly-signoff/:report_id/edit-section
// Body: { section: 'pmc'|'design'|'services', content }
router.post('/:report_id/edit-section', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { section, content } = req.body;
    if (!['pmc','design','services'].includes(section)) return res.status(400).json({ error: 'Invalid section' });

    const [[report]] = await db.query('SELECT * FROM weekly_reports WHERE id = ?', [req.params.report_id]);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status === 'sent' || report.status === 'approved') {
      return res.status(400).json({ error: 'Report already approved/sent — cannot edit' });
    }

    // Role gate — each section can only be edited by matching stream head (or delegates/principals)
    let allowed = false;
    if (section === 'pmc') {
      const r = await hasEffectiveRole(me, ['principal','design_principal','pmc_head'], report.project_id);
      allowed = r.allowed;
    } else if (section === 'design') {
      const r = await hasEffectiveRole(me, ['principal','design_principal','design_head','detailing_head','team_lead'], report.project_id);
      allowed = r.allowed;
    } else if (section === 'services') {
      const r = await hasEffectiveRole(me, ['principal','design_principal','services_head','services_engineer'], report.project_id);
      allowed = r.allowed;
    }
    if (!allowed) return res.status(403).json({ error: `You cannot edit the ${section} section` });

    // Save section — and void the corresponding sign-off if it already existed (they re-sign)
    const colMap = { pmc:'pmc_section', design:'design_section', services:'services_section' };
    const sigCol = { pmc:'sig_pmc_by',   design:'sig_design_by',   services:'sig_services_by' };
    const sigTs  = { pmc:'sig_pmc_at',   design:'sig_design_at',   services:'sig_services_at' };

    await db.query(
      `UPDATE weekly_reports SET ${colMap[section]} = ?, ${sigCol[section]} = NULL, ${sigTs[section]} = NULL WHERE id = ?`,
      [content || '', req.params.report_id]
    );

    audit.log({ userId: me.id, action: 'weekly_report.edit_section',
      entityType: 'weekly_reports', entityId: parseInt(req.params.report_id),
      details: { project_id: report.project_id, section, signoff_voided: true, content_length: (content || '').length }, req });

    res.json({ success: true });
  }));

// POST /api/weekly-signoff/:report_id/sign
// Body: { section: 'pmc'|'design'|'services' }
router.post('/:report_id/sign', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { section } = req.body;
    if (!['pmc','design','services'].includes(section)) return res.status(400).json({ error: 'Invalid section' });

    const [[report]] = await db.query('SELECT * FROM weekly_reports WHERE id = ?', [req.params.report_id]);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Role gate — governance action, so requireGovernanceAuthority (blocks limited_pmc/photo_tags_only delegates)
    let check;
    if (section === 'pmc') {
      check = await requireGovernanceAuthority(me, ['principal','design_principal','pmc_head'], report.project_id);
    } else if (section === 'design') {
      check = await requireGovernanceAuthority(me, ['principal','design_principal','design_head'], report.project_id);
    } else {
      check = await requireGovernanceAuthority(me, ['principal','design_principal','services_head'], report.project_id);
    }
    if (!check.allowed) return res.status(403).json({ error: `You cannot sign the ${section} section` });

    const sigCol = { pmc:'sig_pmc_by',  design:'sig_design_by',  services:'sig_services_by' };
    const sigTs  = { pmc:'sig_pmc_at',  design:'sig_design_at',  services:'sig_services_at' };

    await db.query(
      `UPDATE weekly_reports SET ${sigCol[section]} = ?, ${sigTs[section]} = NOW() WHERE id = ?`,
      [me.id, req.params.report_id]
    );

    // If all 3 signed, move status → pending_approval
    const [[r]] = await db.query('SELECT sig_pmc_by, sig_design_by, sig_services_by, status FROM weekly_reports WHERE id = ?', [req.params.report_id]);
    const allSigned = r.sig_pmc_by && r.sig_design_by && r.sig_services_by;
    if (allSigned && r.status === 'draft') {
      const { weeklyReport: wrSM } = require('../../../services/state-machines');
      await wrSM.transition({
        id: parseInt(req.params.report_id), from: 'draft', to: 'pending_approval',
        audit: { userId: req.session.user.id, req, details: { source: 'stream_signoff' } },
      }).catch(e => {
        if (e.code !== 'INVALID_STATE_TRANSITION') throw e;
      });
    }

    res.json({
      success: true,
      all_signed: !!allSigned,
      message: allSigned ? 'All 3 signatures collected — sent to Naveen/Ajay for final approval.' : `${section} section signed.`
    });
  }));

// POST /api/weekly-signoff/:report_id/principal-approve — Naveen/Ajay final approval
router.post('/:report_id/principal-approve', requireAuth, requireRole(...PRINCIPALS), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[report]] = await db.query('SELECT * FROM weekly_reports WHERE id = ?', [req.params.report_id]);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!report.sig_pmc_by || !report.sig_design_by || !report.sig_services_by) {
      return res.status(400).json({ error: 'All 3 section sign-offs required before Principal approval' });
    }

    const { weeklyReport: wrSM } = require('../../../services/state-machines');
    await wrSM.transition({
      id: parseInt(req.params.report_id), from: report.status, to: 'approved',
      extraCols: { approved_by: me.id, approved_at: new Date() },
      audit: { userId: me.id, req, details: { source: 'principal_approve' } },
    });

    // Lock photos referenced in this report
    await db.query(
      `UPDATE project_photos pp
       JOIN weekly_report_photos wrp ON pp.id = wrp.photo_id
       SET pp.is_locked = 1, pp.locked_at = NOW(), pp.locked_by_report_id = ?
       WHERE wrp.weekly_report_id = ?`,
      [req.params.report_id, req.params.report_id]
    );

    // PDF generation scheduled (actual PDF is built by a script — see scripts/build-weekly-pdf.js)
    setImmediate(async () => {
      try {
        const builder = require('../scripts/build-weekly-pdf');
        await builder.buildForReport(req.params.report_id).catch(e => console.error('PDF build:', e.message));
      } catch (e) { console.warn('[weekly-signoff]', e.message); }
    });

    res.json({ success: true, message: 'Approved. PDF is being generated.' });
  }));

module.exports = router;
