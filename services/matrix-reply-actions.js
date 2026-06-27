// services/matrix-reply-actions.js
// ============================================================
// Matrix poll-vote correlation service.
//
// This is the Matrix equivalent of services/wa-reply-actions.js. The
// pattern: bot sends a poll, we record the poll event_id with the
// business reference (ref_table + ref_id + action_type), a scheduled
// reader scans recent room messages for poll responses, finds the
// matching pending row, and dispatches to the appropriate state
// transition handler.
//
// Phase 2 deliverable (May 2026):
//   - registerPendingPoll: record what we sent, what we wait for
//   - processVotes:        scan rooms with pending polls, dispatch
//   - expireOverdue:       sweep past-expires_at rows
//
// Phase 3 will port the 7 active wa-reply-actions handlers to this
// substrate (anomaly_ack, grn_approve, issue_confirm, vendor_defect_ack,
// urgent_payment_fyi, mom_client_ack, drawing_approval). Until then this
// file's processVotes() is wired but only emits a log line per matched
// vote — actual state transitions still happen via Twilio path.
//
// Concurrency: the reader is single-threaded by design. Multiple
// instances would risk double-dispatching the same vote. The cron
// invocation in scripts/matrix-poll-reader.js must therefore not
// overlap with itself — see lock acquisition there.
// ============================================================

'use strict';

const matrixAdapter = require('./matrix-adapter');
// signoff-gate is required lazily inside the handler to avoid a require
// cycle (gate may grow to use matrix-reply-actions or its tests in the
// future). Lazy require also keeps test setup simpler — tests can mock
// the gate per-suite.

// ── POLL_OWNERS — single registry, no per-table if/else ───────────
//
// A vote arrives correlated to a poll_event_id. The single active owner:
//   - signoff_instances  (relay-aware sign-off gate, v5.32)
//
// Phase 4: matrix_pending_polls (v5.27) removed. All callers migrated
// to triggerSignoff(). The table is dropped in v5.39-phase4-cleanup.sql.
//
// Adding a new owner = one new entry here.

const POLL_OWNERS = [
  {
    kind: 'signoff_instance',
    lookup: async (db, pollEventId) => {
      const [[row]] = await db.query(
        `SELECT * FROM signoff_instances
          WHERE poll_event_id = ?
            AND status = 'in_progress'
          LIMIT 1`,
        [pollEventId]
      );
      return row || null;
    },
    handler: _handleSignoffInstanceVote,
  },
];

async function _resolvePollOwner(db, pollEventId) {
  for (const owner of POLL_OWNERS) {
    const row = await owner.lookup(db, pollEventId);
    if (row) return { kind: owner.kind, row, handler: owner.handler };
  }
  return null;
}

// ── Owner-specific vote handlers ────────────────────────────────────

/**
 * signoff_instances vote handler — the relay-aware path.
 * Records the vote in signoff_votes and either advances the relay
 * (if more approvers) or closes the instance (if last approver).
 *
 * Per delta brief §8: vote → triggerNextRelayStep.
 */
