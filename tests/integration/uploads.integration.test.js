// tests/integration/uploads.integration.test.js
// ════════════════════════════════════════════════════════════════════════
// End-to-end upload regression suite — exercises the 29 upload points with the
// REAL sample files in test-uploads-v2/, against the live app on a live DB, as
// the correct role.
//
// The HARD guarantee this suite protects: **no upload endpoint ever returns a
// 5xx.** Every upload bug found in the 2026-07 audit (F1 file-storage, N1
// petty-cash, N2 direct-payment, N3 ICICI) surfaced as a 500 on a valid file.
// So every point below asserts `status < 500`. A self-contained subset also
// asserts a 2xx happy path; the rest need a chained precondition and are
// asserted no-5xx (2xx-with-chain is covered in
// upload-audit/REAL-FILE-VERIFICATION.md).
//
// SEED-PORTABLE: users and the test project are resolved from the DB by ROLE at
// run time (no hard-coded ids). We pick the project with the richest role
// coverage, resolve an ASSIGNED user for each project-scoped point, and skip
// (not fail) any point whose role/assignment the seed doesn't provide.
//
// Runs against a live MySQL DB. Skips unless TEST_DB_HOST (or DB_SOCKET) is set.
//   NODE_ENV=test DB_USER=root DB_PASSWORD=... DB_NAME=nu_pmc \
//     [DB_SOCKET=/path/mysql.sock] \
//     npx jest --config jest.integration.config.js tests/integration/uploads
// ════════════════════════════════════════════════════════════════════════
'use strict';

const request = require('supertest');
const mysql   = require('mysql2/promise');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

const SKIP = !(process.env.TEST_DB_HOST || process.env.DB_SOCKET);
const d = SKIP ? describe.skip : describe;

const DIR = path.resolve(__dirname, '../../test-uploads-v2');
const F = (sub, name) => path.join(DIR, sub, name);

let app, conn;
let PROJECT, engId, meetingId;
const assignedId = {};  // role -> user id assigned to PROJECT
const anyId = {};       // role -> any active user id

const auth = (req, uid) => req.set('X-Test-User-Id', String(uid));
const attach = (req, list) => { for (const [f, s, n] of list) req = req.attach(f, F(s, n)); return req; };
const fields = (req, obj) => { for (const [k, v] of Object.entries(obj || {})) req = req.field(k, v); return req; };

async function resolveUsers(roles) {
  for (const role of roles) {
    const [a] = await conn.query(
      `SELECT u.id FROM users u
         JOIN project_assignments pa ON pa.user_id = u.id AND pa.is_active = 1
        WHERE u.role = ? AND pa.project_id = ? AND u.is_active = 1 LIMIT 1`, [role, PROJECT]);
    assignedId[role] = a.length ? a[0].id : null;
    const [b] = await conn.query(`SELECT id FROM users WHERE role = ? AND is_active = 1 LIMIT 1`, [role]);
    anyId[role] = b.length ? b[0].id : null;
  }
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
  // Project with the most distinct roles assigned = best coverage.
  const [[p]] = await conn.query(
    `SELECT pa.project_id AS id
       FROM project_assignments pa JOIN users u ON u.id = pa.user_id AND u.is_active = 1
      WHERE pa.is_active = 1
      GROUP BY pa.project_id
      ORDER BY COUNT(DISTINCT u.role) DESC, pa.project_id ASC LIMIT 1`);
  PROJECT = p ? p.id : 1;
  await resolveUsers(['site_manager','senior_site_manager','pmc_head','principal',
                      'design_principal','design_head','services_head','finance_admin']);
  const [[e]] = await conn.query(`SELECT id FROM vendor_engagements WHERE project_id=? LIMIT 1`, [PROJECT]);
  engId = e ? e.id : 1;
  const [mm] = await conn.query(`SELECT id FROM meetings WHERE project_id=? LIMIT 1`, [PROJECT]).catch(()=>[[]]);
  meetingId = mm && mm.length ? mm[0].id : null;
}, 60000);
afterAll(async () => { if (conn) await conn.end(); });

// site-team submitter (prefer senior, else plain site_manager), assigned to PROJECT
const siteUser = () => assignedId['senior_site_manager'] || assignedId['site_manager'];

