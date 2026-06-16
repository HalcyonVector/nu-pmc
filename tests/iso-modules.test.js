// tests/iso-modules.test.js — NCR, Snag, MOM, Site Visits, Comms Log
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const db      = require('../middleware/db');

function makeApp(role = 'principal', username = 'principal') {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    req.session.user = { id: 1, username, full_name: 'Test', role, stream: 'all', projects: [{id:1}], projects_at: Date.now() };
    next();
  });
  // V5 reorg: /api/snags collapsed into /api/issues with issue_type='snag' (v5.7).
  // /api/ncr collapsed into issues with issue_type='quality' + ncr_number column.
  // /api/moms moved to /api/meetings (workflow module). /api/site-visits removed entirely.
  // The describe.skip blocks below cover endpoints that no longer exist as named routes —
  // their behaviour is now tested via the unified /api/issues/ paths in matrix tests
  // and via behaviour tests in tools/v5-critical-paths.js.
  app.use('/api/comms', require('../modules/system/routes/comms'));
  return app;
}

beforeEach(() => { db.query.mockReset(); db.query.mockResolvedValue([[]]); });

// ── NCR
describe.skip('[V5 REMOVED — see /api/issues] POST /api/ncr/:project_id', () => {
  test('site_manager can raise NCR', async () => {
    const app = makeApp('site_manager', 'anjaneya');
    db.query.mockResolvedValueOnce([[{ cnt: 0 }]]).mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/ncr/1').send({
      title: 'Slab level off at grid C3',
      description: 'Measured 12mm deviation from datum. Acceptable limit 6mm.',
      severity: 'major', location: 'Grid C3', trade: 'Civil'
    });
    expect(res.status).toBe(200);
    expect(res.body.ncr_number).toBe('NCR001');
  });

  test('detailing cannot raise NCR', async () => {
    const app = makeApp('detailing', 'abhishek');
    const res = await request(app).post('/api/ncr/1').send({
      title: 'Test', description: 'Test description here'
    });
    expect(res.status).toBe(403);
  });

  test('critical NCR auto-flags payment block', async () => {
    const app = makeApp('pmc_head', 'pmc_head');
    db.query.mockResolvedValueOnce([[{ cnt: 2 }]]).mockResolvedValueOnce([{ insertId: 3 }]);
    const res = await request(app).post('/api/ncr/1').send({
      title: 'Structural concrete not per spec',
      description: 'Cube test results failed — 24MPa vs required 30MPa',
      severity: 'critical', trade: 'Civil'
    });
    expect(res.status).toBe(200);
    expect(res.body.ncr_number).toBe('NCR003');
  });

  test('returns 400 if title missing', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/ncr/1').send({
      description: 'Some issue here'
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 if description missing', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/ncr/1').send({ title: 'Test' });
    expect(res.status).toBe(400);
  });

  test('rejects invalid severity', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/ncr/1').send({
      title: 'Test', description: 'Test desc', severity: 'catastrophic'
    });
    expect(res.status).toBe(400);
  });
});

describe.skip('[V5 REMOVED — see /api/issues] POST /api/ncr/:project_id/:id/close', () => {
  test('pmc_head can close NCR', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).post('/api/ncr/1/1/close').send({
      close_out_notes: 'Level corrected and verified. Within 3mm tolerance.'
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/closed/i);
  });

  test('site_manager cannot close NCR', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).post('/api/ncr/1/1/close').send({});
    expect(res.status).toBe(403);
  });
});

describe.skip('[V5 REMOVED — see /api/issues] POST /api/ncr/:project_id/:id/clear-payment', () => {
  test('principal (Principal) can clear payment block', async () => {
    const app = makeApp('principal', 'principal');
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).post('/api/ncr/1/1/clear-payment');
    expect(res.status).toBe(200);
  });

  test('design_principal (Design Principal) cannot clear payment block', async () => {
    const app = makeApp('design_principal', 'design_principal');
    const res = await request(app).post('/api/ncr/1/1/clear-payment');
    expect(res.status).toBe(403);
  });

  test('pmc_head cannot clear payment block', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/ncr/1/1/clear-payment');
    expect(res.status).toBe(403);
  });
});

