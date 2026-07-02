// tests/integration/sm-ssm-role-gates.integration.test.js
// ════════════════════════════════════════════════════════════════════════
// Verifies the site_manager vs senior_site_manager authority split.
//
// Policy: senior_site_manager is the site-level APPROVER/authority; plain
// site_manager is capture-only. These four actions must be senior-only:
//   1. Approve a GRN            PATCH /api/grn/:id/approve
//   2. Reject a GRN            PATCH /api/grn/:id/reject
//   3. Resolve a site issue    PATCH /api/issues/:id/resolve
//   4. Raise a payment request POST  /api/payment-requests/:project_id
//
// For each: plain site_manager must get 403; senior_site_manager must NOT
// get 403 (it clears the role gate — a later 400/409 is fine).
//
// SEED-PORTABLE: users and the test project are resolved from the DB by ROLE
// at run time (no hard-coded ids), and we pick a project where BOTH a
// site_manager and a senior_site_manager are assigned. If the seed lacks the
// needed roles/assignments, the suite skips with a clear message rather than
// failing spuriously.
//
// Runs against a live DB. Skips unless TEST_DB_HOST (or DB_SOCKET) is set.
//   NODE_ENV=test DB_USER=root DB_PASSWORD=... DB_NAME=nu_pmc \
//     [DB_SOCKET=/path/mysql.sock] \
//     npx jest --config jest.integration.config.js tests/integration/sm-ssm-role-gates
// ════════════════════════════════════════════════════════════════════════
'use strict';

const request = require('supertest');
const mysql   = require('mysql2/promise');

const SKIP = !(process.env.TEST_DB_HOST || process.env.DB_SOCKET);
const d = SKIP ? describe.skip : describe;

let app, conn;
let PROJECT, SM, SSM, PMC;       // resolved at run time
let grnId, issueId, ready = false, reason = '';

const as = (uid) => (req) => req.set('X-Test-User-Id', String(uid));

// A user of `role` assigned to `projectId` (falls back to any active user of the role).
async function userForRole(role, projectId) {
  const [rows] = await conn.query(
    `SELECT u.id FROM users u
       JOIN project_assignments pa ON pa.user_id = u.id AND pa.is_active = 1
      WHERE u.role = ? AND pa.project_id = ? AND u.is_active = 1 LIMIT 1`,
    [role, projectId]);
  if (rows.length) return rows[0].id;
  const [any] = await conn.query(
    `SELECT id FROM users WHERE role = ? AND is_active = 1 LIMIT 1`, [role]);
  return any.length ? any[0].id : null;
}

beforeAll(async () => {
  if (SKIP) return;
  process.env.NODE_ENV = 'test';
  app = require('../../server');
  conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nu_pmc',
    socketPath: process.env.DB_SOCKET || undefined,
  });

  // Pick a project that has BOTH a site_manager and a senior_site_manager assigned.
  const [projs] = await conn.query(
    `SELECT pa.project_id AS id,
            SUM(u.role = 'site_manager')        AS sm,
            SUM(u.role = 'senior_site_manager') AS ssm
       FROM project_assignments pa
       JOIN users u ON u.id = pa.user_id AND u.is_active = 1
      WHERE pa.is_active = 1
      GROUP BY pa.project_id
     HAVING sm > 0 AND ssm > 0
      ORDER BY pa.project_id LIMIT 1`);
  if (!projs.length) {
    reason = 'no project has both a site_manager and a senior_site_manager assigned';
    return;
  }
  PROJECT = projs[0].id;
  SM  = await userForRole('site_manager', PROJECT);
  SSM = await userForRole('senior_site_manager', PROJECT);
  PMC = await userForRole('pmc_head', PROJECT);
  if (!SM || !SSM) { reason = 'could not resolve site_manager / senior_site_manager users'; return; }

  const [[eng]] = await conn.query(
    `SELECT id FROM vendor_engagements WHERE project_id = ? LIMIT 1`, [PROJECT]);
  const engId = eng ? eng.id : null;

  const gno = 'GRN-T' + Date.now();
  const [g] = await conn.query(
    `INSERT INTO grns (project_id, grn_number, engagement_id, delivery_date,
        description, quantity_received, is_unplanned, raised_by, raised_at,
        status, nonconformance_flagged)
     VALUES (?,?,?,CURDATE(),'gate-test',1,0,?,NOW(),'pending',0)`,
    [PROJECT, gno, engId, SSM]);
  grnId = g.insertId;

  const ino = 'ISS-T' + Date.now();
  const [i] = await conn.query(
    `INSERT INTO issues (project_id, issue_number, issue_type, title,
        description, raised_by, status, assigned_to)
     VALUES (?,?,'quality','gate-test','gate-test',?, 'open', NULL)`,
    [PROJECT, ino, PMC || SSM]);
  issueId = i.insertId;
  ready = true;
}, 60000);