// Self-contained points → assert 2xx AND no-5xx. Each entry resolves its user lazily.
function selfCases() {
  return [
    ['01 site-photos', 'post', `/api/photos/${PROJECT}/upload`, siteUser(),
      [['photo','01_site-photos','site-photo-1.jpg'],['photo','01_site-photos','site-photo-2.jpg'],
       ['photo','01_site-photos','site-photo-3.jpg'],['photo','01_site-photos','site-photo-4.png']], {}],
    ['02 issue-defect-photo', 'post', `/api/issues/${PROJECT}`, siteUser(),
      [['photo','02_issue-defect-photo','defect-photo-1.jpg']], { issue_type:'quality', title:'t', description:'d' }],
    ['04 drawing-register', 'post', `/api/register/${PROJECT}/upload`, assignedId['design_head'],
      [['register','04_drawing-register','design-drawing-register.xlsx']], {}],
    ['06 project-schedule', 'post', `/api/schedule/${PROJECT}/upload`, assignedId['pmc_head'],
      [['schedule','06_project-schedule','project-schedule.xlsx']], { revision_reason:'baseline' }],
    ['07 design-boq', 'post', `/api/materials/${PROJECT}/boq/upload`, assignedId['design_head'],
      [['boq','07_design-boq','design-boq.xlsx']], {}],
    ['08 services-boq', 'post', `/api/materials/${PROJECT}/boq/upload`, assignedId['services_head'],
      [['boq','08_services-boq','services-boq.xlsx']], {}],
    ['13 petty-cash-bill', 'post', `/api/finance/${PROJECT}/petty-cash`, assignedId['pmc_head'],
      [['bill','13_petty-cash-bill','petty-cash-bill.jpg']],
      { txn_date:'2026-06-30', description:'tea', amount:'250', category:'other' }],
    ['16 vendor-master-bulk', 'post', `/api/vendors/master/upload`, anyId['pmc_head'],
      [['vendors','16_vendor-master-bulk-upload','vendor-master.xlsx']], {}],
    ['17 vendor-engagements-bulk', 'post', `/api/vendors/${PROJECT}/engagements/bulk-upload`, anyId['principal'],
      [['engagements','17_vendor-engagements-bulk-upload','vendor-engagements.xlsx']], {}],
    ['18 users-bulk', 'post', `/api/users/bulk-upload`, anyId['principal'],
      [['users','18_users-bulk-upload','users-bulk-upload.xlsx']], {}],
    ['20 project-documents', 'post', `/api/documents/${PROJECT}`, assignedId['principal'],
      [['document','20_project-documents','building-plan-sanction.pdf']], { title:'Plan', category:'drawing' }],
    ['23 weekly-report', 'post', `/api/reports/${PROJECT}/weekly/upload`, assignedId['pmc_head'],
      [['report','23_weekly-report','weekly-report.pdf']], { week_ending:'2026-06-28' }],
    ['26 fee-schedule', 'post', `/api/invoices/${PROJECT}/fee-schedule/upload`, assignedId['finance_admin'],
      [['fee_schedule','26_fee-schedule','fee-schedule.xlsx']], {}],
    ['27 site-form-template', 'post', `/api/forms/templates`, anyId['pmc_head'],
      [['excel','27_site-form-template','site-form-template.xlsx']], { name:'quality', project_id:String(PROJECT) }],
    ['29 daily-report', 'post', `/api/daily-reports/${PROJECT}/submit`, siteUser(),
      [['photo','29_daily-report','daily-report-photo.jpg']], { report_date:'2026-06-30', overall_notes:'progress' }],
  ];
}

// Precondition-dependent points → assert NO-5xx only.
function precondCases() {
  return [
    ['09 client-boq', 'post', `/api/client-boq/${PROJECT}/upload`, assignedId['principal'],
      [['client_boq','09_client-boq','client-boq.xlsx']], {}],
    ['10 grn (2-field)', 'post', `/api/grn/${PROJECT}`, siteUser(),
      [['delivery_note','10_grn','grn-delivery-note.pdf'],['invoice','10_grn','grn-vendor-invoice.pdf']],
      { engagement_id:String(engId), delivery_date:'2026-06-30', description:'cement', quantity_received:'100' }],
    ['11 payment-request-evidence', 'post', `/api/payment-requests/${PROJECT}`, assignedId['senior_site_manager'],
      [['evidence','11_payment-request-evidence','payment-evidence-1-invoice.pdf'],
       ['evidence','11_payment-request-evidence','payment-evidence-3-work-completion.pdf']],
      { engagement_id:String(engId), amount_requested:'1000', reason:'work done' }],
    ['12 urgent-payment (2-field)', 'post', `/api/urgent-payments/${PROJECT}`, assignedId['pmc_head'],
      [['invoice','12_urgent-payment','urgent-payment-invoice.pdf'],['upi_qr','12_urgent-payment','urgent-payment-upi-qr.png']],
      { vendor_name:'x', amount:'1000', reason:'urgent' }],
    ['14 direct-payment-receipt', 'post', `/api/finance/${PROJECT}/direct-payments`, assignedId['principal'],
      [['receipt','14_direct-payment-receipt','direct-payment-receipt.pdf']],
      { vendor_name:'ABC', amount:'5000', payment_type:'bank_transfer', payment_date:'2026-06-30' }],
    ['15 icici-confirmation preview', 'post', `/api/payments/${PROJECT}/icici/confirm/preview`, assignedId['finance_admin'] || anyId['finance_admin'],
      [['confirmation','15_icici-payment-confirmation','icici-confirmation.xlsx']], {}],
  ];
}

