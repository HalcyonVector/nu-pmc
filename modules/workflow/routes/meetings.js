// routes/meetings.js — unified site visits + MOMs (v3 fold: replaces routes/moms.js and routes/visits.js)
const express = require('express');
const db      = require('../../../middleware/db');
const { validators } = require('../../../middleware/validate');
const { requireAuth, requirePrincipal, requirePMC, requireRole, requireProjectScope, requireScopeFromEntity } = require('../../../middleware/auth');
const { upload } = require('../../../middleware/upload');
const ai      = require('../../../services/ai');
const router        = express.Router();
const waReply        = require('../../../services/wa-reply-actions');
const asyncHandler = require('../../../middleware/asyncHandler');
const notif        = require('../../../services/notifications');
const { generate: generateSeq, insertWithRetry } = require('../../../services/sequence');
const { ALL_HEADS: TEAM_HEADS, PRINCIPALS } = require('../../../services/roles');
const audit = require('../../../services/audit');
const ol           = require('../../../middleware/optimistic-lock');

// Window ladder per version: v1=3d, v2=2d, v3=1d, v4=0d (locks immediately)
const WINDOW_DAYS = [3, 2, 1, 0];

function windowForVersion(version) {
  return WINDOW_DAYS[Math.min(version - 1, 3)];
}

