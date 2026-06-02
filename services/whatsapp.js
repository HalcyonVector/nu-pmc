// services/whatsapp.js — WhatsApp abstraction layer
// Swap provider here only. Routes never call Twilio directly.
// Current provider: Twilio
// Alternatives: Gupshup, AiSensy, Kaleyra, Meta Cloud API directly

const http  = require('../services/http');
const { buildTwilioRecipient } = require('./wa-link');

// Provider read at call time (not module-load) so an operator can flip
// WA_PROVIDER (currently 'twilio'; future: 'gupshup' | 'meta') without
// app restart. Same pattern as services/matrix-adapter.js _env() and
// services/messaging.js _globalChannel().
function _provider() { return process.env.WA_PROVIDER || 'twilio'; }

// Are Twilio credentials present? Used by send() and sendTemplate() for
// the dev/test guard — in environments without TWILIO_* env vars we
// silently no-op instead of erroring on every call. One-time warning per
// process (via _warnedNoCreds) avoids log floods.
const _credCheckState = { warned: false };
function _isConfigured() {
  if (_provider() !== 'twilio') return true;  // only Twilio gates on these env vars today
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WA_NUMBER) {
    if (!_credCheckState.warned) {
      console.warn('[WA] Twilio credentials not configured — WA sends will be no-ops');
      _credCheckState.warned = true;
    }
    return false;
  }
  return true;
}

// Redact a phone to its last 4 digits for logging — codebase convention is
// "phone_tail" (see audit.log calls in modules/onboarding/routes/vendors.js).
// Prevents PII leak to journalctl/log aggregators while keeping enough info
// to disambiguate concurrent sends. Full phone remains in the database
// (wa_send_failures.to_phone, comms_log.to_address) where access is gated.
function _redactPhone(p) {
  if (!p) return '∅';
  const digits = String(p).replace(/\D/g, '');
  return digits.length >= 4 ? '…' + digits.slice(-4) : '∅';
}

// ── PROVIDER CONFIG
const providers = {
  twilio: {
    send: async ({ to, body, mediaUrl }) => {
      const sid  = process.env.TWILIO_ACCOUNT_SID;
      const auth = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_WA_NUMBER;
      if (!sid || !auth || !from) throw new Error('Twilio credentials not configured');

      // Use canonical phone helper so all formats (with/without +, with spaces,
      // with leading 0/00) normalise consistently. Earlier ad-hoc `to.replace(/^\+/,'')`
      // mangled inputs with spaces or leading 0/00.
      const toRecipient = buildTwilioRecipient(to);
      if (!toRecipient) throw new Error(`Unparseable WhatsApp recipient: ${to}`);

      const params = new URLSearchParams({  
        From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
        To:   toRecipient,
        Body: body,
      });
      if (mediaUrl) params.append('MediaUrl', mediaUrl);

      const res = await http.post(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        params.toString(),
        { headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${auth}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        }}
      );
      return { messageId: res.data.sid, status: res.data.status };
    },

    sendTemplate: async ({ to, templateSid, variables }) => {
      const sid  = process.env.TWILIO_ACCOUNT_SID;
      const auth = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_WA_NUMBER;
      if (!sid || !auth || !from) throw new Error('Twilio credentials not configured');

      const toRecipient = buildTwilioRecipient(to);
      if (!toRecipient) throw new Error(`Unparseable WhatsApp recipient: ${to}`);

      const params = new URLSearchParams({  
        From:                from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
        To:                  toRecipient,
        ContentSid:          templateSid,
        ContentVariables:    JSON.stringify(variables || {}),
      });

      const res = await http.post(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        params.toString(),
        { headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${auth}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        }}
      );
      return { messageId: res.data.sid, status: res.data.status };
    },
  },

  // ── GUPSHUP (future swap — uncomment and fill)
  // gupshup: {
  //   send: async ({ to, body }) => {
  //     const res = await http.post('https://api.gupshup.io/wa/api/v1/msg', {
  //       channel: 'whatsapp', source: process.env.GUPSHUP_NUMBER,
  //       destination: to, message: { type: 'text', text: body },
  //     }, { headers: { apikey: process.env.GUPSHUP_API_KEY } });
  //     return { messageId: res.data.messageId };
  //   },
  //   sendTemplate: async ({ to, templateName, variables }) => { ... }
  // },
};

// ── PUBLIC API — routes call these, never the provider directly

/**
 * Send a free-form WhatsApp message
 * @param {string} to — phone number with country code, no +
 * @param {string} body — message text
 * @param {string} [mediaUrl] — optional media URL
 */
