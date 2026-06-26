// modules/reporting/routes/lessons.js
//
// Lessons-Learned module — end-of-project retrospective.
//
// Endpoints:
//   GET   /api/lessons/:project_id              fetch lesson + this user's input + (if authorised) all inputs
//   POST  /api/lessons/:project_id/input        upsert this user's input (text + category)
//   PATCH /api/lessons/:project_id/publish      principals publish the AI-edited final draft
//   GET   /api/lessons/library                  Knowledge Library — list of all published lessons
//   GET   /api/lessons/library/:lesson_id       single published lesson
//
// AI-generation lifecycle:
//   - During project: ai_draft is null. Users see only raw inputs.
//   - On closure: handover module's closure-signoff endpoint calls
//     generateAIDraftForProject() as a fire-and-forget side effect.
//   - Once draft exists: principals review, optionally edit, then publish.
//   - Published content is visible firm-wide via Knowledge Library.

'use strict';

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requireProjectScope } = require('../../../middleware/auth');
const { requirePermission } = require('../../../middleware/permissions');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');

const router = express.Router();

// AI service abstraction. May be missing in test environments — guard the require.
function getAIService() {
  try { return require('../../../services/ai'); }
  catch { return null; }
}

// ── KNOWLEDGE LIBRARY ──────────────────────────────────────────────────────
// IMPORTANT: declare these BEFORE the /:project_id routes so Express doesn't
// match `/library` as `:project_id`.

router.get('/library',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Visible to ALL authenticated users (firm-wide knowledge).
    const [lessons] = await db.query(
      `SELECT ll.id, ll.project_id, ll.published_at,
              p.name AS project_name, p.client AS client_name,
              u.full_name AS published_by_name
       FROM lessons_learned ll
       JOIN projects p ON ll.project_id = p.id
       LEFT JOIN users u ON ll.published_by = u.id
       WHERE ll.published_at IS NOT NULL
       ORDER BY ll.published_at DESC`
    );
    res.json({ lessons });
  })
);

router.get('/library/:lesson_id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lessonId = parseInt(req.params.lesson_id, 10);
    if (!Number.isFinite(lessonId)) {
      return res.status(404).json({ error: 'Published lesson not found' });
    }
    const [[lesson]] = await db.query(
      `SELECT ll.id, ll.project_id, ll.published_content, ll.published_at,
              p.name AS project_name, p.client AS client_name,
              u.full_name AS published_by_name
       FROM lessons_learned ll
       JOIN projects p ON ll.project_id = p.id
       LEFT JOIN users u ON ll.published_by = u.id
       WHERE ll.id = ? AND ll.published_at IS NOT NULL`,
      [lessonId]
    );
    if (!lesson) return res.status(404).json({ error: 'Published lesson not found' });
    res.json({ lesson });
  })
);

// ── PROJECT-SCOPED ENDPOINTS ───────────────────────────────────────────────

router.get('/:project_id',
  requireAuth, requireProjectScope(),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const projectId = parseInt(req.params.project_id, 10);

    const [[lesson]] = await db.query(
      'SELECT * FROM lessons_learned WHERE project_id = ?', [projectId]
    );

    const [[myInput]] = await db.query(
      'SELECT * FROM lessons_learned_inputs WHERE project_id = ? AND user_id = ?',
      [projectId, me.id]
    );

    // Check if caller has report-view permission. If yes, include all inputs.
    const permissions = require('../../../middleware/permissions');
    const canViewAll = await permissions.canSync(me.role, 'pmc.lessons.report-view');

    let allInputs = null;
    if (canViewAll) {
      const [rows] = await db.query(
        `SELECT i.user_id, u.full_name AS user_name, u.role, i.input_text, i.category, i.signoff
         FROM lessons_learned_inputs i JOIN users u ON i.user_id = u.id
         WHERE i.project_id = ?
         ORDER BY i.category, u.role, u.full_name`,
        [projectId]
      );
      allInputs = rows;
    }

    res.json({
      lesson:    lesson || null,
      my_input:  myInput || null,
      inputs:    allInputs || [],   // empty array for non-authorised viewers
      can_view_all: canViewAll,
    });
  })
);

router.post('/:project_id/input',
  requireAuth, requireProjectScope(),
  requirePermission('pmc.lessons.input-write'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const projectId = parseInt(req.params.project_id, 10);
    const { input_text, category } = req.body || {};
    if (!input_text || !input_text.trim()) {
      return res.status(400).json({ error: 'input_text required' });
    }
    const cat = ['what_went_well','improvement','recommendation','other'].includes(category) ? category : 'other';

    await db.query(
      `INSERT INTO lessons_learned_inputs (project_id, user_id, input_text, category)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE input_text=VALUES(input_text), category=VALUES(category)`,
      [projectId, me.id, input_text.trim(), cat]
    );

    audit.log({ userId: me.id, action: 'lessons.input.write',
      entityType: 'projects', entityId: projectId, req });

    res.json({ success: true });
  })
);

