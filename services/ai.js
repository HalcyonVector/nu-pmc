// services/ai.js — AI abstraction layer
// Swap provider here only. Routes never call Anthropic directly.
// Current provider: Anthropic Claude
// Alternatives: Google Gemini, OpenAI GPT-4o, AWS Bedrock

const http  = require('../services/http');
const fs    = require('fs');

// Env values read at call time (not module-load) so AI_PROVIDER / AI_MODEL
// changes (e.g. failover from sonnet to haiku, swap to a different vendor)
// take effect without app restart. Same pattern as matrix-adapter._env().
function _provider()   { return process.env.AI_PROVIDER    || 'anthropic'; }
function _model()      { return process.env.AI_MODEL       || 'claude-sonnet-4-20250514'; }
function _modelHeavy() { return process.env.AI_MODEL_HEAVY || process.env.AI_MODEL || 'claude-opus-4-20250514'; }

// ── PROVIDER IMPLEMENTATIONS
const providers = {
  anthropic: {
    complete: async ({ systemPrompt, userPrompt, maxTokens, images, model: callModel, cache, schema, json }) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn('[AI] ANTHROPIC_API_KEY not set — AI features disabled');
        return null;
      }
      const useModel = callModel || _model();

      const content = [];
      if (images?.length) {
        for (const img of images) {
          const data = fs.existsSync(img.path)
            ? fs.readFileSync(img.path).toString('base64')
            : img.base64;
          content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data } });
        }
      }
      content.push({ type: 'text', text: userPrompt });

      // Prompt caching — wrap system prompt with cache_control if requested
      const systemBlock = cache && systemPrompt
        ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
        : systemPrompt;

      const body = {
        model:      useModel,
        max_tokens: maxTokens || 1500,
        system:     systemBlock,
        messages:   [{ role: 'user', content }],
      };

      // Structured outputs — guaranteed JSON schema
      if (schema) {
        body.output_format = { type: 'json_schema', json_schema: { schema } };
      } else if (json) {
        body.output_format = { type: 'json' };
      }

      // Build beta headers
      const betas = [];
      if (cache)  betas.push('prompt-caching-2024-07-31');
      if (schema) betas.push('structured-outputs-2025-11-13');

      const headers = {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      };
      if (betas.length) headers['anthropic-beta'] = betas.join(',');

      const res = await http.post('https://api.anthropic.com/v1/messages', body, {
        headers,
        timeout: 60000,
      });

      return res.data.content.map(b => b.text || '').filter(Boolean).join('\n');
    },

    // Batch API — for non-urgent async AI calls (50% cheaper)
    batch: async (requests) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn('[AI] ANTHROPIC_API_KEY not set — batch disabled');
        return null;
      }

      const batchRequests = requests.map((r, i) => ({
        custom_id: r.id || 'req_' + i,
        params: {
          model:      r.model || _modelHeavy(),
          max_tokens: r.maxTokens || 1500,
          system:     r.systemPrompt,
          messages:   [{ role: 'user', content: r.userPrompt }],
        },
      }));

      const res = await http.post('https://api.anthropic.com/v1/messages/batches', {
        requests: batchRequests,
      }, {
        headers: {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta':    'message-batches-2024-09-24',
          'Content-Type':      'application/json',
        },
        timeout: 30000,
      });

      return res.data; // Returns batch ID — results fetched later
    },

    // Poll batch results
    getBatchResults: async (batchId) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return null;
      const res = await http.get('https://api.anthropic.com/v1/messages/batches/' + batchId + '/results', {
        headers: {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta':    'message-batches-2024-09-24',
        },
        timeout: 30000,
      });
      return res.data;
    },
  },

  // ── OPENAI (future swap)
  // openai: {
  //   complete: async ({ systemPrompt, userPrompt, maxTokens }) => {
  //     const res = await http.post('https://api.openai.com/v1/chat/completions', {
  //       model: 'gpt-4o', max_tokens: maxTokens || 1500,
  //       messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
  //     }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
  //     return res.data.choices[0].message.content;
  //   }
  // },
};