async function send(to, body, mediaUrl = null, meta = {}) {
  if (!to || !body) return;
  if (!_isConfigured()) return null;
  try {
    const provider = providers[_provider()];
    if (!provider) throw new Error(`Unknown WA provider: ${_provider()}`);
    const result = await provider.send({ to, body, mediaUrl });
    // Log redacted — phone tail-4 only, no body. The provider messageId is
    // the real lookup key; full phone is in comms_log if needed.
    console.log(`[WA] Sent to ${_redactPhone(to)} → ${result.messageId}`);
    return result;
  } catch (err) {
    console.error(`[WA] Send failed to ${_redactPhone(to)}:`, err.message);
    // Log failure to wa_send_failures so IT Admin / Principal can see
    // when Twilio is down — visible in the Pending tab, not just server log.
    try {
      const db = require('../middleware/db');
      await db.query(
        `INSERT INTO wa_send_failures
           (to_phone, message_type, message_body, error_message, project_id, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          to,
          meta.messageType || 'unknown',
          body.substring(0, 500),
          err.message?.substring(0, 500),
          meta.projectId || null,
          meta.userId   || null,
        ]
      );
    } catch (_dbErr) { /* DB logging is non-blocking */ }
    return null;
  }
}


/**
 * Send a file as WhatsApp media attachment
 * File must be placed in the public uploads/outbox/ directory — will be served at /outbox/<filename>
 * @param {string} to — phone number
 * @param {string} filePath — local file path
 * @param {string} [caption] — optional caption text
 */
async function sendFile(to, filePath, caption = '') {
  if (!to || !filePath) return;
  try {
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(filePath)) {
      console.error('[WA] sendFile — file not found:', filePath);
      return null;
    }
    // Copy to public outbox so Twilio can fetch via URL
    const outboxDir = path.join(process.env.UPLOAD_DIR || '/tmp', 'outbox');
    fs.mkdirSync(outboxDir, { recursive: true });
    const fileName = `${Date.now()}_${path.basename(filePath)}`;
    const publicPath = path.join(outboxDir, fileName);
    fs.copyFileSync(filePath, publicPath);

    const baseUrl = process.env.APP_BASE_URL || 'https://nuassociates.in';
    const mediaUrl = `${baseUrl}/outbox/${fileName}`;
    const body = caption || path.basename(filePath);
    return await send(to, body, mediaUrl);
  } catch (err) {
    console.error('[WA] sendFile failed:', err.message);
    return null;
  }
}

/**
 * Send a pre-approved template message
 * @param {string} to — phone number
 * @param {string} templateKey — key from TEMPLATES below
 * @param {object} vars — template variables
 */
async function sendTemplate(to, templateKey, vars = {}) {
  if (!to) return;
  // Dev/test guard — symmetric with send(). Without this, sendTemplate
  // would call provider.sendTemplate() which throws "credentials not
  // configured", which gets caught + logged on EVERY call. B13 in the audit.
  if (!_isConfigured()) return null;
  try {
    const templateSid = TEMPLATES[templateKey];
    if (!templateSid) { return await send(to, buildFallback(templateKey, vars)); }
    const provider = providers[_provider()];
    return await provider.sendTemplate({ to, templateSid, variables: vars });
  } catch (err) {
    console.error(`[WA] Template send failed [${templateKey}] to ${_redactPhone(to)}:`, err.message);
    return null;
  }
}

// ── TEMPLATE REGISTRY — add new templates here
const TEMPLATES = {
  drawing_issued:    process.env.TWILIO_TMPL_DRAWING_ISSUED,
  query_raised:      process.env.TWILIO_TMPL_QUERY_RAISED,
  otp_reset:         process.env.TWILIO_TMPL_OTP,
  daily_report:      process.env.TWILIO_TMPL_DAILY_REPORT,
  payment_confirmed: process.env.TWILIO_TMPL_PAYMENT_CONFIRMED,
  defect_raised:     process.env.TWILIO_TMPL_DEFECT_RAISED,
  pi_raised:         process.env.TWILIO_TMPL_PI_RAISED,
  user_created:      process.env.TWILIO_TMPL_USER_CREATED,
};

// ── FALLBACK — plain text if template not yet approved
function buildFallback(templateKey, vars) {
  const fallbacks = {
    drawing_issued:    `Drawing issued: ${vars.drawing_number||''} Rev ${vars.revision||''}. Project: ${vars.project||''}.`,
    query_raised:      `Query raised on drawing ${vars.drawing_number||''}. Please respond within 24 hours.`,
    daily_report:      `Daily report for ${vars.project||''} — ${vars.date||''}. Please fill and send back.`,
    payment_confirmed: `Payment confirmed: ₹${vars.amount||''} to ${vars.vendor||''}. UTR: ${vars.utr||''}. Date: ${vars.date||''}.`,
    defect_raised:     `Defect raised — ${vars.project||''}. Description: ${vars.description||''}. Please attend and respond.`,
    pi_raised:         `Proforma Invoice ${vars.pi_number||''} raised for ₹${vars.amount||''}. Milestone: ${vars.milestone||''}.`,
    user_created:      `Welcome to nu PMC. Username: ${vars.username||''}. Temporary password: ${vars.password||'(see message from admin)'}. You must change it on first login.`,
  };
  return fallbacks[templateKey] || `Notification from nu associates PMC.`;
}

// ── Event-based notifications LIVE ELSEWHERE:
//    services/notifications.js — use that for all notify<Event>(…) calls.
//    This file is pure WhatsApp transport: send, sendFile, sendTemplate.

const { tagByType } = require('./wa-headers');

// Log every outbound message to comms_log
async function logOutbound(db, phone, body, sid, messageType) {
  if (!db) return;
  const notifLog = require('./notif-log');
  return notifLog.logOutbound({
    channel: 'whatsapp', toAddress: phone,
    body: (body || '').substring(0, 1000),
    messageType: messageType || 'general',
    providerMsgId: sid || null,
    status: 'queued',
  });
}

// Log every inbound message to comms_log
async function logInbound(db, phone, body, sid) {
  if (!db) return;
  const notifLog = require('./notif-log');
  return notifLog.logOutbound({
    channel: 'whatsapp', toAddress: phone,
    body: (body || '').substring(0, 1000),
    messageType: 'reply',
    providerMsgId: sid || null,
    status: 'delivered',
    direction: 'inbound',
  });
}

module.exports = {
  send,
  sendFile,
  sendTemplate,
  logOutbound,
  logInbound,
};
