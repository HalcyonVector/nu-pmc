// tests/approvals-merged.test.js
// ════════════════════════════════════════════════════════════════════════════
// Tests for GET /api/approvals (unified + signoff-gate merge) and the v2
// endpoints (POST /v2/:id/vote, POST /v2/:id/cancel, GET /v2/:id).
//
// Verifies:
//   - GET merges unified approvals rows with signoff_instances rows
//   - Each row carries source='unified' or source='signoff' (legacy retired)
//   - Sorting by raised_at DESC (newest first)
//   - Vote endpoint translates ApprovalError into HTTP responses
//   - Cancel endpoint enforces "only proposer may cancel"
// ════════════════════════════════════════════════════════════════════════════

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const db = require('../middleware/db');

// Stub out the contracts the route reaches into so we don't re-mock per test
jest.mock('../modules/onboarding/contract', () => ({
  functions: {
    getProjectsByIds: jest.fn(async () => new Map([
      [7, { id: 7, name: 'Test Project', code: 'TP' }],
    ])),
  },
}));
jest.mock('../modules/auth/contract', () => ({
  functions: {
    getUsers: jest.fn(async () => new Map([
      [10, { id: 10, full_name: 'Pia' }],
      [11, { id: 11, full_name: 'Principal' }],
    ])),
  },
}));
// Stub the approvals service so GET tests don't need to mock its 8-row SQL
jest.mock('../services/approvals', () => ({
  pendingForUser: jest.fn(),
  vote: jest.fn(),
  cancel: jest.fn(),
  get: jest.fn(),
  ApprovalError: class ApprovalError extends Error {
    constructor(msg, opts = {}) { super(msg); this.code = opts.code; this.status = opts.status; this.name = 'ApprovalError'; }
  },
}));

const approvals = require('../services/approvals');

function makeApp(role = 'principal', userId = 11, projects = []) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    req.session.user = {
      id: userId, username: `u${userId}`, full_name: 'Test',
      role, stream: 'all',
      projects, projects_at: Date.now(),
    };
    next();
  });
  app.use('/api/approvals', require('../modules/workflow/routes/approvals'));
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
});

// ── GET /api/approvals — merged list ────────────────────────────────────────
// db.query call order in the GET handler:
//   1. signoff_instances JOIN signoff_workflows (returns signoff rows)
// Then: approvalsService.pendingForUser() (mocked — returns unified rows)