// ── CORE COMPLETION FUNCTION
async function complete({ systemPrompt, userPrompt, maxTokens, images, json, heavy }) {
  try {
    const provider = providers[_provider()];
    if (!provider) {
      console.warn('[AI] Unknown provider:', _provider(), '— AI disabled');
      return null;
    }
    if (!process.env.ANTHROPIC_API_KEY && _provider() === 'anthropic') {
      return null; // silent — already warned at call site
    }

    const model = heavy ? _modelHeavy() : _model();

    const sys = json
      ? (systemPrompt || '') + '\n\nRespond ONLY with valid JSON. No markdown, no explanation, no backticks.'
      : systemPrompt;

    const raw = await provider.complete({ systemPrompt: sys, userPrompt, maxTokens, images, model });

    if (json) {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    }
    return raw;
  } catch (err) {
    console.error(`[AI] Complete failed:`, err.message);
    return null;
  }
}

// ── AI FEATURE IMPLEMENTATIONS

/**
 * 1. Drawing change analysis — compare old and new PDF
 */
async function analyseDrawingChange(oldPdfPath, newPdfPath, drawingNumber, trade) {
  return complete({
    heavy: true,   // Opus — complex spatial reasoning across two drawings
    systemPrompt: `You are a senior architect reviewing drawing revisions for a construction project.
Analyse the two drawings provided (old version then new version) and return JSON.`,
    userPrompt: `Drawing: ${drawingNumber} — Trade: ${trade}
Compare these two drawing revisions and identify all changes.`,
    maxTokens: 2000,
    images: [
      { path: oldPdfPath, mediaType: 'image/jpeg' },
      { path: newPdfPath, mediaType: 'image/jpeg' },
    ],
    json: true,
  }).then(result => result || {
    changes: [],
    impacts: { schedule: [], boq: [], drawings: [], vendors: [] },
    summary: 'Analysis unavailable',
  });
}

/**
 * 2. Schedule risk narrative — rules calculate, Claude narrates
 */
async function narrateScheduleRisk(projectName, trade, plannedPct, actualPct, weeksBehind, forecastDelay) {
  const gap = plannedPct - actualPct;
  return complete({
    heavy: true,   // Opus — nuanced risk reading beyond the raw numbers
    systemPrompt: `You are a PMC expert. Write a concise, factual risk assessment in 2-3 sentences. 
No jargon. Plain language. Direct. For a construction project manager.`,
    userPrompt: `Project: ${projectName}
Trade: ${trade}
Planned progress: ${plannedPct}%
Actual progress: ${actualPct}%
Gap: ${gap}%
Weeks behind: ${weeksBehind}
Forecast delay to completion: ${forecastDelay} weeks

Write a 2-3 sentence risk assessment.`,
    maxTokens: 200,
  }) || `${trade} is ${gap}% behind plan. Forecast delay: ${forecastDelay} weeks.`;
}

/**
 * 3. Drawing query auto-suggest
 */
async function suggestQueryAnswer(drawingPath, queryText, trade) {
  return complete({
    systemPrompt: `You are a senior architect. A site manager has raised a query about a drawing.
Review the drawing and suggest an answer. Be specific and practical. Return JSON.`,
    userPrompt: `Trade: ${trade}
Query: ${queryText}
Review the drawing and suggest an answer.`,
    maxTokens: 500,
    images: drawingPath ? [{ path: drawingPath, mediaType: 'image/jpeg' }] : [],
    json: true,
  }).then(r => r || { suggestion: 'Unable to analyse drawing', confidence: 'low', caveats: 'Manual review required' });
}

/**
 * 4. Weekly report narrative
 */
async function generateWeeklyNarrative(projectName, weekEnding, overallPct, tradeProgress, issues, milestones) {
  return complete({
    systemPrompt: `You are a PMC professional writing a weekly progress report summary for a client.
Write a clear, professional paragraph. Factual. No fluff. 80-120 words.`,
    userPrompt: `Project: ${projectName}
Week ending: ${weekEnding}
Overall progress: ${overallPct}%
Trade progress: ${JSON.stringify(tradeProgress)}
Open issues: ${issues.length}
Milestones this week: ${JSON.stringify(milestones)}

Write the overall summary paragraph for the weekly report.`,
    maxTokens: 300,
  }) || `Project progressing at ${overallPct}% overall completion as of ${weekEnding}.`;
}

