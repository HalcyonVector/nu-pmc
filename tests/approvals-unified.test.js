// tests/approvals-unified.test.js
// ════════════════════════════════════════════════════════════════════════════
// Tests for services/approvals.js — the build-commit lock #7 unified API:
// open / vote / cancel / get / pendingForUser / expireOverdue.
//
// Legacy register/close are covered by the modules that already use them;
// not retested here.
// ════════════════════════════════════════════════════════════════════════════

jest.mock('../middleware/db', () => {
  const m = { query: jest.fn() };
  m.tx = jest.fn((fn) => fn({ query: m.query }));
  return m;
});

const db = require('../middleware/db');
const approvals = require('../services/approvals');

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
});

// ── _getTypeConfig (tested via open/vote behaviour) ──────────────────────────

function configRow(overrides = {}) {
  return {
    approval_type: 'cn_approval',
    signer_roles_json: JSON.stringify(['principal', 'design_principal']),
    quorum: 1,
    scope: 'project',
    requires_vendor_confirm: 0,
    expires_after_hours: 72,
    label: 'CN approval',
    active: 1,
    ...overrides,
  };
}

// ── open() ──────────────────────────────────────────────────────────────────

describe('approvals.open()', () => {
  test('creates a pending approval row and returns the id + expiry', async () => {
    db.query
      // _getTypeConfig
      .mockResolvedValueOnce([[configRow()]])
      // existing-pending check — none
      .mockResolvedValueOnce([[]])
      // INSERT
      .mockResolvedValueOnce([{ insertId: 999 }]);

    const r = await approvals.open({
      approvalType: 'cn_approval', refTable: 'change_notices', refId: 5,
      projectId: 7, raisedBy: 10, raisedByRole: 'pmc_head',
      title: 'CN-001', details: 'change scope on third floor',
    });

    expect(r.id).toBe(999);
    expect(r.alreadyExisted).toBe(false);
    expect(r.expiresAt).toBeInstanceOf(Date);
    // Expiry roughly 72h from now
    const diffH = (r.expiresAt - new Date()) / 3600 / 1000;
    expect(diffH).toBeGreaterThan(71.5);
    expect(diffH).toBeLessThan(72.5);
    // The INSERT was made with status='pending'
    const insertCall = db.query.mock.calls[2];
    expect(insertCall[0]).toMatch(/INSERT INTO approvals/);
    expect(insertCall[0]).toMatch(/'pending'/);
  });

  test('throws when approval_type is unknown', async () => {
    db.query.mockResolvedValueOnce([[]]);  // _getTypeConfig — empty
    await expect(approvals.open({
      approvalType: 'nonsense', refTable: 't', refId: 1,
      raisedBy: 1, raisedByRole: 'pmc_head', title: 'x',
    })).rejects.toMatchObject({ code: 'TYPE_UNKNOWN' });
  });

  test('throws when approval_type is inactive', async () => {
    db.query.mockResolvedValueOnce([[configRow({ active: 0 })]]);
    await expect(approvals.open({
      approvalType: 'cn_approval', refTable: 't', refId: 1,
      raisedBy: 1, raisedByRole: 'pmc_head', title: 'x',
    })).rejects.toMatchObject({ code: 'TYPE_INACTIVE' });
  });

  test('throws when scope=project but projectId missing', async () => {
    db.query.mockResolvedValueOnce([[configRow({ scope: 'project' })]]);
    await expect(approvals.open({
      approvalType: 'cn_approval', refTable: 't', refId: 1,
      raisedBy: 1, raisedByRole: 'pmc_head', title: 'x',
    })).rejects.toMatchObject({ code: 'PROJECT_REQUIRED' });
  });

  test('returns existing id with alreadyExisted=true on duplicate (B17 — idempotent contract)', async () => {
    db.query
      .mockResolvedValueOnce([[configRow()]])
      .mockResolvedValueOnce([[{ id: 88, expires_at: '2026-04-30 12:00:00' }]]);
    const r = await approvals.open({
      approvalType: 'cn_approval', refTable: 'change_notices', refId: 5,
      projectId: 7, raisedBy: 10, raisedByRole: 'pmc_head', title: 'x',
    });
    expect(r.id).toBe(88);
    expect(r.alreadyExisted).toBe(true);
    // expiresAt + config still surface so callers don't have to re-fetch
    expect(r.expiresAt).toBe('2026-04-30 12:00:00');
    expect(r.config).toBeDefined();
  });

  test('global-scope approval does not require projectId', async () => {
    db.query
      .mockResolvedValueOnce([[configRow({ scope: 'global' })]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);
    const r = await approvals.open({
      approvalType: 'vendor_bank_change', refTable: 'vendors', refId: 5,
      raisedBy: 9, raisedByRole: 'finance_admin', title: 'bank change',
    });
    expect(r.id).toBe(1);
  });

  test('null expires_after_hours produces null expiresAt', async () => {
    db.query
      .mockResolvedValueOnce([[configRow({ expires_after_hours: null })]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);
    const r = await approvals.open({
      approvalType: 'cn_approval', refTable: 't', refId: 1, projectId: 7,
      raisedBy: 1, raisedByRole: 'pmc_head', title: 'x',
    });
    expect(r.expiresAt).toBeNull();
  });
});

// ── vote() — single-signer (quorum=1) ────────────────────────────────────────

describe('approvals.vote() — quorum=1', () => {
  test('approve transitions to approved on first vote', async () => {
    db.query
      // SELECT approval FOR UPDATE
      .mockResolvedValueOnce([[{
        id: 50, approval_type: 'cn_approval', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      // _getTypeConfig
      .mockResolvedValueOnce([[configRow({ quorum: 1 })]])
      // project_assignments check
      // INSERT signoff
      .mockResolvedValueOnce([{ insertId: 1 }])
      // _reevaluate: SELECT a + atc JOIN
      .mockResolvedValueOnce([[{
        approval_type: 'cn_approval', status: 'pending', row_version: 1,
        vendor_confirmed_at: null, quorum: 1, requires_vendor_confirm: 0,
      }]])
      // SELECT all votes
      .mockResolvedValueOnce([[{ vote: 'approve' }]])
      // UPDATE approval
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const r = await approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'principal', vote: 'approve',
    });

    expect(r.newStatus).toBe('approved');
    expect(r.quorumProgress).toEqual({ approves: 1, quorum: 1, rejects: 0 });
  });

  test('reject vetoes immediately', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 51, approval_type: 'cn_approval', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      .mockResolvedValueOnce([[configRow()]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      // _reevaluate: SELECT a + atc JOIN
      .mockResolvedValueOnce([[{
        approval_type: 'cn_approval', status: 'pending', row_version: 1,
        vendor_confirmed_at: null, quorum: 1, requires_vendor_confirm: 0,
      }]])
      .mockResolvedValueOnce([[{ vote: 'reject' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const r = await approvals.vote({
      approvalId: 51, signerId: 10, signerRole: 'principal', vote: 'reject',
      comment: 'budget concern',
    });
    expect(r.newStatus).toBe('rejected');
  });
});

// ── vote() — multi-signer (quorum=N) ─────────────────────────────────────────

describe('approvals.vote() — quorum=4 (handover_closure)', () => {
  test('first three approves: still pending', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 60, approval_type: 'handover_closure', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      .mockResolvedValueOnce([[configRow({
        quorum: 4,
        signer_roles_json: JSON.stringify(['principal','design_principal','pmc_head','finance_admin']),
      })]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      // _reevaluate: SELECT a + atc JOIN
      .mockResolvedValueOnce([[{
        approval_type: 'handover_closure', status: 'pending', row_version: 1,
        vendor_confirmed_at: null, quorum: 4, requires_vendor_confirm: 0,
      }]])
      .mockResolvedValueOnce([[{ vote: 'approve' }, { vote: 'approve' }, { vote: 'approve' }]]);
    // No UPDATE — status stays pending
    const r = await approvals.vote({
      approvalId: 60, signerId: 10, signerRole: 'principal', vote: 'approve',
    });
    expect(r.newStatus).toBe('pending');
    expect(r.quorumProgress.approves).toBe(3);
  });

  test('fourth approve flips to approved', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 60, approval_type: 'handover_closure', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 3,
      }]])
      .mockResolvedValueOnce([[configRow({
        quorum: 4,
        signer_roles_json: JSON.stringify(['principal','design_principal','pmc_head','finance_admin']),
      })]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      // _reevaluate: SELECT a + atc JOIN
      .mockResolvedValueOnce([[{
        approval_type: 'handover_closure', status: 'pending', row_version: 3,
        vendor_confirmed_at: null, quorum: 4, requires_vendor_confirm: 0,
      }]])
      .mockResolvedValueOnce([[
        { vote: 'approve' }, { vote: 'approve' }, { vote: 'approve' }, { vote: 'approve' },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);   // UPDATE
    const r = await approvals.vote({
      approvalId: 60, signerId: 11, signerRole: 'finance_admin', vote: 'approve',
    });
    expect(r.newStatus).toBe('approved');
    expect(r.quorumProgress.approves).toBe(4);
  });

  test('one reject vetoes even mid-quorum', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 60, approval_type: 'handover_closure', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 2,
      }]])
      .mockResolvedValueOnce([[configRow({
        quorum: 4,
        signer_roles_json: JSON.stringify(['principal','design_principal','pmc_head','finance_admin']),
      })]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      // _reevaluate: SELECT a + atc JOIN
      .mockResolvedValueOnce([[{
        approval_type: 'handover_closure', status: 'pending', row_version: 2,
        vendor_confirmed_at: null, quorum: 4, requires_vendor_confirm: 0,
      }]])
      .mockResolvedValueOnce([[
        { vote: 'approve' }, { vote: 'approve' }, { vote: 'reject' },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const r = await approvals.vote({
      approvalId: 60, signerId: 11, signerRole: 'finance_admin', vote: 'reject',
    });
    expect(r.newStatus).toBe('rejected');
    expect(r.quorumProgress.rejects).toBe(1);
  });
});

// ── vote() guards ────────────────────────────────────────────────────────────

describe('approvals.vote() — guards', () => {
  test('rejects vote when approval is not pending', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 50, approval_type: 'cn_approval', project_id: 7,
      raised_by: 99, status: 'approved', row_version: 2,
    }]]);
    await expect(approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'principal', vote: 'approve',
    })).rejects.toMatchObject({ code: 'NOT_PENDING', status: 409 });
  });

  test('rejects self-vote (proposer cannot sign own approval)', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 50, approval_type: 'cn_approval', project_id: 7,
      raised_by: 10, status: 'pending', row_version: 1,
    }]]);
    await expect(approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'pmc_head', vote: 'approve',
    })).rejects.toMatchObject({ code: 'SELF_VOTE', status: 403 });
  });

  test('rejects when role is not in signer_roles_json', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 50, approval_type: 'cn_approval', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      .mockResolvedValueOnce([[configRow()]]);
    await expect(approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'site_manager', vote: 'approve',
    })).rejects.toMatchObject({ code: 'ROLE_NOT_PERMITTED' });
  });

  test('rejects project-scoped vote when signer not on project (and not firm-wide)', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 50, approval_type: 'cn_approval', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      .mockResolvedValueOnce([[configRow({
        signer_roles_json: JSON.stringify(['site_manager']),
      })]])
      // project_assignments — empty (signer not assigned)
      .mockResolvedValueOnce([[]]);
    await expect(approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'site_manager', vote: 'approve',
    })).rejects.toMatchObject({ code: 'NOT_ON_PROJECT' });
  });

  test('firm-wide role (principal) bypasses project_assignments check', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 50, approval_type: 'cn_approval', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      .mockResolvedValueOnce([[configRow()]])
      // principal is firm-wide → no project_assignments query, INSERT next
      .mockResolvedValueOnce([{ insertId: 1 }])
      // _reevaluate: SELECT a + atc JOIN
      .mockResolvedValueOnce([[{
        approval_type: 'cn_approval', status: 'pending', row_version: 1,
        vendor_confirmed_at: null, quorum: 1, requires_vendor_confirm: 0,
      }]])
      .mockResolvedValueOnce([[{ vote: 'approve' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const r = await approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'principal', vote: 'approve',
    });
    expect(r.newStatus).toBe('approved');
  });

  test('firm-wide pmc_head bypasses project_assignments check', async () => {
    // The bug this catches: an earlier draft hard-coded FIRM_WIDE to just
    // ['principal','design_principal']. pmc_head/finance_admin would have
    // been blocked from project-scoped approvals — breaking schedule_change,
    // vendor_payment, claim_invoice, budget_cost_head, handover_closure for
    // those roles. Use the canonical PROJECT_SCOPED_ROLES complement instead.
    db.query
      .mockResolvedValueOnce([[{
        id: 50, approval_type: 'schedule_change', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      .mockResolvedValueOnce([[configRow({
        signer_roles_json: JSON.stringify(['pmc_head','principal']),
      })]])
      // pmc_head is firm-wide → NO project_assignments query, straight to INSERT
      .mockResolvedValueOnce([{ insertId: 1 }])
      // _reevaluate: SELECT a + atc JOIN
      .mockResolvedValueOnce([[{
        approval_type: 'schedule_change', status: 'pending', row_version: 1,
        vendor_confirmed_at: null, quorum: 1, requires_vendor_confirm: 0,
      }]])
      .mockResolvedValueOnce([[{ vote: 'approve' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const r = await approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'pmc_head', vote: 'approve',
    });
    expect(r.newStatus).toBe('approved');
  });

  test('site_manager (project-scoped) blocked when not on project', async () => {
    // site_manager IS in PROJECT_SCOPED_ROLES — must be in project_assignments.
    db.query
      .mockResolvedValueOnce([[{
        id: 50, approval_type: 'schedule_change', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      .mockResolvedValueOnce([[configRow({
        signer_roles_json: JSON.stringify(['site_manager','principal']),
      })]])
      // project_assignments — empty
      .mockResolvedValueOnce([[]]);
    await expect(approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'site_manager', vote: 'approve',
    })).rejects.toMatchObject({ code: 'NOT_ON_PROJECT' });
  });

  test('rejects double-vote via UNIQUE constraint', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 50, approval_type: 'cn_approval', project_id: 7,
        raised_by: 99, status: 'pending', row_version: 1,
      }]])
      .mockResolvedValueOnce([[configRow()]])
    // INSERT signoff throws ER_DUP_ENTRY
    const dupErr = new Error("Duplicate entry '50-10' for key 'uq_approval_signer'");
    dupErr.code = 'ER_DUP_ENTRY';
    db.query.mockRejectedValueOnce(dupErr);

    await expect(approvals.vote({
      approvalId: 50, signerId: 10, signerRole: 'principal', vote: 'approve',
    })).rejects.toMatchObject({ code: 'ALREADY_VOTED', status: 409 });
  });
});

// ── cancel() ─────────────────────────────────────────────────────────────────

describe('approvals.cancel()', () => {
  test('cancels a pending approval', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const r = await approvals.cancel({ approvalId: 50, cancelledBy: 9, reason: 'duplicate' });
    expect(r.cancelled).toBe(true);
    expect(db.query.mock.calls[0][0]).toMatch(/SET status = 'cancelled'/);
  });
  test('no-op on already-resolved approval', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const r = await approvals.cancel({ approvalId: 50, cancelledBy: 9 });
    expect(r.cancelled).toBe(false);
  });
});