describe('GET /api/approvals — merged list', () => {
  test('returns unified + signoff rows tagged with source', async () => {
    const app = makeApp('principal', 11, [{ id: 7 }]);

    // 1st db.query: signoff_instances — empty for this test
    db.query.mockResolvedValueOnce([[]]);

    // pendingForUser returns 1 unified row
    approvals.pendingForUser.mockResolvedValueOnce([
      { id: 200, approval_type: 'handover_closure', title: 'Closure',
        details: null, project_id: 7, raised_by: 10, raised_by_role: 'pmc_head',
        raised_by_name: 'Pia', raised_at: new Date('2026-04-12'),
        expires_at: null, vendor_id: null, ref_table: 'projects', ref_id: 7,
        label: 'Project handover closure', quorum: 4 },
    ]);

    const res = await request(app).get('/api/approvals');
    expect(res.status).toBe(200);
    expect(res.body.approvals).toHaveLength(1);
    expect(res.body.approvals[0].source).toBe('unified');
    expect(res.body.approvals[0].label).toBe('Project handover closure');
    expect(res.body.approvals[0].quorum).toBe(4);
    expect(res.body.approvals[0].action_type).toBe('handover_closure');
  });

  test('signoff rows surface with source="signoff"', async () => {
    const app = makeApp('principal', 11, [{ id: 7 }]);

    // signoff_instances returns 1 row
    db.query.mockResolvedValueOnce([[
      { id: 5, workflow_type: 'change_notice', document_id: 22, project_id: 7,
        question: 'CN-003 — approve?', si_status: 'pending',
        current_approver_id: 11, closes_at: null,
        created_at: new Date('2026-04-11'), quorum_required: 1 },
    ]]);
    approvals.pendingForUser.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/approvals');
    expect(res.status).toBe(200);
    expect(res.body.approvals).toHaveLength(1);
    expect(res.body.approvals[0].source).toBe('signoff');
    expect(res.body.approvals[0].id).toBe('signoff_5');
    expect(res.body.approvals[0].action_type).toBe('change_notice');
  });

  test('passes user role + projects to pendingForUser', async () => {
    // session.user.projects is shaped [{id}] — handler must map .id to projectIds
    const app = makeApp('finance_admin', 11, [{ id: 5 }, { id: 8 }]);
    db.query.mockResolvedValueOnce([[]]);  // signoff_instances
    approvals.pendingForUser.mockResolvedValueOnce([]);

    await request(app).get('/api/approvals');

    expect(approvals.pendingForUser).toHaveBeenCalledTimes(1);
    const arg = approvals.pendingForUser.mock.calls[0][0];
    expect(arg.userId).toBe(11);
    expect(arg.role).toBe('finance_admin');
    expect(arg.projectIds).toEqual([5, 8]);
  });

  test('empty list still returns approvals: []', async () => {
    const app = makeApp('principal', 11);
    db.query.mockResolvedValueOnce([[]]);  // signoff_instances
    approvals.pendingForUser.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/approvals');
    expect(res.status).toBe(200);
    expect(res.body.approvals).toEqual([]);
  });

  test('unified row sorted before older signoff row', async () => {
    const app = makeApp('principal', 11, [{ id: 7 }]);

    // signoff row raised 2026-04-10
    db.query.mockResolvedValueOnce([[
      { id: 3, workflow_type: 'payment_batch', document_id: 1, project_id: 7,
        question: 'Pay?', si_status: 'pending', current_approver_id: 11,
        closes_at: null, created_at: new Date('2026-04-10'), quorum_required: 1 },
    ]]);

    // unified row raised 2026-04-12 (newer)
    approvals.pendingForUser.mockResolvedValueOnce([
      { id: 200, approval_type: 'cn_approval', title: 'CN-200',
        details: null, project_id: 7, raised_by: 10, raised_by_role: 'pmc_head',
        raised_by_name: 'Pia', raised_at: new Date('2026-04-12'),
        expires_at: null, vendor_id: null, ref_table: 'change_notices', ref_id: 5,
        label: 'CN approval', quorum: 1 },
    ]);

    const res = await request(app).get('/api/approvals');
    expect(res.body.approvals).toHaveLength(2);
    // Newest first: unified (Apr 12) before signoff (Apr 10)
    expect(res.body.approvals[0].source).toBe('unified');
    expect(res.body.approvals[1].source).toBe('signoff');
  });
});

// ── POST /api/approvals/v2/:id/vote ─────────────────────────────────────────