/**
 * 5. BOQ quantity extraction from drawing
 */
async function extractBOQQuantities(drawingPath, trade, existingItems) {
  return complete({
    systemPrompt: `You are a quantity surveyor. Extract measurable quantities from this construction drawing.
Return JSON array. Be conservative — only include quantities you can clearly read from the drawing.`,
    userPrompt: `Trade: ${trade}
Existing BOQ items for reference: ${JSON.stringify(existingItems?.slice(0,10) || [])}
Extract all measurable quantities from this drawing.`,
    maxTokens: 1500,
    images: [{ path: drawingPath, mediaType: 'image/jpeg' }],
    json: true,
  }).then(r => Array.isArray(r) ? r : []);
}

/**
 * 6. Photo tagging — suggest task from photo
 */
async function suggestPhotoTask(photoPath, activeTasks) {
  return complete({
    systemPrompt: `You are a site engineer. Look at this construction site photo and identify which task it shows.
Return JSON with task_id and confidence.`,
    userPrompt: `Active tasks today: ${JSON.stringify(activeTasks?.slice(0,15) || [])}
Which task does this photo show?`,
    maxTokens: 200,
    images: [{ path: photoPath, mediaType: 'image/jpeg' }],
    json: true,
  }).then(r => r || { task_id: null, confidence: 'low' });
}

/**
 * 7. Payment anomaly narrative
 */
async function narratePaymentAnomaly(vendorName, recommended, raBill, previousPayments, reason) {
  return complete({
    systemPrompt: `You are a PMC financial controller. Analyse this vendor payment anomaly in one sentence.`,
    userPrompt: `Vendor: ${vendorName}
RA bill this cycle: ₹${raBill.toLocaleString('en-IN')}
Recommended payment: ₹${recommended.toLocaleString('en-IN')}
Difference: ${Math.round((recommended-raBill)/raBill*100)}%
Previous payment history: ${JSON.stringify(previousPayments?.slice(-3)||[])}
Reason given: ${reason || 'None'}
Analyse this anomaly in one sentence.`,
    maxTokens: 150,
  }) || `Recommended payment differs from RA bill by ${Math.round(Math.abs(recommended-raBill)/raBill*100)}%.`;
}

/**
 * 8. CN impact assessment
 */
async function assessCNImpact(cnDescription, projectTrades, activeDrawings, scheduleTasks) {
  return complete({
    heavy: true,   // Opus — connecting non-obvious downstream impacts
    systemPrompt: `You are a senior project manager. Assess the impact of this change notice on the project.
Return JSON with affected drawings, schedule tasks, BOQ items, and vendors.`,
    userPrompt: `Change Notice description: ${cnDescription}
Project trades: ${projectTrades.join(', ')}
Active drawings: ${JSON.stringify(activeDrawings?.slice(0,20)||[])}
Active schedule tasks: ${JSON.stringify(scheduleTasks?.slice(0,20)||[])}
What are the impacts of this change?`,
    maxTokens: 1500,
    json: true,
  }).then(r => r || { drawings: [], schedule_tasks: [], boq_items: [], vendors: [], summary: 'Impact assessment unavailable' });
}

/**
 * 9. Date sanity check
 */
async function checkDateSanity(projectName, sqftArea, dates, scheduleCompletion) {
  return complete({
    systemPrompt: `You are an experienced project manager reviewing project dates for a construction project in India.
Check if the dates are realistic and internally consistent. Return JSON.`,
    userPrompt: `Project: ${projectName}
Area: ${sqftArea} sqft
Key dates: ${JSON.stringify(dates)}
Schedule planned completion: ${scheduleCompletion || 'Not yet uploaded'}
Are these dates realistic and consistent? Flag any issues.`,
    maxTokens: 800,
    json: true,
  }).then(r => r || { issues: [], warnings: [], verdict: 'Could not assess' });
}

/**
 * 10. Vendor contract extraction from scanned document
 */