// ── SNAGS
describe.skip('[V5 COLLAPSED — see /api/issues] POST /api/snags/:project_id', () => {
  test('principal can raise snag', async () => {
    const app = makeApp('principal');
    db.query.mockResolvedValueOnce([[{ cnt: 0 }]]).mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/snags/1').send({
      title: 'Tile alignment off in lobby', priority: 'high',
      trade: 'Interior', location: 'Ground floor lobby'
    });
    expect(res.status).toBe(200);
    expect(res.body.snag_number).toBe('SN001');
  });

  test('site_manager can raise snag', async () => {
    const app = makeApp('site_manager');
    db.query.mockResolvedValueOnce([[{ cnt: 3 }]]).mockResolvedValueOnce([{ insertId: 4 }]);
    const res = await request(app).post('/api/snags/1').send({
      title: 'Paint drips on east wall', priority: 'low'
    });
    expect(res.status).toBe(200);
    expect(res.body.snag_number).toBe('SN004');
  });

  test('rejects invalid priority', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/snags/1').send({
      title: 'Test snag', priority: 'extreme'
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 if title missing', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/snags/1').send({ priority: 'high' });
    expect(res.status).toBe(400);
  });
});

describe.skip('[V5 COLLAPSED — see /api/issues] POST /api/snags/:project_id/:id/close', () => {
  test('design_head can close snag', async () => {
    const app = makeApp('design_head');
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).post('/api/snags/1/1/close').send({});
    expect(res.status).toBe(200);
  });

  test('site_manager cannot close snag', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).post('/api/snags/1/1/close').send({});
    expect(res.status).toBe(403);
  });
});

// ── MOMs
describe.skip('[V5 MOVED — see /api/meetings] POST /api/moms/:project_id', () => {
  test('pmc_head can create MOM draft', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[{ cnt: 0 }]]).mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/moms/1').send({
      meeting_type: 'client_review', meeting_date: '2026-04-12',
      meeting_location: 'Site office, Nelamangala',
      attendees_external: 'Mr. Venkat (TLD), Ms. Priya (TLD Consultant)'
    });
    expect(res.status).toBe(200);
    expect(res.body.mom_number).toBe('MOM001');
  });

  test('rejects invalid meeting type', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/moms/1').send({
      meeting_type: 'random_meeting', meeting_date: '2026-04-12'
    });
    expect(res.status).toBe(400);
  });

  test('rejects invalid date', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/moms/1').send({
      meeting_type: 'client_review', meeting_date: '12/04/2026'
    });
    expect(res.status).toBe(400);
  });
});

describe.skip('[V5 MOVED — see /api/meetings] POST /api/moms/:project_id/:id/approve', () => {
  test('principal can approve MOM', async () => {
    const app = makeApp('principal');
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).post('/api/moms/1/1/approve');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/approved/i);
  });

  test('design_principal can approve MOM', async () => {
    const app = makeApp('design_principal');
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).post('/api/moms/1/1/approve');
    expect(res.status).toBe(200);
  });

  test('pmc_head cannot approve MOM', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/moms/1/1/approve');
    expect(res.status).toBe(403);
  });

  test('site_manager cannot approve MOM', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).post('/api/moms/1/1/approve');
    expect(res.status).toBe(403);
  });
});

