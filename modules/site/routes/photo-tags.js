// routes/photo-tags.js
// ===========================================================
// Photo tagging + AI + correction chain.
//
// Correction chain (Option B from product spec):
//   Site Manager (12 hrs)  →  Stream audit (indefinite until report-used)  →  Principal lock
//   PMC removed from routine validation — but they see anomalies on dashboard.
//
// Lock rule:
//   Photos used in an approved/sent weekly report → locked at send time.
//   Other photos → editable by valid taggers.
// ===========================================================

const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { requireAuth } = require('../../../middleware/auth');
const { canTagPhotos, resolveEffectiveRoles } = require('../../../middleware/delegation');
const ai      = require('../../../services/ai');
const asyncHandler = require('../../../middleware/asyncHandler');
const fileUrls = require('../../../services/file-url');
const router  = express.Router();

// Helper — fetch photo with current tag
async function fetchPhotoWithTag(photoId) {
  const [[photo]] = await db.query('SELECT * FROM project_photos WHERE id = ?', [photoId]);
  if (!photo) return null;
  const [[tag]] = await db.query(
    'SELECT * FROM photo_tags WHERE photo_id = ? AND is_current = 1 LIMIT 1',
    [photoId]
  );
  return { ...photo, current_tag: tag || null };
}

// Helper — check if a user can tag/retag this photo given the correction chain.
async function canCorrectTag(user, photo) {
  // Locked photos → only Principal
  if (photo.is_locked) {
    if (!['principal','design_principal'].includes(user.role)) {
      return { allowed: false, reason: 'Photo is locked — used in sent client report. Only Principal can override.' };
    }
    return { allowed: true };
  }

  // Check stream via effective roles (delegation-aware)
  const gate = await canTagPhotos(user, photo.project_id);
  if (!gate.allowed) return { allowed: false, reason: 'You do not have permission to tag photos on this project.' };

  // Site manager window — only within 12 hours of upload AND it's their photo
  if (user.role === 'site_manager') {
    if (photo.uploaded_by !== user.id) return { allowed: false, reason: 'Site managers can only edit tags on their own photos.' };
    const ageHours = (Date.now() - new Date(photo.uploaded_at).getTime()) / 3600000;
    if (ageHours > 12) return { allowed: false, reason: 'Your 12-hour correction window has passed. Ask the stream team to correct.' };
  }

  return { allowed: true };
}

// POST /api/photo-tags/:photo_id — set or update tag
// Body: { task_id, trade, caption }
router.post('/:photo_id', requireAuth, asyncHandler(async (req, res) => {
    const me    = req.session.user;
    const photo = await fetchPhotoWithTag(req.params.photo_id);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const check = await canCorrectTag(me, photo);
    if (!check.allowed) return res.status(403).json({ error: check.reason });

    const { task_id, trade, caption } = req.body;

    // Tag source from my role
    const sourceMap = {
      site_manager:'site_manager', pmc_head:'pmc', principal:'principal', design_principal:'principal',
      design_head:'design', team_lead:'design', team_lead:'design', jr_architect:'design', jr_engineer:'design',
      services_head:'services', services_engineer:'services',
    };
    const source = sourceMap[me.role] || 'pmc';

    // S50: UPDATE old tag + INSERT new tag were separate. If INSERT failed,
    // the photo had no current tag — its previous tag was already cleared.
    // Wrap in tx so either both apply or neither.
    let newTagId;
    await db.tx(async (conn) => {
      await conn.query('UPDATE photo_tags SET is_current = 0 WHERE photo_id = ?', [photo.id]);

      const [result] = await conn.query(
        `INSERT INTO photo_tags (photo_id, task_id, trade, caption, tagged_by, tag_source, is_current, replaces_tag_id)
         VALUES (?,?,?,?,?,?,1,?)`,
        [photo.id, task_id || null, trade || null, caption || null, me.id, source, photo.current_tag?.id || null]
      );
      newTagId = result.insertId;
    });

    // S51: tag changes are part of the photo audit chain — record actor.
    const audit = require('../../../services/audit');
    audit.log({ userId: me.id, action: 'photo_tag.set',
      entityType: 'photo_tags', entityId: newTagId,
      details: { photo_id: photo.id, project_id: photo.project_id, task_id: task_id || null, trade: trade || null, source, replaces: photo.current_tag?.id || null }, req });

    res.json({ success: true, tag_id: newTagId });

  }));