async function extractVendorContract(scanPath, vendorName, trade) {
  return complete({
    systemPrompt: `You are a contracts manager. Extract key terms from this vendor contract scan.
Return JSON. Only extract what you can clearly read. Mark unclear items as null.`,
    userPrompt: `Vendor: ${vendorName} — Trade: ${trade}
Extract: scope of work, contract value, payment terms, penalty clauses, completion date, warranty period.`,
    maxTokens: 1500,
    images: [{ path: scanPath, mediaType: 'image/jpeg' }],
    json: true,
  }).then(r => r || { scope: null, contract_value: null, payment_terms: null, penalties: null, completion_date: null, warranty: null });
}

/**
 * 11. Lessons learned draft
 */
async function draftLessonsLearned(projectName, teamInputs, projectMetrics) {
  return complete({
    heavy: true,   // Opus — high quality synthesis, will be read by entire team
    systemPrompt: `You are a senior PMC consultant drafting a project lessons learned document.
Synthesise team inputs into clear, actionable lessons. Professional but candid.`,
    userPrompt: `Project: ${projectName}
Project metrics: ${JSON.stringify(projectMetrics)}
Team inputs: ${JSON.stringify(teamInputs)}
Draft a structured lessons learned document with sections: What went well, What could be improved, Recommendations for future projects.`,
    maxTokens: 2000,
  }) || 'Lessons learned draft unavailable.';
}

/**
 * 11. Daily report AI screening — flag anomalies, auto-approve clean reports
 * Looks for: missing trades, implausible progress, safety keywords, zero headcount
 */
/**
 * Analyse weekly report for schedule drag
 * Returns { drag_detected, flags: [{trade, gap, vendor, severity}], summary }
 */
async function analyseWeeklyDrag(reportData, scheduleData, projectName) {
  const result = await complete({
    systemPrompt: 'You are a senior PMC consultant analysing a construction weekly report for schedule drag. ' +
      'Compare reported progress against planned schedule. ' +
      'Flag trades with >10% gap between planned and actual. ' +
      'Be specific — name the trade and the gap. ' +
      'Return JSON only.',
    userPrompt: 'Project: ' + projectName + '\n' +
      'Weekly report summary: ' + (reportData.summary||'').substring(0, 500) + '\n' +
      'Schedule data: ' + JSON.stringify(scheduleData).substring(0, 800) + '\n' +
      'Identify any schedule drag.',
    maxTokens: 300,
    cache: true,
    schema: {
      type: 'object',
      properties: {
        drag_detected: { type: 'boolean' },
        flags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              trade:    { type: 'string' },
              gap:      { type: 'number' },
              vendor:   { type: ['string','null'] },
              severity: { type: 'string', enum: ['low','medium','high'] },
            },
            required: ['trade','gap','severity'],
            additionalProperties: false,
          },
        },
        summary: { type: 'string' },
      },
      required: ['drag_detected','flags','summary'],
      additionalProperties: false,
    },
  });
  if (result === null) return null;
  try {
    return typeof result === 'string' ? JSON.parse(result) : result;
  } catch(_e) {
    return { drag_detected: false, flags: [], summary: '' };
  }
}

async function screenDailyReport(reportData, projectName) {
  const result = await complete({
    systemPrompt: 'You are a PMC expert screening a construction daily site report. ' +
      'Identify genuine anomalies only — not minor issues. ' +
      'Anomaly triggers: missing key trades with no explanation, progress claims >30% in one day, ' +
      'safety incident keywords (injury/accident/collapse/fire), zero headcount on active trades, ' +
      'contradictory statements.',
    userPrompt: 'Project: ' + projectName + '\nReport: ' + JSON.stringify(reportData).substring(0, 1000) + '\nIs this report anomalous?',
    maxTokens: 150,
    cache: true,   // system prompt cached — 90% cost reduction on repeat calls
    schema: {      // structured output — guaranteed JSON
      type: 'object',
      properties: {
        is_anomaly: { type: 'boolean' },
        reason:     { type: ['string', 'null'] },
        severity:   { type: 'string', enum: ['low','medium','high'] },
      },
      required: ['is_anomaly','reason','severity'],
      additionalProperties: false,
    },
  });
  if (result === null) return null;
  try {
    return typeof result === 'string' ? JSON.parse(result) : result;
  } catch (_e) {
    return { is_anomaly: false, reason: null, severity: 'low' };
  }
}