// ── get() ────────────────────────────────────────────────────────────────────

describe('approvals.get()', () => {
  test('returns approval + signoffs + config', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 50, approval_type: 'cn_approval',
        ref_table: 'change_notices', ref_id: 5,
        project_id: 7, raised_by: 10, raised_by_role: 'pmc_head',
        raised_by_name: 'Pia', raised_at: new Date('2026-04-01'),
        title: 'CN-001', details: null, status: 'pending',
        resolved_at: null, resolved_by: null, resolution_note: null,
        expires_at: null, vendor_id: null, vendor_confirmed_at: null,
        row_version: 1,
        label: 'CN approval', quorum: 1, scope: 'project',
        signer_roles_json: JSON.stringify(['principal','design_principal']),
        requires_vendor_confirm: 0, expires_after_hours: 72,
      }]])
      .mockResolvedValueOnce([[
        { id: 1, approval_id: 50, signer_id: 11, signer_role: 'principal',
          vote: 'approve', comment: null, voted_at: new Date() },
      ]])
      // getUsers hydration (raised_by=10, signer_id=11)
      .mockResolvedValueOnce([[
        { id: 10, full_name: 'Pia', role: 'pmc_head' },
        { id: 11, full_name: 'Principal', role: 'principal' },
      ]]);

    const r = await approvals.get(50);
    expect(r.approval.id).toBe(50);
    expect(r.signoffs).toHaveLength(1);
    expect(r.signoffs[0].signer_name).toBe('Principal');
    expect(r.config.quorum).toBe(1);
    expect(r.config.signer_roles).toEqual(['principal','design_principal']);
  });

  test('returns null when approval not found', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await approvals.get(999);
    expect(r).toBeNull();
  });
});

