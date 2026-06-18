// services/matrix-adapter.js
// ============================================================
// Matrix Client-Server API adapter.
//
// Spec: handoff-2026-04-28/2_ForMe/nu-pmc-matrix-integration-brief.docx §6
//
// Three modes:
//   - LIVE      : MATRIX_BOT_TOKEN is set. Real HTTP calls.
//   - DRY_RUN   : MATRIX_BOT_TOKEN unset. Captures sends to matrix_outbox
//                  (status='dry_run') so a developer can inspect what WOULD
//                  have been sent. Useful pre-EMS, in tests, in CI.
//   - DISABLED  : MATRIX_DISABLED=1. Returns a no-op response. Used by the
//                  notification adapter when NOTIFICATIONS=whatsapp.
//
// ⚠ Bot rooms must have encryption OFF (brief §7.2). Polls do not work
//   in encrypted rooms. Encryption cannot be toggled after creation —
//   create rooms unencrypted from the start.
//
// Everything writes to matrix_outbox first, then attempts the HTTP send.
// On failure the row stays 'pending' and a retry worker drains it. This
// gives at-least-once delivery semantics tied to a durable queue.
// ============================================================

'use strict';

const db   = require('../middleware/db');
const http = require('./http');

// Env values are read on each call (via _env helper) rather than captured
// once at module-load. This way, an operator can flip MATRIX_BOT_TOKEN /
// MATRIX_HOMESERVER (e.g. cutover from DRY_RUN to LIVE during deploy day,
// rotation of credentials, or rollback to DISABLED) without an app restart.
// Trade-off: marginally more env access per send. Acceptable.
function _env() {
  return {
    HOMESERVER: process.env.MATRIX_HOMESERVER  || '',
    BOT_TOKEN:  process.env.MATRIX_BOT_TOKEN   || '',
    BOT_USER:   process.env.MATRIX_BOT_USER_ID || '',
    DISABLED:   process.env.MATRIX_DISABLED === '1',
  };
}

function modeOf() {
  const e = _env();
  if (e.DISABLED)   return 'DISABLED';
  if (!e.BOT_TOKEN) return 'DRY_RUN';
  if (!e.HOMESERVER) {
    console.warn('[matrix-adapter] BOT_TOKEN set but HOMESERVER missing — falling back to DRY_RUN');
    return 'DRY_RUN';
  }
  return 'LIVE';
}

