// routes/whatsapp.js — Twilio WhatsApp Business API
const express = require('express');
const db      = require('../../../middleware/db');
const storage = require('../../../services/file-storage');
// WhatsApp bot functions available but wired via webhook handler
const http    = require('../../../services/http');
const xl      = require('../../../middleware/excel');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { getFileSize, UPLOAD_DIR } = require('../../../middleware/upload');
const router  = express.Router();
const { validateTwilioSignature } = require('../../../middleware/twilio-validate');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');

// Twilio creds read at call time (not module-load) so an operator can
// rotate them or move sandbox→production without an app restart. Same
// pattern as services/matrix-adapter.js _env() and services/messaging.js.
//
// Note: webhook signature validation is NOT in this file — it lives in
// middleware/twilio-validate.js which reads WHATSAPP_VERIFY_TOKEN from env
// directly. Don't add a verify-token constant here; it would just be dead.
function _twilio() {
  return {
    sid:    process.env.TWILIO_ACCOUNT_SID,
    auth:   process.env.TWILIO_AUTH_TOKEN,
    number: process.env.TWILIO_WA_NUMBER,
  };
}

// Redact a phone to its last 4 digits for logging — codebase convention is
// "phone_tail" / "_redactPhone" (services/whatsapp.js, audit.log calls in
// modules/onboarding/routes/vendors.js). Keeps PII out of journalctl/log
// aggregators; full phone remains in DB tables (comms_log.to_address etc.).
function _redactPhone(p) {
  if (!p) return '∅';
  const digits = String(p).replace(/\D/g, '');
  return digits.length >= 4 ? '…' + digits.slice(-4) : '∅';
}