// Safety wrapper — if AI is not configured, all functions return null silently
function safeAI(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err.message && (err.message.includes('not configured') || err.message.includes('API key'))) {
        return null;
      }
      throw err;
    }
  };
}

/**
 * Look-ahead plan — site team's 7-day plan.
 *
 * Given completed tasks (the "what's done" context) and upcoming tasks for the
 * next N days, the AI generates a structured site-readiness plan: material
 * call-up, manpower, access/sequencing, risks. This is what site teams need
 * for their weekly planning meeting.
 *
 * Returns plain text (multi-paragraph). Returns null if AI is unavailable —
 * the caller is expected to render a deterministic fallback summary.
 */
async function lookaheadPlan(projectName, completedTasks, upcomingTasks, days) {
  const completedSummary = completedTasks.length
    ? completedTasks.slice(0, 30).map(t => `  · ${t.trade || ''}: ${t.task_name} (ended ${t.end_date})`).join('\n')
    : '  (no recent completions on record)';
  const upcomingSummary = upcomingTasks.length
    ? upcomingTasks.map(t => `  · ${t.trade || ''}: ${t.task_name} (${t.start_date} → ${t.end_date})`).join('\n')
    : '  (no scheduled tasks)';
  return complete({
    systemPrompt: `You are a senior PMC for an architectural firm in Bengaluru. You write concise site-readiness plans for site managers.
Output format — exactly four short sections, no headings, no bullets longer than one line:

Material — what to call up this week
Manpower — what skills/numbers needed
Access & sequencing — what should be ready
Risks & watch-outs — what could derail the week

Keep total under 200 words. Plain language. Direct. Indian English.`,
    userPrompt: `Project: ${projectName}
Window: next ${days} days

Recently completed (context):
${completedSummary}

Upcoming in window:
${upcomingSummary}

Write the four-section plan.`,
    maxTokens: 500,
  });
}


module.exports = {
  complete: safeAI(complete),
  analyseDrawingChange: safeAI(analyseDrawingChange),
  narrateScheduleRisk: safeAI(narrateScheduleRisk),
  screenDailyReport: safeAI(screenDailyReport),
  analyseWeeklyDrag: safeAI(analyseWeeklyDrag),
  suggestQueryAnswer: safeAI(suggestQueryAnswer),
  generateWeeklyNarrative: safeAI(generateWeeklyNarrative),
  extractBOQQuantities: safeAI(extractBOQQuantities),
  suggestPhotoTask: safeAI(suggestPhotoTask),
  narratePaymentAnomaly: safeAI(narratePaymentAnomaly),
  assessCNImpact: safeAI(assessCNImpact),
  checkDateSanity: safeAI(checkDateSanity),
  extractVendorContract: safeAI(extractVendorContract),
  draftLessonsLearned: safeAI(draftLessonsLearned),
  lookaheadPlan: safeAI(lookaheadPlan),
  // Drawing upload sanity / context extraction — v2 additions
  checkDrawingUpload:     safeAI(checkDrawingUpload),
  analyseDetailDrawing:   safeAI(analyseDetailDrawing),
  analyseRFIResponse:     safeAI(analyseRFIResponse),
  // Photo tagging — v2 additions
  tagAndValidatePhoto:    safeAI(tagAndValidatePhoto),
  // M01 audit (v3.1) — vendor row validation for clearance workflow
  validateVendor:         safeAI(validateVendor),
  // Batch API — schedule-health-checker uses this for bulk narrative generation
  batch: async (requests) => {
    try {
      const provider = providers[_provider()];
      if (!provider?.batch) {
        console.warn('[AI] batch not supported by provider:', _provider());
        return null;
      }
      return await provider.batch(requests);
    } catch (err) {
      console.error('[AI] batch failed:', err.message);
      return null;
    }
  },
};

