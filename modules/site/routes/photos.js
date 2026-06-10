// routes/photos.js
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const storage = require('../../../services/file-storage');
const { requireAuth, requireProjectScope } = require('../../../middleware/auth');
const { upload, compressPhoto, getFileSize } = require('../../../middleware/upload');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const fileUrls = require('../../../services/file-url');
const router  = express.Router();

// GET /api/photos/:project_id — get photos for a project/date
// Returns photos from across all entity types in the project: site progress
// photos, issue photos, snag photos. Each photo includes `entity_type` so the
// frontend can render a visual marker (📷 for progress, ⚠ for issue/snag).
//
// Query params:
//   date     — filter to YYYY-MM-DD (matches photo_date)
//   task_id  — filter progress photos to a specific schedule task
//   types    — comma-separated entity types to include
//              (default: 'project_progress,issue' — i.e. progress + defect)
//              Pass 'all' to include every type, or e.g. 'project_progress'
//              to restrict to progress-only (the legacy behaviour).
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { date, task_id, types } = req.query;
    const VALID_TYPES = ['project_progress', 'issue', 'meeting', 'daily_report', 'snag', 'generic'];
    let typesFilter;
    if (types === 'all') {
      typesFilter = VALID_TYPES;
    } else if (types) {
      typesFilter = types.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t));
      if (!typesFilter.length) typesFilter = ['project_progress', 'issue'];
    } else {
      typesFilter = ['project_progress', 'issue'];   // sensible default
    }

    const params = [req.params.project_id, ...typesFilter];
    let where = `WHERE project_id = ? AND primary_entity_type IN (${typesFilter.map(() => '?').join(',')})`;

    if (date)    { where += ' AND photo_date = ?'; params.push(date); }
    if (task_id) {
      // task_id only applies to progress photos
      where += ` AND ((primary_entity_type = 'project_progress' AND primary_entity_id = ?) OR primary_entity_type != 'project_progress')`;
      params.push(task_id);
    }

    const [photos] = await db.query(
      `SELECT id, project_id, file_path, file_size_kb, caption, source,
              uploaded_by, uploaded_at, photo_date,
              primary_entity_type AS entity_type,
              primary_entity_id   AS entity_id,
              -- legacy aliases for older readers that haven't been updated
              CASE WHEN primary_entity_type = 'project_progress' THEN primary_entity_id ELSE NULL END AS task_id
       FROM entity_photos
       ${where}
       ORDER BY uploaded_at DESC`,
      params
    );

    // Hydrate uploader names and (for issue/snag photos) the issue number
    // so the frontend can show "Defect SNAG-0042" alongside the photo.
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(photos.map(p => p.uploaded_by).filter(Boolean));
    photos.forEach(p => {
      p.uploaded_by_name = users.get(p.uploaded_by)?.full_name || null;
      p.file_url = fileUrls.fileUrl(p.file_path);
    });

    const issueIds = [...new Set(photos
      .filter(p => p.entity_type === 'issue' && p.entity_id)
      .map(p => p.entity_id))];
    if (issueIds.length) {
      const [issueRows] = await db.query(
        `SELECT id, issue_number, issue_type, severity, status, trade
         FROM issues WHERE id IN (${issueIds.map(() => '?').join(',')})`,
        issueIds
      );
      const byId = new Map(issueRows.map(r => [r.id, r]));
      photos.forEach(p => {
        if (p.entity_type === 'issue' && byId.has(p.entity_id)) {
          const r = byId.get(p.entity_id);
          p.linked_issue = {
            id: r.id, issue_number: r.issue_number, issue_type: r.issue_type,
            severity: r.severity, status: r.status, trade: r.trade,
          };
        }
      });
    }

    res.json({ photos });
  }));

