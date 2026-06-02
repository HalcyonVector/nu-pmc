// services/notif-log.js
// ============================================================
// Single writer for outbound notifications.
//
// nu PMC has TWO log tables that record different concerns:
//
//   comms_log              — channel-agnostic outbound audit log.
//                            One row per send-attempt. user_id NULL allowed
//                            (vendors, clients, external phones).
//                            Has provider_msg_id (Twilio SID / Matrix event)
//                            and delivery-state lifecycle columns.
//                            Used for forensics: "did vendor X get message Y?"
//
//   whatsapp_notifications — internal user notification feed.
//                            One row per message-targeted-at-internal-user.
//                            user_id NOT NULL. Fuels the bell icon UI.
//                            Has pdf_path for attachments shown in feed.
//
// Most messages target an internal user, so most callsites write to BOTH
// (audit row in comms_log + feed row in whatsapp_notifications). External-
// only sends (vendors, clients) write to comms_log only.
//
// Background: prior to v5.22 each caller wrote its own INSERT inline,
// with 6 distinct column subsets across 7 files. That created column drift
// (some rows missing phone, some missing project_id) and made forensics
// unreliable. This service consolidates the writes — every row has the
// same column set populated.
// ============================================================

'use strict';

const db = require('../middleware/db');

/**
 * Log an outbound message to comms_log (channel-agnostic audit trail).
 * Returns the inserted id, or null on failure.
 *
 * @param {object}  opts
 * @param {string}  opts.channel        'whatsapp' | 'email' | 'sms' | 'matrix'
 * @param {string}  opts.toAddress      phone number, email address, or matrix user id (REQUIRED)
 * @param {string}  opts.body           message body
 * @param {string}  [opts.messageType]  e.g. 'drawing_issued', 'urgent_payment_fyi'
 * @param {number}  [opts.userId]       internal user id (NULL for external recipients)
 * @param {number}  [opts.projectId]    project context, NULL for cross-project
 * @param {string}  [opts.providerMsgId] Twilio SID / Matrix event id / SES message id
 * @param {string}  [opts.status]       'queued'|'sent'|'delivered'|'failed' — default 'sent'
 * @param {string}  [opts.subject]      email subject (channel='email' only)
 * @param {string}  [opts.errorCode]    error code on failed sends
 * @param {string}  [opts.direction]    'outbound' (default) | 'inbound'
 * @returns {Promise<number|null>}      inserted id, or null on failure (errors are swallowed)
 */
async function logOutbound(opts) {
  const {
    channel,
    toAddress,
    body,
    messageType = null,
    userId = null,
    projectId = null,
    providerMsgId = null,
    status = 'sent',
    subject = null,
    errorCode = null,
    direction = 'outbound',
  } = opts || {};

  if (!channel || !toAddress) {
    console.warn('[notif-log] logOutbound called without channel or toAddress; skipping');
    return null;
  }

  try {
    const [r] = await db.query(
      `INSERT INTO comms_log
         (channel, direction, user_id, to_address, subject, body, message_type,
          provider_msg_id, status, error_code, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [channel, direction, userId, toAddress, subject,
       (body || '').substring(0, 5000),  // belt-and-braces truncation; column is TEXT
       messageType, providerMsgId, status, errorCode, projectId]
    );
    return r.insertId;
  } catch (err) {
    // Non-blocking by design — log-write failure must never break the send path
    console.warn('[notif-log] comms_log insert failed:', err.message);
    return null;
  }
}

/**
 * Log a notification targeted at a specific internal user (the bell-icon feed).
 * Returns the inserted id, or null on failure.
 *
 * @param {object}  opts
 * @param {number}  opts.userId         REQUIRED — internal user id
 * @param {string}  opts.messageType    REQUIRED
 * @param {string}  opts.body           REQUIRED — full message body for in-app feed
 * @param {string}  [opts.phone]        recipient phone (denormalised for old-feed compat)
 * @param {string}  [opts.status]       'pending'|'sent'|'failed'|'queued' — default 'sent'
 * @param {string}  [opts.pdfPath]      attachment path for feed display
 * @returns {Promise<number|null>}
 */
async function logUserNotif(opts) {
  const {
    userId, messageType, body,
    phone = null, status = 'sent', pdfPath = null,
  } = opts || {};

  if (!userId || !messageType || !body) {
    console.warn('[notif-log] logUserNotif requires userId, messageType, body; skipping');
    return null;
  }

  try {
    const [r] = await db.query(
      `INSERT INTO whatsapp_notifications
         (user_id, phone, message_type, message_body, status, pdf_path, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, phone, messageType, body, status, pdfPath,
       (status === 'sent' || status === 'queued') ? new Date() : null]
    );
    return r.insertId;
  } catch (err) {
    console.warn('[notif-log] whatsapp_notifications insert failed:', err.message);
    return null;
  }
}

/**
 * Convenience: log to BOTH comms_log AND whatsapp_notifications.
 * Used when the recipient is an internal user (most common case).
 * Returns { commsLogId, userNotifId }.
 */
async function logBoth(opts) {
  const {
    userId, channel, toAddress, body, messageType,
    projectId = null, providerMsgId = null, status = 'sent',
    pdfPath = null, phone = null,
  } = opts || {};

  const commsLogId = await logOutbound({
    channel, toAddress, body, messageType, userId, projectId, providerMsgId, status,
  });
  const userNotifId = userId ? await logUserNotif({
    userId, messageType, body, phone: phone || toAddress, status, pdfPath,
  }) : null;
  return { commsLogId, userNotifId };
}

/**
 * Update delivery status on a previously-logged outbound message.
 * Called from provider webhooks (Twilio, SES) which look up rows by
 * provider_msg_id, not by primary key. Allowed delivery-state transitions
 * are documented in the comms_log.status ENUM:
 *   queued → sent → delivered | failed | bounced | complaint
 *   sent  → delivered | read | failed | bounced | complaint
 *
 * @param {object}  opts
 * @param {string}  opts.providerMsgId  REQUIRED — Twilio SID / SES message id
 * @param {string}  opts.status         new delivery state
 * @param {string}  [opts.errorCode]    set on failed/bounced
 * @param {boolean} [opts.stampDelivered] update delivered_at = NOW()
 * @param {boolean} [opts.stampRead]      update read_at = NOW()
 * @param {boolean} [opts.stampBounced]   update bounced_at = NOW()
 * @returns {Promise<number>} affectedRows
 */
async function updateDeliveryStatus(opts) {
  const {
    providerMsgId, status, errorCode = null,
    stampDelivered = false, stampRead = false, stampBounced = false,
  } = opts || {};
  if (!providerMsgId || !status) {
    console.warn('[notif-log] updateDeliveryStatus requires providerMsgId and status; skipping');
    return 0;
  }
  const cols = ['status = ?'];
  const vals = [status];
  if (errorCode !== null)   { cols.push('error_code = ?');    vals.push(errorCode); }
  if (stampDelivered)       { cols.push('delivered_at = NOW()'); }
  if (stampRead)            { cols.push('read_at = NOW()'); }
  if (stampBounced)         { cols.push('bounced_at = NOW()'); }
  vals.push(providerMsgId);
  try {
    const [r] = await db.query(
      `UPDATE comms_log SET ${cols.join(', ')} WHERE provider_msg_id = ?`,
      vals
    );
    return r.affectedRows;
  } catch (err) {
    console.warn('[notif-log] updateDeliveryStatus failed:', err.message);
    return 0;
  }
}

module.exports = { logOutbound, logUserNotif, logBoth, updateDeliveryStatus };