function lockDeadline(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ── GET /api/meetings/:project_id — list all MOMs for a project
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const [meetings] = await db.query(`
      SELECT m.*, mr.version AS current_version, mr.locked, mr.lock_deadline, mr.window_days
      FROM meetings m
      LEFT JOIN meeting_revisions mr ON mr.meeting_id = m.id
        AND mr.version = (SELECT MAX(version) FROM meeting_revisions WHERE meeting_id = m.id)
      WHERE m.project_id = ? ORDER BY m.created_at DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      meetings.flatMap(m => [m.created_by, m.approved_by].filter(Boolean))
    );
    meetings.forEach(m => {
      m.created_by_name  = users.get(m.created_by)?.full_name  || null;
      m.approved_by_name = users.get(m.approved_by)?.full_name || null;
    });
    res.json({ meetings });
  }));

// ── POST /api/meetings/:project_id — create draft MOM
router.post('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { MeetingCreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(MeetingCreate, req, res);
    if (!body) return;

    const defaultTitle = body.title || `${body.type} on ${body.meeting_date}`;

    // Normalise attendees — route accepts either a single 'attendees' string (legacy)
    // or split internal/external (preferred). Schema exposes both fields.
    const internal = req.body.attendees_internal || req.body.attendees || null;
    const external = req.body.attendees_external || null;

    // Auto-generate meeting_number per project, with retry on UNIQUE race (see services/sequence.js)
    const { insertId, number: momNumber } = await insertWithRetry(async () => {
      const n = await generateSeq({
        table: 'meetings',
        numberCol: 'meeting_number',
        projectId: req.params.project_id,
        prefix: 'MOM-',
        pad: 3,
        where: 'AND meeting_number IS NOT NULL',
      });
      const [result] = await db.query(
        `INSERT INTO meetings
         (project_id, client_id, meeting_number, title, type, meeting_date, location,
          attendees_internal, attendees_external, agenda, notes, status, drafted_by, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)`,
        [req.params.project_id, body.client_id, n, defaultTitle,
         body.type, body.meeting_date, body.location,
         internal, external, body.agenda, body.notes, me.id, me.id]
      );
      return { insertId: result.insertId, number: n };
    });
    audit.log({ userId: me.id, action: 'meeting.create',
      entityType: 'meetings', entityId: insertId,
      details: { project_id: parseInt(req.params.project_id, 10), meeting_number: momNumber, type: body.type, meeting_date: body.meeting_date, client_id: body.client_id || null }, req });
    res.json({ success: true, id: insertId, meeting_number: momNumber });
  }));

// ── PATCH /api/meetings/:id — edit draft (author only, before PMC approval)
//
// Optimistic-lock guard (B28 fix): the client must echo the row_version it
// received on its last load. Two browser tabs of the same author concurrently
// editing the same draft would otherwise silently last-wins. Now: the second
// save 409s and the user is told to refresh.
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
    const [[mom]] = await db.query('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ error: 'MOM not found' });
    if (mom.status !== 'draft') return res.status(400).json({ error: 'MOM is no longer a draft — cannot edit' });
    if (mom.created_by !== req.session.user.id && !PRINCIPALS.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Only the author or principals can edit a draft MOM' });
    }
    const { title, meeting_date, attendees, agenda, notes, row_version } = req.body;
    if (row_version === undefined || row_version === null) {
      // Strict: we require the client to send the version it loaded. A missing
      // version means the client is on an old build that hasn't been updated;
      // treat it the same as a stale version (force refresh).
      throw new ol.StaleVersionError('meetings', parseInt(req.params.id, 10), null, 'missing');
    }
    // Atomic: bump row_version AND set the fields in one statement, gated on
    // the client's version. affectedRows = 0 means another save raced ahead.
    const [upd] = await db.query(
      `UPDATE meetings
          SET title = ?, meeting_date = ?, attendees_internal = ?,
              agenda = ?, notes = ?,
              row_version = row_version + 1
        WHERE id = ? AND row_version = ?`,
      [title, meeting_date, attendees||null, agenda||null, notes||null,
       req.params.id, row_version]
    );
    if (upd.affectedRows === 0) {
      // Re-read current version for the 409 payload so the client knows what
      // it should re-load against.
      const [[fresh]] = await db.query('SELECT row_version FROM meetings WHERE id = ?', [req.params.id]);
      throw new ol.StaleVersionError('meetings', parseInt(req.params.id, 10), row_version, fresh ? fresh.row_version : 'not_found');
    }
    audit.log({ userId: req.session.user.id, action: 'meeting.draft_edit',
      entityType: 'meetings', entityId: parseInt(req.params.id, 10),
      details: { project_id: mom.project_id, meeting_number: mom.meeting_number, title, meeting_date }, req });
    res.json({ success: true, row_version: parseInt(row_version, 10) + 1 });
  }));

// ── POST /api/meetings/:id/approve — PMC Head approves draft (INTERNAL ONLY; does NOT notify client)
// This is a two-step flow: approve → preview → issue-to-client (separate call).
// Prevents accidental sends from single click.
router.post('/:id/approve', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const [[mom]] = await db.query('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ error: 'MOM not found' });
    if (mom.status !== 'draft') return res.status(400).json({ error: 'MOM is not in draft status' });

    const sm = require('../../../services/state-machines').meeting;
    try {
      await sm.transition({
        id: parseInt(req.params.id, 10), from: 'draft', to: 'approved',
        extraCols: { approved_by: req.session.user.id, approved_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }

    // Audit log
    audit.log({
      userId: req.session.user.id,
      action: 'meeting_approved',
      entityType: 'meetings',
      entityId: req.params.id,
      details: { meeting_number: mom.meeting_number },
      req
    });

    res.json({ success: true, status: 'approved',
      message: 'MOM approved internally. To send to client, use POST /issue-to-client with explicit confirmation.' });
  }));

// ── GET /api/meetings/:id/preview-client-send — returns exact payload that WOULD be sent to client
// UI shows this in a confirmation modal. No state change, no send.
router.get('/:id/preview-client-send', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const [[mom]] = await db.query(
      `SELECT m.id, m.meeting_number, m.meeting_date, m.status,
         c.client_name, c.contact_person, c.contact_whatsapp, c.contact_email
       FROM meetings m
       LEFT JOIN clients c ON m.client_id = c.id
       WHERE m.id = ?`,
      [req.params.id]
    );
    if (!mom) return res.status(404).json({ error: 'MOM not found' });
    if (mom.status !== 'approved') {
      return res.status(400).json({ error: 'MOM must be in approved state before client send' });
    }
    if (!mom.contact_whatsapp && !mom.contact_email) {
      return res.status(400).json({
        error: 'Client has no WhatsApp or email on record — cannot send',
        code: 'NO_CLIENT_CONTACT'
      });
    }

    const meetingDate = new Date(mom.meeting_date).toLocaleDateString('en-IN',
      {day:'2-digit',month:'short',year:'2-digit'});

    res.json({
      meeting_number:   mom.meeting_number,
      recipient: {
        name:      mom.contact_person  || mom.client_name,
        whatsapp:  mom.contact_whatsapp || null,
        email:     mom.contact_email    || null,
      },
      whatsapp_preview: mom.contact_whatsapp ? {
        body: `Meeting Minutes\n${mom.meeting_number} — ${meetingDate}\n\nPlease review and respond within 3 days.`,
        buttons: ['Accept MOM', 'Request changes'],
      } : null,
      warning: 'This will be sent to the client. Review carefully before confirming.',
      confirmation_required: true,
    });
  }));

// ── POST /api/meetings/:id/issue-to-client — ACTUALLY sends to client (separate click from approve)
// Body must include: { confirmation: 'SEND', meeting_number: '<exact-mom-number>' } to prevent accidents.
// This is the explicit, confirmed, audit-logged external send.
router.post('/:id/issue-to-client', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { confirmation, meeting_number } = req.body;
    if (confirmation !== 'SEND') {
      return res.status(400).json({
        error: "Must pass { confirmation: 'SEND', meeting_number: '<exact>' } to send",
        code: 'CONFIRMATION_MISSING'
      });
    }

    const [[mom]] = await db.query(
      `SELECT m.*, c.contact_person, c.client_name
       FROM meetings m LEFT JOIN clients c ON m.client_id=c.id WHERE m.id=?`,
      [req.params.id]
    );
    if (!mom) return res.status(404).json({ error: 'MOM not found' });
    if (mom.status !== 'approved') {
      return res.status(400).json({ error: 'MOM must be in approved state' });
    }
    // Enforce meeting_number matches — prevents stale-UI accidental sends
    if (meeting_number && meeting_number !== mom.meeting_number) {
      return res.status(400).json({
        error: `MOM number mismatch: you confirmed ${meeting_number} but MOM #${req.params.id} is ${mom.meeting_number}`,
        code: 'MOM_NUMBER_MISMATCH'
      });
    }
    const version  = 1;
    const winDays  = windowForVersion(version);
    const deadline = lockDeadline(winDays);

    await db.tx(async (conn) => {
      const sm = require('../../../services/state-machines').meeting;
      await sm.transition({
        id: parseInt(req.params.id, 10), from: 'approved', to: 'issued',
        extraCols: { issued_at: new Date() },
        conn,
      });
      await conn.query(
        `INSERT INTO meeting_revisions (meeting_id, version, issued_by, window_days, lock_deadline)
         VALUES (?,?,?,?,?)`,
        [req.params.id, version, req.session.user.id, winDays, deadline]
      );
    });

    // Audit BEFORE send, so we have a record even if send fails
    audit.log({
      userId: req.session.user.id,
      action: 'meeting_issued_to_client',
      entityType: 'meetings',
      entityId: req.params.id,
      details: {
        meeting_number: mom.meeting_number,
        recipient_name: mom.contact_person || mom.client_name,
      },
      req
    });

    // Trigger acknowledgement poll to client's personal Matrix room.
    // The gate's 'client_rep' resolver reads clients.matrix_room_id via
    // projects.client_id. If matrix_room_id is NULL (client not on Element X),
    // pollEventId is null — the existing WhatsApp / mailto fallback applies.
    // Non-blocking: gate failure logs + drops; instance row still created.
    let sent = false;
    try {
      const signoffGate = require('../../../services/signoff-gate');
      const { pollEventId } = await signoffGate.triggerSignoff(
        'mom_acknowledgement',
        parseInt(req.params.id, 10),
        mom.project_id,
        {
          question: `${mom.meeting_number} — please acknowledge these meeting minutes.`,
          options: [
            { id: 'accept',  text: '✅ Accept MOM' },
            { id: 'changes', text: '🔄 Request changes' },
          ],
          triggeredBy: req.session.user.id,
        }
      );
      sent = !!pollEventId;
    } catch (gateErr) {
      console.error('[meetings.issue-to-client] signoff-gate error:', gateErr.message);
    }

    res.json({
      success: true,
      sent,
      version,
      window_days: winDays,
      lock_deadline: deadline,
      message: sent
        ? `MOM ${mom.meeting_number} sent to ${mom.contact_person || mom.client_name} via Matrix for acknowledgement.`
        : `MOM marked issued but client not on Matrix — please follow up manually.`,
    });
  }));