// ── pendingForUser() ─────────────────────────────────────────────────────────

describe('approvals.pendingForUser()', () => {
  test('filters out: own proposals, role mismatches, projects user is not on', async () => {
    db.query
      // Pending approvals join. Test as site_manager (a project-scoped role).
      .mockResolvedValueOnce([[
        // user's own — should be filtered out
        { id: 10, approval_type: 'cn_approval', ref_table: 't', ref_id: 1,
          project_id: 7, raised_by: 99, raised_by_role: 'site_manager',
          raised_by_name: 'Self', title: 'self', expires_at: null,
          quorum: 1, scope: 'project',
          signer_roles_json: JSON.stringify(['site_manager','principal']) },
        // role mismatch — site_manager not in signer list
        { id: 11, approval_type: 'cn_approval', ref_table: 't', ref_id: 2,
          project_id: 7, raised_by: 50, raised_by_role: 'pmc_head',
          raised_by_name: 'X', title: 't2', expires_at: null,
          quorum: 1, scope: 'project',
          signer_roles_json: JSON.stringify(['principal','design_principal']) },
        // project mismatch — site_manager IS project-scoped, not on project 99
        { id: 12, approval_type: 'schedule_change', ref_table: 't', ref_id: 3,
          project_id: 99, raised_by: 50, raised_by_role: 'pmc_head',
          raised_by_name: 'X', title: 't3', expires_at: null,
          quorum: 1, scope: 'project',
          signer_roles_json: JSON.stringify(['site_manager','principal']) },
        // ELIGIBLE: site_manager, on project 7, not own, eligible role
        { id: 13, approval_type: 'schedule_change', ref_table: 't', ref_id: 4,
          project_id: 7, raised_by: 50, raised_by_role: 'principal',
          raised_by_name: 'X', title: 't4', expires_at: null,
          quorum: 1, scope: 'project',
          signer_roles_json: JSON.stringify(['site_manager','principal']) },
      ]])
      // getUsers hydration for raised_by names
      .mockResolvedValueOnce([[{ id: 50, full_name: 'X', role: 'pmc_head' }]])
      // SELECT votes — user has not voted on any of the survivors
      .mockResolvedValueOnce([[]]);

    const r = await approvals.pendingForUser({
      userId: 99, role: 'site_manager', projectIds: [7],
    });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(13);
  });

  test('filters out approvals user has already voted on', async () => {
    db.query
      .mockResolvedValueOnce([[
        { id: 13, approval_type: 'schedule_change', ref_table: 't', ref_id: 4,
          project_id: 7, raised_by: 50, raised_by_role: 'principal',
          raised_by_name: 'X', title: 't4', expires_at: null,
          quorum: 1, scope: 'project',
          signer_roles_json: JSON.stringify(['pmc_head','principal']) },
      ]])
      // getUsers hydration for raised_by names
      .mockResolvedValueOnce([[{ id: 50, full_name: 'X', role: 'principal' }]])
      // user already voted on 13
      .mockResolvedValueOnce([[{ approval_id: 13 }]]);

    const r = await approvals.pendingForUser({
      userId: 99, role: 'pmc_head', projectIds: [7],
    });
    expect(r).toHaveLength(0);
  });

  test('firm-wide role sees project approvals across projects they are not on', async () => {
    db.query
      .mockResolvedValueOnce([[
        { id: 13, approval_type: 'cn_approval', ref_table: 't', ref_id: 4,
          project_id: 99, raised_by: 50, raised_by_role: 'pmc_head',
          raised_by_name: 'X', title: 't4', expires_at: null,
          quorum: 1, scope: 'project',
          signer_roles_json: JSON.stringify(['principal','design_principal']) },
      ]])
      // getUsers hydration
      .mockResolvedValueOnce([[{ id: 50, full_name: 'X', role: 'pmc_head' }]])
      .mockResolvedValueOnce([[]]);
    const r = await approvals.pendingForUser({
      userId: 99, role: 'principal', projectIds: [],
    });
    expect(r).toHaveLength(1);
  });

  test('firm-wide pmc_head also sees project approvals across all projects', async () => {
    // pmc_head is NOT in PROJECT_SCOPED_ROLES → firm-wide. Sees project-scoped
    // approvals on projects they aren't assigned to. Critical for schedule_change,
    // vendor_payment, claim_invoice etc. that legitimately route to pmc_head
    // across the whole portfolio.
    db.query
      .mockResolvedValueOnce([[
        { id: 14, approval_type: 'schedule_change', ref_table: 'sv', ref_id: 4,
          project_id: 42, raised_by: 50, raised_by_role: 'principal',
          raised_by_name: 'X', title: 'sched', expires_at: null,
          quorum: 1, scope: 'project',
          signer_roles_json: JSON.stringify(['pmc_head','principal']) },
      ]])
      // getUsers hydration
      .mockResolvedValueOnce([[{ id: 50, full_name: 'X', role: 'principal' }]])
      .mockResolvedValueOnce([[]]);
    const r = await approvals.pendingForUser({
      userId: 99, role: 'pmc_head', projectIds: [],
    });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(14);
  });

  test('site_manager (project-scoped) does NOT see approvals on projects not assigned', async () => {
    db.query
      .mockResolvedValueOnce([[
        { id: 14, approval_type: 'schedule_change', ref_table: 'sv', ref_id: 4,
          project_id: 42, raised_by: 50, raised_by_role: 'principal',
          raised_by_name: 'X', title: 'sched', expires_at: null,
          quorum: 1, scope: 'project',
          signer_roles_json: JSON.stringify(['site_manager','principal']) },
      ]])
      // getUsers hydration
      .mockResolvedValueOnce([[{ id: 50, full_name: 'X', role: 'principal' }]])
      .mockResolvedValueOnce([[]]);
    const r = await approvals.pendingForUser({
      userId: 99, role: 'site_manager', projectIds: [7],  // not on project 42
    });
    expect(r).toHaveLength(0);
  });

  test('global-scope approval visible regardless of project membership', async () => {
    db.query
      .mockResolvedValueOnce([[
        { id: 14, approval_type: 'vendor_bank_change', ref_table: 'vendors', ref_id: 5,
          project_id: null, raised_by: 50, raised_by_role: 'finance_admin',
          raised_by_name: 'X', title: 'bank change', expires_at: null,
          quorum: 1, scope: 'global',
          signer_roles_json: JSON.stringify(['principal','design_principal','finance_admin']) },
      ]])
      // getUsers hydration
      .mockResolvedValueOnce([[{ id: 50, full_name: 'X', role: 'finance_admin' }]])
      .mockResolvedValueOnce([[]]);
    const r = await approvals.pendingForUser({
      userId: 99, role: 'principal', projectIds: [],
    });
    expect(r).toHaveLength(1);
  });
});

