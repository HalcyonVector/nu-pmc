// services/messaging.js
// ============================================================
// Unified notification dispatcher.
//
// Spec: nu-pmc-matrix-integration-brief-v2.docx §P5.2
//
// All business logic calls one of these functions. The dispatcher decides
// which channel the message goes through based on the NOTIFICATIONS env
// flag — there is NO per-user override. v2 brief alignment (May 2026):
//
//   - process.env.NOTIFICATIONS=matrix   → Matrix (the normal state)
//   - process.env.NOTIFICATIONS=whatsapp → WhatsApp emergency rollback
//                                          (P10.2 — flip when Matrix is
//                                          provably broken; flip back
//                                          after 3 clean canary runs)
//
// "both" is no longer a supported value — v2 brief's P10.2 only allows
// matrix XOR whatsapp. If anyone sets it, we warn and route to matrix.
//
// Lock-in by design (Principal, May 2026): "If a user checks into matrix,
// they cannot get out — internal or external." No per-user opt-out.
// users.notification_channel was dropped in v5.30.
//
// The legacy services/notifications.js exports (notify, notifyDrawingIssued,
// etc.) are retained as thin wrappers that call into here.
// ============================================================

'use strict';

const db          = require('../middleware/db');
const matrixAdapter = require('./matrix-adapter');
const whatsapp    = require('./whatsapp');
const notifLog    = require('./notif-log');

const VALID_CHANNELS = new Set(['matrix', 'whatsapp']);

// Env values are read at call time (via _globalChannel helper) rather than
// captured once at module-load. An operator can flip NOTIFICATIONS without
// an app restart. Same pattern as services/matrix-adapter.js _env().
//
// On unknown values we warn ONCE per process (not per call) and route to
// matrix (the normal state). 'both' is treated as unknown.
const _warnedUnknown = new Set();
function _globalChannel() {
  const raw = (process.env.NOTIFICATIONS || 'matrix').toLowerCase();
  if (!VALID_CHANNELS.has(raw)) {
    if (!_warnedUnknown.has(raw)) {
      console.warn(`[messaging] Unknown NOTIFICATIONS=${raw}, defaulting to matrix`);
      _warnedUnknown.add(raw);
    }
    return 'matrix';
  }
  return raw;
}

