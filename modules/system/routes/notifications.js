// routes/notifications.js
// ============================================================
// HTTP endpoints for the notification LOG and external webhooks.
// All event-based notify() functions live in services/notifications.js
// ============================================================

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// GET /api/notifications/log — view notification log
router.get('/log', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const isPrincipalOrAudit = ['principal','design_principal','audit'].includes(me.role);
    const [logs] = isPrincipalOrAudit
      ? await db.query(
          `SELECT *, message_type AS message_type, created_at AS sent_at
           FROM whatsapp_notifications
           ORDER BY created_at DESC LIMIT 100`)
      : await db.query(
          `SELECT *, message_type AS message_type, created_at AS sent_at
           FROM whatsapp_notifications
           WHERE user_id = ?
           ORDER BY created_at DESC LIMIT 60`, [me.id]);
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(logs.map(l => l.user_id).filter(Boolean));
    logs.forEach(l => { l.full_name = users.get(l.user_id)?.full_name || null; });
    res.json({ notifications: logs });
  }));

// POST /api/notifications/ses-webhook — AWS SES delivery / bounce / complaint callbacks
// Auth: requires SES_WEBHOOK_SECRET in header X-Webhook-Secret, or process.exit in prod.
// SNS signature verification is the proper long-term solution; shared secret is a floor.
router.post('/ses-webhook', async (req, res) => {
  try {
    const expected = process.env.SES_WEBHOOK_SECRET;
    if (!expected) {
      console.error('[SES-Webhook] SES_WEBHOOK_SECRET not set — refusing');
      return res.status(503).json({ error: 'Webhook not configured' });
    }
    const got = req.get('X-Webhook-Secret') || req.query.secret;
    if (got !== expected) {
      console.warn('[SES-Webhook] Bad/missing secret');
      return res.status(401).send('Unauthorised');
    }

    // Guarded parse — malformed payload returns 200 so SNS doesn't infinite-retry
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (_e) {
      console.warn('[SES-Webhook] Malformed outer JSON');
      return res.status(200).send('OK');
    }

    if (body?.Type === 'SubscriptionConfirmation') {
      const { SubscribeURL } = body;
      if (SubscribeURL) await require('../../../services/http').get(SubscribeURL).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
      return res.status(200).send('OK');
    }

    if (body?.Type !== 'Notification') return res.status(200).send('OK');

    let msg;
    try {
      msg = JSON.parse(body.Message || '{}');
    } catch (_e) {
      console.warn('[SES-Webhook] Malformed inner Message JSON');
      return res.status(200).send('OK');
    }
    const type = msg.notificationType;
    const msgId = msg.mail?.messageId;

    if (type === 'Delivery' && msgId) {
      const notifLog = require('../../../services/notif-log');
      await notifLog.updateDeliveryStatus({ providerMsgId: msgId, status: 'delivered', stampDelivered: true });
    }
    if (type === 'Bounce' && msgId) {
      const addr = msg.bounce?.bouncedRecipients?.[0]?.emailAddress;
      const notifLog = require('../../../services/notif-log');
      await notifLog.updateDeliveryStatus({ providerMsgId: msgId, status: 'bounced', stampBounced: true });
      console.log('[SES] Bounce:', addr, msg.bounce?.bounceType);
    }
    if (type === 'Complaint' && msgId) {
      const notifLog = require('../../../services/notif-log');
      await notifLog.updateDeliveryStatus({ providerMsgId: msgId, status: 'complaint' });
    }

    res.status(200).send('OK');
  } catch (_err) {
    res.status(200).send('OK');
  }
});

// IMPORTANT: module exports only the router.
// To send a notification, require('../../../services/notifications') — never this file.

// POST /notifications/:id/read — mark a single notification read  (B7 deep-link support)
router.post('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const id  = parseInt(req.params.id);
  const uid = req.session.user.id;
  await db.query(
    `UPDATE whatsapp_notifications SET read_at = NOW()
     WHERE id = ? AND user_id = ? AND read_at IS NULL`,
    [id, uid]
  );
  res.json({ success: true });
}));

// POST /notifications/read-all — mark all unread read  (B8 mark all read)
router.post('/read-all', requireAuth, asyncHandler(async (req, res) => {
  const uid = req.session.user.id;
  await db.query(
    `UPDATE whatsapp_notifications SET read_at = NOW()
     WHERE user_id = ? AND read_at IS NULL`,
    [uid]
  );
  res.json({ success: true });
}));

module.exports = router;