// POST /api/photos/:project_id/upload — upload photos
router.post('/:project_id/upload', requireAuth, requireProjectScope(),
  upload.array('photo', 40), asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { task_id, caption, source } = req.body;
    const files = req.files;
    if (!files?.length) return res.status(400).json({ error: 'No photos uploaded' });

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const saved = [];

    for (const file of files) {
      await compressPhoto(file.path);
      const photoId = await storage.savePhoto({
        projectId: pid, file, uploadedBy: me.id,
        taskId: task_id || null, caption: caption || null,
        source: source || 'app', photoDate: today,
      });
      saved.push(photoId);
      const r = { insertId: photoId };   // preserve name for downstream refs below

      // v2: if user pre-tagged (task_id given), persist as current tag from their role
      if (task_id) {
        const sourceMap = {
          site_manager:'site_manager', pmc_head:'pmc', principal:'principal', design_principal:'principal',
          design_head:'design', detailing_head:'design', team_lead:'design', jr_architect:'design', detailing:'design',
          services_head:'services', services_engineer:'services',
        };
        await db.query(
          `INSERT INTO photo_tags (photo_id, task_id, caption, tagged_by, tag_source, is_current)
           VALUES (?,?,?,?,?,1)`,
          [r.insertId, task_id, caption || null, me.id, sourceMap[me.role] || 'site_manager']
        ).catch(e => console.error('Initial tag insert:', e.message));
      }
    }

    // v2: trigger AI tagging async for every photo just uploaded (respond quickly)
    audit.log({ userId: me.id, action: 'photo.upload',
      entityType: 'entity_photos', entityId: null,
      details: { project_id: parseInt(pid), count: saved.length, ids: saved, task_id: task_id || null, source: source || 'app' }, req });
    // Apply timestamp watermark to each saved photo
    const projectCode = (await db.query('SELECT code FROM projects WHERE id=?', [pid]))[0][0]?.code || '';
    for (const photoId of saved) {
      const [[photo]] = await db.query('SELECT file_path FROM project_photos WHERE id=?', [photoId]);
      if (photo?.file_path) await applyTimestampWatermark(photo.file_path, projectCode);
    }

    res.json({ success: true, count: saved.length, ids: saved, ai_tagging: 'scheduled' });

    setImmediate(async () => {
      try {
        const aiToggles = require('../../../services/ai-toggles');
        if (!await aiToggles.isEnabled('photo_auto_tagging')) return;
        const ai = require('../../../services/ai');
        const today2 = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const [tasks] = await db.query(
          `SELECT st.id, st.task_name, st.trade FROM schedule_tasks st
           JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
           WHERE st.project_id = ? AND st.start_date <= ? AND st.end_date >= ?
           LIMIT 30`,
          [pid, today2, today2]
        );
        const project = { name: await users.projectName(pid) };

        for (const photoId of saved) {
          try {
            const [[photo]] = await db.query('SELECT * FROM project_photos WHERE id = ?', [photoId]);
            if (!photo) continue;
            const [[currentTag]] = await db.query(
              'SELECT * FROM photo_tags WHERE photo_id = ? AND is_current = 1',
              [photoId]
            );

            const result = await ai.tagAndValidatePhoto({
              imagePath: photo.file_path,
              siteManagerTag: currentTag ? { taskId: currentTag.task_id, caption: currentTag.caption } : null,
              candidateTasks: tasks,
              projectName: project?.name,
            });
            if (!result) continue;

            if (!currentTag) {
              // No human tag — AI's suggestion becomes current (source='ai')
              await db.query(
                `INSERT INTO photo_tags (photo_id, task_id, trade, caption, tagged_by, tag_source, is_current, ai_confidence, ai_note)
                 VALUES (?,?,?,?,NULL,'ai',1,?,?)`,
                [photoId, result.suggested_task_id || null, result.trade_visible || null,
                 result.suggested_caption || null, result.confidence || 'low',
                 result.note_for_reviewer || null]
              );
            } else if (result.matches_site_manager_tag === false) {
              // AI disagrees — record non-current for PMC dispute view
              await db.query(
                `INSERT INTO photo_tags (photo_id, task_id, trade, caption, tagged_by, tag_source, is_current, ai_confidence, ai_note, replaces_tag_id)
                 VALUES (?,?,?,?,NULL,'ai',0,?,?,?)`,
                [photoId, result.suggested_task_id || null, result.trade_visible || null,
                 result.suggested_caption || null, result.confidence || 'low',
                 result.note_for_reviewer || 'AI disagreement', currentTag.id]
              );
            }
          } catch (e) {
            console.error('[AI photo tag]', photoId, e.message);
          }
        }
      } catch (e) {
        console.error('[AI photo pipeline] error:', e.message);
      }
    });

  }));

// GET /api/photos/:project_id/documents — get documents
router.get('/:project_id/documents', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { date } = req.query;
    const params = [req.params.project_id];
    let where = 'WHERE project_id = ?';
    if (date) { where += ' AND doc_date = ?'; params.push(date); }

    const [docs] = await db.query(
      `SELECT * FROM project_documents
       ${where} ORDER BY uploaded_at DESC`,
      params
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(docs.map(d => d.uploaded_by).filter(Boolean));
    docs.forEach(d => {
      d.uploaded_by_name = users.get(d.uploaded_by)?.full_name || null;
      d.file_url = fileUrls.fileUrl(d.file_path);
    });
    res.json({ documents: docs });
  }));

// POST /api/photos/:project_id/documents/upload — upload document
router.post('/:project_id/documents/upload', requireAuth, requireProjectScope(),
  upload.single('document'), asyncHandler(async (req, res) => {
    const me   = req.session.user;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const result = await storage.saveDocument({
      projectId: req.params.project_id, file, uploadedBy: me.id,
      docType: req.body.doc_type || 'other',
      notes: req.body.notes || null, docDate: today,
    });

    audit.log({ userId: me.id, action: 'document.upload_via_photos',
      entityType: 'project_documents', entityId: result?.documentId || null,
      details: { project_id: parseInt(req.params.project_id), doc_type: req.body.doc_type || 'other' }, req });

    res.json({ success: true });
  }));

module.exports = router;
