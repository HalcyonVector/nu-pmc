// routes/register.js — Drawing Register
// ======================================
// At project initiation, Rajani (design) and Srinath (services) each upload an Excel
// drawing register — the master list of every main drawing that will exist on the
// project. Only drawings on this register can be uploaded later as 'main' drawings.
//
// Sign-off: Naveen or Ajay signs off the register before it is "locked".
// Amendments: Rajani/Srinath can add entries after sign-off; every addition is logged.
//
// Expected Excel columns (case-insensitive, flexible):
//   Drawing No | Drawing Name | Category | Expected Rev (optional) | Notes (optional)
// ======================================

const express = require('express');
const db      = require('../../../middleware/db');
const ExcelJS = require('exceljs');
const { requireAuth, requirePrincipal, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { upload } = require('../../../middleware/upload');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const { STREAM_HEADS_OR_PRINCIPAL: STREAM_HEADS } = require('../../../services/roles');
// Cross-module contracts — hoisted to module scope (no circular deps).
// Onboarding: setChecklistFlag after register upload.
// Auth: user hydration for uploaded_by / signed_off_by fields.
const Onboarding = require('../../onboarding/contract');
const Auth = require('../../auth/contract');
const router = require('express').Router();


// GET /api/register/:project_id — list register entries (filtered by stream if given)
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { stream } = req.query;
    const params = [req.params.project_id];
    let where = 'WHERE project_id = ?';
    if (stream) { where += ' AND stream = ?'; params.push(stream); }

    const [rows] = await db.query(
      `SELECT * FROM drawing_register ${where}
       ORDER BY category, drawing_number`,
      params
    );
    // Auth is required at module scope — see top of file.
    const users = await Auth.functions.getUsers(
      rows.flatMap(r => [r.uploaded_by, r.signed_off_by].filter(Boolean))
    );
    rows.forEach(r => {
      r.uploaded_by_name   = users.get(r.uploaded_by)?.full_name   || null;
      r.signed_off_by_name = users.get(r.signed_off_by)?.full_name || null;
    });

    // Count summary
    const summary = {
      total:       rows.length,
      pending:     rows.filter(r => r.status === 'pending').length,
      in_progress: rows.filter(r => r.status === 'in_progress').length,
      issued:      rows.filter(r => r.status === 'issued').length,
    };

    res.json({ register: rows, summary });
  }));

// POST /api/register/:project_id/upload — Rajani or Srinath uploads Excel register
router.post('/:project_id/upload', requireAuth, requireProjectScope(),
  requireRole(...STREAM_HEADS),
  upload.single('register'), asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { stream } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!stream || !['design','services'].includes(stream)) {
      return res.status(400).json({ error: 'stream must be "design" or "services"' });
    }

    // Parse Excel
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(req.file.path);
    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'Could not read first worksheet' });

    // Extract header row, then rows as keyed objects
    const headerRow = ws.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, col) => { headers[col] = (cell.value || '').toString().trim(); });

    const rows = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const obj = {};
      row.eachCell((cell, col) => {
        const key = headers[col];
        if (key) obj[key] = cell.value === null || cell.value === undefined ? '' : cell.value;
      });
      if (Object.keys(obj).length) rows.push(obj);
    });

    if (!rows.length) return res.status(400).json({ error: 'Register file is empty' });

    const designCats   = ['Architectural','Structural','Civil','Interior'];
    const servicesCats = ['Electrical','HVAC','Plumbing','Fire','IT'];
    const validCats    = stream === 'design' ? designCats : servicesCats;

    const imported = [];
    const skipped  = [];
    const errors   = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Flexible column mapping
      const drawingNumber = (row['Drawing No']  || row['Drawing Number'] || row['drawing_number'] || row['No'] || '').toString().trim();
      const drawingName   = (row['Drawing Name']|| row['Name']           || row['drawing_name']   || '').toString().trim();
      const category      = (row['Category']    || row['category']       || '').toString().trim();
      const expectedRev   = (row['Expected Rev']|| row['Rev']            || row['expected_revision'] || '').toString().trim();
      const notes         = (row['Notes']       || row['notes']          || '').toString().trim();

      if (!drawingNumber || !drawingName || !category) {
        errors.push({ row: i + 2, reason: 'Missing Drawing No / Name / Category' });
        continue;
      }
      if (!validCats.includes(category)) {
        errors.push({ row: i + 2, drawing_number: drawingNumber, reason: `Invalid category "${category}" for ${stream} stream` });
        continue;
      }

      try {
        await db.query(
          `INSERT INTO drawing_register
             (project_id, drawing_number, drawing_name, category, stream, expected_revision, notes, uploaded_by)
           VALUES (?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             drawing_name      = VALUES(drawing_name),
             category          = VALUES(category),
             expected_revision = VALUES(expected_revision),
             notes             = VALUES(notes)`,
          [pid, drawingNumber, drawingName, category, stream,
           expectedRev || null, notes || null, me.id]
        );
        imported.push(drawingNumber);
      } catch (e) {
        skipped.push({ drawing_number: drawingNumber, reason: e.message });
      }
    }

    // Update project checklist for this stream.
    // Onboarding is required at module scope — see top of file.
    if (imported.length) {
      const field = stream === 'design' ? 'checklist_design_register' : 'checklist_services_register';
      await Onboarding.functions.setChecklistFlag(pid, field);
    }

    audit.log({ userId: me.id, action: 'drawing_register.upload',
      entityType: 'drawing_register', entityId: null,
      details: { project_id: parseInt(pid), stream, imported: imported.length, skipped: skipped.length, errors: errors.length }, req });

    res.json({
      success: true,
      stream,
      imported_count: imported.length,
      skipped_count:  skipped.length,
      error_count:    errors.length,
      imported_sample: imported.slice(0, 20),
      skipped,
      errors,
      message: `Register uploaded: ${imported.length} drawings imported${errors.length ? `, ${errors.length} rows had errors` : ''}. Awaiting sign-off by Naveen or Ajay.`
    });

  }));

