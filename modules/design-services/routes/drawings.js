/* eslint-disable no-undef */
// routes/drawings.js
const express  = require('express');
const db       = require('../../../middleware/db');
const { requireAuth, canApproveDrawing, canFlagDrawing, requireProjectScope, requireScopeFromEntity } = require('../../../middleware/auth');
const { upload, getFileSize } = require('../../../middleware/upload');
const router   = express.Router();
const { notifyDrawingIssued } = require('../../../services/notifications');
const notif = require('../../../services/notifications');
const ai = require('../../../services/ai');
const asyncHandler = require('../../../middleware/asyncHandler');
const sequence = require('../../../services/sequence');
const audit = require('../../../services/audit');
const fileUrls = require('../../../services/file-url');
// Onboarding contract — hoisted to module scope (no circular dependency:
// design-services → onboarding.contract only; onboarding routes → design-services.contract).
const Onboarding = require('../../onboarding/contract');

// GET /api/drawings/:project_id — list drawings (filtered by role/stream)
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;

    let whereExtra = '';
    const params = [pid];

    // Site managers see only issued drawings
    if (me.role === 'site_manager') {
      whereExtra = `AND dv.status = 'issued'`;
    }
    // Design stream users see only design drawings
    else if (['team_lead','team_lead','jr_architect','jr_engineer'].includes(me.role) && me.stream === 'design') {
      whereExtra = `AND d.stream = 'design'`;
    }
    // Services stream users see only services drawings
    else if (me.role === 'services_engineer') {
      whereExtra = `AND d.stream = 'services'`;
    }
    // Design head sees design drawings
    else if (me.role === 'design_head') {
      whereExtra = `AND d.stream = 'design'`;
    }
    // Services head sees services drawings
    else if (me.role === 'services_head') {
      whereExtra = `AND d.stream = 'services'`;
    }
    // PMC sees all drawings (oversight role)
    else if (me.role === 'pmc_head') {
      whereExtra = '';
    }

    const [drawings] = await db.query(
      `SELECT d.*, dv.id AS version_id, dv.revision, dv.revision_number, dv.file_path,
              dv.notes, dv.status AS version_status, dv.is_current, dv.created_at AS uploaded_at,
              dv.uploaded_by, dv.l1_reviewed_by, dv.l1_reviewed_at,
              dv.l2_approved_by, dv.l2_approved_at, dv.change_notice_id
       FROM drawings d
       JOIN drawing_versions dv ON dv.drawing_id = d.id AND dv.is_current = 1
       WHERE d.project_id = ? AND d.deleted_at IS NULL AND dv.deleted_at IS NULL ${whereExtra}
       ORDER BY d.category, d.drawing_number`,
      params
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      drawings.flatMap(d => [d.uploaded_by, d.l1_reviewed_by, d.l2_approved_by].filter(Boolean))
    );
    drawings.forEach(d => {
      d.uploaded_by_name      = users.get(d.uploaded_by)?.full_name      || null;
      d.l1_reviewed_by_name   = users.get(d.l1_reviewed_by)?.full_name   || null;
      d.l2_approved_by_name   = users.get(d.l2_approved_by)?.full_name   || null;
      d.view_url              = fileUrls.fileUrl(d.file_path, { defaultSubdir: 'drawings' });
    });

    res.json({ drawings });

  }));

// GET /api/drawings/:project_id/:drawing_id/history — all revisions
router.get('/:project_id/:drawing_id/history', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;
    // Site managers and PMC see only issued versions — all others see full history
    const siteRoles = ['site_manager','pmc_head'];
    const whereStatus = siteRoles.includes(me.role) ? "AND dv.status = 'issued'" : '';
    const [versions] = await db.query(
      `SELECT dv.*, dv.revision, dv.revision_number, dv.notes, dv.status,
              dv.created_at AS uploaded_at
       FROM drawing_versions dv
       WHERE dv.drawing_id = ? AND dv.deleted_at IS NULL ${whereStatus}
       ORDER BY dv.revision_number DESC`,
      [req.params.drawing_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(versions.map(v => v.uploaded_by).filter(Boolean));
    versions.forEach(v => { v.uploaded_by_name = users.get(v.uploaded_by)?.full_name || null; });
    res.json({ versions });
  }));