// ── POST /api/meetings/:id/reissue — author reissues with changes (within window)
router.post('/:id/reissue', requireAuth, requirePMC, upload.single('doc'), asyncHandler(async (req, res) => {
    const [[mom]] = await db.query('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ error: 'MOM not found' });
    if (mom.status !== 'issued') return res.status(400).json({ error: 'MOM must be issued before reissuing' });

    // Get current version
    const [[curr]] = await db.query(
      'SELECT * FROM meeting_revisions WHERE meeting_id = ? ORDER BY version DESC LIMIT 1', [req.params.id]);
    if (!curr) return res.status(400).json({ error: 'No revision record found' });
    if (curr.locked) return res.status(400).json({ error: 'MOM is locked — Principal or Design Principal must unlock first' });

    // Check window has not expired
    if (new Date() > new Date(curr.lock_deadline)) {
      await db.query('UPDATE meeting_revisions SET locked=1, locked_at=NOW() WHERE id=?', [curr.id]);
      return res.status(400).json({ error: 'Revision window has expired — MOM is now locked' });
    }

    const nextVersion = curr.version + 1;
    if (nextVersion > 4) return res.status(400).json({ error: 'Maximum revisions reached — MOM is locked' });

    const winDays  = windowForVersion(nextVersion);
    const deadline = winDays === 0 ? new Date() : lockDeadline(winDays);

    // W14: lock-current + insert-new + meeting-metadata UPDATE were 3 separate
    // statements. A failure between them produced inconsistent state (e.g.
    // current revision unlocked but a new one already created). All three
    // touch the client-facing audit trail; wrap in tx.
    const { title, meeting_date, attendees, agenda, notes } = req.body;
    await db.tx(async (conn) => {
      await conn.query('UPDATE meeting_revisions SET locked=1, locked_at=NOW() WHERE id=?', [curr.id]);
      await conn.query(
        `INSERT INTO meeting_revisions (meeting_id, version, issued_by, window_days, lock_deadline, locked, revision_reason, file_path)
         VALUES (?,?,?,?,?,?,?,?)`,
        [req.params.id, nextVersion, req.session.user.id, winDays, deadline,
         winDays === 0 ? 1 : 0, req.body.reason||null, req.file?.path||null]
      );
      if (title) {
        await conn.query('UPDATE meetings SET title=?, meeting_date=?, attendees_internal=?, agenda=?, notes=? WHERE id=?',
          [title, meeting_date, attendees||null, agenda||null, notes||null, req.params.id]);
      }
    });

    // W15: high-stakes — client trail. Audit AFTER tx commits.
    audit.log({ userId: req.session.user.id, action: 'meeting.reissue',
      entityType: 'meetings', entityId: parseInt(req.params.id, 10),
      details: { version: nextVersion, window_days: winDays, locked: winDays === 0, reason: req.body.reason || null }, req });

    res.json({
      success: true, version: nextVersion, window_days: winDays,
      locked: winDays === 0,
      message: winDays === 0
        ? `MOM v${nextVersion} issued and immediately locked — maximum revisions reached.`
        : `MOM v${nextVersion} issued — ${winDays}-day window.`,
    });
  }));

// ── POST /api/meetings/:id/unlock — Principal/Design Principal only
router.post('/:id/unlock', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason required to unlock MOM' });

    const [[mom]] = await db.query('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
    if (!mom) return res.status(404).json({ error: 'MOM not found' });

    // Lock current revision, create new with 1-day window only
    const [[curr]] = await db.query(
      'SELECT * FROM meeting_revisions WHERE meeting_id = ? ORDER BY version DESC LIMIT 1', [req.params.id]);

    const nextVersion = (curr?.version || 0) + 1;
    const deadline    = lockDeadline(1); // 1 day only after unlock

    // W16: lock-current + insert-new + status UPDATE are 3 separate writes.
    // If any but the first fails, MOM is left in inconsistent state — e.g.
    // all revisions locked but no new revision created. tx.
    await db.tx(async (conn) => {
      await conn.query('UPDATE meeting_revisions SET locked=1, locked_at=NOW() WHERE meeting_id=? AND locked=0',
        [req.params.id]);

      await conn.query(
        `INSERT INTO meeting_revisions (meeting_id, version, issued_by, window_days, lock_deadline, revision_reason)
         VALUES (?,?,?,1,?,?)`,
        [req.params.id, nextVersion, req.session.user.id, deadline, `UNLOCKED: ${reason}`]
      );

      // Force MOM back to 'issued' state. If already issued, no-op (the state
      // machine will reject the no-op transition, which we tolerate here).
      if (mom.status !== 'issued') {
        const sm = require('../../../services/state-machines').meeting;
        await sm.transition({
          id: parseInt(req.params.id, 10), from: mom.status, to: 'issued',
          conn,
        });
      }
    });

    audit.log({
      userId: req.session.user.id,
      action: 'meeting_unlocked',
      entityType: 'meetings',
      entityId: req.params.id,
      details: { reason, version: nextVersion },
      req
    });

    res.json({ success: true, window_days: 1, lock_deadline: deadline,
      message: `MOM unlocked — 1-day window only. Reason recorded.` });
  }));