class MessagingError extends Error {
  constructor(msg, { code = 'MESSAGING_ERROR', status = 500 } = {}) {
    super(msg);
    this.name = 'MessagingError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Resolve which channel to use. v2 brief alignment (May 2026):
 * channel decision is global, not per-user. The user object is consulted
 * only for capability checks (matrix_user_id present? phone present?).
 *
 * @param {object} user        users row (must include matrix_user_id,
 *                              phone, whatsapp_notifications). The legacy
 *                              notification_channel column is no longer
 *                              read — dropped in v5.30.
 * @param {string} [override]  per-message override channel. Used only by
 *                              tests and the rare cross-channel announcement.
 * @returns {{matrix:boolean, whatsapp:boolean}}
 */
function resolveChannels(user, override) {
  const effective = (override || _globalChannel()).toLowerCase();

  let matrix     = false;
  let whatsappCh = false;

  if (effective === 'matrix') {
    matrix = true;
  } else if (effective === 'whatsapp') {
    whatsappCh = true;
  } else {
    // Unknown override (caller bug). Default to global.
    if (_globalChannel() === 'matrix') matrix = true;
    else                               whatsappCh = true;
  }

  // Capability fallthrough: if Matrix is selected but the user has no
  // matrix_user_id (not yet onboarded to Element X), we must fall back to
  // WhatsApp — otherwise the notification silently disappears. This is
  // NOT a per-user preference; it's a transient capability gap during the
  // Matrix rollout. After all users are onboarded the fallback never fires.
  if (matrix && !user?.matrix_user_id) {
    matrix = false;
    whatsappCh = true;
  }
  if (whatsappCh && (!user?.phone || !user?.whatsapp_notifications)) {
    whatsappCh = false;
  }

  return { matrix, whatsapp: whatsappCh };
}

/**
 * Send a notification to a single user.
 *
 * Routes to Matrix and/or WhatsApp based on the resolution rules above.
 * Always logs to comms_log via notif-log (so audit trail is consistent
 * across both channels). Returns a result indicating which channels fired.
 *
 * @param {object} opts
 * @param {number} opts.userId            users.id of recipient
 * @param {string} opts.messageType       e.g. 'drawing_issued', 'rfi_overdue'
 * @param {string} opts.body              message text
 * @param {string} [opts.roomType]        for Matrix: which project room. Defaults
 *                                          to per-user DM (internal room of the user)
 * @param {number} [opts.projectId]       for Matrix project rooms
 * @param {string} [opts.channel]         force a specific channel
 * @returns {Promise<{matrix:boolean, whatsapp:boolean, errors:Array<string>}>}
 */
async function notifyUser(opts) {
  const { userId, messageType, body, roomType, projectId, channel } = opts;
  if (!userId)      throw new MessagingError('userId required',     { code: 'MISSING_UID' });
  if (!messageType) throw new MessagingError('messageType required', { code: 'MISSING_TYPE' });
  if (!body)        throw new MessagingError('body required',        { code: 'MISSING_BODY' });

  const [[user]] = await db.query(
    `SELECT id, full_name, phone, role, matrix_user_id,
            whatsapp_notifications, is_active
       FROM users WHERE id = ?`,
    [userId]
  );
  if (!user || !user.is_active) {
    return { matrix: false, whatsapp: false, errors: ['user_inactive'] };
  }

  const ch = resolveChannels(user, channel);
  const errors = [];
  let matrixOK = false, waOK = false;
  // Track whether Matrix attempt fell through (room couldn't be resolved or
  // delivery failed). Used to engage WhatsApp fallback even if the user's
  // pref was matrix-only. Without this, non-principal/non-finance roles on
  // matrix-only preference would silently lose all notifications because
  // _internalRoomForRole only knows three role-to-room mappings.
  let matrixFellThrough = false;

  // ── Matrix path ─────────────────────────────────────────────
  if (ch.matrix) {
    try {
      // Resolve which room the message goes to. Order:
      //   1. (projectId, roomType) — explicit project room
      //   2. internal room for user role (e.g. internal_finance for finance_admin)
      //   3. fallback: skip Matrix
      let roomId = null;
      if (projectId && roomType) {
        roomId = await matrixAdapter.getProjectRoomId(projectId, roomType);
      }
      if (!roomId) {
        // Try a per-user internal room derived from role
        const internalType = _internalRoomForRole(user);
        if (internalType) {
          roomId = await matrixAdapter.getInternalRoomId(internalType);
        }
      }
      if (roomId) {
        await matrixAdapter.sendText({ roomId, body, recipientUid: userId });
        matrixOK = true;
        await notifLog.logBoth({
          userId, messageType, body,
          channel: 'matrix',
          phone: user.phone || null,
        }).catch(e => console.warn('[messaging] notif-log matrix path:', e.message));
      } else {
        errors.push('no_matrix_room_resolved');
        matrixFellThrough = true;
      }
    } catch (err) {
      errors.push(`matrix:${err.code || err.message}`);
      matrixFellThrough = true;
    }
  }

  // ── WhatsApp path ────────────────────────────────────────────
  // Engage WhatsApp if (a) explicitly selected, OR (b) Matrix attempt fell
  // through and the user has a usable phone number. Without (b), users on
  // matrix-only preference whose role lacks an internal-room mapping would
  // get no notification at all.
  const shouldTryWhatsApp = ch.whatsapp || (matrixFellThrough && user.phone && user.whatsapp_notifications);
  if (shouldTryWhatsApp) {
    try {
      const provider = whatsapp;
      // Capture log row pre-send so the comms_log id exists if sending fails
      const logId = await notifLog.logBoth({
        userId, messageType, body,
        channel: 'whatsapp',
        phone: user.phone,
      }).catch(e => { console.warn('[messaging] notif-log wa path:', e.message); return null; });
      // Send via Twilio
      const sendRes = await provider.send({ to: user.phone, body });
      waOK = true;
      if (logId && sendRes?.messageId) {
        // Store provider message id so webhook callbacks can update delivery state
        await db.query(
          `UPDATE comms_log SET provider_msg_id = ? WHERE id = ?`,
          [sendRes.messageId, logId]
        ).catch(e => console.warn('[messaging] provider_msg_id update:', e.message));
      }
    } catch (err) {
      errors.push(`whatsapp:${err.message}`);
    }
  }

  return { matrix: matrixOK, whatsapp: waOK, errors };
}

/**
 * Send a notification to a Matrix room without involving a specific user.
 * Used for project-broadcast notifications (e.g. "GRN raised on project PV90").
 *
 * @param {object} opts
 * @param {number} opts.projectId
 * @param {string} opts.roomType   'coordination' | 'internal' | 'finance'
 * @param {string} opts.body
 * @returns {Promise<{matrix:boolean, errors:Array<string>}>}
 */
async function notifyRoom(opts) {
  const { projectId, roomType, body } = opts;
  if (!projectId) throw new MessagingError('projectId required', { code: 'MISSING_PROJ' });
  if (!roomType)  throw new MessagingError('roomType required',  { code: 'MISSING_ROOM_TYPE' });
  if (!body)      throw new MessagingError('body required',      { code: 'MISSING_BODY' });

  // Project rooms only fire when global channel is matrix or both
  if (_globalChannel() === 'whatsapp') {
    return { matrix: false, errors: ['global_channel_is_whatsapp'] };
  }

  const errors = [];
  let matrixOK = false;
  try {
    const roomId = await matrixAdapter.getProjectRoomId(projectId, roomType);
    if (!roomId) {
      errors.push(`no_room:${projectId}:${roomType}`);
      return { matrix: false, errors };
    }
    await matrixAdapter.sendText({ roomId, body });
    matrixOK = true;
  } catch (err) {
    errors.push(`matrix:${err.code || err.message}`);
  }
  return { matrix: matrixOK, errors };
}

/**
 * Send a poll to a project room. Used for approvals where a yes/no
 * answer is expected (CN approvals, schedule changes, etc.).
 *
 * @param {object} opts
 * @param {number} opts.projectId
 * @param {string} opts.roomType
 * @param {string} opts.question
 * @param {Array<{id:string,text:string}>} opts.answers
 */
async function pollRoom(opts) {
  const { projectId, roomType, question, answers } = opts;
  if (!projectId) throw new MessagingError('projectId required', { code: 'MISSING_PROJ' });
  if (!roomType)  throw new MessagingError('roomType required',  { code: 'MISSING_ROOM_TYPE' });

  if (_globalChannel() === 'whatsapp') {
    return { matrix: false, errors: ['polls_only_via_matrix'] };
  }

  try {
    const roomId = await matrixAdapter.getProjectRoomId(projectId, roomType);
    if (!roomId) return { matrix: false, errors: [`no_room:${projectId}:${roomType}`] };
    const res = await matrixAdapter.sendPoll({ roomId, question, answers });
    return { matrix: true, errors: [], outboxId: res.outboxId };
  } catch (err) {
    return { matrix: false, errors: [`matrix:${err.code || err.message}`] };
  }
}

// Internal: which personal room does this user's role map to?
//
// Only two internal rooms exist by design: `internal_principal` (for the
// principals — Principal and Design Principal take coordination from this room) and
// `internal_finance` (for finance_admin — bookkeeping/accounting). Other
// roles (PMC head, design head, services head, site managers, etc.) are
// matrix-room-less by intent: their notifications fan out to project rooms
// via _projectRoomForRole, not personal rooms. This is a CONSCIOUS limit,
// not an oversight — adding personal rooms for every role would explode
// the matrix room count and reduce signal-to-noise in shared rooms.
//
// When a user has notification_channel='matrix' but their role doesn't
// map to a personal room here, messaging.js falls back to whatsapp via
// the matrixFellThrough flag. That keeps notifications reliable even
// for matrix-only users in non-mapped roles.
//
// Adding a new internal room: also extend matrix-provision-rooms.js
// (the `INTERNAL_ROOM_TYPES` constant) so the room is provisioned at
// matrix tenant setup time, not lazily on first notify.
function _internalRoomForRole(user) {
  if (!user) return null;
  if (user.role === 'principal' || user.role === 'design_principal') return 'internal_principal';
  if (user.role === 'finance_admin') return 'internal_finance';
  return null;
}

module.exports = {
  // GLOBAL_CHANNEL was a module-load string; replaced with _globalChannel()
  // function (read at call time so env changes take effect without restart).
  // Not exporting because no external callers used it; if future code needs
  // the value, expose globalChannel() rather than re-introducing a constant.
  resolveChannels,
  notifyUser,
  notifyRoom,
  pollRoom,
  MessagingError,
};