// POST /api/drawings/:project_id/upload — upload new drawing or revision
// REGISTER ENFORCEMENT:
//  - drawing_type='main' (default) → drawing_number MUST exist in drawing_register for this project.
//    Upload is REJECTED with a clear error if not on the register.
//  - drawing_type='detail'       → free numbering; optionally link to parent_drawing_id.
//  - drawing_type='rfi_response' → free numbering; must link to rfi_issue_id.
router.post('/:project_id/upload', requireAuth, requireProjectScope(),
  upload.single('drawing'), asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { DrawingUpload, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(DrawingUpload, req, res);
    if (!body) return;
    const {
      drawing_number, drawing_name, category, notes, change_notice_id,
      drawing_type, parent_drawing_id, rfi_issue_id
    } = body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const dType = drawing_type || 'main';

    // Determine stream from category
    const designCats   = ['Architectural','Structural','Civil','Interior'];
    const stream       = designCats.includes(category) ? 'design' : 'services';

    // Check user can upload to this stream
    const canUpload = ['principal','design_principal'].includes(me.role) ||
                      (stream === 'design'   && ['design_head','team_lead','team_lead','jr_architect','jr_engineer'].includes(me.role)) ||
                      (stream === 'services' && ['services_head','services_engineer'].includes(me.role));

    if (!canUpload) return res.status(403).json({ error: 'Cannot upload to this stream' });

    // ── REGISTER CHECK (main drawings only)
    let registerEntry = null;
    if (dType === 'main') {
      const [[entry]] = await db.query(
        'SELECT * FROM drawing_register WHERE project_id = ? AND drawing_number = ?',
        [pid, drawing_number]
      );
      if (!entry) {
        const [allEntries] = await db.query(
          'SELECT drawing_number FROM drawing_register WHERE project_id = ? AND stream = ? ORDER BY drawing_number',
          [pid, stream]
        );
        return res.status(400).json({
          error: 'drawing_not_on_register',
          message: `Drawing "${drawing_number}" is not on the approved drawing register for this project.\n\nOnly drawings pre-registered by Design Head (PMC Head) or Services Head (Services Head) at project initiation can be uploaded as main drawings.\n\nIf this is a detail drawing, upload it under "Detail Drawing" instead. If it is a response to an RFI, use the RFI reply flow.\n\nIf it should be on the register, ask PMC Head or Services Head to add it first.`,
          hint: {
            stream,
            valid_drawing_numbers_on_register: allEntries.map(e => e.drawing_number)
          }
        });
      }
      // Category/stream must also match what's on the register
      if (entry.category !== category || entry.stream !== stream) {
        return res.status(400).json({
          error: 'register_mismatch',
          message: `Drawing "${drawing_number}" is on the register under category "${entry.category}" (${entry.stream} stream) — but you submitted it as "${category}" (${stream} stream). Fix the category to match, or ask the Design/Services Head to amend the register.`
        });
      }
      registerEntry = entry;
    }

    // For rfi_response, rfi_issue_id is mandatory
    if (dType === 'rfi_response' && !rfi_issue_id) {
      return res.status(400).json({ error: 'rfi_issue_id is required for RFI response drawings' });
    }

    // Determine initial status based on uploader role
    // Services: services_engineer → pending_l1 (services_head reviews)
    // Design: jr_engineer → pending_l1 (team_lead review), team_lead → pending_l2 (design_head), design_head/principal → issued
    let initStatus = 'pending_l1';
    if (['principal','design_principal'].includes(me.role)) initStatus = 'issued';
    else if (me.role === 'design_head') initStatus = 'issued';
    else if (me.role === 'services_head') initStatus = 'issued';
    else if (me.role === 'team_lead' || me.role === 'team_lead') initStatus = 'pending_l2';

    // ── ATOMIC WRITES BLOCK ─────────────────────────────────────────
    // The upload writes touch four tables in sequence: drawings (insert if new),
    // drawing_versions (supersede previous + insert new), drawing_register
    // (status update). Wrap in a transaction so a mid-flight failure rolls back
    // cleanly instead of leaving e.g. a published version with stale register
    // status.
    //
    // The insertWithRetry inner loop handles ER_DUP_ENTRY on uq_drawing_revision
    // by regenerating the revision number; each retry runs inside the
    // transaction's isolation so the SELECT of the latest revision sees a
    // consistent view.
    let drawing, nextRevNum, revLabel, vResult;
    await db.tx(async (conn) => {
      // Get or create drawing record
      [[drawing]] = await conn.query(
        'SELECT * FROM drawings WHERE project_id = ? AND drawing_number = ?',
        [pid, drawing_number]
      );

      if (!drawing) {
        const [r] = await conn.query(
          `INSERT INTO drawings
             (project_id, drawing_number, drawing_name, category, stream,
              drawing_type, parent_drawing_id, rfi_issue_id, register_entry_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [pid, drawing_number, drawing_name, category, stream,
           dType, parent_drawing_id || null, rfi_issue_id || null,
           registerEntry ? registerEntry.id : null]
        );
        [[drawing]] = await conn.query('SELECT * FROM drawings WHERE id = ?', [r.insertId]);
      }

      // Atomic revision creation — regen on ER_DUP_ENTRY (uq_drawing_revision UNIQUE added in v3.1)
      // revision_number starts at 0 (R0 is the first revision)
      await sequence.insertWithRetry(async () => {
        const [[lastRev]] = await conn.query(
          'SELECT revision_number FROM drawing_versions WHERE drawing_id = ? ORDER BY id DESC LIMIT 1',
          [drawing.id]
        );
        nextRevNum = lastRev == null ? 0 : (parseInt(lastRev.revision_number, 10) + 1);
        revLabel   = `R${nextRevNum}`;

        // Supersede current version (inside retry so state is consistent per attempt)
        const [[currentRow]] = await conn.query(
          'SELECT id, status FROM drawing_versions WHERE drawing_id = ? AND is_current = 1',
          [drawing.id]
        );
        if (currentRow) {
          const sm = require('../../../services/state-machines').drawingVersion;
          await sm.transition({
            id: currentRow.id, from: currentRow.status, to: 'superseded',
            extraCols: { is_current: 0 },
            conn,
          });
        }

        const [r] = await conn.query(
          `INSERT INTO drawing_versions
           (drawing_id, revision, revision_number, file_path, file_size_kb, notes, change_notice_id, status, is_current, uploaded_by)
           VALUES (?,?,?,?,?,?,?,?,1,?)`,
          [drawing.id, revLabel, nextRevNum, file.path, getFileSize(file.path),
           notes || null, change_notice_id || null, initStatus, me.id]
        );
        vResult = r;
      });

      // ── Update drawing register entry status (main drawings only)
      if (dType === 'main' && registerEntry) {
        const regStatus = initStatus === 'issued' ? 'issued' : 'in_progress';
        const [[regCur]] = await conn.query(
          'SELECT status FROM drawing_register WHERE id = ?', [registerEntry.id]
        );
        if (regCur && regCur.status !== regStatus) {
          const sm = require('../../../services/state-machines').drawingRegister;
          await sm.transition({
            id: registerEntry.id, from: regCur.status, to: regStatus,
            conn,
          });
        }
      }
    });

    // If issued by principal/head, mark project BOQ checklist.
    // Business rule: any issued drawing confirms that a BOQ exists for this stream
    // (design_head/services_head cannot upload without a prior BOQ upload, and
    // principals uploading directly always have context). The flag is idempotent
    // (UPDATE SET flag=1) so re-triggering on subsequent revisions is harmless.
    // (Outside the transaction — checklist update is a separate concern; if it
    // fails, the drawing is still correctly saved.)
    if (initStatus === 'issued') {
      // Onboarding is required at module scope — see top of file.
      if (stream === 'design') {
        await Onboarding.functions.setChecklistFlag(pid, 'checklist_design_boq');
      } else {
        await Onboarding.functions.setChecklistFlag(pid, 'checklist_services_boq');
      }
    }

    // Trigger AI drawing change analysis async — only on revisions
    const vId = vResult.insertId;
    setImmediate(async () => {
      try {
        const aiToggles = require('../../../services/ai-toggles');
        // ── v2: COMMON-SENSE CHECK on every upload (main, detail, rfi_response)
        if (await aiToggles.isEnabled('drawing_sanity_check')) {
        try {
          const sanity = await ai.checkDrawingUpload({
            pdfPath: req.file?.path,
            declared: {
              drawing_number: drawing.drawing_number,
              drawing_name:   drawing.drawing_name,
              category:       drawing.category,
              stream:         stream,
              revision:       revLabel,
              drawing_type:   dType,
            }
          });
          if (sanity && sanity.issues?.length) {
            const worst = sanity.issues.reduce((a,b) =>
              (['error','warn','info'].indexOf(a.severity) < ['error','warn','info'].indexOf(b.severity)) ? a : b, sanity.issues[0]);
            await db.query(
              `INSERT INTO drawing_ai_checks (drawing_version_id, check_type, result_json, ok, severity, summary)
               VALUES (?, 'common_sense', ?, ?, ?, ?)`,
              [vId, JSON.stringify(sanity), sanity.ok ? 1 : 0, worst?.severity || 'info',
               sanity.issues.map(i => i.note).join('; ')]
            );
          }
        } catch (e) { console.error('[AI common-sense] error:', e.message); }
        }

        // ── v2: DETAIL context extraction
        if (dType === 'detail' && await aiToggles.isEnabled('detail_drawing_analysis')) {
          try {
            const parentNum = parent_drawing_id
              ? (await db.query('SELECT drawing_number FROM drawings WHERE id = ?', [parent_drawing_id]))[0][0]?.drawing_number
              : null;
            const detail = await ai.analyseDetailDrawing({ pdfPath: req.file?.path, parentDrawingNumber: parentNum });
            if (detail) {
              await db.query(
                `INSERT INTO drawing_ai_checks (drawing_version_id, check_type, result_json, ok, severity, summary)
                 VALUES (?, 'detail_context', ?, 1, 'info', ?)`,
                [vId, JSON.stringify(detail), detail.summary || 'Detail context extracted']
              );
            }
          } catch (e) { console.error('[AI detail] error:', e.message); }
        }

        // ── v2: RFI relevance
        if (dType === 'rfi_response' && rfi_issue_id && await aiToggles.isEnabled('rfi_response_check')) {
          try {
            const [[rfi]] = await db.query('SELECT title, description FROM issues WHERE id = ?', [rfi_issue_id]);
            // The RFI question is the issue title or full description. Prefer title for brevity.
            const rfiQ = rfi?.title || rfi?.description;
            const rfiCheck = await ai.analyseRFIResponse({ pdfPath: req.file?.path, rfiQuestion: rfiQ });
            if (rfiCheck) {
              const sev = rfiCheck.appears_to_answer ? 'info' : 'warn';
              await db.query(
                `INSERT INTO drawing_ai_checks (drawing_version_id, check_type, result_json, ok, severity, summary)
                 VALUES (?, 'rfi_relevance', ?, ?, ?, ?)`,
                [vId, JSON.stringify(rfiCheck), rfiCheck.appears_to_answer ? 1 : 0, sev,
                 rfiCheck.reasoning || '']
              );
            }
          } catch (e) { console.error('[AI rfi] error:', e.message); }
        }

        // Existing: revision-change analysis (for main drawings with a prior revision)
        if (dType === 'main' && await aiToggles.isEnabled('revision_change_analysis')) { // B15: was gated on non-existent drawing.version_count; the prev-version query below is the real guard
          const [[prev]] = await db.query(
            'SELECT id, file_path FROM drawing_versions WHERE drawing_id = ? ORDER BY revision_number DESC LIMIT 1 OFFSET 1',
            [drawing.id]
          );
          if (prev?.file_path && req.file?.path) {
            const aiRes = await ai.analyseDrawingChange(prev.file_path, req.file.path, drawing.drawing_number||'', drawing.category||'');
            if (aiRes?.changes?.length || aiRes?.impacts) {
              await db.query(
                `INSERT INTO drawing_ai_checks (drawing_version_id, check_type, result_json, ok, severity, summary)
                 VALUES (?, 'revision_change', ?, 1, 'info', ?)`,
                [vId, JSON.stringify(aiRes), (aiRes.changes || []).slice(0,3).map(c => c.description || c).join('; ') || 'Revision changes detected']
              );
            }
          }
        }
      } catch (e) {
        console.error('[AI drawing pipeline] error:', e.message);
      }
    });

    res.json({
      success: true,
      drawing_id:  drawing.id,
      version_id:  vId,
      revision:    revLabel,
      status:      initStatus,
      message:     initStatus === 'issued' ? 'Drawing issued to site.' : `Drawing uploaded — awaiting ${initStatus === 'pending_l1' ? 'Level 1' : 'Level 2'} approval. AI change analysis running.`
    });

    // SSE real-time notification
    try { require('../../system/routes/sse').notifyProject(req.params.project_id, 'drawing_issued', { project_id: req.params.project_id, drawing_id: drawing.id }); } catch(_e) {}

    // Drawing approval poll to Design/Services Head (D1, friction-reduction brief)
    // Fires only when drawing needs approval — not when issued directly by head/principal.
    if (initStatus === 'pending_l1' || initStatus === 'pending_l2') {
      const signoffGate = require('../../../services/signoff-gate');
      const workflowType = stream === 'services' ? 'drawing_approval_services' : 'drawing_approval_design';
      signoffGate.triggerSignoff(
        workflowType,
        vId,
        pid,
        {
          question: `${drawing.drawing_number} ${revLabel} — ${drawing.drawing_name?.slice(0, 50) || 'drawing'} — approval required.`,
          triggeredBy: me.id,
        }
      ).catch(e => console.warn('[drawings] approval poll failed:', e.message));

      // E2 — Principal FYI: drawing in approval queue
      const matrixAdapter = require('../../../services/matrix-adapter');
      const db2 = require('../../../middleware/db');
      db2.query(
        `SELECT matrix_room_id FROM users WHERE role IN ('principal','design_principal') AND is_active=1 AND matrix_room_id IS NOT NULL`
      ).then(([principals]) => {
        const msg = `📐 ${drawing.drawing_number} ${revLabel} — ${drawing.drawing_name?.slice(0,50)||'drawing'} — submitted for ${stream} head approval.`;
        for (const p of principals) {
          matrixAdapter.sendText({ roomId: p.matrix_room_id, body: msg })
            .catch(e => console.warn('[drawings] principal FYI failed:', e.message));
        }
      }).catch(() => {});
    }

  }));

// POST /api/drawings/version/:version_id/approve — approve drawing
router.post('/version/:version_id/approve', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    /* eslint-disable no-undef */
    const [[dv]] = await db.query(
      `SELECT dv.*, d.stream, d.project_id FROM drawing_versions dv
       JOIN drawings d ON dv.drawing_id = d.id
       WHERE dv.id = ?`,
      [req.params.version_id]
    );
    /* eslint-enable no-undef */

    if (!dv) return res.status(404).json({ error: 'Drawing version not found' });

    // L4a project-scope check: project-scoped roles (site_manager, team_lead,
    // etc.) can only act on drawings in projects they're assigned to.
    // Firm-wide roles bypass. canApproveDrawing() below handles stream + role
    // gate; this adds the project membership gate on top.
    const { PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
    if (PROJECT_SCOPED_ROLES.includes(me.role)) {
      const assigned = (me.projects || []).some(p => parseInt(p.id) === parseInt(dv.project_id));
      if (!assigned) {
        return res.status(403).json({
          error: 'Not assigned to this project',
          code:  'PROJECT_SCOPE_DENIED',
        });
      }
    }

    if (!canApproveDrawing(me, dv)) return res.status(403).json({ error: 'Cannot approve this drawing' });

    // Idempotent — already issued or superseded, nothing to do
    if (['issued','superseded'].includes(dv.status)) {
      return res.json({ success: true, status: dv.status, message: 'Drawing already ' + dv.status });
    }

    let newStatus;
    const updates = {};

    if (dv.status === 'pending_l1') {
      // L1 review — move to L2 or issue if principal
      if (['principal','design_principal','design_head'].includes(me.role) || me.role === 'services_head') {
        newStatus = 'issued';
        updates.l1_reviewed_by = me.id;
        updates.l1_reviewed_at = new Date();
        updates.l2_approved_by = me.id;
        updates.l2_approved_at = new Date();
        updates.issued_at      = new Date();
      } else {
        newStatus = 'pending_l2';
        updates.l1_reviewed_by = me.id;
        updates.l1_reviewed_at = new Date();
      }
    } else if (dv.status === 'pending_l2') {
      newStatus = 'issued';
      updates.l2_approved_by = me.id;
      updates.l2_approved_at = new Date();
      updates.issued_at      = new Date();
    }

    // D2: drawing_versions UPDATE and (when issued) drawing_register UPDATE
    // were sequential. If the register UPDATE failed, the drawing was issued
    // but the register entry stayed in_progress — visible drift for the next
    // upload attempt against the same number. Wrap in tx so both apply or
    // neither.
    await db.tx(async (conn) => {
      const sm = require('../../../services/state-machines');
      await sm.drawingVersion.transition({
        id: dv.id, from: dv.status, to: newStatus,
        extraCols: {
          l1_reviewed_by: updates.l1_reviewed_by || dv.l1_reviewed_by,
          l1_reviewed_at: updates.l1_reviewed_at || dv.l1_reviewed_at,
          l2_approved_by: updates.l2_approved_by || dv.l2_approved_by,
          l2_approved_at: updates.l2_approved_at || dv.l2_approved_at,
          issued_at:      updates.issued_at      || dv.issued_at,
        },
        conn,
      });
      if (newStatus === 'issued') {
        // Look up the register entry id, then transition via state machine.
        const [[reg]] = await conn.query(
          'SELECT register_entry_id FROM drawings WHERE id = ? AND register_entry_id IS NOT NULL',
          [dv.drawing_id]
        );
        if (reg?.register_entry_id) {
          const [[regCur]] = await conn.query(
            'SELECT status FROM drawing_register WHERE id = ?', [reg.register_entry_id]
          );
          if (regCur && regCur.status !== 'issued') {
            await sm.drawingRegister.transition({
              id: reg.register_entry_id, from: regCur.status, to: 'issued',
              conn,
            });
          }
        }
      }
    });

    audit.log({ userId: me.id, action: 'drawing.approve',
      entityType: 'drawing_versions', entityId: dv.id,
      details: { from: dv.status, to: newStatus, project_id: dv.project_id, stream: dv.stream }, req });

    // Notify site team when drawing is issued.
    if (newStatus === 'issued') {
      try {
        const [[drawingInfo]] = await db.query(
          'SELECT d.drawing_number, d.drawing_name FROM drawings d JOIN drawing_versions dv ON dv.drawing_id = d.id WHERE dv.id = ?',
          [dv.id]
        );
        notifyDrawingIssued(dv.project_id, drawingInfo?.drawing_number||'', dv.revision||'', drawingInfo?.drawing_name||'')
          .catch(e => console.warn('[drawings] notifyDrawingIssued swallowed:', e.message));
      } catch(e) { console.error('[drawings] Notify error:', e.message); }
    }

    // Mark project BOQ checklist for this stream when a drawing is approved+issued.
    // Onboarding is required at module scope — see top of file.
    if (newStatus === 'issued') {
      if (dv.stream === 'design') {
        await Onboarding.functions.setChecklistFlag(dv.project_id, 'checklist_design_boq');
      } else {
        await Onboarding.functions.setChecklistFlag(dv.project_id, 'checklist_services_boq');
      }
    }

    // Notify L2 reviewer when drawing moves to pending_l2.
    // notifyDrawingApproval handles both R1/R2 (Matrix poll via signoff-gate)
    // and R3+ (in-app notification to design_head/services_head).
    if (newStatus === 'pending_l2') {
      notifyDrawingApproval(dv, dv.project_id)
        .catch(e => console.warn('[drawings] L2 reviewer notify swallowed:', e.message));
    }

    res.json({
      success: true,
      new_status: newStatus,
      message: newStatus === 'issued' ? 'Drawing approved and issued to site.' : 'Drawing reviewed — sent for Level 2 approval.'
    });

  }));

// POST /api/drawings/version/:version_id/reject — reject drawing
router.post('/version/:version_id/reject', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { rejection_note } = req.body;
    const [[dv]] = await db.query(
      `SELECT dv.*, d.stream, d.project_id FROM drawing_versions dv JOIN drawings d ON dv.drawing_id = d.id WHERE dv.id = ?`,
      [req.params.version_id]
    );

    if (!dv) return res.status(404).json({ error: 'Not found' });

    // L4a project-scope check — same pattern as approve
    const { PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
    if (PROJECT_SCOPED_ROLES.includes(me.role)) {
      const assigned = (me.projects || []).some(p => parseInt(p.id) === parseInt(dv.project_id));
      if (!assigned) {
        return res.status(403).json({
          error: 'Not assigned to this project',
          code:  'PROJECT_SCOPE_DENIED',
        });
      }
    }

    if (!canApproveDrawing(me, dv)) return res.status(403).json({ error: 'Cannot reject this drawing' });

    const field = dv.status === 'pending_l1' ? 'l1_rejection_note' : 'l2_rejection_note';
    // D3: status UPDATE and restore-previous-version UPDATE were separate.
    // If the second UPDATE failed, the drawing had no current version. tx.
    await db.tx(async (conn) => {
      const sm = require('../../../services/state-machines').drawingVersion;
      await sm.transition({
        id: dv.id, from: dv.status, to: 'rejected',
        extraCols: { [field]: rejection_note || 'No reason given', is_current: 0 },
        conn,
      });
      // Restore the most recent superseded revision as current (no status change,
      // just is_current flag). Audit-allowed raw UPDATE — see audit allowlist.
      await conn.query(
        `UPDATE drawing_versions SET is_current = 1
         WHERE drawing_id = ? AND status = 'superseded'
         ORDER BY revision_number DESC LIMIT 1`,
        [dv.drawing_id]
      );
    });
    audit.log({ userId: me.id, action: 'drawing.reject',
      entityType: 'drawing_versions', entityId: dv.id,
      details: { from: dv.status, to: 'rejected', reason: rejection_note || null }, req });

    res.json({ success: true, message: 'Drawing rejected — sent back to uploader.' });

  }));

// POST /api/drawings/version/:version_id/flag — Design Principal/Principal/R/S flag with comment
// Does not reject — holds drawing for review. Notifies uploader.
router.post('/version/:version_id/flag', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[dv]] = await db.query(
      `SELECT dv.*, d.stream, d.project_id, d.drawing_number, d.drawing_name
       FROM drawing_versions dv JOIN drawings d ON dv.drawing_id = d.id
       WHERE dv.id = ?`,
      [req.params.version_id]
    );
    if (!dv) return res.status(404).json({ error: 'Drawing version not found' });
    // D5: project-scope check (canFlagDrawing handles role but not project membership).
    const { PROJECT_SCOPED_ROLES: PSR_FLAG } = require('../../../middleware/auth');
    if (PSR_FLAG.includes(me.role)) {
      const assigned = (me.projects || []).some(p => parseInt(p.id) === parseInt(dv.project_id));
      if (!assigned) {
        return res.status(403).json({ error: 'Not assigned to this project', code: 'PROJECT_SCOPE_DENIED' });
      }
    }
    if (!canFlagDrawing(me, dv)) {
      return res.status(403).json({ error: 'Only Principal, Design Principal, PMC Head, Services Head or PMC Head can flag drawings' });
    }
    const { comment, hold } = req.body;
    if (!comment) return res.status(400).json({ error: 'Comment required when flagging a drawing' });

    // If hold=true — put drawing back to pending review
    if (hold) {
      const sm = require('../../../services/state-machines').drawingVersion;
      try {
        await sm.transition({
          id: parseInt(req.params.version_id), from: dv.status, to: 'pending_l2',
          extraCols: {
            flag_comment: comment, flag_by: me.id, flag_at: new Date(),
          },
        });
      } catch (err) { return sm.handleRouteError(err, res); }
    } else {
      // Comment only — no status change
      await db.query(
        'UPDATE drawing_versions SET flag_comment=?, flag_by=?, flag_at=NOW() WHERE id=?',
        [comment, me.id, req.params.version_id]
      );
    }

    // Notify the uploader
    const [[uploader]] = await db.query(
      'SELECT uploaded_by FROM drawing_versions WHERE id=?', [req.params.version_id]
    );
    if (uploader?.uploaded_by) {
      await notif.notify(uploader.uploaded_by, 'drawing_flag',
         `Drawing ${dv.drawing_number} — ${dv.drawing_name} flagged by ${me.full_name}: ${comment}${hold ? ' — HELD for review.' : ''}`);
    }

    audit.log({ userId: me.id, action: 'drawing.flag',
      entityType: 'drawing_versions', entityId: parseInt(req.params.version_id),
      details: { project_id: dv.project_id, drawing_number: dv.drawing_number, hold: !!hold, comment }, req });

    res.json({
      success: true,
      held: !!hold,
      message: hold
        ? `Drawing held for review — ${me.full_name}. Uploader notified.`
        : `Comment added — ${me.full_name}. Uploader notified.`,
    });
  }));

// GET /api/drawings/view/:version_id — serve drawing for PDF viewer
// Returns metadata + authenticated file URL
router.get('/view/:version_id', requireAuth, asyncHandler(async (req, res) => {
    const [[dv]] = await db.query(
      `SELECT dv.*, d.drawing_number, d.drawing_name, d.stream, d.project_id
       FROM drawing_versions dv
       JOIN drawings d ON dv.drawing_id = d.id
       WHERE dv.id = ?`,
      [req.params.version_id]
    );
    if (!dv) return res.status(404).json({ error: 'Drawing version not found' });

    // D6: project-scope check — version_id is sequential, scoped users could
    // enumerate to read drawings from projects they're not assigned to.
    const { PROJECT_SCOPED_ROLES: PSR_VIEW } = require('../../../middleware/auth');
    if (PSR_VIEW.includes(req.session.user.role)) {
      const assigned = (req.session.user.projects || []).some(p => parseInt(p.id) === parseInt(dv.project_id));
      if (!assigned) {
        return res.status(403).json({ error: 'Not assigned to this project', code: 'PROJECT_SCOPE_DENIED' });
      }
    }

    if (dv.uploaded_by) {
      const Auth = require('../../auth/contract');
      const users = await Auth.functions.getUsers([dv.uploaded_by]);
      dv.uploaded_by_name = users.get(dv.uploaded_by)?.full_name || null;
    }

    // Site managers only see issued drawings
    if (req.session.user.role === 'site_manager' && dv.status !== 'issued') {
      return res.status(403).json({ error: 'Drawing not yet issued to site' });
    }

    const parts = fileUrls.uploadedFileParts(dv.file_path || '', 'drawings');

    res.json({
      drawing_number: dv.drawing_number,
      drawing_name:   dv.drawing_name,
      revision:       dv.revision,
      status:         dv.status,
      stream:         dv.stream,
      uploaded_by:    dv.uploaded_by_name,
      uploaded_at:    dv.created_at,
      view_url:       fileUrls.fileUrl(dv.file_path, { defaultSubdir: 'drawings' }),
      filename:       parts?.filename || null,
    });
  }));

// Helper — send drawing approval notification based on revision
async function notifyDrawingApproval(drawingVersion, projectId) {
  const revision = drawingVersion.revision || 'R0';
  const revNum   = parseInt(revision.replace(/[^0-9]/g,'')) || 0;
  const isMinor  = revNum >= 1 && revNum <= 2;
  const stream   = drawingVersion.stream;

  if (isMinor) {
    // R1/R2: signoff-gate handles approver resolution + Matrix poll.
    // Thumbnail (when available) is attached to the same room
    // immediately before the poll so it sits with the buttons.
    const signoffGate = require('../../../services/signoff-gate');
    await signoffGate.triggerSignoff(
      'drawing_approval',
      drawingVersion.id,
      projectId,
      {
        question: `${drawingVersion.drawing_number || ''} Rev ${revision} — ${(drawingVersion.drawing_name || '').substring(0, 40)} — approve?`,
        documentRow: {
          id: drawingVersion.id,
          stream,                                  // drives is_services_stream / is_design_stream
          raised_by: drawingVersion.raised_by,
        },
        attachImage: drawingVersion.thumbnail_path || undefined,
        attachMime:  'image/jpeg',
      }
    ).catch(e => console.warn('[drawings signoffGate.triggerSignoff]', e.message));
  } else {
    // R3+ or no thumbnail — in-app notification only.
    const Auth = require('../../auth/contract');
    const headRole = stream === 'design' ? 'design_head' : 'services_head';
    const heads = (await Auth.functions.getUsersByRole(headRole, projectId)).filter(u => u.phone);
    for (const h of heads) {
      await notif.notify(h.id, 'drawing_approval',
         'Drawing submitted for L2 approval: ' + (drawingVersion.drawing_number||'') + ' Rev ' + revision);
    }
  }
}

// DELETE /api/drawings/version/:id — delete a drawing version (only if pending, not issued)
// Only principal, design_head, services_head, or the uploader can delete.
router.delete('/version/:id', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[dv]] = await db.query(
      `SELECT dv.*, d.project_id, d.stream FROM drawing_versions dv
       JOIN drawings d ON dv.drawing_id = d.id
       WHERE dv.id = ?`, [req.params.id]
    );
    if (!dv) return res.status(404).json({ error: 'Drawing version not found' });

    if (dv.status === 'issued') {
      return res.status(400).json({ error: 'Cannot delete an issued drawing — it may be referenced by site documents' });
    }

    const canDelete =
      ['principal', 'design_principal'].includes(me.role) ||
      (me.role === 'design_head' && dv.stream === 'design') ||
      (me.role === 'services_head' && dv.stream === 'services') ||
      dv.uploaded_by === me.id;

    if (!canDelete) {
      return res.status(403).json({ error: 'Not authorised to delete this drawing' });
    }

    // Soft-delete: mark as deleted rather than removing the row permanently.
    // This preserves audit trail and allows recovery. Queries exclude deleted rows
    // via `WHERE deleted_at IS NULL`.
    await db.query(
      'UPDATE drawing_versions SET deleted_at = NOW(), deleted_by = ? WHERE id = ?',
      [me.id, req.params.id]
    );

    // Soft-delete the parent drawing record if all its non-deleted versions are gone
    const [[remaining]] = await db.query(
      'SELECT COUNT(*) AS c FROM drawing_versions WHERE drawing_id = ? AND deleted_at IS NULL',
      [dv.drawing_id]
    );
    if (remaining.c === 0) {
      await db.query(
        'UPDATE drawings SET deleted_at = NOW(), deleted_by = ? WHERE id = ?',
        [me.id, dv.drawing_id]
      );
    }

    audit.log({ userId: me.id, action: 'drawing.delete',
      entityType: 'drawing_versions', entityId: parseInt(req.params.id),
      details: { project_id: dv.project_id, drawing_number: dv.drawing_number, stream: dv.stream, status: dv.status }, req });

    res.json({ success: true, message: 'Drawing deleted' });
  }));

module.exports = router;
