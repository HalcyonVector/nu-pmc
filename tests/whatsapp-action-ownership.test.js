// tests/whatsapp-action-ownership.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const db      = require('../middleware/db');
const perms   = require('../middleware/permissions');
const waReplyActions = require('../services/wa-reply-actions');

jest.mock('../modules/onboarding/contract', () => ({
  functions: {
    getProjectsByIds: jest.fn(async (ids) => {
      const map = new Map();
      (ids || []).forEach(id => map.set(id, { id, name: 'Project X', code: 'PX' }));
      return map;
    }),
  },
}));

jest.mock('../services/approvals', () => ({
  open:           jest.fn(),
  pendingForUser: jest.fn(),
  vote:           jest.fn(),
  cancel:         jest.fn(),
  get:            jest.fn(),
  ApprovalError:  class ApprovalError extends Error {
    constructor(msg, opts) {
      opts = opts || {};
      super(msg);
      this.code   = opts.code;
      this.status = opts.status;
      this.name   = 'ApprovalError';
    }
  },
}));

const approvalsService = require('../services/approvals');

function makeApp(role, extraRoutes) {
  role        = role        || 'pmc_head';
  extraRoutes = extraRoutes || [];

  perms._setCacheForTests([
    { role: 'pmc_head',  action: 'approvals.read',  level: 'A' },
    { role: 'pmc_head',  action: 'approvals.create', level: 'A' },
    { role: 'principal', action: 'approvals.read',  level: 'A' },
  ]);

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.use(function(req, _res, next) {
    req.session.user = {
      id: 99, username: 'test_pmc', full_name: 'Test PMC',
      role: role, stream: 'all',
      projects: [{ id: 1, name: 'Test Project' }],
      projects_at: Date.now(),
    };
    next();
  });
  extraRoutes.forEach(function(pair) { app.use(pair[0], pair[1]); });
  return app;
}

describe('WhatsApp Action Ownership and Assignment', function() {
  var app;

  beforeEach(function() {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  test('POST /api/approvals sets raisedBy as the session user', async function() {
    app = makeApp('pmc_head', [['/api/approvals', require('../modules/workflow/routes/approvals')]]);
    approvalsService.open.mockResolvedValueOnce({ id: 50, alreadyExisted: false });
    db.query.mockImplementation(async function(sql) {
      if (sql.indexOf('audit_log')     !== -1) return [{ insertId: 100 }];
      if (sql.indexOf('FROM projects') !== -1) return [[{ name: 'Project X' }]];
      return [[]];
    });

    var res = await request(app).post('/api/approvals').send({
      project_id: 1, action_type: 'schedule_change', message_sent: 'Proposing schedule change',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(approvalsService.open).toHaveBeenCalledWith(expect.objectContaining({ raisedBy: 99 }));
  });

  test('GET /api/approvals resolves user_id_name from raised_by', async function() {
    app = makeApp('principal', [['/api/approvals', require('../modules/workflow/routes/approvals')]]);
    approvalsService.pendingForUser.mockResolvedValueOnce([{
      id: 10, approval_type: 'schedule_change',
      raised_by: 99, raised_by_name: 'Test Proposer',
      project_id: 1, title: 'Proposing schedule change',
      details: null, raised_at: new Date().toISOString(),
      expires_at: null, vendor_id: null,
      ref_table: 'projects', ref_id: 1, label: 'Schedule Change', quorum: 1,
    }]);
    db.query.mockResolvedValueOnce([[]]); // signoff_instances

    var res = await request(app).get('/api/approvals');

    expect(res.status).toBe(200);
    expect(res.body.approvals).toHaveLength(1);
    expect(res.body.approvals[0].user_id_name).toBe('Test Proposer');
  });

  test('sendPendingAction inserts both user_id (assignee) and raised_by (proposer)', async function() {
    var mockWa = { send: jest.fn().mockResolvedValue(true) };
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    db.query.mockResolvedValueOnce([{ insertId: 60 }]);

    await waReplyActions.sendPendingAction(db, mockWa, {
      actionType: 'grn_approve', refId: 5, refTable: 'grns',
      phone: '919000000001', userId: 88, raisedBy: 99, message: 'Pending GRN approval',
    });

    var insertCall = db.query.mock.calls.find(function(call) {
      return call[0].indexOf('INSERT INTO wa_pending_actions') !== -1;
    });
    expect(insertCall).toBeDefined();
    var params = insertCall[1];
    expect(params[4]).toBe(88); // user_id  = assignee
    expect(params[5]).toBe(99); // raised_by = proposer
  });
});
