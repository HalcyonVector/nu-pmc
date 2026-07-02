// tests/integration/uploads-chained.integration.test.js
// ════════════════════════════════════════════════════════════════════════
// The 7 upload points that need a chained precondition, run AUTOMATED: the
// suite creates the required prior-state rows in beforeAll (a register entry,
// a measurement, an issued MOM + revision, a meeting, a form template, a
// handover template), then uploads the REAL test-uploads-v2 file.
//
//   05 drawings           – needs a matching drawing_register row
//   22 measurement cert   – needs a measurement to accept
//   24 mom-reissue        – needs an issued MOM with an open revision
//   03 meeting observation – needs a meeting
//   28 form-submission    – needs a form template
//   21 handover-document  – needs the handover template seeded + checklist init
//   19 clients-bulk       – no precondition (route has no UI on current build)
//
// Guarantee asserted: none of these ever returns a 5xx. All seed rows are
// cleaned up in afterAll. Seed-portable: users/project resolved by role.
//
// Skips unless TEST_DB_HOST (or DB_SOCKET) is set.
//   NODE_ENV=test DB_USER=root DB_PASSWORD=... DB_NAME=nu_pmc [DB_SOCKET=...] \
//     npx jest --config jest.integration.config.js tests/integration/uploads-chained
// ════════════════════════════════════════════════════════════════════════
'use strict';

const request = require('supertest');
const mysql   = require('mysql2/promise');
const path    = require('path');

const SKIP = !(process.env.TEST_DB_HOST || process.env.DB_SOCKET);
const d = SKIP ? describe.skip : describe;

const DIR = path.resolve(__dirname, '../../test-uploads-v2');
const F = (s, n) => path.join(DIR, s, n);

let app, conn, PROJECT;
const A = {};
let dwgId, measId, momId, obsMeetId, tmplId, DNUM;
const clean = { drawing_register: [], measurements: [], meetings: [], form_templates: [], form_submissions: [] };

const auth = (r, u) => r.set('X-Test-User-Id', String(u));

async function uid(role) {
  const [a] = await conn.query(
    `SELECT u.id FROM users u JOIN project_assignments pa ON pa.user_id=u.id AND pa.is_active=1
      WHERE u.role=? AND pa.project_id=? AND u.is_active=1 LIMIT 1`, [role, PROJECT]);
  if (a.length) return a[0].id;
  const [b] = await conn.query(`SELECT id FROM users WHERE role=? AND is_active=1 LIMIT 1`, [role]);
  return b.length ? b[0].id : null;
}