// ── GET /api/meetings/:id/action-items — get action items for a MOM
router.get('/:id/action-items', requireAuth, asyncHandler(async (req, res) => {
    const [items] = await db.query(`
      SELECT * FROM meeting_actions
      WHERE meeting_id = ? ORDER BY due_date`, [req.params.id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      items.flatMap(i => [i.assigned_to, i.countersign_by].filter(Boolean))
    );
    items.forEach(i => {
      const u = users.get(i.assigned_to);
      i.assigned_to_name = u?.full_name || i.assignee_name || null;
      i.assigned_role    = u?.role || null;
      i.countersign_name = users.get(i.countersign_by)?.full_name || null;
    });
    res.json({ action_items: items });
  }));

// ── POST /api/meetings/:id/action-items — add action item
router.post('/:id/action-items', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    // Accept both { action_text, assigned_to } and { description, assignee }
    const action_text = req.body.action_text || req.body.description;
    const rawAssignee = req.body.assigned_to ?? req.body.assignee;
    const due_date    = req.body.due_date;
    if (!action_text || !rawAssignee || !due_date) {
      return res.status(400).json({ error: 'Action text, assignee and due date required' });
    }

    // Resolve assignee — integer = user_id, string = free-text name
    let assigned_to = null;
    let assignee_name = null;
    if (/^\d+$/.test(String(rawAssignee))) {
      assigned_to = parseInt(rawAssignee, 10);
    } else {
      assignee_name = String(rawAssignee);
    }

    // Determine countersigner
    const [[assignee]] = assigned_to
      ? await db.query('SELECT role, id FROM users WHERE id = ?', [assigned_to])
      : [[null]];
    let countersignBy = null;

    if (TEAM_HEADS.includes(assignee?.role)) {
      // Team head — PMC Head peer reviews. Find PMC Head on this project
      const [[mtg]] = await db.query('SELECT project_id FROM meetings WHERE id = ?', [req.params.id]);
      const Auth = require('../../auth/contract');
      const pmcCandidates = (await Auth.functions.getUsersByRole('pmc_head', mtg?.project_id))
        .filter(u => u.id !== assigned_to);
      countersignBy = pmcCandidates[0]?.id || null;
    } else {
      // Regular member — their team head countersigns
      const roleToHead = {
        team_lead: 'design_head', team_lead: 'design_head', jr_architect: 'design_head', jr_engineer: 'design_head',
        services_engineer: 'services_head', site_manager: 'pmc_head',
      };
      const headRole = roleToHead[assignee?.role];
      if (headRole) {
        const [[mtg]] = await db.query('SELECT project_id FROM meetings WHERE id = ?', [req.params.id]);
        const Auth = require('../../auth/contract');
        const heads = await Auth.functions.getUsersByRole(headRole, mtg?.project_id);
        countersignBy = heads[0]?.id || null;
      }
    }

    const [result] = await db.query(
      `INSERT INTO meeting_actions (meeting_id, action_text, assigned_to, assignee_name, countersign_by, due_date)
       VALUES (?,?,?,?,?,?)`,
      [req.params.id, action_text, assigned_to, assignee_name, countersignBy, due_date]
    );

    // Notify assignee in-app (only if internal user)
    if (assigned_to) {
      await notif.notify(assigned_to, 'action_item', `Action item assigned to you — due ${due_date}. Open app to acknowledge.`);
    }

    // Notify the countersigner (peer / team-head review) that an item awaits
    // their sign-off. Previously only the assignee was told, so the
    // countersigner had to discover the pending review in-app.
    if (countersignBy && countersignBy !== assigned_to) {
      await notif.notify(countersignBy, 'countersign_needed',
        `An action item needs your countersign — due ${due_date}. Open app to review.`);
    }

    audit.log({ userId: req.session.user.id, action: 'action_item.create',
      entityType: 'meeting_actions', entityId: result.insertId,
      details: { meeting_id: parseInt(req.params.id, 10), action_text, assigned_to: assigned_to || null, assignee_name: assignee_name || null, countersign_by: countersignBy, due_date }, req });

    res.json({ success: true, id: result.insertId, countersign_by: countersignBy });
  }));

