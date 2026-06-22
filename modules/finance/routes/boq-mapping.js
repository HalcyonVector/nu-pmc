// routes/boq-mapping.js — Client BOQ ↔ Vendor engagement mapping
const express      = require('express');
const db           = require('../../../middleware/db');
const { requireAuth, requirePMC, requireProjectScope } = require('../../../middleware/auth');
const ai           = require('../../../services/ai');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router       = express.Router();

// GET /api/boq-mapping/:project_id — get all mappings + unmapped items
router.get('/:project_id', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const pid = req.params.project_id;

    // All client BOQ items (non-section)
    const [boqItems] = await db.query(
      `SELECT bi.id, bi.trade, bi.item_name, bi.item_code, bi.unit, bi.quantity,
              bi.parent_id, par.item_name AS parent_name,
              (SELECT COUNT(*) FROM vendor_boq_mapping vbm WHERE vbm.boq_item_id=bi.id AND vbm.deleted_at IS NULL) AS mapping_count
       FROM boq_items bi
       JOIN boq_versions bv ON bi.boq_version_id=bv.id
       LEFT JOIN boq_items par ON bi.parent_id=par.id
       WHERE bi.project_id=? AND bi.is_section=0 AND bv.is_current=1
       ORDER BY bi.trade, bi.display_order`,
      [pid]
    );

    // All vendor engagements on project (with vendor info + first few mapped items)
    const Onboarding = require('../../onboarding/contract');
    const engagements = await Onboarding.functions.listEngagementsByProject(pid);
    // Attach preview of mapped items per engagement.
    // NOTE: original used a correlated subquery with LIMIT 3, but LIMIT was a
    // no-op there (applied to the aggregated single-row outer SELECT). So the
    // original behavior was "concatenate ALL mapped items per engagement."
    // Preserving that behavior here; if a true preview-limit is wanted,
    // that's a product decision (truncate in JS at display time).
    for (const e of engagements) {
      const [previewRows] = await db.query(
        `SELECT GROUP_CONCAT(bi.item_name SEPARATOR ', ') AS mapped_items
         FROM vendor_boq_mapping vbm
         JOIN boq_items bi ON vbm.boq_item_id = bi.id
         WHERE vbm.engagement_id = ?`,
        [e.id]
      );
      e.mapped_items = previewRows[0]?.mapped_items || null;
    }

    // Existing mappings
    const [mappings] = await db.query(
      `SELECT vbm.*, bi.item_name, bi.trade
       FROM vendor_boq_mapping vbm
       JOIN boq_items bi ON vbm.boq_item_id=bi.id
       WHERE vbm.project_id=? AND vbm.deleted_at IS NULL`,
      [pid]
    );
    // Hydrate vendor_name + scope via engagement bulk helper
    const engMap = await Onboarding.functions.getEngagementsByIds(mappings.map(m => m.engagement_id));
    mappings.forEach(m => {
      const e = engMap.get(m.engagement_id);
      m.vendor_name = e?.vendor_name || null;
      m.scope       = e?.scope || null;
    });

    const unmapped = boqItems.filter(b => b.mapping_count === 0);

    res.json({ boq_items: boqItems, engagements, mappings, unmapped_count: unmapped.length });
  }));

// POST /api/boq-mapping/:project_id/suggest — AI suggests mappings
router.post('/:project_id/suggest', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const pid = req.params.project_id;

    const [boqItems] = await db.query(
      `SELECT bi.id, bi.trade, bi.item_name, bi.item_code
       FROM boq_items bi JOIN boq_versions bv ON bi.boq_version_id=bv.id
       WHERE bi.project_id=? AND bi.is_section=0 AND bv.is_current=1
       AND bi.id NOT IN (SELECT boq_item_id FROM vendor_boq_mapping WHERE project_id=?)`,
      [pid, pid]
    );

    const Onboarding = require('../../onboarding/contract');
    const engagements = await Onboarding.functions.listEngagementsByProject(pid);

    if (!boqItems.length || !engagements.length) {
      return res.json({ suggestions: [], message: 'Nothing to map' });
    }

    // Build AI prompt
    const prompt = `Match each vendor engagement to the most relevant client BOQ item(s).

Vendor Engagements:
${engagements.map(e => `ID ${e.id}: "${e.vendor_name}" — Scope: "${e.scope}"`).join('\n')}

Client BOQ Items:
${boqItems.map(b => `ID ${b.id}: [${b.trade}] ${b.item_name}`).join('\n')}

Return JSON array: [{ engagement_id, boq_item_ids: [], confidence: 0.0-1.0, reason: "" }]
Only include matches with confidence >= 0.6. One engagement can map to multiple BOQ items and vice versa.`;

    const result = await ai.complete({
      systemPrompt: 'You are a construction cost expert. Match vendor scopes to BOQ items accurately.',
      userPrompt: prompt,
      maxTokens: 1500,
      json: true,
    });

    let suggestions = [];
    if (result) {
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.matches || []);
      } catch (_e) { suggestions = []; }
    }

    // If AI unavailable — return simple trade-based matching
    if (!suggestions.length) {
      suggestions = engagements.map(eng => {
        const engWords = eng.scope.toLowerCase().split(' ');
        const matched  = boqItems.filter(b =>
          engWords.some(w => w.length > 3 && b.item_name.toLowerCase().includes(w))
        ).slice(0, 3);
        return matched.length ? {
          engagement_id: eng.id,
          boq_item_ids:  matched.map(m => m.id),
          confidence:    0.6,
          reason:        'Keyword match — confirm before saving',
        } : null;
      }).filter(Boolean);
    }

    res.json({ suggestions, ai_used: !!result });
  }));

