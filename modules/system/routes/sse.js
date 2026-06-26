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

// Broadcast to ALL connected users (for genuinely firm-wide events).
// NOTE: prefer notifyProject() for anything carrying a project_id — broadcast()
// reaches every connected user including project-scoped roles (site managers,
// trainees) who are not on that project.
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, set] of clients) {
    for (const res of set) {
      try { res.write(msg); } catch (_e) { set.delete(res); }
    }
  }
}

// Project-scoped broadcast — only firm-wide roles (principal, DP, PMC/design/
// services head, finance_admin, audit) and users assigned to the project receive
// the event. Mirrors the PROJECT_SCOPED_ROLES visibility model in
// modules/auth/middleware/auth.js. Fails closed: on lookup error it sends to
// nobody rather than leaking a project event firm-wide.
async function notifyProject(projectId, event, data) {
  if (!projectId) return;
  try {
    const db = require('../../../middleware/db');
    const { PROJECT_SCOPED_ROLES } = require('../../auth/middleware/auth');
    const ph = PROJECT_SCOPED_ROLES.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id FROM users
         WHERE is_active = 1
           AND ( role NOT IN (${ph})
                 OR id IN (SELECT user_id FROM project_assignments
                            WHERE project_id = ? AND is_active = 1) )`,
      [...PROJECT_SCOPED_ROLES, projectId]
    );
    notify(rows.map(r => r.id), event, data);
  } catch (_e) {
    // fail closed — do not fall back to a firm-wide broadcast
  }
}

router.notify = notify;
router.broadcast = broadcast;
router.notifyProject = notifyProject;
module.exports = router;