// ── SEND WHATSAPP MESSAGE via Twilio
async function sendWA(to, templateSid, variables) {
  try {
    const tw = _twilio();
    const toNum = to.startsWith('whatsapp:') ? to : `whatsapp:+${to}`;
    const auth  = Buffer.from(`${tw.sid}:${tw.auth}`).toString('base64');

    const body = new URLSearchParams({  
      From:             tw.number,
      To:               toNum,
      ContentSid:       templateSid,
      ContentVariables: JSON.stringify(variables),
    });

    const res = await http.post(
      `https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`,
      body.toString(),
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log(`[WA] Sent to ${_redactPhone(to)} — SID: ${res.data.sid}`);
    return true;
  } catch (err) {
    console.error(`[WA] Send error to ${_redactPhone(to)}:`, err.response?.data || err.message);
    return false;
  }
}

// ── NOTIFICATION FUNCTIONS (called from other routes)

// Drawing issued — notify site managers + PMC
// Drawing query raised — notify PMC
// Query overdue — notify PMC (called from overdue-checker)
// Task rejected — notify site manager
// Schedule change approved — notify PMC + site manager
// Change Notice approved — notify M/P + PMC Head + Services Head
// Material overdue — notify PMC
// Query closed — notify site manager who raised it

// NOTE: /send-otp and /verify-otp (self-service password reset) deleted 2026-04-21.
// Replaced by principal + manager reset via /admin-reset — see routes/admin-reset.js.
// See AUDIT-M04-M13.md HIGH-6 for rationale.

// ── TWILIO WEBHOOK — receives incoming WhatsApp messages
router.post('/webhook', validateTwilioSignature, async (req, res) => {
  // Respond 200 immediately to Twilio (don't hold the connection)
  res.status(200).send('<Response></Response>');

  try {
    const from      = (req.body.From || '').replace('whatsapp:', '').replace('+', '');
    const body      = (req.body.Body || '').trim();
    const buttonPayload = req.body.ButtonPayload;
    const mediaUrl  = req.body.MediaUrl0;
    const mediaType = req.body.MediaContentType0;

    if (!from) return;

    // 1. LOCATION CHECK-IN (Latitude+Longitude present)
    if (req.body.Latitude && req.body.Longitude) {
      await handleLocationCheckin(from, req.body).catch(err => console.error('[WA] location:', err.message));
      return;
    }

    // 2. BUTTON REPLY or TEXT reply — try pending-action resolver first (covers MOM ack, GRN approve, vendor defect etc.)
    const replyText = buttonPayload || body;
    if (replyText) {
      try {
        const waReply = require('../../../services/wa-reply-actions');
        const replyResult = await waReply.processReply(db, from, replyText);
        if (replyResult?.handled) return;
      } catch (err) {
        console.error('[WA] reply handler:', err.message);
      }
    }

    // 3. MEDIA — Excel report or site photo (requires site_manager role)
    if (mediaUrl) {
      const [[user]] = await db.query(
        "SELECT * FROM users WHERE phone = ? AND role IN ('site_manager','senior_site_manager') AND is_active = 1",
        [from]
      );
      if (!user) return;
      const [assignments] = await db.query(
        'SELECT pa.project_id FROM project_assignments pa WHERE pa.user_id = ? AND pa.is_active = 1',
        [user.id]
      );
      if (!assignments.length) return;
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (mediaType?.includes('spreadsheet')) {
        for (const a of assignments) await processExcelReport(mediaUrl, user, a.project_id, today);
      } else if (mediaType?.includes('image')) {
        for (const a of assignments) await saveWhatsAppPhoto(mediaUrl, user, a.project_id, today);
      }
    }

    // 4. TEXT daily report — site managers can submit via text (fallback)
    // Handled via reply resolver above if it matches a pending prompt
  } catch (err) {
    console.error('[WA] Webhook error:', err.message);
  }
});

// Location check-in — records user's site arrival
async function handleLocationCheckin(from, payload) {
  const [[user]] = await db.query(
    'SELECT * FROM users WHERE phone = ? AND is_active = 1',
    [from]
  );
  if (!user) return;

  // Find a project assignment — most recently assigned wins when user is on multiple
  const [[assn]] = await db.query(
    'SELECT project_id FROM project_assignments WHERE user_id = ? AND is_active = 1 ORDER BY assigned_at DESC, id DESC LIMIT 1',
    [user.id]
  );
  if (!assn) return;

  const now     = new Date();
  const today   = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const time    = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const lat     = parseFloat(payload.Latitude);
  const lng     = parseFloat(payload.Longitude);
  const address = payload.Address || null;

  await db.query(
    `INSERT INTO site_checkins (user_id, project_id, checkin_date, checkin_time, latitude, longitude, address)
     VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE checkin_time=VALUES(checkin_time), latitude=VALUES(latitude),
       longitude=VALUES(longitude), address=VALUES(address)`,
    [user.id, assn.project_id, today, time, lat, lng, address]
  );
}

async function processExcelReport(mediaUrl, user, projectId, today) {
  try {
    const tw      = _twilio();
    const auth    = Buffer.from(`${tw.sid}:${tw.auth}`).toString('base64');
    const fileRes = await http.get(mediaUrl, {
      headers: { Authorization: `Basic ${auth}` },
      responseType: 'arraybuffer'
    });

    const filePath = path.join(UPLOAD_DIR, 'daily-reports', `${user.id}_${projectId}_${today}.xlsx`);
    fs.writeFileSync(filePath, fileRes.data);

    const rows = await xl.readFile(filePath, { header: 1 });

    await db.query(
      `INSERT INTO daily_reports (project_id, report_date, site_manager_id, source, raw_file_path)
       VALUES (?,?,?,'whatsapp',?)
       ON DUPLICATE KEY UPDATE raw_file_path=VALUES(raw_file_path), processed_at=NOW()`,
      [projectId, today, user.id, filePath]
    );

    const [[report]] = await db.query(
      'SELECT id FROM daily_reports WHERE project_id=? AND report_date=? AND site_manager_id=?',
      [projectId, today, user.id]
    );

    const [tasks] = await db.query(
      `SELECT st.id, st.task_name FROM schedule_tasks st
       JOIN schedule_versions sv ON st.schedule_version_id=sv.id AND sv.is_current=1
       WHERE st.project_id=? AND st.start_date<=? AND st.end_date>=?`,
      [projectId, today, today]
    );

    const taskMap = {};
    tasks.forEach(t => { taskMap[t.task_name.toLowerCase().trim()] = t.id; });

    for (const row of rows) {
      const taskName = (row['Task'] || row['task_name'] || '').toLowerCase().trim();
      const pctRaw   = row['% Complete'] !== undefined ? row['% Complete'] : row['pct'];
      const pctNum   = parseFloat(pctRaw);
      if (Number.isNaN(pctNum) || pctNum < 0 || pctNum > 100) continue;  // skip invalid
      const pct      = Math.round(pctNum);
      const notes    = row['Notes'] || row['notes'] || null;
      let   flagged  = ['y','yes','1'].includes(String(row['Flag']||'').toLowerCase());
      let   flagNote = null;
      const taskId   = taskMap[taskName];
      if (!taskId) continue;

      // Regression check — flag but don't block
      const [[prev]] = await db.query(
        `SELECT pct_complete, report_date FROM task_updates
         WHERE task_id=? AND project_id=? AND report_date < ?
         ORDER BY report_date DESC, id DESC LIMIT 1`,
        [taskId, projectId, today]
      );
      if (prev && pct < parseInt(prev.pct_complete, 10)) {
        flagged = true;
        flagNote = `REGRESSION: ${prev.pct_complete}% (${prev.report_date}) → ${pct}% — needs PMC review`;
      }

      await db.query(
        `INSERT INTO task_updates (task_id, project_id, report_date, pct_complete, notes, is_flagged, flag_note, updated_by, daily_report_id)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE pct_complete=VALUES(pct_complete), notes=VALUES(notes), is_flagged=VALUES(is_flagged), flag_note=VALUES(flag_note), daily_report_id=VALUES(daily_report_id)`,
        [taskId, projectId, today, pct, notes, flagged?1:0, flagNote, user.id, report.id]
      );

    }

    await db.query('UPDATE daily_reports SET processed_at=NOW() WHERE id=?', [report.id]);
    console.log(`[WA] Report processed — ${user.full_name} / project ${projectId} / ${today}`);

  } catch (err) {
    console.error('[WA] processExcelReport error:', err.message);
  }
}

async function saveWhatsAppPhoto(mediaUrl, user, projectId, today) {
  try {
    const tw      = _twilio();
    const auth    = Buffer.from(`${tw.sid}:${tw.auth}`).toString('base64');
    const fileRes = await http.get(mediaUrl, {
      headers: { Authorization: `Basic ${auth}` },
      responseType: 'arraybuffer'
    });

    const filePath = path.join(UPLOAD_DIR, 'photos', `wa_${user.id}_${Date.now()}.jpg`);
    fs.writeFileSync(filePath, fileRes.data);

    await storage.savePhoto({
      projectId, file: { path: filePath }, uploadedBy: user.id,
      source: 'whatsapp', photoDate: today,
    });

    console.log(`[WA] Photo saved — ${user.full_name}`);
  } catch (err) {
    console.error('[WA] saveWhatsAppPhoto error:', err.message);
  }
}

// Test endpoint — send a test message
router.post('/send-test', require('../../../middleware/auth').requirePrincipal, asyncHandler(async (req, res) => {
    const { phone, message } = req.body;
    const tw   = _twilio();
    const auth = Buffer.from(`${tw.sid}:${tw.auth}`).toString('base64');
    const body = new URLSearchParams({  
      From: tw.number,
      To:   `whatsapp:+${phone}`,
      Body: message || 'Test message from nu associates PMC',
    });
    const r = await http.post(
      `https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`,
      body.toString(),
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    res.json({ success: true, sid: r.data.sid });
  }));

// Missing daily report notifications (called from overdue-checker)
// PMC 7 AM digest
// Drawing escalation — notify Principal
// Change Notice stuck — notify Principal

// POST /status-callback — Twilio delivery status callback (used by production)
router.post('/status-callback', validateTwilioSignature, async (req, res) => {
  try {
    const { MessageSid, MessageStatus, To, ErrorCode } = req.body || {};
    // Log into comms_log if message was tracked
    if (MessageSid) {
      const notifLog = require('../../../services/notif-log');
      await notifLog.updateDeliveryStatus({
        providerMsgId: MessageSid,
        status: MessageStatus || 'unknown',
        errorCode: ErrorCode || null,
        stampDelivered: MessageStatus === 'delivered',
      });
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('[WA] status-callback error:', err.message);
    res.status(200).send('OK'); // always 200 to Twilio
  }
});

module.exports = { router };