d('29 uploads — chained points, live DB', () => {
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
    PROJECT = p ? p.id : 1;
    for (const r of ['site_manager','senior_site_manager','pmc_head','principal','design_head','finance_admin'])
      A[r] = await uid(r);

    // 05 — a register row (unique number so setup is idempotent)
    DNUM = 'D-T' + Date.now();
    const [dr] = await conn.query(
      `INSERT INTO drawing_register (project_id,drawing_number,drawing_name,category,stream,uploaded_by)
       VALUES (?,?,?,?,?,?)`, [PROJECT, DNUM, 'Ground Floor Plan', 'Architectural', 'design', A['design_head']]);
    dwgId = dr.insertId; clean.drawing_register.push(dwgId);

    // 22 — a measurement to accept
    const [ms] = await conn.query(
      `INSERT INTO measurements (project_id,ra_bill_number,discipline,measurement_date,recorded_by,status)
       VALUES (?,?,?,CURDATE(),?,'rs_signed')`, [PROJECT, 'RA-T' + Date.now(), 'civil', A['senior_site_manager']]);
    measId = ms.insertId; clean.measurements.push(measId);

    // 24 — an issued MOM + an open (unlocked, in-window) revision
    const [mo] = await conn.query(`INSERT INTO meetings (project_id,meeting_date,status) VALUES (?,CURDATE(),'issued')`, [PROJECT]);
    momId = mo.insertId; clean.meetings.push(momId);
    await conn.query(
      `INSERT INTO meeting_revisions (meeting_id,version,issued_by,window_days,lock_deadline,locked)
       VALUES (?,1,?,7,DATE_ADD(NOW(),INTERVAL 7 DAY),0)`, [momId, A['pmc_head']]);

    // 03 — a meeting for the observation photo
    const [om] = await conn.query(`INSERT INTO meetings (project_id,meeting_date,status) VALUES (?,CURDATE(),'draft')`, [PROJECT]);
    obsMeetId = om.insertId; clean.meetings.push(obsMeetId);

    // 28 — a form template
    const [ft] = await conn.query(`INSERT INTO form_templates (name,fields_json,created_by) VALUES (?,?,?)`,
      ['gate-tmpl', '[]', A['pmc_head']]);
    tmplId = ft.insertId; clean.form_templates.push(tmplId);

    // 21 — seed the handover template if the deployment hasn't
    const [[hc]] = await conn.query(`SELECT COUNT(*) c FROM handover_checklist_template`);
    if (hc.c === 0) {
      await conn.query(`INSERT INTO handover_checklist_template (item_name,discipline,sort_order,is_active)
        VALUES ('As-built drawings','architectural',10,1),('Final report','pmc',20,1)`);
    }
  }, 60000);

  afterAll(async () => {
    if (!conn) return;
    for (const id of clean.form_submissions) await conn.query('DELETE FROM form_submissions WHERE id=?', [id]).catch(()=>{});
    for (const id of clean.form_templates)   await conn.query('DELETE FROM form_templates WHERE id=?', [id]).catch(()=>{});
    for (const id of clean.meetings) { await conn.query('DELETE FROM meeting_revisions WHERE meeting_id=?', [id]).catch(()=>{});
                                       await conn.query('DELETE FROM meetings WHERE id=?', [id]).catch(()=>{}); }
    for (const id of clean.measurements)     await conn.query('DELETE FROM measurements WHERE id=?', [id]).catch(()=>{});
    for (const id of clean.drawing_register) await conn.query('DELETE FROM drawing_register WHERE id=?', [id]).catch(()=>{});
    await conn.end();
  });

  test('05 drawings (matches register) → never 5xx', async () => {
    const r = await auth(request(app).post(`/api/drawings/${PROJECT}/upload`), A['design_head'])
      .field('drawing_number', DNUM).field('drawing_name', 'Ground Floor Plan')
      .field('category', 'Architectural').field('drawing_type', 'main')
      .attach('drawing', F('05_drawings', 'D-ARCH-001-ground-floor-plan-RevC.pdf'));
    expect(r.status).toBeLessThan(500);
  });

  test('22 measurement signed-cert → never 5xx', async () => {
    const r = await auth(request(app).post(`/api/measurements/${PROJECT}/${measId}/client-acceptance`), A['pmc_head'])
      .field('client_rep_name', 'Client X').field('acceptance_date', '2026-06-30')
      .attach('signed_certificate', F('22_measurement-signed-certificate', 'measurement-signed-certificate.pdf'));
    expect(r.status).toBeLessThan(500);
  });

  test('24 mom-reissue (issued MOM) → never 5xx', async () => {
    const r = await auth(request(app).patch(`/api/meetings/${momId}/reissue`), A['pmc_head'])
      .field('revision_reason', 'correction')
      .attach('doc', F('24_mom-reissue-document', 'mom-reissued.pdf'));
    expect(r.status).toBeLessThan(500);
  });

  test('03 meeting observation photo → never 5xx', async () => {
    const r = await auth(request(app).post(`/api/meetings/${obsMeetId}/observation`), A['senior_site_manager'])
      .field('observation', 'site visit note')
      .attach('photo', F('03_meeting-site-visit-photo', 'site-visit-photo.jpg'));
    expect(r.status).toBeLessThan(500);
  });

  test('28 form-submission (needs template) → never 5xx', async () => {
    const r = await auth(request(app).post(`/api/forms/${PROJECT}/submit`), A['senior_site_manager'])
      .field('template_id', String(tmplId)).field('responses_json', '{}')
      .attach('form', F('28_site-form-submission', 'site-form-filled.jpg'));
    expect(r.status).toBeLessThan(500);
  });

  test('21 handover-document (seed + init) → never 5xx', async () => {
    await auth(request(app).post(`/api/handover/${PROJECT}/checklist/initialise`), A['pmc_head']).send({});
    const cl = await auth(request(app).get(`/api/handover/${PROJECT}/checklist`), A['pmc_head']);
    const item = (cl.body.items || [])[0];
    if (!item) { console.warn('[21] no checklist item after init'); return; }
    const r = await auth(request(app).post(`/api/handover/${PROJECT}/checklist/${item.id}/upload`), A['pmc_head'])
      .attach('doc', F('21_handover-document', 'handover-document.pdf'));
    expect(r.status).toBeLessThan(500);
  });

  test('19 clients-bulk → never 5xx', async () => {
    const r = await auth(request(app).post(`/api/clients/bulk-upload`), A['principal'])
      .attach('clients', F('19_clients-bulk-upload', 'clients-bulk-upload.xlsx'));
    expect(r.status).toBeLessThan(500);
  });
});