d('29 uploads — real files, live DB', () => {

  test('sample files present on disk', () => expect(fs.existsSync(DIR)).toBe(true));

  describe('self-contained points → 2xx (and never 5xx)', () => {
    // NB: generated at run time so resolved ids are populated.
    test('run self-contained uploads', async () => {
      for (const [label, m, url, uid, atts, fs_] of selfCases()) {
        if (uid == null) { console.warn(`[uploads] SKIP ${label}: no seeded user for its role`); continue; }
        const r = await attach(fields(auth(request(app)[m](url), uid), fs_), atts);
        expect(r.status).toBeLessThan(500);
        if (!(r.status >= 200 && r.status < 300))
          throw new Error(`${label}: expected 2xx, got ${r.status} — ${JSON.stringify(r.body).slice(0,300)}`);
      }
    });
  });

  describe('precondition-dependent points → never 5xx', () => {
    test('run precondition uploads', async () => {
      for (const [label, m, url, uid, atts, fs_] of precondCases()) {
        if (uid == null) { console.warn(`[uploads] SKIP ${label}: no seeded user`); continue; }
        const r = await attach(fields(auth(request(app)[m](url), uid), fs_), atts);
        expect(r.status).toBeLessThan(500);
      }
    });
    test('25 meeting-observation → never 5xx', async () => {
      const uid = assignedId['pmc_head']; if (uid == null) return;
      const id = meetingId || PROJECT;
      const r = await auth(request(app).post(`/api/meetings/${id}/upload`), uid)
        .field('note','obs').attach('file', F('25_meeting-observation-file','meeting-observation.pdf'));
      expect(r.status).toBeLessThan(500);
    });
  });

  describe('role gating', () => {
    test('26 fee-schedule: site_manager blocked (not 2xx, not 5xx)', async () => {
      const uid = assignedId['site_manager']; if (uid == null) return;
      const r = await auth(request(app).post(`/api/invoices/${PROJECT}/fee-schedule/upload`), uid)
        .attach('fee_schedule', F('26_fee-schedule','fee-schedule.xlsx'));
      expect(r.status >= 200 && r.status < 300).toBe(false);
      expect(r.status).toBeLessThan(500);
    });
    test('14 direct-payment: pmc_head blocked (principal-only)', async () => {
      const uid = assignedId['pmc_head']; if (uid == null) return;
      const r = await auth(request(app).post(`/api/finance/${PROJECT}/direct-payments`), uid)
        .field('vendor_name','x').field('amount','1').field('payment_type','upi').field('payment_date','2026-06-30')
        .attach('receipt', F('14_direct-payment-receipt','direct-payment-receipt.pdf'));
      expect(r.status >= 200 && r.status < 300).toBe(false);
    });
  });

  describe('a disallowed file is a clean 4xx, never 5xx (error-handler fix)', () => {
    test('.txt into an image field → 4xx', async () => {
      const uid = siteUser(); if (uid == null) return;
      const tmp = path.join(os.tmpdir(), 'bad-upload.txt');
      fs.writeFileSync(tmp, 'not an image');
      const r = await auth(request(app).post(`/api/issues/${PROJECT}`), uid)
        .field('issue_type','quality').field('title','t').field('description','d').attach('photo', tmp);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    });
  });

  // The 7 chained points (03, 05, 19, 21, 22, 24, 28) are executed for real —
  // with their preconditions built in setup — in uploads-chained.integration.test.js.
});