// ── expireOverdue() ─────────────────────────────────────────────────────────

describe('approvals.expireOverdue()', () => {
  test('returns {expired:0, notified:0} when no candidates match', async () => {
    db.query.mockResolvedValueOnce([[]]);   // SELECT → no rows
    const r = await approvals.expireOverdue();
    expect(r.expired).toBe(0);
    expect(r.notified).toBe(0);
  });

  test('expires each candidate row + notifies its proposer', async () => {
    // Mock notifications module — must be set up via jest.mock at top-of-file
    // but for this test we let the real notifyApprovalExpired run; it routes
    // through services/messaging which itself uses db.query. Instead we just
    // assert the SELECT + per-row UPDATEs happen.
    db.query
      .mockResolvedValueOnce([[
        { id: 91, raised_by: 5, title: 'CN-091 — extra scope', label: 'Change Notice approval' },
        { id: 92, raised_by: 6, title: 'CN-092',               label: 'Change Notice approval' },
      ]])
      // First UPDATE: 1 row affected
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // Notification path — services/messaging looks up the user
      .mockResolvedValue([[{ id: 5, full_name: 'Alice', phone: null,
        role: 'pmc_head', matrix_user_id: null, notification_channel: 'whatsapp',
        whatsapp_notifications: 0, is_active: 1 }]]);

    const r = await approvals.expireOverdue();
    expect(r.expired).toBe(2);
    // Confirm first call was the SELECT for candidates
    const sql0 = db.query.mock.calls[0][0];
    expect(sql0).toMatch(/SELECT[\s\S]+a\.id, a\.raised_by, a\.title/);
    expect(sql0).toMatch(/expires_at < NOW\(\)/);
    // Confirm a per-row UPDATE happened
    const updateCalls = db.query.mock.calls.filter(c => /UPDATE approvals/.test(c[0]));
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    // Each per-row UPDATE filters on id AND status='pending' (race-safe)
    expect(updateCalls[0][0]).toMatch(/WHERE id = \? AND status = 'pending'/);
  });

  test('skips notification + counts when raced (UPDATE affects 0 rows)', async () => {
    db.query
      .mockResolvedValueOnce([[
        { id: 93, raised_by: 7, title: 'CN-093', label: 'Change Notice approval' },
      ]])
      // UPDATE returns 0 — concurrent vote() already resolved this approval
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const r = await approvals.expireOverdue();
    expect(r.expired).toBe(0);
    expect(r.notified).toBe(0);
  });
});