describe.skip('[V5 MOVED — see /api/meetings] POST /api/moms/:project_id/:id/mark-shared', () => {
  test('pmc_head can mark MOM as shared after approval', async () => {
    const app = makeApp('pmc_head');
    db.query
      .mockResolvedValueOnce([[{ status: 'approved', mom_number: 'MOM001', project_id: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/moms/1/1/mark-shared').send({
      method: 'whatsapp', notes: 'Sent to Mr. Venkat at 3:15 PM'
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/shared/i);
  });

  test('cannot share unapproved MOM', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[{ status: 'draft', mom_number: 'MOM001', project_id: 1 }]]);
    const res = await request(app).post('/api/moms/1/1/mark-shared').send({
      method: 'whatsapp'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approved/i);
  });
});

// ── SITE VISITS
describe.skip('[V5 REMOVED] POST /api/site-visits/:project_id', () => {
  test('principal can log visit', async () => {
    const app = makeApp('principal');
    db.query.mockResolvedValueOnce([[{ cnt: 0 }]]).mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/site-visits/1').send({
      visit_type: 'principal_visit', visit_date: '2026-04-12',
      time_in: '10:00', time_out: '12:30'
    });
    expect(res.status).toBe(200);
    expect(res.body.visit_number).toBe('SV001');
    expect(res.body.message).toMatch(/photos/i);
  });

  test('design_principal (Design Principal) can log visit', async () => {
    const app = makeApp('design_principal', 'design_principal');
    db.query.mockResolvedValueOnce([[{ cnt: 1 }]]).mockResolvedValueOnce([{ insertId: 2 }]);
    const res = await request(app).post('/api/site-visits/1').send({
      visit_type: 'design_review', visit_date: '2026-04-12'
    });
    expect(res.status).toBe(200);
    expect(res.body.visit_number).toBe('SV002');
  });

  test('site_manager can log visit', async () => {
    const app = makeApp('site_manager');
    db.query.mockResolvedValueOnce([[{ cnt: 2 }]]).mockResolvedValueOnce([{ insertId: 3 }]);
    const res = await request(app).post('/api/site-visits/1').send({
      visit_type: 'client_inspection', visit_date: '2026-04-12',
      visitor_name: 'Mr. Venkat (TLD)'
    });
    expect(res.status).toBe(200);
  });

  test('detailing cannot log visit', async () => {
    const app = makeApp('detailing');
    const res = await request(app).post('/api/site-visits/1').send({
      visit_type: 'design_review', visit_date: '2026-04-12'
    });
    expect(res.status).toBe(403);
  });

  test('rejects invalid visit type', async () => {
    const app = makeApp('principal');
    const res = await request(app).post('/api/site-visits/1').send({
      visit_type: 'random', visit_date: '2026-04-12'
    });
    expect(res.status).toBe(400);
  });

  test('photos-only visit is valid (no text required)', async () => {
    const app = makeApp('design_principal');
    db.query.mockResolvedValueOnce([[{ cnt: 0 }]]).mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/site-visits/1').send({
      visit_type: 'design_review', visit_date: '2026-04-12'
      // No observations field — should still pass
    });
    expect(res.status).toBe(200);
  });
});

// ── COMMS LOG
describe('POST /api/comms/:project_id', () => {
  test('pmc_head can log communication', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/comms/1').send({
      document_type: 'measurement_certificate',
      document_ref: 'RA01 Civil',
      method: 'whatsapp',
      notes: 'Sent to Mr. Venkat via WhatsApp at 3:15 PM'
    });
    expect(res.status).toBe(200);
  });

  test('rejects invalid method', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/comms/1').send({
      document_type: 'mom', method: 'sms'
    });
    expect(res.status).toBe(400);
  });

  test('rejects invalid document type', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/comms/1').send({
      document_type: 'text_message', method: 'whatsapp'
    });
    expect(res.status).toBe(400);
  });

  test('site_manager cannot log communication', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).post('/api/comms/1').send({
      document_type: 'mom', method: 'whatsapp'
    });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/comms/:project_id/:id/ack', () => {
  test('pmc_head can record client acknowledgement', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).patch('/api/comms/1/1/ack').send({
      client_response: 'Mr. Venkat confirmed receipt via WhatsApp at 4:30 PM. No comments.'
    });
    expect(res.status).toBe(200);
  });

  test('site_manager cannot record acknowledgement', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).patch('/api/comms/1/1/ack').send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/comms/:project_id', () => {
  test('pmc_head can view comms log', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[{ id: 1, document_type: 'mom', sent_by_name: 'PMC Head' }]])
            .mockResolvedValueOnce([[{ total_sent: 5, acknowledged: 3, last_comm_date: '2026-04-12' }]]);
    const res = await request(app).get('/api/comms/1');
    expect(res.status).toBe(200);
    expect(res.body.comms).toBeDefined();
    expect(res.body.stats).toBeDefined();
  });

  test('site_manager cannot view comms log', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).get('/api/comms/1');
    expect(res.status).toBe(403);
  });
});