// POST /api/boq-mapping/:project_id — save mapping (PMC confirms)
router.post('/:project_id', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const { engagement_id, boq_item_ids, split_pct, notes, ai_suggested, ai_confidence } = req.body;
    if (!engagement_id || !boq_item_ids?.length) {
      return res.status(400).json({ error: 'Engagement and BOQ items required' });
    }

    // ── SPLIT_PCT SUM VALIDATION
    // For each BOQ item we're mapping, check the cumulative split_pct across
    // ALL vendors mapped to that item AFTER this operation would apply. If
    // the sum exceeds 100%, reject the whole batch — commits beyond 100% of
    // a line item indicate a mapping error (e.g. three vendors each at 80%).
    // Mappings without a split_pct (null) are treated as 100% for their line.
    if (split_pct !== undefined && split_pct !== null) {
      const splitValue = parseFloat(split_pct);
      if (isNaN(splitValue) || splitValue < 0 || splitValue > 100) {
        return res.status(400).json({ error: 'split_pct must be between 0 and 100' });
      }

      for (const boq_item_id of boq_item_ids) {
        const [[existing]] = await db.query(
          `SELECT COALESCE(SUM(COALESCE(split_pct, 100)), 0) AS total_pct
           FROM vendor_boq_mapping
           WHERE project_id = ? AND boq_item_id = ? AND engagement_id != ?`,
          [req.params.project_id, boq_item_id, engagement_id]
        );
        const existingPct = parseFloat(existing?.total_pct || 0);
        if (existingPct + splitValue > 100.01) {  // 0.01 tolerance for floating point
          const [[item]] = await db.query(
            'SELECT item_name FROM boq_items WHERE id = ?', [boq_item_id]
          );
          return res.status(400).json({
            error: `Split exceeds 100% for "${item?.item_name || 'item #' + boq_item_id}": ${existingPct.toFixed(1)}% already mapped, adding ${splitValue}% = ${(existingPct + splitValue).toFixed(1)}%`,
            code: 'SPLIT_EXCEEDS_100',
            boq_item_id,
            existing_pct: existingPct,
            proposed_pct: splitValue,
          });
        }
      }
    }

    let saved = 0;
    for (const boq_item_id of boq_item_ids) {
      await db.query(
        `INSERT INTO vendor_boq_mapping
         (project_id, engagement_id, boq_item_id, split_pct, notes, mapped_by, ai_suggested, ai_confidence, confirmed_by, confirmed_at)
         VALUES (?,?,?,?,?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE split_pct=VALUES(split_pct), notes=VALUES(notes),
           confirmed_by=VALUES(confirmed_by), confirmed_at=NOW()`,
        [req.params.project_id, engagement_id, boq_item_id,
         split_pct||null, notes||null, req.session.user.id,
         ai_suggested ? 1 : 0, ai_confidence||null, req.session.user.id]
      );
      saved++;
    }

    audit.log({ userId: req.session.user.id, action: 'boq_mapping.save',
      entityType: 'vendor_boq_mapping', entityId: parseInt(engagement_id),
      details: { project_id: parseInt(req.params.project_id), engagement_id, saved, boq_item_count: boq_item_ids.length, split_pct: split_pct || null, ai_suggested: !!ai_suggested }, req });

    res.json({ success: true, saved, message: `${saved} BOQ item${saved>1?'s':''} mapped` });
  }));

// DELETE /api/boq-mapping/:project_id/:mapping_id
router.delete('/:project_id/:mapping_id', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    await db.query(
      'UPDATE vendor_boq_mapping SET deleted_at = NOW(), deleted_by = ? WHERE id=? AND project_id=?',
      [req.session.user.id, req.params.mapping_id, req.params.project_id]
    );
    audit.log({ userId: req.session.user.id, action: 'boq_mapping.delete',
      entityType: 'vendor_boq_mapping', entityId: parseInt(req.params.mapping_id),
      details: { project_id: parseInt(req.params.project_id) }, req });
    res.json({ success: true });
  }));

module.exports = router;