// POST /api/register/:project_id/add — add a single entry to register (post-sign-off amendment)
router.post('/:project_id/add', requireAuth, requireProjectScope(), requireRole(...STREAM_HEADS), async (req, res) => {
  try {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { RegisterEntryAdd, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(RegisterEntryAdd, req, res);
    if (!body) return;
    const { drawing_number, drawing_name, category, stream, expected_revision, notes } = body;

    const [result] = await db.query(
      `INSERT INTO drawing_register
         (project_id, drawing_number, drawing_name, category, stream, expected_revision, notes, uploaded_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [pid, drawing_number, drawing_name, category, stream,
       expected_revision || null, notes || null, me.id]
    );

    audit.log({ userId: me.id, action: 'drawing_register.add',
      entityType: 'drawing_register', entityId: result.insertId,
      details: { project_id: parseInt(pid), drawing_number, drawing_name, category, stream }, req });

    res.json({
      success: true,
      id: result.insertId,
      message: `Drawing ${drawing_number} added to register. Naveen or Ajay can sign off on this amendment.`
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This drawing number is already on the register' });
    }
    console.error('Add register entry error:', err);
    res.status(500).json({ error: 'Failed to add register entry' });
  }
});

// POST /api/register/:project_id/sign-off — Naveen or Ajay signs off the register
router.post('/:project_id/sign-off', requireAuth, requireProjectScope(), requirePrincipal, async (req, res) => {
  try {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { stream } = req.body; // 'design', 'services', or both if omitted

    const params = [me.id, pid];
    let where = 'project_id = ? AND signed_off_by IS NULL';
    if (stream) {
      where = 'project_id = ? AND stream = ? AND signed_off_by IS NULL';
      params.push(stream);
      params.splice(1, 0); // no-op, keep readable
    }

    let query, args;
    if (stream) {
      query = 'UPDATE drawing_register SET signed_off_by = ?, signed_off_at = NOW() WHERE project_id = ? AND stream = ? AND signed_off_by IS NULL';
      args  = [me.id, pid, stream];
    } else {
      query = 'UPDATE drawing_register SET signed_off_by = ?, signed_off_at = NOW() WHERE project_id = ? AND signed_off_by IS NULL';
      args  = [me.id, pid];
    }

    const [result] = await db.query(query, args);

    audit.log({ userId: me.id, action: 'drawing_register.sign_off',
      entityType: 'drawing_register', entityId: null,
      details: { project_id: parseInt(pid), stream: stream || 'all', signed_count: result.affectedRows }, req });

    res.json({
      success: true,
      signed_count: result.affectedRows,
      message: `${result.affectedRows} register entries signed off.`
    });
  } catch (_err) { res.status(500).json({ error: 'Sign-off failed' }); }
});

// DELETE /api/register/:project_id/:entry_id — remove a register entry
// Only allowed if no drawings have been uploaded against this entry yet
router.delete('/:project_id/:entry_id', requireAuth, requireProjectScope(), requireRole(...STREAM_HEADS), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[entry]] = await db.query('SELECT * FROM drawing_register WHERE id = ?', [req.params.entry_id]);
    if (!entry) return res.status(404).json({ error: 'Register entry not found' });
    if (entry.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot delete — drawings already uploaded against this entry' });
    }

    await db.query('DELETE FROM drawing_register WHERE id = ?', [req.params.entry_id]);
    audit.log({ userId: me.id, action: 'drawing_register.delete',
      entityType: 'drawing_register', entityId: parseInt(req.params.entry_id),
      details: { project_id: parseInt(req.params.project_id), drawing_number: entry.drawing_number, stream: entry.stream }, req });
    res.json({ success: true });
  }));

// GET /api/register/:project_id/template — download Excel template
router.get('/:project_id/template', requireAuth, asyncHandler(async (req, res) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Drawing Register');
    ws.columns = [
      { header: 'Drawing No',   key: 'no',   width: 16 },
      { header: 'Drawing Name', key: 'name', width: 36 },
      { header: 'Category',     key: 'cat',  width: 18 },
      { header: 'Expected Rev', key: 'rev',  width: 14 },
      { header: 'Notes',        key: 'notes',width: 30 },
    ];
    ws.addRows([
      { no: 'A-101', name: 'Ground Floor Plan',  cat: 'Architectural', rev: 'R2', notes: 'Include furniture layout' },
      { no: 'A-102', name: 'First Floor Plan',   cat: 'Architectural', rev: 'R2' },
      { no: 'S-201', name: 'Foundation Details', cat: 'Structural',    rev: 'R1' },
      { no: 'C-301', name: 'Site Drainage Plan', cat: 'Civil',         rev: 'R0' },
    ]);
    ws.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="drawing-register-template.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }));

module.exports = router;