// =====================================================================
// M01 AUDIT (v3.1) — VENDOR ROW VALIDATION
// Called per row after deterministic format checks + API lookups have run.
// Takes the raw uploaded row and the lookup results, returns a judgement
// on cross-field sanity. Deliberately conservative — the purpose is to
// surface anomalies for human review, not to auto-reject.
// =====================================================================
async function validateVendor({ row, gstLookup, ifscLookup }) {
  const systemPrompt = `You are a careful back-office assistant checking a vendor
record before it goes to finance for clearance. Flag anomalies that a human
should eye-ball, but do not reject — finance makes the final call.

Return strict JSON only.`;

  const userPrompt = `Uploaded vendor row:
${JSON.stringify(row, null, 2)}

GST portal returned:
${gstLookup ? JSON.stringify(gstLookup, null, 2) : '(no GSTIN or lookup unavailable)'}

IFSC lookup returned:
${ifscLookup ? JSON.stringify(ifscLookup, null, 2) : '(no IFSC or lookup unavailable)'}

Check for:
- Vendor name materially different from GST legal name (ignore minor formatting — Pvt Ltd, &, spacing)
- Trade declared doesn't match what GST filings suggest
- Phone missing country code or wrong length (Indian numbers = 10 digits or 91 + 10)
- PAN present but first 5 chars don't match GSTIN positions 3-7 (PAN is embedded in GSTIN)
- Bank name inconsistent with IFSC-derived bank
- Obvious typos in address, contact person name, email

Return:
{
  "status": "green" | "amber" | "red",
  "notes": ["short phrase per anomaly, human-readable"],
  "gst_match": "ok" | "minor" | "major" | "na",
  "pan_in_gstin": "ok" | "mismatch" | "na",
  "bank_match": "ok" | "mismatch" | "na"
}

"green" = nothing to flag. "amber" = review recommended. "red" = clear problem.`;

  const result = await complete({
    systemPrompt,
    userPrompt,
    maxTokens: 400,
    json: true,
  });

  return result || { status: 'amber', notes: ['AI validation unavailable'], gst_match: 'na', pan_in_gstin: 'na', bank_match: 'na' };
}

// =====================================================================
// v2 ADDITIONS — Drawing upload checks, detail/RFI analysis, photo tagging
// =====================================================================

// Common-sense check applied to EVERY drawing upload (main, detail, rfi_response).
// Returns { ok, issues[], confidence }. If !ok, the upload route surfaces issues to the
// uploader — non-blocking, advisory only (they can override). Runs async after upload.
async function checkDrawingUpload({ pdfPath, declared }) {
  const systemPrompt = `You are a senior architect auditing a drawing file that was just uploaded.

The uploader declared:
- Drawing number: ${declared.drawing_number}
- Drawing name:   ${declared.drawing_name}
- Category:       ${declared.category}
- Stream:         ${declared.stream}
- Revision:       ${declared.revision}
- Drawing type:   ${declared.drawing_type}

Look at the drawing and confirm the declared metadata is consistent with what you see.
Flag ONLY real issues — don't manufacture problems. Be specific, concise.

Check for:
1. Is this actually an architectural/engineering drawing? (not a blank page, not a random photo)
2. Is the title block readable and oriented correctly? (not 90° rotated)
3. Does the title block's drawing number match the declared number?
4. Does the title block's drawing name roughly match the declared name?
5. Does the category match the content (A-series should show architectural work, S-series structural, etc.)?
6. Is the revision marker on the drawing consistent with the declared revision?

Respond strictly as JSON:
{
  "ok": boolean,
  "issues": [{"field": "drawing_number|drawing_name|category|revision|orientation|content", "severity": "info|warn|error", "note": "short plain-English issue"}],
  "confidence": "low|medium|high"
}`;

  // Feed first page of PDF as image for vision
  const images = pdfPath ? [{ path: pdfPath, mediaType: 'application/pdf' }] : [];

  const res = await complete({
    systemPrompt,
    userPrompt: 'Audit this drawing. Return JSON only.',
    maxTokens: 600,
    images,
    json: true,
  });

  return res || { ok: true, issues: [], confidence: 'low' };
}

