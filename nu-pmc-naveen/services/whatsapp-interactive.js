// services/whatsapp-interactive.js
// Sends WhatsApp interactive button messages via Twilio.
// All button labels verified ≤20 chars.
//
// ─── DUAL-SUBSTRATE NOTE (Concept-Map Audit, Apr 2026) ────────────────
// This file is one of TWO outbound-dispatch substrates in the codebase:
//   Path A — services/notifications.js  (DB-driven via notification_triggers,
//            event_key → recipient roles → channel routing). Used for ~25 events.
//   Path B — this file                  (direct phone arg, hardcoded by caller,
//            interactive Twilio Content API buttons). Used for ~8 events.
// Same intent (deliver an alert), different mechanics. The architectural
// goal is a single unified pipeline (events → recipients → channels → buttons-
// or-text). That's a V8-tier refactor, not a bug fix.
//
// ─── B22: SENDERS STAGED FOR SYSTEM ALERTS ────────────────────────────
// Four senders below have ZERO current callers in the codebase. Naveen
// confirmed they are wiring points for upcoming system-alert features:
//
//   sendAnomalyAlert       — wire from: anomaly detector (weekly report drag,
//                            budget overruns, schedule drift)
//   sendVendorDefectAck    — wire from: defect/NCR raise route after the
//                            vendor's submission is recorded
//   sendBudgetHardBlock    — wire from: budget threshold checker when a trade
//                            exceeds the hard-block percentage
//   sendAnomalyEscalated   — wire from: escalation cron (anomaly unresolved
//                            past N hours)
//
// Do NOT delete these — they're scaffolding, not orphans. When wiring lands,
// drop the per-function "no current callers" comment and update this header
// to reflect what's now live.
// ──────────────────────────────────────────────────────────────────────

const twilio = require('twilio');
const { buildTwilioRecipient } = require('./wa-link');

// Lazy init — don't crash the server if Twilio creds missing.
// Allows the app to boot for dev/test without WhatsApp configured.
let _client = null;
let _warnedMissing = false;
function getClient() {
  if (_client) return _client;
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) {
    if (!_warnedMissing) {
      console.warn('[WA] Twilio credentials not configured — WhatsApp disabled');
      _warnedMissing = true;
    }
    return null;
  }
  _client = twilio(sid, auth);
  return _client;
}

// Twilio sender + app base URL — read at call time so env changes (number
// rotation, sandbox→prod) take effect without restart. See matrix-adapter
// _env() for the canonical pattern. Three previously-duplicated constants
// (FROM, BASE_URL, BASE_URL_fn, BASE — the last unused dead code) are
// collapsed into two helpers.
function _from()     { return process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; }
function _baseUrl()  { return process.env.APP_BASE_URL || 'https://nuassociates.in'; }
const { tagByType } = require('./wa-headers');

/**
 * Send a message with a list of action options.
 *
 * NOTE: this used to TRY to send Twilio "interactive button" messages but the
 * persistentAction format that was being constructed is obsolete (Twilio moved
 * interactive buttons to the Content Template API around 2024). The previous
 * implementation built a `params` object with `persistentAction` and then
 * silently DISCARDED it — calling `messages.create` with a plain text payload.
 * Recipients have been getting plain text already; this is just making the
 * function honest about it: it now appends the button labels as a numbered
 * list ("Reply 1 to Approve, 2 to Reject") so the recipient knows what to type.
 *
 * Real interactive buttons require provisioning Twilio Content Templates per
 * message-type and are tracked as a separate Naveen-side ticket.
 *
 * buttons: [{ id, title }] — title max 20 chars
 */
async function sendButtons(to, body, buttons, mediaUrl) {
  if (!to) return null;
  const phone = buildTwilioRecipient(to); if (!phone) return null;

  // Honest plain-text degradation. Numbered list so recipient can text back
  // a single digit and the inbound webhook routes to the right action.
  const labels = (buttons || []).map((b, i) =>
    `${i + 1}. ${(b.title || '').substring(0, 20)}`
  ).join('\n');
  const enrichedBody = labels
    ? `${body}\n\nReply with:\n${labels}`
    : body;

  const _c = getClient(); if (!_c) return null;
  const msg = await _c.messages.create({
    from:  _from(),
    to:    phone,
    body:  enrichedBody,
    ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
  });

  return msg.sid;
}

/**
 * Send location request message
 */
async function sendLocationRequest(to, body) {
  if (!to) return null;
  const phone = buildTwilioRecipient(to); if (!phone) return null;
  const _c = getClient(); if (!_c) return null;
  const msg = await _c.messages.create({
    from: _from(),
    to:   phone,
    body: body + '\n\n📍 Please share your location.',
    // Twilio passes through WA location request natively
  });
  return msg.sid;
}

/**
 * Send message with CTA deep-link button
 */
async function sendWithCTA(to, body, ctaLabel, path) {
  if (!to) return null;
  const phone = buildTwilioRecipient(to); if (!phone) return null;
  const url   = _baseUrl() + path;
  const _c = getClient(); if (!_c) return null;
  const msg   = await _c.messages.create({
    from: _from(),
    to:   phone,
    body: body + '\n\n🔗 ' + url,
  });
  return msg.sid;
}

// ── SPECIFIC MESSAGE BUILDERS (all button labels ≤20 chars)

// B22 staged sender — no current callers. See file header for wiring plan.
async function sendAnomalyAlert(phone, reportId, projectName, reason, userId) {
  // No button — system auto-logs delivery, PMC sees in 9PM digest
  // Escalation still available by opening app directly
  const truncReason = (reason || '').substring(0, 40);
  const body = tagByType('report_anomaly', '"' + truncReason + '"\n\nFull detail in app.', projectName);
  const wa = require('./whatsapp');
  return wa.send(phone, body).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
}

