// routes/photos.js
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const storage = require('../../../services/file-storage');
const { requireAuth, requireProjectScope, requireScopeFromEntity } = require('../../../middleware/auth');
const { upload, compressPhoto, getFileSize } = require('../../../middleware/upload');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const fileUrls = require('../../../services/file-url');
const router  = express.Router();

// Timestamp watermark — non-blocking, best-effort
async function applyTimestampWatermark(filePath, projectCode) {
  try {
    const sharp = require('sharp');
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const text = projectCode ? `${projectCode} · ${dateStr}` : dateStr;
    const svgText = `<svg width="600" height="40"><text x="10" y="28" font-family="monospace" font-size="18" fill="white" stroke="black" stroke-width="0.5">${text}</text></svg>`;
    const watermark = Buffer.from(svgText);
    const composited = await sharp(filePath).composite([{ input: watermark, gravity: 'southwest' }]).toBuffer();
    await sharp(composited).toFile(filePath);
  } catch (e) {
    console.warn('[photos] watermark failed:', e.message);
  }
}

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

    const params = [req.params.project_id];
    let where = `WHERE pp.project_id = ?`;

    if (date) { where += ' AND pp.photo_date = ?'; params.push(date); }
    if (task_id) { where += ' AND pp.task_id = ?'; params.push(task_id); }

    // Filter by tag type using photo_tags.trade:
    //   'project_progress' → photos tagged as 'progress' (or untagged, since default is progress)
    //   'issue'            → photos tagged as 'defect'
    //   default (both)     → all photos
    // Allowlist guard — reject any value not explicitly expected (HIGH-1 fix)
    const VALID_TYPES = new Set(['project_progress', 'issue', 'all', 'project_progress,issue', undefined, '']);
    if (types && !VALID_TYPES.has(types)) return res.status(400).json({ error: 'Invalid types filter' });
    let typeFilter = '';
    if (types && types !== 'all' && types !== 'project_progress,issue') {
      if (types === 'project_progress') {
        // Progress = tagged 'progress' OR not tagged at all (default)
        typeFilter = ` AND (pt.trade = 'progress' OR pt.trade IS NULL)`;
      } else if (types === 'issue') {
        typeFilter = ` AND pt.trade = 'defect'`;
      }
    }

    const [photos] = await db.query(
      `SELECT pp.id, pp.project_id, pp.file_path, pp.file_size_kb, pp.caption, pp.source,
              pp.uploaded_by, pp.uploaded_at, pp.photo_date,
              CASE WHEN pt.trade = 'defect' THEN 'issue' ELSE 'project_progress' END AS entity_type,
              pp.task_id
       FROM project_photos pp
       LEFT JOIN photo_tags pt ON pt.photo_id = pp.id AND pt.is_current = 1
       ${where}${typeFilter}
       ORDER BY pp.uploaded_at DESC`,
      params
    );

    // Hydrate uploader names
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(photos.map(p => p.uploaded_by).filter(Boolean));
    photos.forEach(p => {
      p.uploaded_by_name = users.get(p.uploaded_by)?.full_name || null;
      p.file_url = fileUrls.fileUrl(p.file_path);
    });

    // For photos tagged as defects, try to find linked issues via issue_photos
    // that share the same file_path (snag-from-photo workflow)
    const defectPhotos = photos.filter(p => p.entity_type === 'issue');
    if (defectPhotos.length) {
      const paths = defectPhotos.map(p => p.file_path).filter(Boolean);
      if (paths.length) {
        const [issueRows] = await db.query(
          `SELECT ip.file_path, i.id, i.issue_number, i.issue_type, i.severity, i.status
           FROM issue_photos ip
           JOIN issues i ON ip.issue_id = i.id
           WHERE ip.project_id = ? AND ip.file_path IN (${paths.map(() => '?').join(',')})`,
          [req.params.project_id, ...paths]
        );
        const byPath = new Map(issueRows.map(r => [r.file_path, r]));
        defectPhotos.forEach(p => {
          if (byPath.has(p.file_path)) {
            const r = byPath.get(p.file_path);
            p.linked_issue = {
              id: r.id, issue_number: r.issue_number, issue_type: r.issue_type,
              severity: r.severity, status: r.status,
            };
          }
        });
      }
    }

    res.json({ photos });
  }));

