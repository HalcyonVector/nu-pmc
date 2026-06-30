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
    const fileUrls = require('../../../services/file-url');
    const users = await Auth.functions.getUsers(templates.map(t => t.created_by).filter(Boolean));
    templates.forEach(t => {
      t.created_by_name = users.get(t.created_by)?.full_name || null;
      t.template_url = t.file_path ? fileUrls.fileUrl(t.file_path) : null;
      delete t.file_path;
    });
    res.json({ templates });
  }));

// POST /api/forms/templates — create new template
router.post('/templates', requireAuth, upload.single('excel'), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { name, category, fields_json, project_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name required' });

    // Principals auto-approved, others need approval
    const isAutoApproved = [...PMC_ROLES, ...PRINCIPALS].includes(me.role);

    // If Excel uploaded — parse fields from it
    let fields = fields_json ? JSON.parse(fields_json) : [];
    if (req.file && !fields.length) {
      const rows = await xl.readFile(req.file.path);
      // Detect format: inspection checklist (has "Check Item") vs field-definition sheet (has "Field Label")
      const sample = rows[0] || {};
      if ('Check Item' in sample || 'check_item' in sample || 'Item' in sample) {
        // Inspection checklist — each row IS a check item; use it as the field label
        fields = rows
          .filter(r => r['Check Item'] || r['Item'] || r['S.No.'])
          .map((r, i) => ({
            id: i + 1,
            label: r['Check Item'] || r['Item'] || `Item ${i+1}`,
            type: 'text',
            required: false,
            spec: r['Specification'] || r['Spec'] || '',
          }));
      } else {
        // Standard field-definition format
        fields = rows.map((row, i) => ({
          id: i + 1,
          label: row['Field Label'] || row['Label'] || `Field ${i+1}`,
          type:  row['Type'] || 'text',
          required: row['Required'] === 'Yes',
        }));
      }
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
      message: isAutoApproved ? 'Template created and approved.' : 'Template created — pending Principal or PMC Head approval.',
    });
  }));

// PATCH /api/forms/templates/:id/approve — Principal or PMC Head approves
router.patch('/templates/:id/approve', requireAuth, requireRole(...PMC_ROLES), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[cur]] = await db.query('SELECT status FROM form_templates WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Form template not found' });
    if (cur.status === 'approved') return res.json({ success: true });   // idempotent

    const sm = require('../../../services/state-machines').formTemplate;
    try {
      await sm.transition({
        id: parseInt(req.params.id, 10), from: cur.status, to: 'approved',
        extraCols: { approved_by: me.id, approved_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: me.id, action: 'form_template.approve',
      entityType: 'form_templates', entityId: parseInt(req.params.id, 10),
      details: { approver_role: me.role }, req });
    res.json({ success: true, message: 'Template approved — available for use on all projects.' });
  }));

// GET /api/forms/templates/:id/download — serve original file if uploaded, else generate XLSX
router.get('/templates/:id/download', requireAuth, asyncHandler(async (req, res) => {
    const [[template]] = await db.query('SELECT * FROM form_templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // If an original file was uploaded, serve it directly
    if (template.file_path) {
      const path = require('path');
      const fs   = require('fs');
      const ext  = path.extname(template.file_path) || '.xlsx';
      const filename = `${template.name.replace(/[^a-zA-Z0-9_\-]/g,'_')}_template${ext}`;
      if (fs.existsSync(template.file_path)) {
        return res.download(template.file_path, filename);
      }
    }

    // Fall back: generate XLSX from fields_json
    const fields = JSON.parse(template.fields_json || '[]');
    const data   = [
      ['Field Label', 'Specification', 'Status (OK/NOT OK/NA)', 'Remarks'],
      ...fields.map(f => [f.label, f.spec || '', '', '']),
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
      details: { project_id: parseInt(req.params.project_id, 10), template_id: parseInt(template_id, 10), template_version: template.version }, req });
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
    const fileUrls = require('../../../services/file-url');
    subs.forEach(s => {
      s.submitted_by_name = users.get(s.submitted_by)?.full_name || null;
      s.file_url = s.file_path ? fileUrls.fileUrl(s.file_path) : null;
    });
    res.json({ submissions: subs });
  }));

module.exports = router;