router.patch('/:project_id/publish',
  requireAuth, requireProjectScope(),
  requirePermission('pmc.lessons.publish'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const projectId = parseInt(req.params.project_id, 10);
    const { final_content } = req.body || {};
    if (!final_content || !final_content.trim()) {
      return res.status(400).json({ error: 'final_content required' });
    }

    // Upsert pattern: ensure lessons_learned row exists, then update publish fields.
    await db.query(
      `INSERT INTO lessons_learned (project_id, published_content, published_at, published_by)
       VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         published_content=VALUES(published_content),
         published_at=NOW(),
         published_by=VALUES(published_by)`,
      [projectId, final_content.trim(), me.id]
    );

    audit.log({ userId: me.id, action: 'lessons.publish',
      entityType: 'projects', entityId: projectId,
      details: { content_length: final_content.length }, req });

    res.json({ success: true });
  })
);

// POST /api/lessons/:project_id/generate — manually trigger AI draft generation.
// Useful when the user wants to regenerate the draft after editing inputs.
// (Closure flow calls this internally as fire-and-forget.)
router.post('/:project_id/generate',
  requireAuth, requireProjectScope(),
  requirePermission('pmc.lessons.publish'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const projectId = parseInt(req.params.project_id, 10);
    try {
      await generateAIDraftForProject(projectId);
      audit.log({ userId: me.id, action: 'lessons.draft.regenerate',
        entityType: 'projects', entityId: projectId, req });
      res.json({ success: true });
    } catch (err) {
      console.error('[lessons.generate] failed:', err.message);
      res.status(500).json({ error: 'AI draft generation failed', detail: err.message });
    }
  })
);

// ── INTERNAL: AI DRAFT GENERATION ──────────────────────────────────────────
// Called by handover/closure when all four signatures arrive. Fire-and-forget.
// Not a route — exported for the closure handler to call directly.

async function generateAIDraftForProject(projectId) {
  // Fetch project name for the prompt context
  const [[project]] = await db.query(
    'SELECT name FROM projects WHERE id = ?', [projectId]
  );
  const projectName = project?.name || `Project #${projectId}`;

  const [inputs] = await db.query(
    `SELECT u.full_name, u.role, i.input_text, i.category
     FROM lessons_learned_inputs i JOIN users u ON i.user_id = u.id
     WHERE i.project_id = ?
     ORDER BY i.category, u.role`,
    [projectId]
  );

  if (inputs.length === 0) {
    await db.query(
      `INSERT INTO lessons_learned (project_id, ai_draft, ai_drafted_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE ai_draft=VALUES(ai_draft), ai_drafted_at=NOW()`,
      [projectId, '(No team inputs were submitted for this project.)']
    );
    return;
  }

  // Group by category for the prompt + the fallback draft.
  const byCategory = {};
  for (const i of inputs) {
    const c = i.category;
    if (!byCategory[c]) byCategory[c] = [];
    byCategory[c].push(`- [${i.role}] ${i.full_name}: ${i.input_text}`);
  }
  const fallbackSections = [];
  if (byCategory.what_went_well)  fallbackSections.push(`What went well:\n${byCategory.what_went_well.join('\n')}`);
  if (byCategory.improvement)     fallbackSections.push(`Improvements suggested:\n${byCategory.improvement.join('\n')}`);
  if (byCategory.recommendation)  fallbackSections.push(`Recommendations:\n${byCategory.recommendation.join('\n')}`);
  if (byCategory.other)           fallbackSections.push(`Other observations:\n${byCategory.other.join('\n')}`);

  // Call the purpose-built AI function. Returns string or fallback message.
  let aiDraft;
  const ai = getAIService();
  if (!ai || !ai.draftLessonsLearned) {
    aiDraft = `LESSONS LEARNED — DRAFT\n\n${fallbackSections.join('\n\n')}\n\n(AI service unavailable — please edit this raw input list before publishing.)`;
  } else {
    try {
      // draftLessonsLearned takes (projectName, teamInputs, projectMetrics).
      // teamInputs is the array of {full_name, role, input_text, category} rows.
      // projectMetrics: keep light for now — AI service receives empty metrics.
      const result = await ai.draftLessonsLearned(projectName, inputs, {});
      aiDraft = result || `LESSONS LEARNED — DRAFT (AI returned no content)\n\n${fallbackSections.join('\n\n')}`;
    } catch (err) {
      console.error('[lessons.generateAIDraft] AI service failed:', err.message);
      aiDraft = `LESSONS LEARNED — DRAFT (AI generation failed: ${err.message})\n\n${fallbackSections.join('\n\n')}`;
    }
  }

  await db.query(
    `INSERT INTO lessons_learned (project_id, ai_draft, ai_drafted_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE ai_draft=VALUES(ai_draft), ai_drafted_at=NOW()`,
    [projectId, aiDraft]
  );
}

router.generateAIDraftForProject = generateAIDraftForProject;
module.exports = router;
module.exports.generateAIDraftForProject = generateAIDraftForProject;
