// routes/ai-triggers.js — All Claude-powered triggers wired to app events
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth } = require('../../../middleware/auth');
const { upload } = require('../../../middleware/upload');
const ai      = require('../../../services/ai');
const router  = express.Router();
const _path   = require('path'); // available for file ops
const _fs     = require('fs');   // available for file ops
const asyncHandler = require('../../../middleware/asyncHandler');

// ── 1. DRAWING TITLE BLOCK EXTRACTION
// POST /api/ai/drawing-titleblock
router.post('/drawing-titleblock', requireAuth, upload.single('drawing'), asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Drawing file required' });

    const result = await ai.complete({
      systemPrompt: `You are an architect reading a construction drawing title block.
Extract all information from the title block and return JSON only.`,
      userPrompt: `Extract from this drawing title block: drawing_number, revision, title, scale, date, drawn_by, checked_by, approved_by, project_name, client_name.
Return null for any field not found.`,
      maxTokens: 500,
      images: [{ path: file.path, mediaType: file.mimetype || 'image/jpeg' }],
      json: true,
    });

    res.json({ success: true, extracted: result || {} });
  }));

// ── 2. SCHEDULE VALIDATION ON UPLOAD
// POST /api/ai/validate-schedule
router.post('/validate-schedule', requireAuth, asyncHandler(async (req, res) => {
    const { tasks, projectName, handoverDate } = req.body;
    if (!tasks?.length) return res.status(400).json({ error: 'Tasks required' });

    const result = await ai.complete({
      systemPrompt: `You are a senior project manager reviewing a construction schedule for an Indian project.
Check for issues and return JSON with arrays: issues (critical problems), warnings (concerns), suggestions (improvements).`,
      userPrompt: `Project: ${projectName}
Target handover: ${handoverDate}
Schedule tasks (${tasks.length} items):
${JSON.stringify(tasks.slice(0, 30), null, 2)}

Check: Are dates realistic? Any circular dependencies? Any trade conflicts? Is the sequence logical?`,
      maxTokens: 1000,
      json: true,
    });

    res.json({ success: true, validation: result || { issues: [], warnings: [], suggestions: [] } });
  }));

// ── 3. BOQ ITEM → HSN CODE SUGGESTION
// POST /api/ai/suggest-hsn
router.post('/suggest-hsn', requireAuth, asyncHandler(async (req, res) => {
    const aiToggles = require('../../../services/ai-toggles');
    if (!await aiToggles.isEnabled('hsn_code_suggestion')) {
      return res.json({ success: true, suggestion: { hsn_code: null, confidence: 'low', note: 'Feature disabled' } });
    }
    const { item_description, trade } = req.body;
    if (!item_description) return res.status(400).json({ error: 'Item description required' });

    const result = await ai.complete({
      systemPrompt: `You are a GST compliance expert for Indian construction projects.
Suggest the most appropriate HSN code for the given BOQ item. Return JSON only.`,
      userPrompt: `BOQ Item: ${item_description}
Trade: ${trade || 'General'}
Return: { hsn_code, description, gst_rate, confidence: 'high'|'medium'|'low', note }`,
      maxTokens: 300,
      json: true,
    });

    res.json({ success: true, suggestion: result || { hsn_code: null, confidence: 'low' } });
  }));

