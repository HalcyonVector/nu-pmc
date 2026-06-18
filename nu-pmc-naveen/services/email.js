// services/email.js — Email abstraction layer
// Current provider: AWS SES (configured but not transmitting)
// Alternatives: SendGrid, Postmark, Mailgun, Resend
// Original purpose: client PI emails, formal notifications
//
// ─── B23 DEFERRED — DO NOT WIRE WITHOUT TALKING TO NAVEEN ────────────
// Email-as-substrate has been REPLACED by Matrix room messages with a
// tap-to-email widget on the client app side. See services/matrix-adapter.js
// and the room-message templates. The decision: keep all client comms inside
// one channel (Matrix room) rather than splitting between Matrix-for-PMC and
// email-for-client. The "email" you see on a client's side is a Matrix
// message that LOOKS like email when they tap "send via email" on the widget.
//
// Implications:
//   - This file does NOT actually transmit email today. Calling send() emits
//     a console-warn placeholder and writes to failed_emails for the retry
//     worker (which is also dormant).
//   - FROM and FROM_NAME env vars are read at call time but never transmitted.
//     They're kept env-reactive so that IF the email path is ever revived,
//     the wiring is already correct — no architectural rework needed.
//   - DO NOT add a new caller of email.send() expecting it to actually send.
//     Use services/messaging.js (Matrix substrate) instead.
//
// If/when Naveen reverses the deferral: remove this block, wire the SES
// provider stub (lines ~50-65 below) to actually call SES, and reactivate
// the retry worker call from scripts/overdue-checker.js.
// ─────────────────────────────────────────────────────────────────────
//
// Retry queue infrastructure: failed sends would write to failed_emails
// table. Pattern mirrors the GSTIN retry queue in services/vendor-validation.js.

// Env values read at call time so EMAIL_PROVIDER / FROM / FROM_NAME can be
// rotated without restart. Same pattern as matrix-adapter._env().
//
// FROM and FROM_NAME have NO consumers today (see deferred-block above).
// Kept env-reactive to avoid an architectural rework if email is revived.
function _provider() { return process.env.EMAIL_PROVIDER || 'ses'; }
function _from()     { return process.env.EMAIL_FROM     || 'noreply@nuassociates.com'; }
function _fromName() { return process.env.EMAIL_FROM_NAME|| 'nu associates'; }

const providers = {
  ses: {
    send: async ({ to, subject, html: _html, attachments: _attachments }) => {
      const accessKey = process.env.AWS_ACCESS_KEY_ID;
      const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
      const _region   = process.env.AWS_REGION || 'ap-south-1';
      if (!accessKey || !secretKey) {
        console.warn('[Email/SES] AWS credentials not set — email skipped:', subject);
        return { messageId: null, skipped: true };
      }
      // Placeholder — real implementation uses @aws-sdk/client-ses
      console.log(`[Email/SES] Would send to ${to}: ${subject}`);
      return { messageId: `ses-${Date.now()}` };
    },
  },
};