async function _handleSignoffInstanceVote({ db, ev, voterMxid, voterUid, answerId, ownerRow }) {
  const inst = ownerRow;

  // Wrong voter: not the current_approver_id. Record-but-don't-act so
  // an out-of-order or unintended vote doesn't advance the relay. The
  // expected approver can still vote later.
  if (inst.current_approver_id != null && voterUid !== inst.current_approver_id) {
    return { acted: false, reason: 'wrong_voter' };
  }

  // Insert the vote audit row. UNIQUE (signoff_instance_id, voter_user_id)
  // means a duplicate vote from the same user is rejected at the DB
  // level — we treat that as already-acted.
  try {
    await db.query(
      `INSERT INTO signoff_votes
         (signoff_instance_id, voter_user_id, voter_mxid,
          vote_answer_id, vote_event_id, voted_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [inst.id, voterUid, voterMxid, answerId, ev.event_id || null]
    );
  } catch (err) {
    // Duplicate-vote = treat as acted (idempotent).
    if (err && /Duplicate/i.test(err.message || '')) {
      return { acted: false, reason: 'duplicate' };
    }
    throw err;
  }

  // Rejection short-circuit: if the approver voted "no", close the
  // instance with result='rejected' instead of advancing the relay.
  // Delegated to the gate so all terminal transitions go through one
  // place (and post-completion hooks fire uniformly).
  if (answerId === 'no' || /reject|❌/i.test(String(answerId))) {
    const gate = require('./signoff-gate');
    await gate.markRejected(inst.id);
    return { acted: true, terminal: 'rejected' };
  }

  // Approval: advance to the next approver in the relay (or close if
  // last). Lazy require to break a potential cycle.
  const gate = require('./signoff-gate');
  await gate.triggerNextRelayStep(inst.id);

  return { acted: true };
}

// ── Tunables ────────────────────────────────────────────────────────
//
// Per-action expiry windows mirror the WA values where applicable, so
// the user-facing rules don't change with the migration. New actions
// added in Phase 3 should append to this map.
const EXPIRY_HOURS = {
  anomaly_ack:        24,
  grn_approve:        12,
  report_update:       4,
  issue_confirm:      24,
  vendor_defect_ack:  48,
  urgent_payment_fyi:  4,
  mom_client_ack:     72,
  drawing_approval:   48,
};

// Auto-accept eligibility — for these actions, no reply within the
// computed window is treated as approval. Phase 2 records the
// auto_accept_at timestamp; the worker that fires on it is Phase 3.
const AUTO_ACCEPT_TYPES = new Set([
  'anomaly_ack',
  'drawing_approval',
  'vendor_defect_ack',
]);

const BIZ_START_HOUR = 7;
const BIZ_END_HOUR   = 21;

// ── Helpers ────────────────────────────────────────────────────────

function _autoAcceptTime(sentAt) {
  const sent = new Date(sentAt || Date.now());
  const hour = sent.getHours();
  if (hour >= BIZ_START_HOUR && hour < (BIZ_END_HOUR - 2)) {
    return new Date(sent.getTime() + 2 * 3600000);
  }
  const next = new Date(sent);
  if (hour >= BIZ_END_HOUR) next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

function _expiryFor(actionType) {
  return (EXPIRY_HOURS[actionType] || 24) * 3600000;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Register a pending poll. Called immediately after matrixAdapter.sendPoll()
 * succeeds, with the returned event_id.
 *
 * Idempotency: same poll_event_id → INSERT IGNORE; the existing row wins.
 * Supersede: any prior pending row with the same (action_type, ref_id) is
 * marked 'cancelled' so a re-sent poll doesn't double-act.
 *
 * @param {object} db                   middleware/db wrapper
 * @param {object} opts
 * @param {string} opts.pollEventId     Matrix event_id of the poll start
 * @param {string} opts.roomId          Matrix room id the poll was posted to
 * @param {string} opts.actionType      e.g. 'grn_approve'
 * @param {number} opts.refId           PK of the business object
 * @param {string} opts.refTable        table name e.g. 'grns'
 * @param {string} opts.question        poll question text (for audit)
 * @param {number} [opts.expectedVoterUid]  if set, only this user's vote
 *                                          dispatches; others are recorded
 *                                          but not acted on.
 * @returns {Promise<number>}           pending_poll row id
 */
/**
 * Read recent events from a room and dispatch any new poll-response
 * events to their pending records.
 *
 * Returns a count of votes processed. The caller (typically the cron
 * worker) sums these across rooms for telemetry.
 *
 * @param {object} db
 * @param {string} roomId
 * @param {object} [opts]
 * @param {number} [opts.limit]     events to fetch per cycle, default 50
 * @returns {Promise<{scanned:number, dispatched:number, ignored:number}>}
 */
async function processVotesForRoom(db, roomId, { limit = 50 } = {}) {
  const events = await matrixAdapter.readMessages(roomId, { limit });
  if (!events.length) {
    return { scanned: 0, dispatched: 0, ignored: 0,
             mediaInserted: 0, mediaDuplicate: 0, mediaRejected: 0 };
  }

  // Get cursor: only look at events newer than what we last saw.
  const [[cursor]] = await db.query(
    `SELECT last_seen_ts FROM matrix_reader_cursor WHERE room_id = ?`,
    [roomId]
  );
  const lastSeenTs = cursor ? Number(cursor.last_seen_ts) : 0;

  // Filter to poll-response events newer than the cursor.
  const POLL_RESP_TYPE = 'org.matrix.msc3381.poll.response';
  const newResponses = events.filter(e =>
    e.type === POLL_RESP_TYPE && Number(e.origin_server_ts || 0) > lastSeenTs
  );

  // Track the highest timestamp we've seen so we can advance the cursor
  // even when no responses match (still skips re-reads next cycle).
  let highestTs = lastSeenTs;
  for (const e of events) {
    const t = Number(e.origin_server_ts || 0);
    if (t > highestTs) highestTs = t;
  }

  let dispatched = 0;
  let ignored    = 0;

  for (const ev of newResponses) {
    // Each poll-response event has m.relates_to.event_id pointing at
    // the poll-start event. That's our correlation key.
    const relatesTo = ev.content?.['m.relates_to']?.event_id
                   || ev.content?.['org.matrix.msc3381.poll.response']?.relates_to?.event_id;
    if (!relatesTo) { ignored++; continue; }

    // Resolve which "kind" of poll this vote belongs to. Two systems
    // currently hold pending polls — matrix_pending_polls (legacy
    // one-shot polls) and signoff_instances (the relay-aware sign-off
    // gate, delta brief 1 May 2026). A vote could correlate to either.
    //
    // Resolution is data-shaped, not a hardcoded if/else: each "owner
    // kind" registers a lookup + handler. Adding a third table means
    // one new entry in POLL_OWNERS, not branches scattered through this
    // function.
    const owner = await _resolvePollOwner(db, relatesTo);
    if (!owner) { ignored++; continue; }

    const answers = ev.content?.['org.matrix.msc3381.poll.response']?.answers;
    const answerId = Array.isArray(answers) && answers.length ? String(answers[0]) : null;
    const voterMxid = ev.sender || null;

    // Resolve voter user_id once (used by both handlers).
    let voterUid = null;
    if (voterMxid) {
      const [[u]] = await db.query(
        `SELECT id FROM users WHERE matrix_user_id = ? LIMIT 1`,
        [voterMxid]
      );
      if (u) voterUid = u.id;
    }

    // Hand off to the owner-specific handler. Returns:
    //   { acted: true|false, voteEventId, reason? }
    //   acted=false means "wrong voter" or "duplicate" — record nothing,
    //   user is still allowed to vote (or already voted earlier).
    const result = await owner.handler({
      db, ev, voterMxid, voterUid, answerId, roomId, ownerRow: owner.row,
    });

    if (!result.acted) { ignored++; continue; }

    // C8 (v2 brief): bot reacts ✅ on the vote event within 5 seconds
    // as physical confirmation. Best-effort — vote-record more important
    // than feedback emoji. Same for both owner kinds.
    if (ev.event_id) {
      matrixAdapter.sendReaction({
        roomId,
        targetEventId: ev.event_id,
        emoji: '✅',
      }).catch(err => {
        console.warn('[matrix-reply-actions] reaction failed:', err.message);
      });
    }

    console.log('[matrix-reply-actions] vote dispatched', {
      owner_kind:     owner.kind,
      owner_id:       owner.row.id,
      answer_id:      answerId,
      voter_uid:      voterUid,
      voter_mxid:     voterMxid,
      poll_event_id:  relatesTo,
    });

    dispatched++;
  }

  // Advance cursor regardless of dispatch count (so we don't reread).
  await db.query(
    `INSERT INTO matrix_reader_cursor (room_id, last_seen_ts)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_seen_ts = VALUES(last_seen_ts)`,
    [roomId, highestTs]
  );

  // ── Inbound media (delta brief §11.4) ──────────────────────────────
  // The same scan picks up m.image / m.file / m.video / m.audio events.
  // Dedup is by matrix_event_id inside processIncomingFile, so this is
  // safe to run on every cycle even if cursor handling lags.
  let mediaInserted  = 0;
  let mediaDuplicate = 0;
  let mediaRejected  = 0;
  const FILE_MSGTYPES = new Set(['m.image', 'm.file', 'm.video', 'm.audio']);
  const fileEvents = events.filter(e =>
    e.type === 'm.room.message' && FILE_MSGTYPES.has(e.content?.msgtype)
  );
  if (fileEvents.length) {
    const matrixMedia = require('./matrix-media');
    for (const ev of fileEvents) {
      try {
        const r = await matrixMedia.processIncomingFile(ev, roomId);
        if (r.action === 'inserted')  mediaInserted++;
        if (r.action === 'duplicate') mediaDuplicate++;
        if (r.action === 'rejected')  mediaRejected++;
      } catch (err) {
        console.warn('[matrix-reply-actions] media intake failed', ev.event_id, err.message);
      }
    }
  }

  // ── Drawing query thread replies (B2) ──────────────────────────────
  let queryReplies = 0;
  try {
    const r = await processDrawingQueryReplies(db, roomId, events);
    queryReplies = r.queryReplies || 0;
  } catch (err) {
    console.warn('[matrix-reply-actions] drawing query reply processing failed:', err.message);
  }

  return {
    scanned: newResponses.length,
    dispatched,
    ignored,
    mediaInserted,
    mediaDuplicate,
    mediaRejected,
    queryReplies,
  };
}

/**
 * processDrawingQueryReplies — B2, friction-reduction brief.
 *
 * Scans m.room.message text events that are thread replies (m.relates_to
 * with rel_type m.thread or m.in_reply_to) in a drawing query room.
 * When a reply is from an authorised user (design_head, services_head,
 * design_principal, principal), updates the issue status to 'responded'
 * and stores the reply text.
 *
 * Called from processVotesForRoom on every cycle. Non-blocking — failures
 * log and continue.
 */
async function processDrawingQueryReplies(db, roomId, events) {
  const textEvents = events.filter(e =>
    e.type === 'm.room.message' &&
    e.content?.msgtype === 'm.text' &&
    (e.content?.['m.relates_to']?.rel_type === 'm.thread' ||
     e.content?.['m.relates_to']?.['m.in_reply_to'])
  );
  if (!textEvents.length) return { queryReplies: 0 };

  let queryReplies = 0;

  for (const ev of textEvents) {
    // Look up if this room has an open drawing query issue
    const [[issue]] = await db.query(
      `SELECT i.id, i.status FROM issues i
        WHERE i.matrix_room_id = ? AND i.issue_type = 'quality'
          AND i.status IN ('open','in_progress')
          AND i.raised_from = 'drawing_query'
        LIMIT 1`,
      [roomId]
    ).catch(() => [[null]]);

    if (!issue) continue;

    // Verify sender is authorised to respond to drawing queries
    const [[sender]] = await db.query(
      `SELECT id, role FROM users WHERE matrix_user_id = ? AND is_active = 1 LIMIT 1`,
      [ev.sender || '']
    ).catch(() => [[null]]);

    const AUTHORISED_ROLES = ['design_head','services_head','design_principal','principal','team_lead','jr_architect'];
    if (!sender || !AUTHORISED_ROLES.includes(sender.role)) continue;

    const replyText = (ev.content?.body || '').slice(0, 500);
    if (!replyText) continue;

    // Update issue: status → responded, store reply
    await db.query(
      `UPDATE issues SET status = 'responded', resolution_note = ?, resolved_at = NOW()
        WHERE id = ? AND status IN ('open','in_progress')`,
      [replyText, issue.id]
    ).catch(e => console.warn('[drawing-query-reply] update failed:', e.message));

    queryReplies++;
  }

  return { queryReplies };
}

/**
 * Run a full cycle across all rooms with pending polls in their expiry
 * window. Used by scripts/matrix-poll-reader.js.
 *
 * @returns {Promise<{rooms:number, scanned:number, dispatched:number, ignored:number}>}
 */
async function processVotes(db) {
  // matrix_pending_polls was dropped in v5.39-phase4-cleanup. Active rooms
  // are now tracked via signoff_instances (v5.32+). Scan rooms that have
  // in_progress signoff instances — those are the rooms with live polls.
  const [rooms] = await db.query(
    `SELECT DISTINCT poll_room_id AS room_id
       FROM signoff_instances
      WHERE status = 'in_progress'
        AND poll_room_id IS NOT NULL`
  );

  let totals = { rooms: rooms.length, scanned: 0, dispatched: 0, ignored: 0 };
  for (const r of rooms) {
    try {
      const out = await processVotesForRoom(db, r.room_id);
      totals.scanned    += out.scanned;
      totals.dispatched += out.dispatched;
      totals.ignored    += out.ignored;
    } catch (err) {
      // Per-room failure shouldn't kill the whole cycle. Other rooms
      // may have time-sensitive votes (e.g. urgent payment with 4h window).
      console.warn('[matrix-reply-actions] room scan failed', r.room_id, err.message);
    }
  }
  return totals;
}

/**
 * Sweep pending polls past their expiry. Per v2 brief C9:
 *   1. Mark the row 'expired' (terminal state)
 *   2. Send poll-end event to the room so Element X greys the buttons
 *   3. React ✅ on the original poll-start message (visual marker that
 *      the poll is done)
 *
 * Best-effort on the matrix-side actions — DB update is the source of
 * truth. If matrix-side fails the user sees stale buttons but the
 * server's view is consistent.
 *
 * Note: this is the time-based close path. Quorum-based close happens
 * inside triggerNextRelayStep when the Nth approve vote lands — it
 * counts signoff_votes against signoff_workflows.quorum_required and
 * completes with 'approved' if quorum is met, or 'no_quorum' if the
 * relay exhausts approvers without reaching quorum.
 *
 * @returns {Promise<{expired:number, closed:number, errors:Array<string>}>}
 */
async function expireOverdue(db) {
  // 1. Snapshot signoff_instances past their closes_at deadline.
  // (Phase 4: matrix_pending_polls dropped in v5.39. Time-based close
  //  now operates entirely on signoff_instances.)
  const [overdue] = await db.query(
    `SELECT id, poll_room_id AS room_id, poll_event_id
       FROM signoff_instances
      WHERE status = 'in_progress'
        AND closes_at IS NOT NULL
        AND closes_at <= NOW()`
  );

  if (overdue.length === 0) {
    return { expired: 0, closed: 0, errors: [] };
  }

  // 2. Mark expired — distinguish no_quorum (got some votes but not enough)
  //    from timed_out (no votes at all or single-approver).
  for (const row of overdue) {
    const [[voteInfo]] = await db.query(
      `SELECT COUNT(*) AS vote_count FROM signoff_votes WHERE signoff_instance_id = ?`,
      [row.id]
    );
    const [[wf]] = await db.query(
      `SELECT quorum_required FROM signoff_workflows sw
       JOIN signoff_instances si ON si.workflow_type = sw.workflow_type
      WHERE si.id = ? LIMIT 1`,
      [row.id]
    );
    const quorum = wf?.quorum_required || 1;
    const votes  = voteInfo?.vote_count || 0;
    const result = (quorum > 1 && votes > 0) ? 'no_quorum' : 'timed_out';
    await db.query(
      `UPDATE signoff_instances
          SET status = 'completed', result = ?, completed_at = NOW()
        WHERE id = ? AND status = 'in_progress'`,
      [result, row.id]
    );
  }

  // 3. Close each poll on Matrix + react ✅. Best-effort.
  let closed = 0;
  const errors = [];
  for (const row of overdue) {
    if (!row.room_id || !row.poll_event_id) continue;
    try {
      await matrixAdapter.closePoll({
        roomId: row.room_id, pollEventId: row.poll_event_id,
        text: 'Poll closed (timed out).',
      });
      closed++;
    } catch (err) {
      errors.push(`closePoll ${row.poll_event_id}: ${err.message}`);
    }
    try {
      await matrixAdapter.sendReaction({
        roomId: row.room_id, targetEventId: row.poll_event_id, emoji: '✅',
      });
    } catch (err) {
      errors.push(`reaction ${row.poll_event_id}: ${err.message}`);
    }
  }

  return { expired: overdue.length, closed, errors };
}

module.exports = {
  processVotes,
  processVotesForRoom,
  processDrawingQueryReplies,
  expireOverdue,
  // Exposed for tests
  _autoAcceptTime,
  _expiryFor,
  EXPIRY_HOURS,
  AUTO_ACCEPT_TYPES,
};