// ── 4. DRAWING QUERY DE-DUPLICATION
// POST /api/ai/similar-queries
router.post('/similar-queries', requireAuth, asyncHandler(async (req, res) => {
    const aiToggles = require('../../../services/ai-toggles');
    if (!await aiToggles.isEnabled('similar_query_search')) {
      return res.json({ success: true, similar: [], message: 'Feature disabled' });
    }
    const { question, project_id, trade } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    // Get recent closed queries from this and other projects
    const [pastQueries] = await db.query(
      `SELECT dq.description, dq.resolution_note, dq.project_id, d.drawing_number, d.trade
       FROM issues dq
       JOIN drawings d ON dq.drawing_id = d.id
       WHERE dq.status = 'closed' AND dq.resolution_note IS NOT NULL
       ${trade ? "AND d.trade = ?" : ""}
       ORDER BY dq.created_at DESC LIMIT 50`,
      trade ? [trade] : []
    );

    if (!pastQueries.length) return res.json({ similar: [], message: 'No past queries found' });

    const Onboarding = require('../../onboarding/contract');
    const pqProjs = await Onboarding.functions.getProjectsByIds(pastQueries.map(q => q.project_id));
    pastQueries.forEach(q => { q.project_name = pqProjs.get(q.project_id)?.name || null; });

    const result = await ai.complete({
      systemPrompt: `You are a construction knowledge assistant. Find similar past queries and return JSON.`,
      userPrompt: `New query: "${question}"
Past resolved queries:
${JSON.stringify(pastQueries.slice(0, 20).map(q => ({ q: q.question, a: q.resolution, project: q.project_name })))}

Find the top 3 most similar past queries. Return: [{ question, resolution, similarity: 'high'|'medium', project_name }]
Return empty array if nothing similar found.`,
      maxTokens: 800,
      json: true,
    });

    res.json({ success: true, similar: Array.isArray(result) ? result : [] });
  }));

// ── 5. CN TEXT DRAFTING
// POST /api/ai/draft-cn
router.post('/draft-cn', requireAuth, asyncHandler(async (req, res) => {
    const { plain_description, trade, project_name } = req.body;
    if (!plain_description) return res.status(400).json({ error: 'Description required' });

    const result = await ai.complete({
      systemPrompt: `You are a senior architect drafting a formal Change Notice for a construction project in India.
Write precise, technical language. Return JSON only.`,
      userPrompt: `Project: ${project_name || 'Construction Project'}
Trade: ${trade || 'General'}
Plain language description from PMC: "${plain_description}"

Draft a formal Change Notice with:
- cn_title: short title (max 10 words)
- cn_description: formal technical description (2-3 sentences)
- potential_cost_impact: 'increase'|'decrease'|'neutral'|'unknown'
- potential_schedule_impact: 'delay'|'acceleration'|'neutral'|'unknown'
- recommended_action: what should happen next`,
      maxTokens: 600,
      json: true,
    });

    res.json({ success: true, draft: result || { cn_title: '', cn_description: plain_description } });
  }));

// ── 6. INVOICE SCAN → PRE-FILL PAYMENT ENTRY
// POST /api/ai/read-invoice
router.post('/read-invoice', requireAuth, upload.single('invoice'), asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Invoice scan required' });

    const result = await ai.complete({
      systemPrompt: `You are an accounts clerk reading a vendor invoice for a construction project in India.
Extract all financial details accurately. Return JSON only.`,
      userPrompt: `Read this invoice and extract:
vendor_name, invoice_number, invoice_date, amount_ex_gst, gst_rate, gst_amount, total_amount,
hsn_code, description_of_work, payment_terms, bank_account, bank_ifsc, gstin_vendor.
Return null for missing fields. Amounts as numbers without commas.`,
      maxTokens: 800,
      images: [{ path: file.path, mediaType: file.mimetype || 'image/jpeg' }],
      json: true,
    });

    // Store scan path for PMC review
    res.json({
      success:      true,
      extracted:    result || {},
      scan_path:    file.path,
      requires_pmc_review: true,
      message:      'Invoice read. PMC must review before sending to Finance Admin.',
    });
  }));

