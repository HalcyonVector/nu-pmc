// routes/nav.js — Navigation configuration endpoints
//
// Replaces the hardcoded ROLE_TABS array in public/js/app.js. The frontend
// fetches the current user's nav at login (or after reload) and builds the
// sidebar/bottom-bar from the response.
//
// Endpoints:
//   GET /api/nav/me  — current user's nav, grouped by bucket
//
// Future (Sprint 2 Item 8 · IT Admin nav editor):
//   POST /api/nav/:role        — IT Admin proposes nav changes (saved as draft)
//   GET  /api/nav/:role/draft  — fetch the pending draft for that role
//   POST /api/nav/:role/approve — principal approves the draft
//   POST /api/nav/:role/reject  — principal rejects the draft

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// GET /api/nav/me — returns the current user's nav grouped by bucket
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const role = req.session.user.role;

  const [rows] = await db.query(
    `SELECT bucket, tab_key, sort_order
       FROM role_nav
      WHERE role = ? AND is_visible = 1
      ORDER BY FIELD(bucket,'home','work','money','more','pending','strip'),
               sort_order ASC`,
    [role]
  );

  // Group by bucket. Response shape:
  //   { role: 'principal',
  //     buckets: { home: [...], work: [...], money: [...], ... } }
  const buckets = {};
  for (const r of rows) {
    if (!buckets[r.bucket]) buckets[r.bucket] = [];
    buckets[r.bucket].push({
      key: r.tab_key,
      sort_order: r.sort_order,
    });
  }

  res.json({
    role,
    buckets,
  });
}));

module.exports = router;