// ── PATCH /api/meetings/action-items/:id/acknowledge
router.patch('/action-items/:id/acknowledge', requireAuth, asyncHandler(async (req, res) => {
    const [[item]] = await db.query('SELECT * FROM meeting_actions WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    if (item.assigned_to !== req.session.user.id) return res.status(403).json({ error: 'Not your action item' });
    const sm = require('../../../services/state-machines').meetingAction;
    try {
      await sm.transition({
        id: parseInt(req.params.id, 10), from: item.status, to: 'acknowledged',
        extraCols: { acknowledged_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: req.session.user.id, action: 'action_item.acknowledge',
      entityType: 'meeting_actions', entityId: parseInt(req.params.id, 10),
      details: { meeting_id: item.meeting_id }, req });
    res.json({ success: true });
  }));

// ── PATCH /api/meetings/action-items/:id/countersign — peer review / team head countersign
router.patch('/action-items/:id/countersign', requireAuth, asyncHandler(async (req, res) => {
    const { agree, reason } = req.body;
    const [[item]] = await db.query('SELECT * FROM meeting_actions WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    if (item.countersign_by !== req.session.user.id) return res.status(403).json({ error: 'Not your countersign' });

    if (agree) {
      const sm = require('../../../services/state-machines').meetingAction;
      try {
        await sm.transition({
          id: parseInt(req.params.id, 10), from: item.status, to: 'in_progress',
          extraCols: { countersigned_at: new Date() },
        });
      } catch (err) { return sm.handleRouteError(err, res); }
      audit.log({ userId: req.session.user.id, action: 'action_item.countersign.agree',
        entityType: 'meeting_actions', entityId: parseInt(req.params.id, 10),
        details: { meeting_id: item.meeting_id }, req });
      res.json({ success: true, message: 'Countersigned — action item active.' });
    } else {
      // Disagreement — triggers reissue of parent MOM
      const sm = require('../../../services/state-machines').meetingAction;
      try {
        await sm.transition({
          id: parseInt(req.params.id, 10), from: item.status, to: 'pending',
        });
      } catch (err) { return sm.handleRouteError(err, res); }
      audit.log({ userId: req.session.user.id, action: 'action_item.countersign.disagree',
        entityType: 'meeting_actions', entityId: parseInt(req.params.id, 10),
        details: { meeting_id: item.meeting_id, reason: reason || null }, req });
      // Tell the assignee their action item bounced back and the MOM must be
      // reissued — otherwise the disagreement is silent to them.
      if (item.assigned_to && item.assigned_to !== req.session.user.id) {
        await notif.notify(item.assigned_to, 'countersign_disagreed',
          `Your meeting action item was sent back on countersign review${reason ? ` (${reason})` : ''}. The MOM will be reissued.`);
      }
      res.json({
        success: true, requires_reissue: true,
        message: `Disagreement recorded — MOM must be reissued. Uses one revision window. Reason: ${reason||'Not specified'}`,
      });
    }
  }));

// ── PATCH /api/meetings/action-items/:id/complete
router.patch('/action-items/:id/complete', requireAuth, asyncHandler(async (req, res) => {
    const { completion_note } = req.body;
    const [[item]] = await db.query('SELECT * FROM meeting_actions WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    const me = req.session.user;
    const canComplete = item.assigned_to === me.id
      || PRINCIPALS.includes(me.role)
      || me.role === 'pmc_head';
    if (!canComplete) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const sm = require('../../../services/state-machines').meetingAction;
    try {
      await sm.transition({
        id: parseInt(req.params.id, 10), from: item.status, to: 'completed',
        extraCols: { completed_at: new Date(), completion_note: completion_note || null },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: req.session.user.id, action: 'action_item.complete',
      entityType: 'meeting_actions', entityId: parseInt(req.params.id, 10),
      details: { meeting_id: item.meeting_id, completion_note: completion_note || null }, req });
    res.json({ success: true });
  }));

// =====================================================================
// SITE-VISIT CONVENIENCE ENDPOINTS — thin shortcuts for type='site_visit'
// (Replaces routes/visits.js. A site visit IS a meeting with type='site_visit'
// and visibility='internal'. Use these for quick logging; use the main
// POST /:project_id for full meetings.)
// =====================================================================

// POST /api/meetings/:project_id/site-visit — quick-log an internal site visit
router.post('/:project_id/site-visit', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { visit_date, summary, notes } = req.body;
    if (!visit_date) return res.status(400).json({ error: 'visit_date required' });

    const [result] = await db.query(
      `INSERT INTO meetings (project_id, type, visibility, meeting_date, summary, notes, drafted_by, created_by, status)
       VALUES (?, 'site_visit', 'internal', ?, ?, ?, ?, ?, 'draft')`,
      [req.params.project_id, visit_date, summary || null, notes || null, me.id, me.id]
    );
    audit.log({ userId: me.id, action: 'meeting.site_visit.create',
      entityType: 'meetings', entityId: result.insertId,
      details: { project_id: parseInt(req.params.project_id, 10), visit_date }, req });
    res.json({ success: true, id: result.insertId });
  }));

// POST /api/meetings/:meeting_id/observation — add an observation to a site visit
// (Observations are stored as action items with no assignee)
//
// Bug B25 fix: previously had only role-based auth — a site_manager assigned
// to project A could post observations on project B's meetings. Now uses
// requireScopeFromEntity('meetings', 'meeting_id') to verify the meeting's
// project is one the user is assigned to. Matches the pattern used by
// the GET /:meeting_id/documents route at line ~626.
router.post('/:meeting_id/observation',
  requireAuth,
  requireScopeFromEntity('meetings', 'meeting_id'),
  requireRole(...TEAM_HEADS, 'site_manager', 'senior_site_manager'),
  require('../../../middleware/upload').upload.single('photo'),
  asyncHandler(async (req, res) => {
    const { observation } = req.body;
    if (!observation) return res.status(400).json({ error: 'observation required' });

    await db.query(
      `INSERT INTO meeting_actions (meeting_id, action_text, assignee_name, status)
       VALUES (?, ?, 'Observation', 'pending')`,
      [req.params.meeting_id, observation]
    );
    if (req.file) {
      await db.query(
        `INSERT INTO meeting_photos (meeting_id, file_path, caption, doc_type, uploaded_by)
         VALUES (?, ?, ?, 'photo', ?)`,
        [req.params.meeting_id, req.file.path, observation.substring(0, 300), req.session.user.id]
      );
    }
    audit.log({ userId: req.session.user.id, action: 'meeting.observation.add',
      entityType: 'meeting_actions', entityId: null,
      details: { meeting_id: parseInt(req.params.meeting_id, 10), has_photo: !!req.file, observation_length: observation.length }, req });
    res.json({ success: true });
  }));

// POST /api/meetings/:meeting_id/upload — attach a document (e.g. scanned minutes or site visit report)
//
// Bug B26 fix: same gap as B25 — added requireScopeFromEntity to prevent
// upload to meetings on projects the user is not assigned to.
router.post('/:meeting_id/upload',
  requireAuth,
  requireScopeFromEntity('meetings', 'meeting_id'),
  requireRole(...TEAM_HEADS, 'site_manager', 'senior_site_manager'),
  require('../../../middleware/upload').upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const docType = (req.body.doc_type === 'report_draft' || req.body.doc_type === 'report_final' || req.body.doc_type === 'attachment')
      ? req.body.doc_type : 'attachment';
    await db.query(
      `INSERT INTO meeting_photos (meeting_id, file_path, caption, doc_type, file_size_kb, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.meeting_id, req.file.path, req.body.caption || null, docType,
       Math.round((req.file.size||0)/1024), req.session.user.id]
    );
    audit.log({ userId: req.session.user.id, action: 'meeting.upload',
      entityType: 'meeting_photos', entityId: null,
      details: { meeting_id: parseInt(req.params.meeting_id, 10), doc_type: docType, file_path: req.file.path }, req });
    res.json({ success: true, file: req.file.path });
  }));

// GET /api/meetings/:meeting_id/documents — list all attached photos/docs
router.get('/:meeting_id/documents', requireAuth, requireScopeFromEntity('meetings', 'meeting_id'), asyncHandler(async (req, res) => {
    const [docs] = await db.query(
      'SELECT id, file_path, caption, doc_type, uploaded_at FROM meeting_photos WHERE meeting_id = ? ORDER BY uploaded_at DESC',
      [req.params.meeting_id]
    );
    res.json({ documents: docs });
  }));

module.exports = router;