// GET /api/photo-tags/:photo_id/history — audit trail
router.get('/:photo_id/history', requireAuth, asyncHandler(async (req, res) => {
    const [rows] = await db.query(
      `SELECT pt.*, st.task_name
       FROM photo_tags pt
       LEFT JOIN schedule_tasks st ON pt.task_id = st.id
       WHERE pt.photo_id = ? ORDER BY pt.created_at DESC`,
      [req.params.photo_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(rows.map(r => r.tagged_by).filter(Boolean));
    rows.forEach(r => { r.tagged_by_name = users.get(r.tagged_by)?.full_name || null; });
    res.json({ history: rows });
  }));

// POST /api/photo-tags/:photo_id/ai-tag — trigger AI tagging (or re-run)
//
// Bug B27 fix: previously had only requireAuth — any authenticated user could
// trigger AI inference on any project's photos, costing AI tokens and leaking
// photo content via the response. Now: load the photo, then check the caller
// is on its project (firm-wide roles bypass, matching the rest of the codebase).
router.post('/:photo_id/ai-tag', requireAuth, asyncHandler(async (req, res) => {
    const me    = req.session.user;
    const photo = await fetchPhotoWithTag(req.params.photo_id);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    // Project-scope gate. Same shape as the L4a check in drawings.js:383 — load
    // the parent's project_id, refuse if a project-scoped role is not assigned.
    const { PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
    if (PROJECT_SCOPED_ROLES.includes(me.role)) {
      const assigned = (me.projects || []).some(p => parseInt(p.id, 10) === parseInt(photo.project_id, 10));
      if (!assigned) {
        return res.status(403).json({
          error: 'Not assigned to this project',
          code:  'PROJECT_SCOPE_DENIED',
        });
      }
    }

    // Candidate tasks: active today OR starting within next 14 days
    // so AI can suggest upcoming tasks for photos taken ahead of schedule start.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const lookahead14 = new Date();
    lookahead14.setDate(lookahead14.getDate() + 14);
    const lookaheadStr = lookahead14.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [tasks] = await db.query(
      `SELECT st.id, st.task_name, st.trade FROM schedule_tasks st
       JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
       WHERE st.project_id = ? AND st.end_date >= ? AND st.start_date <= ?
       ORDER BY st.start_date ASC LIMIT 30`,
      [photo.project_id, today, lookaheadStr]
    );

    const project = { name: await users.projectName(photo.project_id) };

    const result = await ai.tagAndValidatePhoto({
      imagePath:       photo.file_path,
      siteManagerTag:  photo.current_tag
        ? { taskId: photo.current_tag.task_id, caption: photo.current_tag.caption }
        : null,
      candidateTasks:  tasks,
      projectName:     project?.name,
    });

    if (!result) return res.json({ success: true, ai_result: null, note: 'AI not configured or no result' });

    // If no human tag yet, store AI's suggestion as current tag (unconfirmed source='ai')
    if (!photo.current_tag) {
      await db.query(
        `INSERT INTO photo_tags (photo_id, task_id, trade, caption, tagged_by, tag_source, is_current, ai_confidence, ai_note)
         VALUES (?,?,?,?,NULL,'ai',1,?,?)`,
        [photo.id, result.suggested_task_id || null, result.trade_visible || null,
         result.suggested_caption || null, result.confidence || 'low',
         result.note_for_reviewer || null]
      );
    } else if (result.matches_site_manager_tag === false) {
      // Record AI disagreement as a non-current tag with ai_note
      await db.query(
        `INSERT INTO photo_tags (photo_id, task_id, trade, caption, tagged_by, tag_source, is_current, ai_confidence, ai_note, replaces_tag_id)
         VALUES (?,?,?,?,NULL,'ai',0,?,?,?)`,
        [photo.id, result.suggested_task_id || null, result.trade_visible || null,
         result.suggested_caption || null, result.confidence || 'low',
         result.note_for_reviewer || 'AI disagrees with site manager tag', photo.current_tag.id]
      );
    }

    const audit = require('../../../services/audit');
    audit.log({ userId: req.session.user.id, action: 'photo_tag.ai_run',
      entityType: 'photo_tags', entityId: null,
      details: { photo_id: photo.id, project_id: photo.project_id, ai_confidence: result.confidence || 'low', matches_human: result.matches_site_manager_tag !== false, suggested_task_id: result.suggested_task_id || null }, req });

    res.json({ success: true, ai_result: result });

  }));

// GET /api/photo-tags/disputes/:project_id — photos where AI has suggested a task
// awaiting human confirmation (includes disputes AND unconfirmed AI-only tags).
// "Confirmed" means a human has explicitly set a tag with the same task_id as AI.
router.get('/disputes/:project_id', requireAuth, asyncHandler(async (req, res) => {
    const [rows] = await db.query(
      `SELECT
         pp.id AS photo_id, pp.file_path, pp.photo_date, pp.uploaded_at,
         -- Most recent AI tag for this photo
         at.id AS ai_tag_id, at.task_id AS ai_task_id, at.caption AS ai_caption,
         at.ai_note, at.ai_confidence,
         st_a.task_name AS ai_task_name, st_a.trade AS ai_trade,
         -- Current human-confirmed tag (if any), with matching task
         ht.task_id AS human_task_id, ht.tagged_by AS human_tagger_id,
         st_h.task_name AS human_task_name
       FROM project_photos pp
       -- Latest AI tag that suggested a specific task
       JOIN photo_tags at ON at.photo_id = pp.id
         AND at.tag_source = 'ai'
         AND at.task_id IS NOT NULL
         AND at.id = (
           SELECT MAX(id) FROM photo_tags
           WHERE photo_id = pp.id AND tag_source = 'ai' AND task_id IS NOT NULL
         )
       LEFT JOIN schedule_tasks st_a ON st_a.id = at.task_id
       -- Current human tag (non-AI, must have a task to count as confirmed)
       LEFT JOIN photo_tags ht ON ht.photo_id = pp.id
         AND ht.is_current = 1
         AND ht.tag_source != 'ai'
         AND ht.task_id IS NOT NULL
       LEFT JOIN schedule_tasks st_h ON st_h.id = ht.task_id
       WHERE pp.project_id = ?
         AND pp.is_locked = 0
         -- Only show if human has NOT yet confirmed the AI suggestion
         AND (ht.task_id IS NULL OR ht.task_id != at.task_id)
       ORDER BY pp.uploaded_at DESC
       LIMIT 100`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(rows.map(r => r.human_tagger_id).filter(Boolean));
    rows.forEach(r => {
      r.human_tagger = users.get(r.human_tagger_id)?.full_name || null;
      r.file_url = fileUrls.fileUrl(r.file_path);
    });
    res.json({ suggestions: rows });
  }));

module.exports = router;
