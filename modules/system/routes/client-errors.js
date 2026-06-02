// modules/system/routes/client-errors.js
//
// Client-side error reporting. Frontend API wrapper calls POST when it
// receives any non-2xx response (other than auth/CSRF flows that already
// force re-login). Principal-only endpoints to list and triage.
//
// Mounted at /api/log/client-error (POST) and /api/client-errors (GET, PATCH).
// Two mounts because POST is reachable for any logged-in user (so we capture
// errors from every role), while reads are gated to Principal.

'use strict';

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requirePrincipal } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');

const router = express.Router();

// Trim user_agent and excerpts to safe lengths to match column widths.
function trim(s, max) {
  if (s == null) return null;
  const str = String(s);
  return str.length > max ? str.slice(0, max) : str;
}

// ── POST /api/log/client-error ───────────────────────────────────────────
// Any logged-in user can record a client-side error. requireAuth keeps
// anonymous spam out (errors before login go nowhere — but the login page
// itself is the only pre-auth screen, and 401 from the login endpoint is
// already visible in server logs).
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const {
    request_method, request_path, http_status, error_code,
    response_excerpt, client_path,
  } = req.body || {};

  if (!request_method || !request_path) {
    return res.status(400).json({ error: 'request_method and request_path are required' });
  }

  // Self-loop guard — if logging /api/log/client-error fails, the wrapper
  // would call us with a record about us. Drop those silently.
  if (typeof request_path === 'string' && request_path.startsWith('/api/log/client-error')) {
    return res.json({ ok: true, dropped: 'self-loop' });
  }

  // Bound the inputs — the column widths protect us, but also protects against
  // accidental megabyte-sized response_excerpt blowing up the row.
  await db.query(
    `INSERT INTO client_errors (
       user_id, user_role, user_full_name,
       request_method, request_path, http_status, error_code,
       response_excerpt, user_agent, client_path
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      me.id, me.role, me.full_name,
      trim(request_method, 10), trim(request_path, 500),
      Number.isFinite(parseInt(http_status, 10)) ? parseInt(http_status, 10) : null,
      trim(error_code, 40),
      trim(response_excerpt, 1000),
      trim(req.headers['user-agent'], 500),
      trim(client_path, 200),
    ]
  );

  res.json({ ok: true });
}));

module.exports = router;

// ── Reader/triager router (separate mount path) ─────────────────────────
// Listed below as exports.readRouter so server.js can mount at a different
// path. Principal-only.
const readRouter = express.Router();

// GET /api/client-errors — list, with optional filters.
//   ?untriaged=1     only rows not yet triaged
//   ?method=POST     filter by HTTP method
//   ?since=2026-04-25 ISO date floor on created_at
//   ?limit=50        default 50, max 200
readRouter.get('/', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.untriaged) where.push('triaged_at IS NULL');
  if (req.query.method) { where.push('request_method = ?'); params.push(String(req.query.method).toUpperCase()); }
  if (req.query.since) { where.push('created_at >= ?'); params.push(String(req.query.since)); }

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const sql = `
    SELECT id, user_id, user_role, user_full_name,
           request_method, request_path, http_status, error_code,
           response_excerpt, user_agent, client_path,
           triaged_at, triaged_by, triage_note, created_at
    FROM client_errors
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ?`;
  params.push(limit);
  const [rows] = await db.query(sql, params);

  // Group same (method, path) into clusters for at-a-glance triage.
  const clusters = new Map();
  for (const r of rows) {
    const k = `${r.request_method} ${r.request_path.replace(/\/\d+(\/|$)/g, '/:id$1')}`;
    if (!clusters.has(k)) clusters.set(k, { key: k, count: 0, latest: r.created_at, untriaged: 0, samples: [] });
    const c = clusters.get(k);
    c.count++;
    if (!r.triaged_at) c.untriaged++;
    if (c.samples.length < 3) c.samples.push(r);
  }

  res.json({
    rows,
    clusters: [...clusters.values()].sort((a,b) => b.untriaged - a.untriaged || b.count - a.count),
  });
}));

// GET /api/client-errors/summary — counts only, fast.
readRouter.get('/summary', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const [[r]] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN triaged_at IS NULL THEN 1 ELSE 0 END) AS untriaged,
       SUM(CASE WHEN created_at >= NOW() - INTERVAL 24 HOUR THEN 1 ELSE 0 END) AS last_24h,
       SUM(CASE WHEN created_at >= NOW() - INTERVAL 7 DAY  THEN 1 ELSE 0 END) AS last_7d
     FROM client_errors`
  );
  res.json(r);
}));

// PATCH /api/client-errors/:id/triage — mark as triaged, optional note.
readRouter.patch('/:id/triage', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'id required' });
  const note = trim(req.body?.note, 500);

  const [r] = await db.query(
    `UPDATE client_errors SET triaged_at = NOW(), triaged_by = ?, triage_note = ?
     WHERE id = ?`,
    [me.id, note, id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
}));

// POST /api/client-errors/triage-pattern — bulk triage by method+path pattern.
// e.g. mark all "GET /api/handover/* dead routes" as triaged at once.
readRouter.post('/triage-pattern', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const { method, path_prefix, note } = req.body || {};
  if (!method || !path_prefix) {
    return res.status(400).json({ error: 'method and path_prefix required' });
  }
  const [r] = await db.query(
    `UPDATE client_errors
     SET triaged_at = NOW(), triaged_by = ?, triage_note = ?
     WHERE triaged_at IS NULL
       AND request_method = ?
       AND request_path LIKE ?`,
    [me.id, trim(note, 500), String(method).toUpperCase(), String(path_prefix) + '%']
  );
  res.json({ ok: true, triaged: r.affectedRows });
}));

module.exports.readRouter = readRouter;
