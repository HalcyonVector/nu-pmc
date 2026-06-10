// routes/sse.js — Server-Sent Events for real-time dashboard updates
'use strict';
const express = require('express');
const { requireAuth } = require('../../../middleware/auth');
const router = express.Router();

// Active connections
const clients = new Map(); // userId -> Set of response objects

router.get('/stream', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx compatibility
  });

  res.write('event: connected\ndata: {"status":"ok"}\n\n');

  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);

  // Keep-alive every 30s
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const set = clients.get(userId);
    if (set) { set.delete(res); if (!set.size) clients.delete(userId); }
  });
});

// Broadcast to specific user(s)
function notify(userIds, event, data) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  for (const uid of ids) {
    const set = clients.get(uid);
    if (!set) continue;
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
      try { res.write(msg); } catch (_e) { set.delete(res); }
    }
  }
}

// Broadcast to ALL connected users (for firm-wide events)
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, set] of clients) {
    for (const res of set) {
      try { res.write(msg); } catch (_e) { set.delete(res); }
    }
  }
}

router.notify = notify;
router.broadcast = broadcast;
module.exports = router;