async function sendGRNApproval(phone, grnId, grnNumber, vendorName, qty, unit, amount, deliveryNoteUrl, projectName) {
  const body = tagByType('grn_approve', grnNumber + ' raised\n' + vendorName.substring(0,30) + '\n' + qty + ' ' + unit + ' - Rs' + parseFloat(amount).toLocaleString('en-IN') + '\n\nApprove or reject:', projectName);
  return sendButtons(phone, body, [
    { id: 'grn_' + grnId + '_1', title: 'Approve' },
    { id: 'grn_' + grnId + '_2', title: 'Reject'  },
  ], deliveryNoteUrl || null);
}

async function sendIssueConfirm(phone, issueId, issueNumber, issueType, title, projectName) {
  const rawBody = issueType.charAt(0).toUpperCase() + issueType.slice(1) +
    ' Issue raised\n' + issueNumber + '\n\n"' + title.substring(0,60) + '"\n\nConfirm into register?';
  const body = tagByType('issue_confirm', rawBody, projectName);
  return sendButtons(phone, body, [
    { id: 'issue_' + issueId + '_1', title: 'Confirm' },
    { id: 'issue_' + issueId + '_2', title: 'Dismiss' },
  ]);
}

// B22 staged sender — no current callers. See file header for wiring plan.
async function sendVendorDefectAck(phone, ncrId, ncrNumber, defectDesc) {
  const body = tagByType('safety_issue', 'Defect Notice\n' + ncrNumber + '\n\n"' + defectDesc.substring(0,60) + '"\n\nPlease respond:');
  return sendButtons(phone, body, [
    { id: 'ncr_' + ncrId + '_1', title: 'Acknowledged' },
    { id: 'ncr_' + ncrId + '_2', title: 'Dispute'      },
  ]);
}

async function sendUrgentPaymentFYI(phone, payId, vendorName, amount) {
  // FYI only — no button, no reply required. PMC opens app directly if querying.
  const body = tagByType('urgent_payment_fyi',
    '\u2705 Urgent payment auto-approved\n' + vendorName.substring(0,30) +
    '\nRs ' + parseFloat(amount).toLocaleString('en-IN') + '\n\nOpen app to query if needed.');
  const wa = require('./whatsapp');
  return wa.send(phone, body).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
}

async function sendMOMClientAck(phone, momId, momNumber, meetingDate) {
  const body = tagByType('action', 'Meeting Minutes\n' + momNumber + ' - ' + meetingDate + '\n\nPlease review and respond within 3 days.');
  return sendButtons(phone, body, [
    { id: 'mom_' + momId + '_1', title: 'Accept MOM'      },
    { id: 'mom_' + momId + '_2', title: 'Request changes' },
  ]);
}

// ── DEEP LINK BUILDER (uses _baseUrl above)
function deepLink(path) {
  return _baseUrl() + path;
}

// ── DEEP-LINK NOTIFICATION SENDERS

async function sendCNApprovalAlert(phone, cnId, cnNumber, projectName, amount) {
  const body = tagByType('cn_approval', 'CN awaiting approval\n' + cnNumber + '\nRs ' + parseFloat(amount).toLocaleString('en-IN') + '\n\nTap to review and approve:', projectName);
  return sendWithCTA(phone, body, 'Open in App', '/app/changes/' + cnId);
}

// B22 staged sender — no current callers. See file header for wiring plan.
async function sendBudgetHardBlock(phone, projectId, projectName, trade, pctOver) {
  const body = tagByType('budget_escalation', trade + ' is ' + pctOver + '% over budget\n\nAll new engagements blocked. Tap to review:', projectName);
  return sendWithCTA(phone, body, 'Open in App', '/app/budget/' + projectId);
}

async function sendScheduleDriftAlert(phone, projectId, projectName, trade, gap) {
  const body = tagByType('schedule_risk', trade + ' is ' + gap + '% behind plan\n\nTap to review narrative:', projectName);
  return sendWithCTA(phone, body, 'Open in App', '/app/schedule/' + projectId + '/health');
}

async function sendGRNPendingAlert(phone, grnId, grnNumber, vendorName, amount, projectName) {
  const body = tagByType('grn_approve', grnNumber + '\n' + vendorName.substring(0,30) + '\nRs ' + parseFloat(amount).toLocaleString('en-IN'), projectName);
  return sendWithCTA(phone, body, 'Open in App', '/app/grn/' + grnId);
}

async function sendPaymentBatchReady(phone, projectId, projectName, count, total) {
  const body = tagByType('saturday_payment_digest', count + ' vendor' + (count>1?'s':'') + ' - Rs ' + parseFloat(total).toLocaleString('en-IN') + '\n\nTap to approve:', projectName);
  return sendWithCTA(phone, body, 'Open in App', '/app/payments/' + projectId + '/batch');
}

// B22 staged sender — no current callers. See file header for wiring plan.
async function sendAnomalyEscalated(phone, reportId, projectName, reason) {
  const body = tagByType('report_anomaly_escalated', '"' + (reason||'').substring(0,40) + '"\n\nTap to read full report:', projectName);
  return sendWithCTA(phone, body, 'Open in App', '/app/reports/' + reportId);
}

// Deep-link builder — opens the PWA at the exact tab + project


module.exports = {
  deepLink, sendButtons, sendLocationRequest, sendWithCTA,
  sendAnomalyAlert, sendGRNApproval, sendIssueConfirm,
  sendVendorDefectAck, sendUrgentPaymentFYI, sendMOMClientAck,
  sendCNApprovalAlert, sendBudgetHardBlock, sendScheduleDriftAlert,
  sendGRNPendingAlert, sendPaymentBatchReady, sendAnomalyEscalated,
};
