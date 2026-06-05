// tests/whatsapp-action-ownership.test.js — Tests for WhatsApp action ownership and assignment standardization
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const db      = require('../middleware/db');
const perms   = require('../middleware/permissions');
const waReplyActions = require('../services/wa-reply-actions');

function makeApp(role = 'pmc_head', extraRoutes = []) {
  perms._setCacheForTests([
    { role: 'pmc_head', action: 'approvals.read', level: 'A' },
    { role: 'pmc_head', action: 'approvals.create', level: 'A' },
    { role: 'principal', action: 'approvals.read', level: 'A' }
  ]);

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));

  app.use((req, _res, next) => {
    req.session.user = {
      id: 99,
      username: 'test_pmc',
      full_name: 'Test PMC',
      role,
      stream: 'all',
      projects: [{ id: 1, name: 'Test Project' }],
      projects_at: Date.now(),
    };
    next();
  });

  extraRoutes.forEach(([path, router]) => app.use(path, router));
  return app;
}

describe('WhatsApp Action Ownership and Assignment', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  test('POST /api/approvals inserts raised_by as the session user and sets user_id as null', async () => {
    app = makeApp('pmc_head', [['/api/approvals', require('../modules/workflow/routes/approvals')]]);

    // Mock database queries
    db.query.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO wa_pending_actions')) {
        return [{ insertId: 50 }];
      }
      if (sql.includes('INSERT INTO audit_log')) {
        return [{ insertId: 100 }];
      }
      if (sql.includes('SELECT name FROM projects')) {
        return [[{ name: 'Project X' }]];
      }
      return [[]];
    });

    const res = await request(app)
      .post('/api/approvals')
      .send({
        project_id: 1,
        action_type: 'schedule_change',
        message_sent: 'Proposing schedule change',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify INSERT query contains raised_by and user_id is null
    const insertCall = db.query.mock.calls.find(call => call[0].includes('INSERT INTO wa_pending_actions'));
    expect(insertCall).toBeDefined();
    
    // SQL: INSERT INTO wa_pending_actions (action_type, ref_id, ref_table, phone, user_id, raised_by, ...)
    // Params: [action_type, 0, 'general', '', null, req.session.user.id, message_sent, 'app']
    const params = insertCall[1];
    expect(params[4]).toBeNull(); // user_id (assignee) is null
    expect(params[5]).toBe(99);   // raised_by (proposer) is 99 (session user ID)
  });

  test('GET /api/approvals resolves user_id_name from raised_by', async () => {
    app = makeApp('principal', [['/api/approvals', require('../modules/workflow/routes/approvals')]]);

    // Mock DB queries for GET /api/approvals
    // 1. SELECT ar.* FROM wa_pending_actions
    db.query.mockResolvedValueOnce([[
      {
        id: 10,
        action_type: 'schedule_change',
        raised_by: 99, // proposer
        user_id: 88,   // assignee (could be different)
        project_id: 1,
        status: 'pending',
        channel: 'app'
      }
    ]]);
    // 2. getProjectsByIds
    db.query.mockResolvedValueOnce([[{ id: 1, name: 'Project X', code: 'PX' }]]);
    // 3. getUsers
    db.query.mockResolvedValueOnce([[
      { id: 99, username: 'test_pmc', full_name: 'Test Proposer' },
      { id: 88, username: 'test_assignee', full_name: 'Test Assignee' }
    ]]);
    // 4. pendingForUser (unified approvals check)
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/approvals');

    expect(res.status).toBe(200);
    expect(res.body.approvals).toHaveLength(1);
    
    // user_id_name must be hydrated from raised_by (Test Proposer) rather than user_id (Test Assignee)
    const approval = res.body.approvals[0];
    expect(approval.user_id_name).toBe('Test Proposer');
  });

  test('sendPendingAction and registerPendingAction insert raisedBy into raised_by', async () => {
    // Mock wa provider
    const mockWa = { send: jest.fn().mockResolvedValue(true) };
    
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // cancel query
    db.query.mockResolvedValueOnce([{ insertId: 60 }]);   // insert query

    await waReplyActions.sendPendingAction(db, mockWa, {
      actionType: 'grn_approve',
      refId: 5,
      refTable: 'grns',
      phone: '919000000001',
      userId: 88,
      raisedBy: 99,
      message: 'Pending GRN approval'
    });

    const insertCall = db.query.mock.calls.find(call => call[0].includes('INSERT INTO wa_pending_actions'));
    expect(insertCall).toBeDefined();
    const params = insertCall[1];
    
    // Params matching: [actionType, refId, refTable, phone, userId||null, opts.raisedBy||null, message, expiresAt, autoAcceptAt]
    expect(params[4]).toBe(88); // user_id is 88 (assignee)
    expect(params[5]).toBe(99); // raised_by is 99 (proposer)
  });
});