// ── CORE SEND WITH RETRY QUEUE ────────────────────────────────────────────
async function send({ to, subject, html, text, attachments, meta = {} }) {
  if (!to || !subject) return null;
  try {
    const provider = providers[_provider()];
    if (!provider) throw new Error(`Unknown email provider: ${_provider()}`);
    const result = await provider.send({
      to, subject,
      html: html || `<p>${text||''}</p>`,
      attachments,
    });
    if (result?.skipped) return result;   // no creds — not a failure, just a no-op
    console.log(`[Email] Sent to ${to}: ${subject} → ${result.messageId}`);
    return result;
  } catch (err) {
    console.error(`[Email] Send failed to ${to}:`, err.message);
    // Write to retry queue — same pattern as GSTIN retry queue.
    // Next retry attempt is in 30 minutes; doubles each retry up to 3 attempts.
    try {
      const db = require('../middleware/db');
      await db.query(
        `INSERT INTO failed_emails
           (to_address, subject, body_preview, error_message, project_id, retry_count, next_retry_at)
         VALUES (?, ?, ?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
        [
          to,
          subject.substring(0, 500),
          (html || text || '').substring(0, 500),
          err.message?.substring(0, 500),
          meta.projectId || null,
        ]
      );
      console.log(`[Email] Queued for retry: ${to} — ${subject}`);
    } catch (_dbErr) { /* DB queue write is non-blocking */ }
    return null;
  }
}

// ── RETRY WORKER ──────────────────────────────────────────────────────────
// Call this from the overdue-checker script or a cron.
// Retries up to 3 times; exponential back-off: 30min → 1h → 2h then gives up.
async function retryFailed() {
  const db = require('../middleware/db');
  const [rows] = await db.query(
    `SELECT id, to_address, subject, body_preview, retry_count
     FROM failed_emails
     WHERE resolved_at IS NULL
       AND next_retry_at <= NOW()
       AND retry_count < 3
     LIMIT 10`
  );
  if (!rows.length) return;
  console.log(`[Email/retry] ${rows.length} queued emails to retry`);
  for (const row of rows) {
    try {
      const provider = providers[_provider()];
      await provider.send({
        to:      row.to_address,
        subject: row.subject,
        html:    row.body_preview || '(retry — original body not stored)',
      });
      // Mark resolved
      await db.query(
        `UPDATE failed_emails SET resolved_at = NOW() WHERE id = ?`,
        [row.id]
      );
      console.log(`[Email/retry] OK: ${row.to_address} — ${row.subject}`);
    } catch (err) {
      // Increment retry count; next attempt doubles the wait
      const nextMinutes = 30 * Math.pow(2, row.retry_count + 1);
      await db.query(
        `UPDATE failed_emails SET
           retry_count   = retry_count + 1,
           error_message = ?,
           next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
         WHERE id = ?`,
        [err.message?.substring(0, 500), nextMinutes, row.id]
      );
      console.error(`[Email/retry] Failed again (attempt ${row.retry_count+1}): ${row.to_address}`, err.message);
    }
  }
}

// ── EMAIL HELPERS ──────────────────────────────────────────────────────────

async function sendPIEmail({ to, clientName, piNumber, projectName, milestone, amount, pdfPath }) {
  const subject = `Proforma Invoice ${piNumber} — ${projectName}`;
  const html = `
    <p>Dear ${clientName},</p>
    <p>Please find attached Proforma Invoice <strong>${piNumber}</strong> for the completion of <strong>${milestone}</strong> on ${projectName}.</p>
    <p><strong>Amount: ₹${amount.toLocaleString('en-IN')} (inclusive of GST)</strong></p>
    <p>We request you to kindly process the payment at the earliest and share the UTR number for our records.</p>
    <p>Please do not hesitate to contact us for any clarifications.</p>
    <br>
    <p>With regards,<br>
    <strong>Naveen Kumar Bhat</strong><br>
    Principal, nu associates<br>
    Naveen@nuassociates.com</p>
  `;
  return send({ to, subject, html, attachments: pdfPath ? [{ path: pdfPath, filename: `${piNumber}.pdf` }] : [] });
}

async function sendWeeklyReportEmail({ to, clientName, projectName, weekEnding, pdfPath }) {
  const subject = `Weekly Progress Report — ${projectName} — ${weekEnding}`;
  const html = `
    <p>Dear ${clientName},</p>
    <p>Please find attached the weekly progress report for <strong>${projectName}</strong> for the week ending <strong>${weekEnding}</strong>.</p>
    <p>Please review and revert with any comments or queries.</p>
    <br>
    <p>With regards,<br>
    <strong>nu associates PMC Team</strong><br>
    Naveen@nuassociates.com</p>
  `;
  return send({ to, subject, html, attachments: pdfPath ? [{ path: pdfPath, filename: `WeeklyReport_${weekEnding}.pdf` }] : [] });
}

module.exports = { send, sendPIEmail, sendWeeklyReportEmail, retryFailed };

