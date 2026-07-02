// tests/integration/payments-icici.integration.test.js
// ════════════════════════════════════════════════════════════════════════
// ICICI confirmation flow — the pieces touched by the "Cycle ID picker" fix:
//   1. GET  /payments/:pid/icici/cycles  → lists batch cycles awaiting
//      confirmation (powers the dropdown; without this the modal made the
//      user type an unknown cycle number).
//   2. POST /payments/:pid/icici/confirm/preview → accepts the real
//      icici-confirmation.xlsx for a cycle and returns a preview (no 5xx).
//
// A cycle is SEEDED directly (status='icici_generated') rather than going
// through Generate Batch, because batch generation has bank-validation guards
// that need extensive vendor state — out of scope for this contract test.
//
// Seed-portable: project + finance user resolved by role at run time.
// Skips unless TEST_DB_HOST (or DB_SOCKET) is set.
//   NODE_ENV=test DB_USER=root DB_PASSWORD=... DB_NAME=nu_pmc [DB_SOCKET=...] \
//     npx jest --config jest.integration.config.js tests/integration/payments-icici
// ════════════════════════════════════════════════════════════════════════
'use strict';

const request = require('supertest');
const mysql   = require('mysql2/promise');
const path    = require('path');

const SKIP = !(process.env.TEST_DB_HOST || process.env.DB_SOCKET);
const d = SKIP ? describe.skip : describe;

const DIR = path.resolve(__dirname, '../../test-uploads-v2');
const F = (s, n) => path.join(DIR, s, n);

let app, conn, PROJECT, FIN, PMC, cycleId, ready = false, reason = '';
const auth = (r, u) => r.set('X-Test-User-Id', String(u));

async function uid(role, projectId) {
  const [a] = await conn.query(
    `SELECT u.id FROM users u JOIN project_assignments pa ON pa.user_id=u.id AND pa.is_active=1
      WHERE u.role=? AND pa.project_id=? AND u.is_active=1 LIMIT 1`, [role, projectId]);
  if (a.length) return a[0].id;
  const [b] = await conn.query(`SELECT id FROM users WHERE role=? AND is_active=1 LIMIT 1`, [role]);
  return b.length ? b[0].id : null;
}

d('ICICI confirmation flow (live DB)', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = require('../../server');
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nu_pmc', socketPath: process.env.DB_SOCKET || undefined });

    const [[p]] = await conn.query(
      `SELECT pa.project_id AS id FROM project_assignments pa
         JOIN users u ON u.id=pa.user_id AND u.is_active=1
        WHERE pa.is_active=1 GROUP BY pa.project_id
        ORDER BY COUNT(DISTINCT u.role) DESC, pa.project_id ASC LIMIT 1`);
    if (!p) { reason = 'no project with assignments'; return; }
    PROJECT = p.id;
    FIN = await uid('finance_admin', PROJECT);
    if (!FIN) { reason = 'no finance_admin user'; return; }
    PMC = await uid('pmc_head', PROJECT);

    const [c] = await conn.query(
      `INSERT INTO vendor_payment_cycles (project_id, cycle_date, cycle_type, status, generated_by)
       VALUES (?, CURDATE(), 'weekly', 'icici_generated', ?)`, [PROJECT, FIN]);
    cycleId = c.insertId;
    ready = true;
  }, 60000);

  afterAll(async () => {
    if (conn) {
      if (cycleId) await conn.query(`DELETE FROM vendor_payment_cycles WHERE id=?`, [cycleId]).catch(()=>{});
      await conn.end();
    }
  });

  const guard = () => { if (!ready) console.warn(`[icici] skipped: ${reason}`); return ready; };

  test('GET /icici/cycles lists the awaiting-confirmation cycle', async () => {
    if (!guard()) return;
    const r = await auth(request(app).get(`/api/payments/${PROJECT}/icici/cycles`), FIN);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.cycles)).toBe(true);
    expect(r.body.cycles.some(c => c.id === cycleId)).toBe(true);
  });

  test('a plain site_manager cannot list cycles (role-gated)', async () => {
    if (!guard()) return;
    const sm = await uid('site_manager', PROJECT);
    if (!sm) return;
    const r = await auth(request(app).get(`/api/payments/${PROJECT}/icici/cycles`), sm);
    expect(r.status).not.toBe(200);
  });

  test('POST /icici/confirm/preview accepts the real xlsx for the cycle → never 5xx', async () => {
    if (!guard()) return;
    const r = await auth(request(app).post(`/api/payments/${PROJECT}/icici/confirm/preview`), FIN)
      .field('cycle_id', String(cycleId))
      .attach('confirmation', F('15_icici-payment-confirmation', 'icici-confirmation.xlsx'));
    expect(r.status).toBeLessThan(500);
  });

  test('preview without a cycle_id is a clean 400 (not 500)', async () => {
    if (!guard()) return;
    const r = await auth(request(app).post(`/api/payments/${PROJECT}/icici/confirm/preview`), FIN)
      .attach('confirmation', F('15_icici-payment-confirmation', 'icici-confirmation.xlsx'));
    expect(r.status).toBe(400);
  });

  // ── Generate Batch — money-safety guards (no fixture needed) ──────────────
  // These lock the confirmation gate that prevents accidental/stale batch
  // generation. The full happy path (validated vendor + approved payment +
  // company entity + Excel write) is covered manually — see VERIFICATION-RUNBOOK.
  describe('Generate Batch guards', () => {
    test('empty payment_ids → 400', async () => {
      if (!guard() || !PMC) return;
      const r = await auth(request(app).post(`/api/payments/${PROJECT}/icici/generate`), PMC)
        .send({ payment_ids: [] });
      expect(r.status).toBe(400);
    });

    test('missing confirmation code → 400 (must pass GENERATE)', async () => {
      if (!guard() || !PMC) return;
      const r = await auth(request(app).post(`/api/payments/${PROJECT}/icici/generate`), PMC)
        .send({ payment_ids: [999999], expected_total: 0 });
      expect(r.status).toBe(400);
      // The guard fires before any DB lookup of the (nonexistent) payment.
      expect(r.body.code === 'CONFIRMATION_MISSING' || /GENERATE/.test(r.body.error || '')).toBe(true);
    });
  });
});