afterAll(async () => {
  if (conn) {
    if (grnId)   await conn.query(`DELETE FROM grns WHERE id = ?`,  [grnId]).catch(()=>{});
    if (issueId) await conn.query(`DELETE FROM issues WHERE id = ?`, [issueId]).catch(()=>{});
    await conn.end();
  }
});

d('SM/SSM authority split (live DB)', () => {
  const guard = () => { if (!ready) { console.warn(`[sm-ssm] skipped: ${reason}`); } return ready; };

  describe('1. GRN approve — PATCH /api/grn/:id/approve', () => {
    test('plain site_manager is BLOCKED (403)', async () => {
      if (!guard()) return;
      const r = await as(SM)(request(app).patch(`/api/grn/${grnId}/approve`));
      expect(r.status).toBe(403);
    });
    test('senior_site_manager clears the gate (not 403)', async () => {
      if (!guard()) return;
      const r = await as(SSM)(request(app).patch(`/api/grn/${grnId}/approve`));
      expect(r.status).not.toBe(403);
    });
  });

  describe('2. GRN reject — PATCH /api/grn/:id/reject', () => {
    test('plain site_manager is BLOCKED (403)', async () => {
      if (!guard()) return;
      const r = await as(SM)(request(app).patch(`/api/grn/${grnId}/reject`).send({ reason: 'x' }));
      expect(r.status).toBe(403);
    });
    test('senior_site_manager clears the gate (not 403)', async () => {
      if (!guard()) return;
      const r = await as(SSM)(request(app).patch(`/api/grn/${grnId}/reject`).send({ reason: 'gate-test' }));
      expect(r.status).not.toBe(403);
    });
  });

  describe('3. Issue resolve — PATCH /api/issues/:id/resolve', () => {
    test('plain site_manager (non-assignee) is BLOCKED (403)', async () => {
      if (!guard()) return;
      const r = await as(SM)(request(app).patch(`/api/issues/${issueId}/resolve`));
      expect(r.status).toBe(403);
    });
    test('senior_site_manager clears the gate (not 403)', async () => {
      if (!guard()) return;
      const r = await as(SSM)(request(app).patch(`/api/issues/${issueId}/resolve`));
      expect(r.status).not.toBe(403);
    });
  });

  describe('4. Raise payment request — POST /api/payment-requests/:project_id', () => {
    test('plain site_manager is BLOCKED (403)', async () => {
      if (!guard()) return;
      const r = await as(SM)(request(app).post(`/api/payment-requests/${PROJECT}`)
        .field('amount_requested', '1000').field('reason', 'gate-test'));
      expect(r.status).toBe(403);
    });
    test('senior_site_manager clears the gate (not 403)', async () => {
      if (!guard()) return;
      const r = await as(SSM)(request(app).post(`/api/payment-requests/${PROJECT}`)
        .field('amount_requested', '1000').field('reason', 'gate-test'));
      expect(r.status).not.toBe(403);
    });
  });

  describe('control: GRN create is open to BOTH grades', () => {
    test('site_manager is NOT blocked from the create route by role', async () => {
      if (!guard()) return;
      const r = await as(SM)(request(app).post(`/api/grn/${PROJECT}`));
      expect(r.status).not.toBe(403);
    });
  });
});