class MatrixError extends Error {
  constructor(msg, { code = 'MATRIX_ERROR', status = 500, body = null } = {}) {
    super(msg);
    this.name = 'MatrixError';
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

// 4xx codes that are RETRYABLE (the rule is "4xx terminal" with these
// exceptions). Earlier all 4xx were treated as terminal — so a Synapse
// hiccup returning 408, an MSC2832 425 race, or a rate-limit 429 silently
// killed the message. B15 in the audit. Used by sendText, sendPoll, sendImage.
const RETRYABLE_4XX = new Set([408, 425, 429]);
function _isTerminal4xx(status) {
  return status >= 400 && status < 500 && !RETRYABLE_4XX.has(status);
}

/**
 * Generate a unique transaction id for idempotent sends.
 * Reusing a txnId is safe — Matrix returns the same event_id.
 * Format: <epoch_ms>.<random6>  e.g. 1714467890123.x9k2pq
 */
function makeTxnId() {
  return `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Insert a row into matrix_outbox before attempting HTTP send.
 * Returns the outbox row id.
 */
async function _enqueue({ roomId, txnId, msgType, body, mxcUrl, recipientUid, dryRun }) {
  const status = dryRun ? 'dry_run' : 'pending';
  const [r] = await db.query(
    `INSERT INTO matrix_outbox
       (room_id, txn_id, msg_type, body, mxc_url, recipient_uid, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [roomId, txnId, msgType, body, mxcUrl || null, recipientUid || null, status]
  );
  return r.insertId;
}

async function _markSent(outboxId, eventId) {
  await db.query(
    `UPDATE matrix_outbox SET status='sent', matrix_event_id=?, sent_at=NOW() WHERE id=?`,
    [eventId, outboxId]
  );
}

async function _markFailed(outboxId, errorMsg) {
  await db.query(
    `UPDATE matrix_outbox SET status='failed', attempts=attempts+1, last_error=? WHERE id=?`,
    [String(errorMsg).slice(0, 4000), outboxId]
  );
}

async function _markRetry(outboxId, errorMsg) {
  await db.query(
    `UPDATE matrix_outbox SET status='pending', attempts=attempts+1, last_error=? WHERE id=?`,
    [String(errorMsg).slice(0, 4000), outboxId]
  );
}

/**
 * Send a plain text message to a room.
 *
 * @param {object} opts
 * @param {string} opts.roomId        Matrix room id (!abcdef:server)
 * @param {string} opts.body          message text
 * @param {number} [opts.recipientUid]  users.id of intended human recipient
 * @returns {Promise<{outboxId:number, eventId:string|null, mode:string}>}
 */
async function sendText({ roomId, body, recipientUid = null }) {
  if (!roomId) throw new MatrixError('roomId required', { code: 'MISSING_ROOM' });
  if (!body)   throw new MatrixError('body required', { code: 'MISSING_BODY' });

  const mode = modeOf();
  if (mode === 'DISABLED') return { outboxId: null, eventId: null, mode };

  const txnId = makeTxnId();
  const outboxId = await _enqueue({
    roomId, txnId, msgType: 'text', body, recipientUid,
    dryRun: mode === 'DRY_RUN',
  });

  if (mode === 'DRY_RUN') {
    return { outboxId, eventId: null, mode };
  }

  // LIVE mode — actually post to Matrix
  try {
    const url = `${_env().HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`;
    const res = await http.put(url, { msgtype: 'm.text', body }, {
      headers: { Authorization: `Bearer ${_env().BOT_TOKEN}`, 'Content-Type': 'application/json' },
    });
    const eventId = res?.data?.event_id || null;
    if (!eventId) {
      // Treat missing event_id as a transient failure — leave pending for retry
      await _markRetry(outboxId, 'Matrix response missing event_id');
      throw new MatrixError('Matrix response missing event_id', { body: res?.data });
    }
    await _markSent(outboxId, eventId);
    return { outboxId, eventId, mode };
  } catch (err) {
    // 4xx terminal vs retryable — see _isTerminal4xx + RETRYABLE_4XX above.
    const status = err.response?.status || 0;
    const msg = err.response?.data?.error || err.message;
    if (_isTerminal4xx(status)) {
      await _markFailed(outboxId, `${status}: ${msg}`);
      throw new MatrixError(`Matrix rejected message: ${msg}`, { code: 'MATRIX_4XX', status, body: err.response?.data });
    }
    await _markRetry(outboxId, `${status || 'NET'}: ${msg}`);
    throw new MatrixError(`Matrix transient error: ${msg}`, { code: 'MATRIX_RETRY', status: 503 });
  }
}

/**
 * Send a poll. Matrix poll spec: org.matrix.msc3381.poll.start
 * Bot rooms MUST be unencrypted — polls do not work in encrypted rooms.
 *
 * @param {object} opts
 * @param {string} opts.roomId
 * @param {string} opts.question
 * @param {Array<{id:string,text:string}>} opts.answers
 * @param {number} [opts.maxSelections]   default 1
 * @param {number} [opts.recipientUid]
 */
async function sendPoll({ roomId, question, answers, maxSelections = 1, recipientUid = null }) {
  if (!roomId)   throw new MatrixError('roomId required', { code: 'MISSING_ROOM' });
  if (!question) throw new MatrixError('question required', { code: 'MISSING_QUESTION' });
  if (!Array.isArray(answers) || answers.length < 2) {
    throw new MatrixError('At least 2 answers required for a poll', { code: 'POLL_TOO_FEW_ANSWERS' });
  }

  const mode = modeOf();
  if (mode === 'DISABLED') return { outboxId: null, eventId: null, mode };

  const txnId = makeTxnId();
  // Body is a JSON-encoded payload describing the poll for outbox inspection
  const payload = {
    'org.matrix.msc1767.text': question,
    'org.matrix.msc3381.poll.start': {
      question: { 'org.matrix.msc1767.text': question },
      kind: 'org.matrix.msc3381.poll.disclosed',
      max_selections: maxSelections,
      answers: answers.map(a => ({ id: a.id, 'org.matrix.msc1767.text': a.text })),
    },
  };

  const outboxId = await _enqueue({
    roomId, txnId, msgType: 'poll',
    body: JSON.stringify(payload),
    recipientUid,
    dryRun: mode === 'DRY_RUN',
  });

  if (mode === 'DRY_RUN') return { outboxId, eventId: null, mode };

  try {
    const url = `${_env().HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/org.matrix.msc3381.poll.start/${encodeURIComponent(txnId)}`;
    const res = await http.put(url, payload, {
      headers: { Authorization: `Bearer ${_env().BOT_TOKEN}`, 'Content-Type': 'application/json' },
    });
    const eventId = res?.data?.event_id;
    if (!eventId) {
      await _markRetry(outboxId, 'Matrix response missing event_id');
      throw new MatrixError('Matrix response missing event_id');
    }
    await _markSent(outboxId, eventId);
    return { outboxId, eventId, mode };
  } catch (err) {
    const status = err.response?.status || 0;
    const msg = err.response?.data?.error || err.message;
    if (_isTerminal4xx(status)) {
      await _markFailed(outboxId, `${status}: ${msg}`);
      throw new MatrixError(`Matrix poll rejected: ${msg}`, { code: 'MATRIX_4XX', status });
    }
    await _markRetry(outboxId, `${status || 'NET'}: ${msg}`);
    throw new MatrixError(`Matrix poll transient: ${msg}`, { code: 'MATRIX_RETRY', status: 503 });
  }
}

/**
 * Read recent messages from a room (for poll-vote collection).
 * Returns reverse-chronological events.
 *
 * @param {string} roomId
 * @param {object} [opts]
 * @param {number} [opts.limit]  default 50
 * @returns {Promise<Array>}     event chunk
 */
async function readMessages(roomId, { limit = 50 } = {}) {
  const mode = modeOf();
  if (mode !== 'LIVE') return [];   // dry-run / disabled — no events to read
  if (!roomId) throw new MatrixError('roomId required', { code: 'MISSING_ROOM' });

  const url = `${_env().HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?limit=${limit}&dir=b`;
  try {
    const res = await http.get(url, {
      headers: { Authorization: `Bearer ${_env().BOT_TOKEN}` },
    });
    return res?.data?.chunk || [];
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    throw new MatrixError(`Matrix read failed: ${msg}`, { status: err.response?.status || 0 });
  }
}

/**
 * Upload a file/image to Matrix media repository. Returns mxc:// URI.
 *
 * @param {Buffer} fileBuffer
 * @param {object} opts
 * @param {string} opts.filename
 * @param {string} opts.contentType   e.g. 'image/jpeg', 'application/pdf'
 * @returns {Promise<string>}         mxc:// URI
 */
async function uploadMedia(fileBuffer, { filename, contentType }) {
  const mode = modeOf();
  if (mode !== 'LIVE') {
    return `mxc://dry-run/${filename || 'unknown'}`;   // placeholder for outbox inspection
  }
  const url = `${_env().HOMESERVER}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename || 'file')}`;
  const res = await http.post(url, fileBuffer, {
    headers: {
      Authorization: `Bearer ${_env().BOT_TOKEN}`,
      'Content-Type': contentType || 'application/octet-stream',
    },
  });
  if (!res?.data?.content_uri) {
    throw new MatrixError('Matrix upload missing content_uri');
  }
  return res.data.content_uri;
}

/**
 * Send an image (mxc:// URI required — call uploadMedia first).
 */
async function sendImage({ roomId, mxcUrl, caption = '', recipientUid = null }) {
  if (!roomId) throw new MatrixError('roomId required', { code: 'MISSING_ROOM' });
  if (!mxcUrl) throw new MatrixError('mxcUrl required (call uploadMedia first)', { code: 'MISSING_MXC' });

  const mode = modeOf();
  if (mode === 'DISABLED') return { outboxId: null, eventId: null, mode };

  const txnId = makeTxnId();
  const outboxId = await _enqueue({
    roomId, txnId, msgType: 'image',
    body: caption || '(image)',
    mxcUrl, recipientUid,
    dryRun: mode === 'DRY_RUN',
  });

  if (mode === 'DRY_RUN') return { outboxId, eventId: null, mode };

  try {
    const url = `${_env().HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`;
    const res = await http.put(url, {
      msgtype: 'm.image', body: caption || 'image', url: mxcUrl,
    }, { headers: { Authorization: `Bearer ${_env().BOT_TOKEN}`, 'Content-Type': 'application/json' }});
    const eventId = res?.data?.event_id;
    if (!eventId) {
      await _markRetry(outboxId, 'missing event_id');
      throw new MatrixError('Matrix response missing event_id');
    }
    await _markSent(outboxId, eventId);
    return { outboxId, eventId, mode };
  } catch (err) {
    const status = err.response?.status || 0;
    const msg = err.response?.data?.error || err.message;
    if (_isTerminal4xx(status)) {
      await _markFailed(outboxId, `${status}: ${msg}`);
      throw new MatrixError(`Matrix image rejected: ${msg}`, { status });
    }
    await _markRetry(outboxId, `${status || 'NET'}: ${msg}`);
    throw new MatrixError(`Matrix image transient: ${msg}`, { status: 503 });
  }
}

/**
 * Look up a project room by (project_id, room_type). Returns the room_id
 * string or null. Most callers want sendText({ roomId: ... }), so this is
 * a convenience to find the right room first.
 */
async function getProjectRoomId(projectId, roomType) {
  const [[r]] = await db.query(
    `SELECT room_id FROM matrix_rooms
      WHERE project_id = ? AND room_type = ? AND archived_at IS NULL
      LIMIT 1`,
    [projectId, roomType]
  );
  return r?.room_id || null;
}

/**
 * Look up an internal/system room (project_id IS NULL).
 */
async function getInternalRoomId(roomType) {
  const [[r]] = await db.query(
    `SELECT room_id FROM matrix_rooms
      WHERE project_id IS NULL AND room_type = ? AND archived_at IS NULL
      LIMIT 1`,
    [roomType]
  );
  return r?.room_id || null;
}

/**
 * Send an emoji reaction (m.reaction) to an existing event in a room.
 *
 * Used per v2 brief C8: after a poll vote is processed, the bot reacts
 * ✅ on the vote message within 5 seconds — physical confirmation that
 * the vote was recorded. Without it, users have no feedback and re-vote.
 *
 * Also used by C9 poll-close: bot reacts ✅ on the poll-start message
 * itself once the poll is closed (visual marker that the poll is done).
 *
 * Note the URL form differs from sendText/sendImage: reactions go to
 * /send/m.reaction/{txnId}, not /send/m.room.message/{txnId}. The
 * v2 brief P3.1 ⚠ explicitly calls this out.
 *
 * @param {object} opts
 * @param {string} opts.roomId
 * @param {string} opts.targetEventId   the message being reacted to
 * @param {string} [opts.emoji]         default ✅
 * @returns {Promise<{outboxId:number|null, eventId:string|null, mode:string}>}
 */
async function sendReaction({ roomId, targetEventId, emoji = '✅' }) {
  if (!roomId)        throw new MatrixError('roomId required',        { code: 'MISSING_ROOM' });
  if (!targetEventId) throw new MatrixError('targetEventId required', { code: 'MISSING_TARGET' });

  const mode = modeOf();
  if (mode === 'DISABLED') return { outboxId: null, eventId: null, mode };

  const txnId = makeTxnId();
  const content = {
    'm.relates_to': {
      rel_type: 'm.annotation',
      event_id: targetEventId,
      key: emoji,
    },
  };
  // Outbox queue type 'reaction' is reserved for these. Drain worker
  // already accepts arbitrary msg_type, so no schema change needed here
  // beyond adding 'reaction' to the matrix_outbox enum (handled in
  // v5.31 if/when outbox-driven reactions become canonical).
  // For now, fire directly without outbox enqueue — reactions are
  // best-effort feedback, not durable messages, and a missed reaction
  // is far less harmful than a missed vote-record.
  if (mode === 'DRY_RUN') return { outboxId: null, eventId: null, mode };

  try {
    const url = `${_env().HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.reaction/${encodeURIComponent(txnId)}`;
    const res = await http.put(url, content, {
      headers: { Authorization: `Bearer ${_env().BOT_TOKEN}`, 'Content-Type': 'application/json' },
    });
    return { outboxId: null, eventId: res?.data?.event_id || null, mode };
  } catch (err) {
    const status = err.response?.status || 0;
    const msg = err.response?.data?.error || err.message;
    if (_isTerminal4xx(status)) {
      throw new MatrixError(`Matrix reaction rejected: ${msg}`, { status });
    }
    throw new MatrixError(`Matrix reaction transient: ${msg}`, { status: 503 });
  }
}

/**
 * Send a poll-end event (m.poll.end / msc3381). Closes a poll so no
 * further votes count. Per v2 brief C9, the server (not the user) closes
 * polls — time-based for routine approvals, quorum-based for formal
 * sign-offs.
 *
 * The poll-end event is itself a message-type send to /send/{type}/{txnId}.
 * We use msc3381's 'org.matrix.msc3381.poll.end'.
 *
 * @param {object} opts
 * @param {string} opts.roomId
 * @param {string} opts.pollEventId        eventId returned by sendPoll
 * @param {string} [opts.text]             user-visible text alongside close
 * @returns {Promise<{eventId:string|null, mode:string}>}
 */
async function closePoll({ roomId, pollEventId, text = 'Poll closed.' }) {
  if (!roomId)      throw new MatrixError('roomId required',      { code: 'MISSING_ROOM' });
  if (!pollEventId) throw new MatrixError('pollEventId required', { code: 'MISSING_POLL' });

  const mode = modeOf();
  if (mode === 'DISABLED') return { eventId: null, mode };
  if (mode === 'DRY_RUN')  return { eventId: null, mode };

  const txnId = makeTxnId();
  const content = {
    'org.matrix.msc1767.text': text,
    'm.relates_to': {
      rel_type: 'm.reference',
      event_id: pollEventId,
    },
    'org.matrix.msc3381.poll.end': {},
  };
  try {
    const url = `${_env().HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/org.matrix.msc3381.poll.end/${encodeURIComponent(txnId)}`;
    const res = await http.put(url, content, {
      headers: { Authorization: `Bearer ${_env().BOT_TOKEN}`, 'Content-Type': 'application/json' },
    });
    return { eventId: res?.data?.event_id || null, mode };
  } catch (err) {
    const status = err.response?.status || 0;
    const msg = err.response?.data?.error || err.message;
    if (_isTerminal4xx(status)) {
      throw new MatrixError(`Matrix poll-close rejected: ${msg}`, { status });
    }
    throw new MatrixError(`Matrix poll-close transient: ${msg}`, { status: 503 });
  }
}

/**
 * formatMessage — one function for all Matrix text/link message construction.
 *
 * Per v2 brief P7.1 (C13): no message construction elsewhere in the codebase.
 * Poll messages use matrixAdapter.sendPoll() directly — not this function.
 *
 * @param {string} emoji          e.g. '📋', '⚠️', '💰' per P7.2 colour code
 * @param {string} projectCode    e.g. 'PV90' — always uppercase
 * @param {string} description    short description of the event
 * @param {'link'|'info'} actionType
 * @param {string} [actionPayload]  for 'link': the full PWA URL
 * @returns {object}  Matrix content object ready for sendText()
 */
function formatMessage(emoji, projectCode, description, actionType, actionPayload) {
  const header = `${emoji} ${projectCode} — ${description}`;

  if (actionType === 'link') {
    return {
      msgtype: 'm.text',
      body: `${header}\n\nTap to open: ${actionPayload}`,
      format: 'org.matrix.custom.html',
      formatted_body: `<p><strong>${header}</strong></p><p><a href='${actionPayload}'>Open →</a></p>`,
    };
  }

  // actionType === 'info' — notification only, no action needed
  return { msgtype: 'm.text', body: header };
}

module.exports = {
  modeOf,
  makeTxnId,
  formatMessage,
  sendText,
  sendPoll,
  sendImage,
  sendReaction,
  closePoll,
  uploadMedia,
  readMessages,
  getProjectRoomId,
  getInternalRoomId,
  MatrixError,
};