// Detail drawing — extract context: trade, parent reference, what the detail shows
async function analyseDetailDrawing({ pdfPath, parentDrawingNumber }) {
  const systemPrompt = `You are examining a DETAIL drawing just uploaded. It's not a main drawing — it's a detail sketch, junction detail, or site condition drawing.

${parentDrawingNumber ? `The uploader says it belongs to parent drawing: ${parentDrawingNumber}` : 'No parent drawing was specified.'}

Extract:
- What the detail shows in 1 short sentence (e.g. "Window reveal detail at external wall")
- Which trade is most relevant (Civil, Architectural, Electrical, HVAC, etc.)
- Whether you can identify a cross-reference to any main drawing (title block, "see also" note, grid reference)
- Whether the drawing appears complete — dimensions, annotations, title block — or looks like a rough markup

Respond strictly as JSON:
{
  "summary": "1 sentence",
  "trade": "Civil|Architectural|Structural|Interior|Electrical|HVAC|Plumbing|Fire|IT|Unknown",
  "referenced_drawings": ["A-101", "S-203"],
  "appears_complete": boolean,
  "note_for_reviewer": "short, optional"
}`;

  const images = pdfPath ? [{ path: pdfPath, mediaType: 'application/pdf' }] : [];

  const res = await complete({
    systemPrompt,
    userPrompt: 'Extract context. JSON only.',
    maxTokens: 500,
    images,
    json: true,
  });

  return res || null;
}

// RFI response — check if the drawing actually answers the RFI question
async function analyseRFIResponse({ pdfPath, rfiQuestion }) {
  const systemPrompt = `You are reviewing a drawing uploaded as a response to a site RFI.

The RFI question was:
"""${rfiQuestion || 'Not provided'}"""

Look at the drawing and assess whether it appears to answer the question.
Don't be pedantic — if the drawing is plausibly related to the question, mark it relevant.
Only flag if the drawing seems completely unrelated to the question.

Respond strictly as JSON:
{
  "appears_to_answer": boolean,
  "confidence": "low|medium|high",
  "reasoning": "1-2 short sentences",
  "suggested_caption": "short caption summarising what the drawing shows"
}`;

  const images = pdfPath ? [{ path: pdfPath, mediaType: 'application/pdf' }] : [];

  const res = await complete({
    systemPrompt,
    userPrompt: 'Assess relevance. JSON only.',
    maxTokens: 400,
    images,
    json: true,
  });

  return res || null;
}

// Photo tag + sanity check.
// - If siteManagerTag provided, AI acts as checker (is the tag consistent with image?)
// - If not, AI suggests tag from candidate tasks
async function tagAndValidatePhoto({ imagePath, siteManagerTag, candidateTasks, projectName }) {
  const taskList = (candidateTasks || []).map(t =>
    `- id=${t.id}, task="${t.task_name}", trade=${t.trade}`
  ).join('\n') || '(no current tasks provided)';

  const systemPrompt = `You are reviewing a photo uploaded from a construction site by a site manager.

Project: ${projectName || 'Unknown'}
Candidate tasks currently scheduled for this project today:
${taskList}

${siteManagerTag
  ? `The site manager has TAGGED this photo with task id=${siteManagerTag.taskId}, caption="${siteManagerTag.caption || ''}". Check if the photo is consistent with this tag.`
  : 'The site manager has NOT tagged this photo. Suggest the most likely task from the candidate list and give a caption.'}

Be practical — construction photos often show mixed activities. Don't over-reject. If unsure, mark confidence: low and let the human decide.

Respond strictly as JSON:
{
  "suggested_task_id": <number or null>,
  "suggested_caption": "<short caption>",
  "trade_visible": "<Civil|Architectural|Structural|Interior|Electrical|HVAC|Plumbing|Fire|IT|Unknown>",
  "matches_site_manager_tag": <true|false|null>,
  "confidence": "<low|medium|high>",
  "note_for_reviewer": "<short, only if matches_site_manager_tag is false>"
}`;

  const images = imagePath ? [{ path: imagePath, mediaType: 'image/jpeg' }] : [];

  const res = await complete({
    systemPrompt,
    userPrompt: 'Analyse photo. JSON only.',
    maxTokens: 500,
    images,
    json: true,
  });

  return res || null;
}
