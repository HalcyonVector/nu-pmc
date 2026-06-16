// services/emergency-mail.js
// ============================================================
// Emergency SMTP-direct helper.
//
// PURPOSE: deliver a fire-alarm email when the normal notification
// substrate (Matrix) cannot be relied on. Used only by:
//   - scripts/vps-health.js  (server liveness check on a different
//                             machine; pings home, alerts on failure)
//   - any future "Matrix outbox stuck" watchdog
//
// THIS IS NOT A USER-FACING EMAIL CHANNEL.
//
// Per Matrix Integration Brief §1.1 / §4 / §15, system emails (SES)
// were eliminated. Personal emails are sent by named users via the
// mailto: pattern (PWA → user's mail client). NEITHER applies here:
// this is server-to-fire-alarm, not user-facing communication.
//
// This file deliberately does NOT use services/email.js (dormant SES
// path) so that:
//   - SES being broken does not break this fallback
//   - AWS being unreachable does not break this fallback
//   - Anyone reading the email.js DEFERRED block doesn't think this
//     file should be similarly deferred — it's a different concern.
//
// FAILURE MODES THIS COVERS:
//   - Matrix homeserver / EMS is unreachable
//   - matrix_outbox queue is stuck (drain worker dead)
//
// FAILURE MODES THIS DOES NOT COVER:
//   - The Node process itself is dead (need an external watchdog)
//   - The VPS is off the network entirely (need an external watchdog)
//   - SMTP relay is also down (need a tertiary signal — out of scope)
//
// Principal, May 2026: this is acceptable. External watchdog is a
// separate concern, not part of nu PMC.
//
// ENV VARS (all required at call time, not module-load):
//   EMERGENCY_SMTP_HOST      e.g. smtp.gmail.com
//   EMERGENCY_SMTP_PORT      587 (STARTTLS) or 465 (TLS)
//   EMERGENCY_SMTP_USER      authenticating account (e.g. alerts@nuassociates.com)
//   EMERGENCY_SMTP_PASS      app password / SMTP password
//   EMERGENCY_ALERT_TO       comma-separated recipient list
//   EMERGENCY_ALERT_FROM     "From" header (defaults to SMTP_USER)
//
// If any required env var is missing the helper returns
// { sent: false, reason: 'config' } and the caller is expected to
// log loudly. We do NOT throw — a fire-alarm path failing should
// never crash the caller (which is itself a watchdog).
// ============================================================

'use strict';

function _config() {
  const cfg = {
    host: process.env.EMERGENCY_SMTP_HOST,
    port: parseInt(process.env.EMERGENCY_SMTP_PORT || '587', 10),
    user: process.env.EMERGENCY_SMTP_USER,
    pass: process.env.EMERGENCY_SMTP_PASS,
    to:   process.env.EMERGENCY_ALERT_TO,
    from: process.env.EMERGENCY_ALERT_FROM || process.env.EMERGENCY_SMTP_USER,
  };
  const missing = [];
  if (!cfg.host) missing.push('EMERGENCY_SMTP_HOST');
  if (!cfg.user) missing.push('EMERGENCY_SMTP_USER');
  if (!cfg.pass) missing.push('EMERGENCY_SMTP_PASS');
  if (!cfg.to)   missing.push('EMERGENCY_ALERT_TO');
  return { cfg, missing };
}

/**
 * Send a single emergency email. Returns { sent, reason?, messageId? }.
 * Never throws. Caller should not await result for critical-path code —
 * this is best-effort. Typical caller: a one-shot CLI script that exits
 * after the call regardless.
 *
 * @param {object} opts
 * @param {string} opts.subject
 * @param {string} opts.body          plain text (HTML not used — keep minimal)
 * @param {string} [opts.to]          override default recipient
 * @returns {Promise<{sent:boolean, reason?:string, messageId?:string}>}
 */
async function sendEmergency({ subject, body, to }) {
  if (!subject || !body) {
    return { sent: false, reason: 'usage: subject and body required' };
  }

  const { cfg, missing } = _config();
  if (missing.length) {
    return { sent: false, reason: 'missing env: ' + missing.join(',') };
  }

  // Lazy-require so a missing dep doesn't crash the rest of the app.
  // nodemailer is a runtime dependency that needs to be added to
  // package.json; if it's not installed we fail soft.
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (_e) {
    return { sent: false, reason: 'nodemailer not installed' };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,        // true for 465, false for 587 STARTTLS
    auth: { user: cfg.user, pass: cfg.pass },
    // Short timeouts — this is fire-alarm, not best-effort retry.
    // If SMTP is slow, surface the failure quickly so the watchdog
    // can move on (or escalate to whatever tier-3 signal exists).
    connectionTimeout: 10_000,
    greetingTimeout:    8_000,
    socketTimeout:     15_000,
  });

  const recipients = (to || cfg.to).split(',').map(s => s.trim()).filter(Boolean);
  if (!recipients.length) return { sent: false, reason: 'no recipients' };

  try {
    const info = await transporter.sendMail({
      from:    cfg.from,
      to:      recipients.join(','),
      subject: '[nu PMC ALERT] ' + subject,
      text:    body,
    });
    return { sent: true, messageId: info?.messageId || null };
  } catch (err) {
    return { sent: false, reason: 'smtp: ' + (err.message || String(err)) };
  } finally {
    try { transporter.close(); } catch (_e) { /* fine */ }
  }
}

module.exports = {
  sendEmergency,
  _config,  // exported for tests
};