describe('POST /api/approvals/v2/:id/vote', () => {
  test('approve happy path', async () => {
    const app = makeApp('principal', 11);
    approvals.vote.mockResolvedValueOnce({
      approvalId: 50, newStatus: 'approved',
      quorumProgress: { approves: 1, quorum: 1, rejects: 0 },
    });
    const res = await request(app)
      .post('/api/approvals/v2/50/vote')
      .send({ vote: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.newStatus).toBe('approved');
    expect(approvals.vote).toHaveBeenCalledWith(expect.objectContaining({
      approvalId: 50, signerId: 11, signerRole: 'principal', vote: 'approve',
    }));
  });

  test('translates ApprovalError to HTTP', async () => {
    const app = makeApp('site_manager', 11);
    const ApprovalError = approvals.ApprovalError;
    approvals.vote.mockRejectedValueOnce(new ApprovalError('Role not permitted', {
      code: 'ROLE_NOT_PERMITTED', status: 403,
    }));
    const res = await request(app)
      .post('/api/approvals/v2/50/vote')
      .send({ vote: 'approve' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_NOT_PERMITTED');
  });

  test('translates self-vote refusal to 403', async () => {
    const app = makeApp('pmc_head', 11);
    const ApprovalError = approvals.ApprovalError;
    approvals.vote.mockRejectedValueOnce(new ApprovalError('Proposer cannot vote', {
      code: 'SELF_VOTE', status: 403,
    }));
    const res = await request(app)
      .post('/api/approvals/v2/50/vote')
      .send({ vote: 'approve' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SELF_VOTE');
  });

  test('translates double-vote conflict to 409', async () => {
    const app = makeApp('principal', 11);
    const ApprovalError = approvals.ApprovalError;
    approvals.vote.mockRejectedValueOnce(new ApprovalError('Already voted', {
      code: 'ALREADY_VOTED', status: 409,
    }));
    const res = await request(app)
      .post('/api/approvals/v2/50/vote')
      .send({ vote: 'approve' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_VOTED');
  });
});

// ── POST /api/approvals/v2/:id/cancel ───────────────────────────────────────

describe('POST /api/approvals/v2/:id/cancel', () => {
  test('proposer can cancel their own pending approval', async () => {
    const app = makeApp('pmc_head', 10);
    approvals.get.mockResolvedValueOnce({
      approval: { id: 50, raised_by: 10, status: 'pending' },
      signoffs: [], config: {},
    });
    approvals.cancel.mockResolvedValueOnce({ cancelled: true });

    const res = await request(app)
      .post('/api/approvals/v2/50/cancel')
      .send({ reason: 'duplicate of CN-099' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(approvals.cancel).toHaveBeenCalledWith(expect.objectContaining({
      approvalId: 50, cancelledBy: 10, reason: 'duplicate of CN-099',
    }));
  });

  test('non-proposer cannot cancel', async () => {
    const app = makeApp('principal', 99);
    approvals.get.mockResolvedValueOnce({
      approval: { id: 50, raised_by: 10, status: 'pending' },
      signoffs: [], config: {},
    });
    const res = await request(app)
      .post('/api/approvals/v2/50/cancel')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_PROPOSER');
    expect(approvals.cancel).not.toHaveBeenCalled();
  });

  test('cannot cancel an already-resolved approval', async () => {
    const app = makeApp('pmc_head', 10);
    approvals.get.mockResolvedValueOnce({
      approval: { id: 50, raised_by: 10, status: 'approved' },
      signoffs: [], config: {},
    });
    const res = await request(app)
      .post('/api/approvals/v2/50/cancel')
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_PENDING');
  });

  test('404 when approval not found', async () => {
    const app = makeApp('pmc_head', 10);
    approvals.get.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/approvals/v2/999/cancel')
      .send({});
    expect(res.status).toBe(404);
  });
});

// ── GET /api/approvals/v2/:id ───────────────────────────────────────────────

describe('GET /api/approvals/v2/:id', () => {
  test('returns approval + signoffs + config', async () => {
    const app = makeApp('principal', 11);
    approvals.get.mockResolvedValueOnce({
      approval: { id: 50, status: 'pending', raised_by: 10 },
      signoffs: [{ signer_id: 11, vote: 'approve' }],
      config: { label: 'CN approval', quorum: 1 },
    });
    const res = await request(app).get('/api/approvals/v2/50');
    expect(res.status).toBe(200);
    expect(res.body.approval.id).toBe(50);
    expect(res.body.signoffs).toHaveLength(1);
    expect(res.body.config.label).toBe('CN approval');
  });

  test('404 when not found', async () => {
    const app = makeApp('principal', 11);
    approvals.get.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/approvals/v2/999');
    expect(res.status).toBe(404);
  });
});