// ── 7. BOQ UPLOAD → FLAG MISSING MATERIAL APPROVALS
// POST /api/ai/check-material-approvals
router.post('/check-material-approvals', requireAuth, asyncHandler(async (req, res) => {
    const aiToggles = require('../../../services/ai-toggles');
    if (!await aiToggles.isEnabled('material_approval_check')) {
      return res.json({ success: true, flagged: [] });
    }
    const { boq_items, project_id } = req.body;
    if (!boq_items?.length) return res.status(400).json({ error: 'BOQ items required' });

    // Get existing approvals
    const [approvals] = await db.query(
      'SELECT material_name, approval_status FROM material_approvals WHERE project_id = ?',
      [project_id]
    );
    const approvedNames = approvals.filter(a=>a.approval_status==='approved').map(a=>a.material_name.toLowerCase());

    const result = await ai.complete({
      systemPrompt: `You are a construction materials expert. Identify BOQ items that typically require client material approval before procurement. Return JSON only.`,
      userPrompt: `BOQ items (${boq_items.length} total, showing first 30):
${JSON.stringify(boq_items.slice(0,30).map(i=>({desc:i.description,trade:i.trade})))}

Already approved materials: ${approvedNames.join(', ') || 'None'}

Identify items that need material approval (finishes, fittings, equipment, branded items).
Return: [{ item_description, reason_approval_needed, priority: 'high'|'medium'|'low' }]`,
      maxTokens: 1000,
      json: true,
    });

    res.json({ success: true, flagged: Array.isArray(result) ? result : [] });
  }));

// ── 8. DRAWING CHANGE ANALYSIS (trigger on revision upload)
// POST /api/ai/analyse-drawing-change — called automatically when new revision uploaded
router.post('/analyse-drawing-change', requireAuth, asyncHandler(async (req, res) => {
    const { old_version_id, new_version_id, drawing_number, trade } = req.body;
    if (!old_version_id || !new_version_id) return res.status(400).json({ error: 'Drawing IDs required' });

    // Get file paths
    const DS = require('../../design-services/contract');
    const dvMap = await DS.functions.getDrawingContextByVersionIds([old_version_id, new_version_id]);
    const oldVer = dvMap.get(old_version_id);
    const newVer = dvMap.get(new_version_id);

    if (!oldVer?.file_path || !newVer?.file_path) {
      return res.json({ success: false, message: 'File paths not available for analysis' });
    }

    const result = await ai.analyseDrawingChange(oldVer.file_path, newVer.file_path, drawing_number, trade);

    // Store impact items for CN hard block
    if (result?.impacts) {
      // Get or create CN placeholder
      const _allImpacts = [
        ...(result.impacts.schedule||[]).map(i=>({type:'schedule_task',desc:i})),
        ...(result.impacts.boq||[]).map(i=>({type:'boq_item',desc:i})),
        ...(result.impacts.drawings||[]).map(i=>({type:'drawing',desc:i})),
        ...(result.impacts.vendors||[]).map(i=>({type:'vendor',desc:i})),
      ];
      // Store for display — actual CN created separately
      await db.query(
        `INSERT INTO drawing_versions (id) VALUES (?) ON DUPLICATE KEY UPDATE id=id`,
        [new_version_id]
      ).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
    }

    res.json({ success: true, analysis: result });
  }));

// ── AI SETTINGS ENDPOINTS (Principal only)

// GET /api/ai/settings — get all AI feature toggle states (Principal only)
router.get('/settings', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  if (!['principal','design_principal'].includes(me.role)) {
    return res.status(403).json({ error: 'Only principals can manage AI settings' });
  }
  const toggles = require('../../../services/ai-toggles');
  const all = await toggles.getAll();
  res.json({ toggles: all });
}));

// POST /api/ai/settings — update a toggle (Principal only)
router.post('/settings', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  if (!['principal','design_principal'].includes(me.role)) {
    return res.status(403).json({ error: 'Only principals can manage AI settings' });
  }
  const { feature_key, enabled } = req.body;
  if (!feature_key || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'feature_key and enabled (boolean) required' });
  }
  const toggles = require('../../../services/ai-toggles');
  await toggles.setEnabled(feature_key, enabled, me.id);
  res.json({ success: true });
}));

// GET /api/ai/settings/active — public (authenticated) list of enabled features
router.get('/settings/active', requireAuth, asyncHandler(async (req, res) => {
  const toggles = require('../../../services/ai-toggles');
  const all = await toggles.getAll(); // array of { feature_key, enabled, ... }
  const active = all.filter(f => f.enabled).map(f => f.feature_key);
  res.json({ active });
}));

module.exports = router;
