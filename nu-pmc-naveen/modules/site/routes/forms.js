// routes/forms.js — Custom form templates and submissions
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requirePrincipal, requirePMC, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { upload } = require('../../../middleware/upload');
const xl      = require('../../../middleware/excel');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const { PMC_ROLES, PRINCIPALS } = require('../../../services/roles');
const router  = express.Router();

// GET /api/forms/templates — all approved templates
router.get('/templates', requireAuth, asyncHandler(async (req, res) => {
    const [templates] = await db.query(
      `SELECT * FROM form_templates
       WHERE status = 'approved' OR created_by = ?
       ORDER BY is_standard DESC, name`,
      [req.session.user.id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(templates.map(t => t.created_by).filter(Boolean));
    templates.forEach(t => { t.created_by_name = users.get(t.created_by)?.full_name || null; });
    res.json({ templates });
  }));

// POST /api/forms/templates — create new template
router.post('/templates', requireAuth, upload.single('excel'), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { name, category, fields_json, project_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name required' });

    // Principals auto-approved, others need approval
    const isAutoApproved = PRINCIPALS.includes(me.role);

    // If Excel uploaded — parse fields from it
    let fields = fields_json ? JSON.parse(fields_json) : [];
    if (req.file && !fields.length) {
      const rows = await xl.readFile(req.file.path);
      fields = rows.map((row, i) => ({
        id: i + 1,
        label: row['Field Label'] || row['Label'] || `Field ${i+1}`,
        type:  row['Type'] || 'text',
        required: row['Required'] === 'Yes',
      }));
    }

    const [result] = await db.query(
      `INSERT INTO form_templates (name, category, fields_json, created_by, project_id, file_path,
       status, approved_by, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [name, category||'custom', JSON.stringify(fields), me.id, project_id||null,
       req.file?.path||null,
       isAutoApproved ? 'approved' : 'draft',
       isAutoApproved ? me.id : null,
       isAutoApproved ? new Date() : null]
    );

    audit.log({ userId: me.id, action: 'form_template.create',
      entityType: 'form_templates', entityId: result.insertId,
      details: { name, category: category || 'custom', auto_approved: isAutoApproved, project_id: project_id || null, field_count: fields.length }, req });

    res.json({
      success: true, id: result.insertId,
      status: isAutoApproved ? 'approved' : 'draft',
      message: isAutoApproved ? 'Template created and approved.' : 'Template created — pending Naveen or PMC Head approval.',
    });
  }));

// PATCH /api/forms/templates/:id/approve — Naveen or PMC Head approves
router.patch('/templates/:id/approve', requireAuth, requireRole(...PMC_ROLES), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[cur]] = await db.query('SELECT status FROM form_templates WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Form template not found' });
    if (cur.status === 'approved') return res.json({ success: true });   // idempotent

    const sm = require('../../../services/state-machines').formTemplate;
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: cur.status, to: 'approved',
        extraCols: { approved_by: me.id, approved_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    const approvals = require('../../../services/approvals');
    await approvals.close({ refTable: 'form_templates', refId: parseInt(req.params.id), actionedBy: req.session.user.id }).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
    audit.log({ userId: me.id, action: 'form_template.approve',
      entityType: 'form_templates', entityId: parseInt(req.params.id),
      details: { approver_role: me.role }, req });
    res.json({ success: true, message: 'Template approved — available for use on all projects.' });
  }));

// GET /api/forms/templates/:id/download — download as Excel for offline editing
router.get('/templates/:id/download', requireAuth, asyncHandler(async (req, res) => {
    const [[template]] = await db.query('SELECT * FROM form_templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const fields = JSON.parse(template.fields_json || '[]');
    const data   = [
      ['Field Label', 'Type', 'Required', 'Options (comma separated)'],
      ...fields.map(f => [f.label, f.type || 'text', f.required ? 'Yes' : 'No', f.options || '']),
      // Empty rows for adding new fields
      ['', 'text', 'No', ''],
      ['', 'text', 'No', ''],
      ['', 'text', 'No', ''],
    ];

    const outPath = `/tmp/form_template_${template.id}_${Date.now()}.xlsx`;
    await xl.writeFile(data, outPath, template.name);
    res.download(outPath, `${template.name.replace(/\s/g,'_')}_template.xlsx`);
  }));

// POST /api/forms/:project_id/submit — submit a filled form
router.post('/:project_id/submit', requireAuth, requireProjectScope(), upload.single('form'), asyncHandler(async (req, res) => {
    const { template_id, responses_json, notes } = req.body;
    if (!template_id) return res.status(400).json({ error: 'Template ID required' });

    const [[template]] = await db.query('SELECT * FROM form_templates WHERE id = ?', [template_id]);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const [r] = await db.query(
      `INSERT INTO form_submissions (template_id, template_version, project_id, submitted_by, responses_json, file_path, notes)
       VALUES (?,?,?,?,?,?,?)`,
      [template_id, template.version, req.params.project_id, req.session.user.id,
       responses_json || '{}', req.file?.path||null, notes||null]
    );
    audit.log({ userId: req.session.user.id, action: 'form_submission.create',
      entityType: 'form_submissions', entityId: r.insertId,
      details: { project_id: parseInt(req.params.project_id), template_id: parseInt(template_id), template_version: template.version }, req });
    res.json({ success: true, message: 'Form submitted.' });
  }));

// GET /api/forms/:project_id/submissions
router.get('/:project_id/submissions', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const [subs] = await db.query(
      `SELECT fs.*, ft.name AS template_name
       FROM form_submissions fs
       JOIN form_templates ft ON fs.template_id = ft.id
       WHERE fs.project_id = ? ORDER BY fs.submitted_at DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(subs.map(s => s.submitted_by).filter(Boolean));
    subs.forEach(s => { s.submitted_by_name = users.get(s.submitted_by)?.full_name || null; });
    res.json({ submissions: subs });
  }));

module.exports = router;