// POST /api/photos/:project_id/upload — upload photos
router.post('/:project_id/upload', requireAuth, requireProjectScope(),
  upload.array('photo', 40), asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { task_id, caption, source, photo_date, tag } = req.body;
    const files = req.files;
    if (!files?.length) return res.status(400).json({ error: 'No photos uploaded' });

    // Tag type: 'defect' or 'progress' (default)
    const photoTag = tag === 'defect' ? 'defect' : 'progress';

    const today = photo_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const saved = [];

    const sourceMap = {
      site_manager:'site_manager', pmc_head:'pmc', principal:'principal', design_principal:'principal',
      design_head:'design', team_lead:'design', jr_architect:'design', jr_engineer:'design',
      services_head:'services', services_engineer:'services',
    };
    const tagSource = sourceMap[me.role] || 'site_manager';

    for (const file of files) {
      await compressPhoto(file.path);
      const photoId = await storage.savePhoto({
        projectId: pid, file, uploadedBy: me.id,
        taskId: task_id || null, caption: caption || null,
        source: source || 'app', photoDate: today,
      });
      saved.push(photoId);

      // Always insert a photo_tag row with trade = 'progress' or 'defect'
      await db.query(
        `INSERT INTO photo_tags (photo_id, task_id, trade, caption, tagged_by, tag_source, is_current)
         VALUES (?,?,?,?,?,?,1)`,
        [photoId, task_id || null, photoTag, caption || null, me.id, tagSource]
      ).catch(e => console.error('Photo tag insert:', e.message));
    }

    // v2: trigger AI tagging async for every photo just uploaded (respond quickly)
    audit.log({ userId: me.id, action: 'photo.upload',
      entityType: 'project_photos', entityId: null,
      details: { project_id: parseInt(pid, 10), count: saved.length, ids: saved, task_id: task_id || null, source: source || 'app' }, req });

    res.json({ success: true, count: saved.length, ids: saved, ai_tagging: 'scheduled' });

    // Apply timestamp watermark async (non-blocking, after response)
    setImmediate(async () => {
      try {
        const projectCode = (await db.query('SELECT code FROM projects WHERE id=?', [pid]))[0][0]?.code || '';
        for (const photoId of saved) {
          const [[photo]] = await db.query('SELECT file_path FROM project_photos WHERE id=?', [photoId]);
          if (photo?.file_path) await applyTimestampWatermark(photo.file_path, projectCode);
        }
      } catch (e) { console.warn('[photos] watermark failed:', e.message); }
    });

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
      details: { project_id: parseInt(req.params.project_id, 10), doc_type: req.body.doc_type || 'other' }, req });

    res.json({ success: true });
  }));

// POST /api/photos/:photo_id/mark-progress — mark a photo as progress
// Scope guard: resolve the photo's project from project_photos and enforce
// project membership — otherwise any authenticated user could retag a photo
// on a project they're not assigned to by enumerating photo_id.
router.post('/:photo_id/mark-progress', requireAuth, requireScopeFromEntity('project_photos', 'photo_id'), asyncHandler(async (req, res) => {
    const { photo_id } = req.params;
    const me = req.session.user;
    // Update existing current tag to 'progress', or insert one if none exists
    const [[existing]] = await db.query(
      'SELECT id FROM photo_tags WHERE photo_id = ? AND is_current = 1 LIMIT 1',
      [photo_id]
    );
    if (existing) {
      await db.query('UPDATE photo_tags SET trade = ? WHERE id = ?', ['progress', existing.id]);
    } else {
      await db.query(
        `INSERT INTO photo_tags (photo_id, trade, tagged_by, tag_source, is_current)
         VALUES (?,?,?,?,1)`,
        [photo_id, 'progress', me.id, 'site_manager']
      );
    }
    res.json({ success: true });
}));

module.exports = router;
