// tests/signoff-gate.test.js
// ============================================================
// Tests for services/signoff-gate.js — the abstracted sign-off gate
// per nu-pmc-signoff-delta-brief.docx (1 May 2026).
//
// Covered:
//   - One predicate registry, one action registry — no per-workflow
//     hardcoded if/else
//   - buildSequence applies rules in priority order
//   - triggerSignoff inserts an instance and sends a poll to the first
//     approver only (relay, not broadcast)
//   - triggerNextRelayStep advances on each vote and closes on last
//   - Approver resolution dispatches via APPROVER_RESOLVERS map (no
//     hardcoded role-name conditionals)
// ============================================================

'use strict';

jest.mock('../middleware/db', () => ({
  query: jest.fn(),
}));

jest.mock('../services/matrix-adapter', () => ({
  sendPoll:           jest.fn(),
  sendText:           jest.fn(),
  uploadMedia:        jest.fn(),
  sendImage:          jest.fn(),
  getProjectRoomId:   jest.fn(),
  getInternalRoomId:  jest.fn(),
}));

const db    = require('../middleware/db');
const adapter = require('../services/matrix-adapter');
const gate  = require('../services/signoff-gate');

beforeEach(() => {
  db.query.mockReset();
  adapter.sendPoll.mockReset();
  adapter.sendText.mockReset();
  adapter.uploadMedia.mockReset();
  adapter.sendImage.mockReset();
  adapter.getProjectRoomId.mockReset();
  adapter.getInternalRoomId.mockReset();
  adapter.sendPoll.mockResolvedValue({ eventId: '$poll1:s' });
  adapter.sendText.mockResolvedValue({ eventId: '$txt:s' });
  adapter.uploadMedia.mockResolvedValue('mxc://server/abc123');
  adapter.sendImage.mockResolvedValue({ eventId: '$img:s' });
  adapter.getProjectRoomId.mockResolvedValue('!project_room:s');
  adapter.getInternalRoomId.mockResolvedValue('!org_room:s');
});

// ── Registry shape — no hardcoded paths ─────────────────────────────

describe('signoff-gate — abstraction discipline', () => {
  test('PREDICATES is a single registry, not per-workflow if/else', () => {
    // The registry contains the named predicates. New rules use these
    // names. New predicates require ONE entry, not a workflow-specific
    // function.
    expect(typeof gate.PREDICATES).toBe('object');
    expect(typeof gate.PREDICATES.always).toBe('function');
    expect(typeof gate.PREDICATES.is_emergency).toBe('function');
    expect(typeof gate.PREDICATES.below_threshold).toBe('function');
    expect(typeof gate.PREDICATES.no_snags).toBe('function');
    expect(typeof gate.PREDICATES.settlement_pending).toBe('function');
  });

  test('ACTIONS is a single registry', () => {
    expect(typeof gate.ACTIONS.skip_role).toBe('function');
    expect(typeof gate.ACTIONS.append_role).toBe('function');
    expect(typeof gate.ACTIONS.strip_initiator).toBe('function');
  });

  test('APPROVER_RESOLVERS is a single registry — no hardcoded role conditionals', () => {
    // Every role token in any seeded sequence must have an entry. Each
    // entry names a strategy (defined in _STRATEGIES); a third-party
    // reading the file should be able to spot the entire role surface
    // in one place.
    const expectedRoles = [
      'recipient', 'client_rep', 'naveen',
      'pmc', 'pmc_head', 'site_manager',
      'principal', 'design_principal', 'design_lead',
      'services_head', 'finance', 'finance_admin',
    ];
    for (const r of expectedRoles) {
      const entry = gate.APPROVER_RESOLVERS[r];
      expect(entry).toBeDefined();
      expect(typeof entry.strategy).toBe('string');
    }
  });
});

// ── buildSequence ───────────────────────────────────────────────────

describe('buildSequence', () => {
  test('applies rules in priority order; skip_role removes a role', async () => {
    const workflow = {
      workflow_type: 'change_notice',
      sequence: 'site_manager,pmc,design_lead,principal',
      principal_threshold_pct: 1.00,
    };

    // Mock chain:
    //  1. SELECT rules → returns the strip_initiator + is_emergency + below_threshold + external rules
    //  2. is_emergency predicate uses documentRow only → no DB call
    //  3. below_threshold predicate → SELECT contract_value
    //  4. external_origin → no DB call
    //  5. resolveApprover for each surviving role → 1 DB call per role

    db.query
      // Rules query
      .mockResolvedValueOnce([[
        { id: 1, priority: 10, predicate_name: 'always',           action_name: 'strip_initiator', role_token: null },
        { id: 2, priority: 20, predicate_name: 'is_emergency',     action_name: 'skip_role',       role_token: 'design_lead' },
        { id: 3, priority: 30, predicate_name: 'below_threshold',  action_name: 'skip_role',       role_token: 'principal' },
        { id: 4, priority: 90, predicate_name: 'external_origin',  action_name: 'append_role',     role_token: 'client_rep' },
      ]])
      // below_threshold predicate: SELECT contract_value
      .mockResolvedValueOnce([[{ contract_value: 10000000 }]])
      // resolveApprover('pmc') — project-scoped
      .mockResolvedValueOnce([[{ id: 11, full_name: 'PMC Head', role: 'pmc_head', matrix_room_id: '!pmc:s', matrix_user_id: '@pmc:s', phone: '111' }]]);

    const ctx = {
      documentRow: {
        id: 1, raised_by: 5, source: 'site',
        is_emergency: true,           // → skip design_lead
        cn_origin: 'internal',        // → no client_rep append
        estimated_value: 50_000,      // 0.5% of 10M → below 1% threshold → skip principal
      },
    };

    const out = await gate.buildSequence(workflow, 100, ctx);

    // After applying rules:
    //   strip_initiator → 'site' source = site_manager → strip → [pmc, design_lead, principal]
    //   is_emergency → skip design_lead → [pmc, principal]
    //   below_threshold (true: 0.5 < 1.00) → skip principal → [pmc]
    //   external_origin (false) → no-op
    expect(out.roles).toEqual(['pmc']);
    expect(out.approvers.length).toBe(1);
    expect(out.approvers[0].id).toBe(11);
  });

  test('strip_initiator no-op when initiator role not in sequence', async () => {
    const workflow = {
      workflow_type: 'change_notice',
      sequence: 'pmc,design_lead,principal',
    };
    db.query
      .mockResolvedValueOnce([[
        { id: 1, priority: 10, predicate_name: 'always', action_name: 'strip_initiator', role_token: null },
      ]])
      // resolvers
      .mockResolvedValueOnce([[{ id: 1, role: 'pmc_head', matrix_room_id: '!a:s' }]])
      .mockResolvedValueOnce([[{ id: 2, role: 'design_head', matrix_room_id: '!b:s' }]])
      .mockResolvedValueOnce([[{ id: 3, role: 'principal',  matrix_room_id: '!c:s' }]]);

    const ctx = {
      documentRow: { id: 1, raised_by: 99, source: 'client' /* client_rep — not in seq */ },
    };
    const out = await gate.buildSequence(workflow, 1, ctx);
    expect(out.roles).toEqual(['pmc', 'design_lead', 'principal']);
  });

  test('throws when sequence becomes empty after rules', async () => {
    const workflow = {
      workflow_type: 'tiny',
      sequence: 'pmc',
    };
    db.query.mockResolvedValueOnce([[
      { id: 1, priority: 10, predicate_name: 'always', action_name: 'skip_role', role_token: 'pmc' },
    ]]);
    await expect(gate.buildSequence(workflow, 1, { documentRow: {} }))
      .rejects.toThrow(/empty/);
  });

  test('throws when role token has no resolver', async () => {
    const workflow = { workflow_type: 'x', sequence: 'martian_overlord' };
    db.query.mockResolvedValueOnce([[]]);   // no rules
    await expect(gate.buildSequence(workflow, 1, {})).rejects.toThrow(/unknown role token/);
  });

  test('throws when predicate name unknown', async () => {
    const workflow = { workflow_type: 'x', sequence: 'pmc' };
    db.query.mockResolvedValueOnce([[
      { id: 1, priority: 10, predicate_name: 'do_a_barrel_roll', action_name: 'skip_role', role_token: 'pmc' },
    ]]);
    await expect(gate.buildSequence(workflow, 1, { documentRow: {} }))
      .rejects.toThrow(/unknown predicate/);
  });
});

// ── triggerSignoff ──────────────────────────────────────────────────

describe('triggerSignoff', () => {
  test('inserts instance, sends poll to first approver only (not broadcast)', async () => {
    db.query
      // workflow lookup
      .mockResolvedValueOnce([[{
        id: 1, workflow_type: 'weekly_report',
        sequence: 'pmc,principal',
        signoff_type: 'poll', closing_minutes: null,
        quorum_required: 2, principal_threshold_pct: null,
      }]])
      // rules: empty
      .mockResolvedValueOnce([[]])
      // resolveApprover('pmc')
      .mockResolvedValueOnce([[{ id: 11, full_name: 'PMC', role: 'pmc_head', matrix_room_id: '!pmc:s' }]])
      // resolveApprover('principal')
      .mockResolvedValueOnce([[{ id: 22, full_name: 'Naveen', role: 'principal', matrix_room_id: '!nav:s' }]])
      // cancel prior pending
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      // INSERT signoff_instances
      .mockResolvedValueOnce([{ insertId: 7 }])
      // UPDATE poll_event_id
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await gate.triggerSignoff('weekly_report', 100, 5);

    expect(out.instanceId).toBe(7);
    expect(out.pollEventId).toBe('$poll1:s');
    expect(out.sequence).toEqual(['pmc', 'principal']);

    // Critical: sendPoll called ONCE (to PMC's room), not broadcast
    // to both PMC + Principal. That's the relay invariant.
    expect(adapter.sendPoll).toHaveBeenCalledTimes(1);
    expect(adapter.sendPoll.mock.calls[0][0].roomId).toBe('!pmc:s');
  });

  test('cancels any prior in-progress instance for same (workflow_type, document_id)', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 1, workflow_type: 'grn_approval',
        sequence: 'pmc',
        closing_minutes: 120, quorum_required: 1, principal_threshold_pct: null,
      }]])
      .mockResolvedValueOnce([[]])    // rules
      .mockResolvedValueOnce([[{ id: 11, role: 'pmc_head', matrix_room_id: '!pmc:s' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])    // cancel prior — this is the key check
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await gate.triggerSignoff('grn_approval', 42, 1);

    // Find the cancel-prior call.
    const cancelCall = db.query.mock.calls.find(c =>
      /UPDATE signoff_instances[\s\S]*'cancelled'/.test(c[0])
    );
    expect(cancelCall).toBeTruthy();
    // The WHERE must filter by (workflow_type, document_id) AND status
    // in pending/in_progress — otherwise cancel-prior could miss live
    // rows or wipe terminal ones.
    expect(cancelCall[0]).toMatch(/workflow_type = \?/);
    expect(cancelCall[0]).toMatch(/document_id = \?/);
    expect(cancelCall[0]).toMatch(/status IN \('pending','in_progress'\)/);
    expect(cancelCall[1]).toEqual(['grn_approval', 42]);
  });

  test('time-based workflow: closes_at set; quorum-based: NULL', async () => {
    db.query
      .mockResolvedValueOnce([[{
        workflow_type: 'daily_report',
        sequence: 'pmc',
        closing_minutes: 120,    // time-based
        quorum_required: 1,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 1, role: 'pmc_head', matrix_room_id: '!r:s' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await gate.triggerSignoff('daily_report', 1, 1);

    const insertCall = db.query.mock.calls.find(c =>
      /INSERT INTO signoff_instances/.test(c[0])
    );
    // closes_at is the 9th param (index 8) — should be a Date, not null
    expect(insertCall[1][8]).toBeInstanceOf(Date);
  });

  test('throws on unknown workflow_type', async () => {
    db.query.mockResolvedValueOnce([[]]);   // no workflow row
    await expect(gate.triggerSignoff('not_a_workflow', 1, 1))
      .rejects.toThrow(/not found/);
  });

  test('approver with no matrix_room_id: instance still created, pollEventId null', async () => {
    db.query
      .mockResolvedValueOnce([[{
        workflow_type: 'mom_acknowledgement',
        sequence: 'recipient',
        closing_minutes: 1440, quorum_required: 1,
      }]])
      .mockResolvedValueOnce([[]])
      // recipient resolver: looks up user by id from documentRow.raised_by
      .mockResolvedValueOnce([[{ id: 99, full_name: 'Rec', role: 'site_manager', matrix_room_id: null, phone: '111' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 5 }]);

    const out = await gate.triggerSignoff('mom_acknowledgement', 1, 1, {
      documentRow: { raised_by: 99 },
    });

    expect(out.instanceId).toBe(5);
    expect(out.pollEventId).toBeNull();
    expect(adapter.sendPoll).not.toHaveBeenCalled();
  });

  test('attachImage: uploads + sends image BEFORE poll (so it sits above)', async () => {
    db.query
      .mockResolvedValueOnce([[{
        workflow_type: 'drawing_approval',
        sequence: 'design_lead',
        closing_minutes: 1440, quorum_required: 1,
      }]])
      .mockResolvedValueOnce([[]])    // rules
      .mockResolvedValueOnce([[{ id: 50, role: 'design_head', matrix_room_id: '!d:s' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await gate.triggerSignoff('drawing_approval', 99, 1, {
      attachImage: '/tmp/thumb.jpg',
      attachMime:  'image/jpeg',
    });

    expect(adapter.uploadMedia).toHaveBeenCalledWith('/tmp/thumb.jpg', 'image/jpeg');
    expect(adapter.sendImage).toHaveBeenCalledTimes(1);
    expect(adapter.sendImage.mock.calls[0][0].roomId).toBe('!d:s');
    expect(adapter.sendImage.mock.calls[0][0].mxcUrl).toBe('mxc://server/abc123');

    // The image went BEFORE the poll. We can verify by call order.
    const imageCallOrder = adapter.sendImage.mock.invocationCallOrder[0];
    const pollCallOrder  = adapter.sendPoll.mock.invocationCallOrder[0];
    expect(imageCallOrder).toBeLessThan(pollCallOrder);
  });

  test('attachImage failure does not block the poll', async () => {
    adapter.uploadMedia.mockRejectedValueOnce(new Error('upload broken'));

    db.query
      .mockResolvedValueOnce([[{
        workflow_type: 'drawing_approval',
        sequence: 'design_lead',
        closing_minutes: 1440, quorum_required: 1,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 50, role: 'design_head', matrix_room_id: '!d:s' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await gate.triggerSignoff('drawing_approval', 99, 1, {
      attachImage: '/tmp/thumb.jpg',
    });

    expect(out.pollEventId).toBe('$poll1:s');   // poll still fired
    expect(adapter.sendImage).not.toHaveBeenCalled();   // image skipped
  });

  test('no attachImage = no upload/sendImage calls', async () => {
    db.query
      .mockResolvedValueOnce([[{
        workflow_type: 'grn_approval',
        sequence: 'pmc',
        closing_minutes: 120, quorum_required: 1,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 1, role: 'pmc_head', matrix_room_id: '!r:s' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await gate.triggerSignoff('grn_approval', 1, 1);

    expect(adapter.uploadMedia).not.toHaveBeenCalled();
    expect(adapter.sendImage).not.toHaveBeenCalled();
  });
});

// ── triggerNextRelayStep ────────────────────────────────────────────

describe('triggerNextRelayStep', () => {
  test('advances to next approver, sends poll, updates remaining_approvers', async () => {
    db.query
      // SELECT instance
      .mockResolvedValueOnce([[{
        id: 7, status: 'in_progress', workflow_id: 1, project_id: 5,
        remaining_approvers: '[22, 33]',
        question: 'CN-1 — approve?',
        options: '[{"id":"yes","text":"✅"},{"id":"no","text":"❌"}]',
      }]])
      // _userById(22) — next approver
      .mockResolvedValueOnce([[{ id: 22, full_name: 'P', role: 'principal', matrix_room_id: '!p:s' }]])
      // SELECT workflow row (destination_kind/qualifier)
      .mockResolvedValueOnce([[{
        id: 1, workflow_type: 'change_notice',
        destination_kind: 'personal', destination_qualifier: null,
      }]])
      // UPDATE
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await gate.triggerNextRelayStep(7);

    expect(out.advanced).toBe(true);
    expect(out.completed).toBe(false);
    expect(out.nextApproverId).toBe(22);

    // Poll sent to next approver's room (personal destination → approver's matrix_room_id)
    expect(adapter.sendPoll).toHaveBeenCalledTimes(1);
    expect(adapter.sendPoll.mock.calls[0][0].roomId).toBe('!p:s');

    // UPDATE wrote new remaining_approvers (without the 22 we just advanced to)
    const updCall = db.query.mock.calls.find(c =>
      /UPDATE signoff_instances/.test(c[0])
    );
    expect(updCall[1]).toContain('[33]');
  });

  test('marks completed when remaining_approvers is empty', async () => {
    db.query
      // SELECT instance
      .mockResolvedValueOnce([[{
        id: 7, status: 'in_progress',
        workflow_type: 'weekly_report',  // no hooks for this type
        document_id: 1,
        remaining_approvers: '[]',
      }]])
      // UPDATE completed/approved
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // Re-fetch for hook firing
      .mockResolvedValueOnce([[{
        id: 7, status: 'completed', result: 'approved',
        workflow_type: 'weekly_report', document_id: 1,
      }]]);

    const out = await gate.triggerNextRelayStep(7);

    expect(out.advanced).toBe(false);
    expect(out.completed).toBe(true);
    expect(adapter.sendPoll).not.toHaveBeenCalled();

    // The UPDATE marked status='completed' result='approved'
    const updCall = db.query.mock.calls.find(c =>
      /UPDATE signoff_instances/.test(c[0])
    );
    expect(updCall[0]).toMatch(/status = 'completed'/);
    expect(updCall[0]).toMatch(/result = 'approved'/);
  });

  test('non-existent instance throws', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await expect(gate.triggerNextRelayStep(999)).rejects.toThrow(/not found/);
  });

  test('terminal-status instance is no-op', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 7, status: 'completed', remaining_approvers: '[]',
    }]]);
    const out = await gate.triggerNextRelayStep(7);
    expect(out.advanced).toBe(false);
    expect(out.completed).toBe(true);
    // No additional DB writes.
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

// ── markRejected ────────────────────────────────────────────────────

describe('markRejected', () => {
  test('UPDATEs status=completed result=rejected and re-fetches for hooks', async () => {
    db.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])    // UPDATE
      .mockResolvedValueOnce([[{                       // re-fetch for hooks
        id: 11, status: 'completed', result: 'rejected',
        workflow_type: 'weekly_report', document_id: 5,
      }]]);

    const out = await gate.markRejected(11);
    expect(out.terminal).toBe(true);

    const upd = db.query.mock.calls[0];
    expect(upd[0]).toMatch(/UPDATE signoff_instances/);
    expect(upd[0]).toMatch(/status = 'completed'/);
    expect(upd[0]).toMatch(/result = 'rejected'/);
    expect(upd[0]).toMatch(/status = 'in_progress'/); // guard
    expect(upd[1]).toEqual([11]);
  });

  test('idempotent — second call on already-terminal row is a no-op', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);   // UPDATE matched nothing
    const out = await gate.markRejected(11);
    expect(out.terminal).toBe(false);
    // Should NOT have made the re-fetch call.
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

// ── POST_COMPLETION_HOOKS ──────────────────────────────────────────

describe('POST_COMPLETION_HOOKS', () => {
  test('change_notice has an emergency-design-ratification hook', () => {
    expect(Array.isArray(gate.POST_COMPLETION_HOOKS.change_notice)).toBe(true);
    expect(gate.POST_COMPLETION_HOOKS.change_notice.length).toBeGreaterThan(0);
  });

  test('emergencyDesignRatification: only fires for approved emergency CNs', async () => {
    const hook = gate.POST_COMPLETION_HOOKS.change_notice[0];

    // Not approved — does nothing (no DB calls).
    db.query.mockClear();
    await hook({ id: 1, document_id: 7, project_id: 3,
                 result: 'rejected', workflow_type: 'change_notice' });
    expect(db.query).not.toHaveBeenCalled();

    // Approved but not emergency — reads CN, then bails.
    db.query.mockReset();
    db.query.mockResolvedValueOnce([[{ id: 7, project_id: 3, is_emergency: 0 }]]);
    await hook({ id: 1, document_id: 7, project_id: 3,
                 result: 'approved', workflow_type: 'change_notice' });
    expect(db.query).toHaveBeenCalledTimes(1);   // only the CN lookup
  });

  test('emergencyDesignRatification: triggers cn_design_ratification when emergency', async () => {
    const hook = gate.POST_COMPLETION_HOOKS.change_notice[0];

    db.query.mockReset();
    adapter.sendPoll.mockReset();
    adapter.sendPoll.mockResolvedValue({ eventId: '$ratification:s' });
    db.query
      // hook's CN lookup
      .mockResolvedValueOnce([[{ id: 7, project_id: 3, is_emergency: 1 }]])
      // triggerSignoff: workflow lookup (cn_design_ratification)
      .mockResolvedValueOnce([[{
        id: 99, workflow_type: 'cn_design_ratification',
        sequence: 'design_lead', closing_minutes: 2880, quorum_required: 1,
      }]])
      // rules: empty
      .mockResolvedValueOnce([[]])
      // resolve design_lead → users.role='design_head'
      .mockResolvedValueOnce([[{ id: 50, role: 'design_head', matrix_room_id: '!d:s' }]])
      // cancel prior pending
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      // INSERT signoff_instance
      .mockResolvedValueOnce([{ insertId: 200 }])
      // UPDATE poll_event_id after send
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await hook({ id: 1, document_id: 7, project_id: 3,
                 result: 'approved', workflow_type: 'change_notice' });

    // The follow-up poll was sent.
    expect(adapter.sendPoll).toHaveBeenCalledTimes(1);
    expect(adapter.sendPoll.mock.calls[0][0].roomId).toBe('!d:s');

    // Verify INSERT was for cn_design_ratification, doc 7, project 3
    const insertCall = db.query.mock.calls.find(c =>
      /INSERT INTO signoff_instances/.test(c[0])
    );
    expect(insertCall[1][0]).toBe('cn_design_ratification');
    expect(insertCall[1][1]).toBe(7);
    expect(insertCall[1][2]).toBe(3);
  });

  test('hook errors are isolated — completion still succeeds', async () => {
    // Replace the hook with one that throws, then run the public
    // _runPostCompletionHooks via markRejected (which calls it after
    // the UPDATE). Failure must NOT propagate.
    const original = gate.POST_COMPLETION_HOOKS.change_notice;
    gate.POST_COMPLETION_HOOKS.change_notice = [
      async function bad() { throw new Error('hook blew up'); },
    ];

    db.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{
        id: 1, status: 'completed', result: 'rejected',
        workflow_type: 'change_notice', document_id: 1,
      }]]);

    // Should not throw.
    const out = await gate.markRejected(1);
    expect(out.terminal).toBe(true);

    gate.POST_COMPLETION_HOOKS.change_notice = original;
  });

  test('WIRING: triggerNextRelayStep on last-approver YES fires hooks', async () => {
    // Replace hooks with a spy so we can verify the completion path
    // actually invokes them (not just that the hook itself works in
    // isolation). Catches a regression where someone removes the
    // _runPostCompletionHooks call from triggerNextRelayStep.
    const spy = jest.fn().mockResolvedValue();
    const original = gate.POST_COMPLETION_HOOKS.change_notice;
    gate.POST_COMPLETION_HOOKS.change_notice = [spy];

    try {
      db.query
        // SELECT instance — last approver, empty remaining
        .mockResolvedValueOnce([[{
          id: 5, status: 'in_progress',
          workflow_type: 'change_notice',
          document_id: 7,
          remaining_approvers: '[]',
        }]])
        // UPDATE completed/approved
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        // Re-fetch for hook firing
        .mockResolvedValueOnce([[{
          id: 5, status: 'completed', result: 'approved',
          workflow_type: 'change_notice', document_id: 7,
        }]]);

      await gate.triggerNextRelayStep(5);

      expect(spy).toHaveBeenCalledTimes(1);
      // Hook receives the completed instance row.
      expect(spy.mock.calls[0][0].id).toBe(5);
      expect(spy.mock.calls[0][0].result).toBe('approved');
    } finally {
      gate.POST_COMPLETION_HOOKS.change_notice = original;
    }
  });

  test('WIRING: markRejected fires hooks', async () => {
    const spy = jest.fn().mockResolvedValue();
    const original = gate.POST_COMPLETION_HOOKS.change_notice;
    gate.POST_COMPLETION_HOOKS.change_notice = [spy];

    try {
      db.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{
          id: 9, status: 'completed', result: 'rejected',
          workflow_type: 'change_notice', document_id: 11,
        }]]);

      await gate.markRejected(9);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].result).toBe('rejected');
    } finally {
      gate.POST_COMPLETION_HOOKS.change_notice = original;
    }
  });
});

// ── vendor_rep resolver ─────────────────────────────────────────────
//
// Per v2 brief A4 + Naveen's decision: vendors have matrix_room_id
// either via native EMS account (vendors on Element X) or via the
// Matrix WhatsApp Bridge (mautrix-whatsapp). EITHER WAY the gate
// dispatches to one matrix_room_id — no separate "fallback" code path.
//
// Resolver: from_doc strategy with docField='vendor_id', table=vendors.
// Document row must carry vendor_id (e.g. payment_request, GRN row).

describe('vendor_rep resolver', () => {
  test('resolves vendor via accounts contact when available', async () => {
    // First query: vendor_contacts WHERE role='accounts' → found
    db.query.mockResolvedValueOnce([[{
      id: 99, full_name: 'ABC Construction', contact_person: 'Ramesh',
      phone: '919999999999', matrix_room_id: '!vendor_abc:s', _is_vendor: 1,
    }]]);

    const out = await gate.resolveApprover('vendor_rep', 5, {
      documentRow: { vendor_id: 99 },
    });

    expect(out).toBeTruthy();
    expect(out.matrix_room_id).toBe('!vendor_abc:s');
    expect(out._is_vendor).toBe(1);
    // Only one query — accounts contact found, no fallback needed.
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toMatch(/vendor_contacts/);
    expect(db.query.mock.calls[0][0]).toMatch(/role = 'accounts'/);
  });

  test('falls back to vendor master row when no accounts contact exists', async () => {
    // First query: vendor_contacts → not found
    db.query.mockResolvedValueOnce([[undefined]]);
    // Second query: vendors master row
    db.query.mockResolvedValueOnce([[{
      id: 99, full_name: 'ABC Construction', contact_person: 'Ramesh',
      phone: '919999999999', matrix_room_id: '!vendor_abc:s', _is_vendor: 1,
    }]]);

    const out = await gate.resolveApprover('vendor_rep', 5, {
      documentRow: { vendor_id: 99 },
    });

    expect(out).toBeTruthy();
    expect(out.matrix_room_id).toBe('!vendor_abc:s');
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toMatch(/FROM vendors/);
  });

  test('returns null when documentRow has no vendor_id', async () => {
    const out = await gate.resolveApprover('vendor_rep', 5, {
      documentRow: { id: 1 },
    });
    expect(out).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('returns null when documentRow itself is missing', async () => {
    const out = await gate.resolveApprover('vendor_rep', 5, {});
    expect(out).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('legacy vendor with no matrix_room_id still resolves (caller handles)', async () => {
    db.query.mockResolvedValueOnce([[undefined]]); // no accounts contact
    db.query.mockResolvedValueOnce([[{
      id: 88, full_name: 'LegacyVendor', phone: '918888888888',
      matrix_room_id: null, _is_vendor: 1,
    }]]);

    const out = await gate.resolveApprover('vendor_rep', 5, {
      documentRow: { vendor_id: 88 },
    });
    expect(out).toBeTruthy();
    expect(out.matrix_room_id).toBeNull();
  });
});

// ── from_doc generalisation backward-compat ─────────────────────────
//
// The 'recipient' role still uses from_doc with default params (users
// via raised_by/created_by/user_id). Generalising from_doc to support
// vendors must not break this.

describe('recipient resolver — backward compat after from_doc generalisation', () => {
  test('still resolves user via raised_by', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 5, full_name: 'Author', role: 'site_manager',
      matrix_user_id: '@a:s', matrix_room_id: '!a:s', phone: '111',
    }]]);
    const out = await gate.resolveApprover('recipient', null, {
      documentRow: { raised_by: 5 },
    });
    expect(out.id).toBe(5);
    expect(db.query.mock.calls[0][0]).toMatch(/FROM users[\s\S]*WHERE id = \?/);
  });

  test('falls through raised_by → created_by → user_id', async () => {
    db.query.mockResolvedValueOnce([[{ id: 9, role: 'pmc_head', matrix_room_id: '!9:s' }]]);
    const out = await gate.resolveApprover('recipient', null, {
      documentRow: { raised_by: null, created_by: null, user_id: 9 },
    });
    expect(out.id).toBe(9);
  });
});


// ── PREDICATES — individual tests ───────────────────────────────────

// ── DESTINATION RESOLVERS ───────────────────────────────────────────
//
// Naveen's call (May 2026): bank notifications + individual BOQ sign-offs
// = personal. Everything else community. The destination_kind +
// destination_qualifier columns on signoff_workflows drive _dispatchPoll.

describe('destination_kind: personal', () => {
  test('sends poll to approver.matrix_room_id (their own DM), no @mention', async () => {
    db.query
      // workflow lookup (triggerSignoff)
      .mockResolvedValueOnce([[{
        id: 1, workflow_type: 'mom_client_ack',
        signoff_type: 'poll', sequence: 'recipient',
        closing_minutes: 4320, quorum_required: 1,
        destination_kind: 'personal', destination_qualifier: 'recipient',
      }]])
      // rules: empty
      .mockResolvedValueOnce([[]])
      // _findUser for 'recipient' role (read from documentRow.raised_by)
      .mockResolvedValueOnce([[{
        id: 99, full_name: 'Client X', role: 'client_rep',
        matrix_room_id: '!client_dm:s', matrix_user_id: '@cx:s',
      }]])
      // cancel-prior UPDATE
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      // INSERT signoff_instances
      .mockResolvedValueOnce([{ insertId: 7 }])
      // UPDATE poll_event_id
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await gate.triggerSignoff('mom_client_ack', 1, 5, {
      documentRow: { raised_by: 99 },
      question: 'Confirm minutes?',
    });
    expect(out.pollEventId).toBe('$poll1:s');

    // Personal destination: poll to the approver's own room.
    expect(adapter.sendPoll).toHaveBeenCalledTimes(1);
    expect(adapter.sendPoll.mock.calls[0][0].roomId).toBe('!client_dm:s');

    // No project/org room lookups for personal.
    expect(adapter.getProjectRoomId).not.toHaveBeenCalled();
    expect(adapter.getInternalRoomId).not.toHaveBeenCalled();

    // No heads-up @mention text since no other recipients in the room.
    expect(adapter.sendText).not.toHaveBeenCalled();
  });

  test('returns null pollEventId when approver has no matrix_room_id', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 1, workflow_type: 'daily_report',
        signoff_type: 'poll', sequence: 'pmc',
        closing_minutes: 120, quorum_required: 1,
        destination_kind: 'personal', destination_qualifier: null,
      }]])
      .mockResolvedValueOnce([[]])  // rules empty
      .mockResolvedValueOnce([[{ id: 99, full_name: 'PMC', matrix_room_id: null }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 7 }]);

    const out = await gate.triggerSignoff('daily_report', 1, 5, {});
    expect(out.pollEventId).toBeNull();
    expect(adapter.sendPoll).not.toHaveBeenCalled();
  });
});

describe('destination_kind: project', () => {
  test('sends poll to project room with @mention of approver', async () => {
    db.query
      // workflow
      .mockResolvedValueOnce([[{
        id: 1, workflow_type: 'payment_batch',
        signoff_type: 'poll', sequence: 'finance,principal',
        closing_minutes: null, quorum_required: 2,
        destination_kind: 'project', destination_qualifier: 'finance',
      }]])
      .mockResolvedValueOnce([[]])  // rules
      // _findUser finance
      .mockResolvedValueOnce([[{
        id: 22, full_name: 'Finance', role: 'finance',
        matrix_room_id: '!finance_dm:s', matrix_user_id: '@finance:s',
      }]])
      // _findUser principal
      .mockResolvedValueOnce([[{
        id: 33, full_name: 'Naveen', role: 'principal',
        matrix_room_id: '!naveen_dm:s', matrix_user_id: '@naveen:s',
      }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await gate.triggerSignoff('payment_batch', 9, 5, {});
    expect(out.pollEventId).toBe('$poll1:s');

    // Project destination: looks up project's finance room.
    expect(adapter.getProjectRoomId).toHaveBeenCalledWith(5, 'finance');

    // Poll lands in the project room, not the approver's DM.
    expect(adapter.sendPoll).toHaveBeenCalledTimes(1);
    expect(adapter.sendPoll.mock.calls[0][0].roomId).toBe('!project_room:s');

    // Heads-up @mention text precedes the poll so the approver gets pinged.
    expect(adapter.sendText).toHaveBeenCalledTimes(1);
    expect(adapter.sendText.mock.calls[0][0].roomId).toBe('!project_room:s');
    expect(adapter.sendText.mock.calls[0][0].recipientUid).toBe('@finance:s');
  });

  test('warns and returns null when projectId missing for project destination', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 1, workflow_type: 'payment_batch',
        signoff_type: 'poll', sequence: 'finance',
        closing_minutes: null, quorum_required: 1,
        destination_kind: 'project', destination_qualifier: 'finance',
      }]])
      .mockResolvedValueOnce([[]])  // rules
      .mockResolvedValueOnce([[{ id: 22, full_name: 'F', matrix_room_id: '!fdm:s' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 8 }]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await gate.triggerSignoff('payment_batch', 9, null, {});
    expect(out.pollEventId).toBeNull();
    expect(adapter.sendPoll).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('destination_kind: org', () => {
  test('sends poll to internal org room with @mention of approver', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 1, workflow_type: 'vendor_bank_peer_approve',
        signoff_type: 'poll', sequence: 'finance,principal',
        closing_minutes: null, quorum_required: 1,
        destination_kind: 'org', destination_qualifier: 'internal_finance',
      }]])
      // rules: strip_initiator on always (matches v5.36 seed)
      .mockResolvedValueOnce([[
        { id: 1, priority: 10, predicate_name: 'always',
          action_name: 'strip_initiator', role_token: null,
          notes: 'V8 separation of duties' },
      ]])
      // _findUser principal (finance was stripped because proposed_by_role='finance')
      .mockResolvedValueOnce([[{ id: 55, full_name: 'P', role: 'principal',
        matrix_room_id: '!pdm:s', matrix_user_id: '@p:s' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 9 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await gate.triggerSignoff('vendor_bank_peer_approve', 1, null, {
      documentRow: { proposed_by_role: 'finance' },
    });
    expect(out.pollEventId).toBe('$poll1:s');

    // Org destination: looks up internal_finance room (no project context needed).
    expect(adapter.getInternalRoomId).toHaveBeenCalledWith('internal_finance');
    expect(adapter.getProjectRoomId).not.toHaveBeenCalled();

    // Poll lands in org room.
    expect(adapter.sendPoll).toHaveBeenCalledTimes(1);
    expect(adapter.sendPoll.mock.calls[0][0].roomId).toBe('!org_room:s');

    // @mention precedes poll. strip_initiator removed 'finance' → first
    // approver is principal.
    expect(adapter.sendText).toHaveBeenCalledTimes(1);
    expect(adapter.sendText.mock.calls[0][0].recipientUid).toBe('@p:s');
  });
});


// ── PREDICATES — individual tests ───────────────────────────────────

describe('PREDICATES', () => {
  test('is_emergency: reads documentRow.is_emergency truthy', async () => {
    expect(await gate.PREDICATES.is_emergency({
      documentRow: { is_emergency: 1 },
    })).toBe(true);
    expect(await gate.PREDICATES.is_emergency({
      documentRow: { is_emergency: 0 },
    })).toBe(false);
    expect(await gate.PREDICATES.is_emergency({})).toBe(false);
  });

  test('below_threshold: false when no contract_value', async () => {
    db.query.mockResolvedValueOnce([[{ contract_value: null }]]);
    const out = await gate.PREDICATES.below_threshold({
      workflow: { principal_threshold_pct: 1.00 },
      projectId: 1,
      documentRow: { estimated_value: 50000 },
    });
    expect(out).toBe(false);
  });

  test('below_threshold: true when doc < threshold% of contract', async () => {
    db.query.mockResolvedValueOnce([[{ contract_value: 10_000_000 }]]);
    const out = await gate.PREDICATES.below_threshold({
      workflow: { principal_threshold_pct: 1.00 },
      projectId: 1,
      documentRow: { estimated_value: 50_000 },   // 0.5%
    });
    expect(out).toBe(true);
  });

  test('below_threshold: false when doc >= threshold% of contract', async () => {
    db.query.mockResolvedValueOnce([[{ contract_value: 10_000_000 }]]);
    const out = await gate.PREDICATES.below_threshold({
      workflow: { principal_threshold_pct: 1.00 },
      projectId: 1,
      documentRow: { estimated_value: 200_000 },   // 2%
    });
    expect(out).toBe(false);
  });

  test('no_snags: true when issues count is 0', async () => {
    db.query.mockResolvedValueOnce([[{ cnt: 0 }]]);
    expect(await gate.PREDICATES.no_snags({ projectId: 1 })).toBe(true);

    db.query.mockResolvedValueOnce([[{ cnt: 3 }]]);
    expect(await gate.PREDICATES.no_snags({ projectId: 1 })).toBe(false);
  });

  test('settlement_pending: true when no completed final_settlement', async () => {
    db.query.mockResolvedValueOnce([[]]);
    expect(await gate.PREDICATES.settlement_pending({ projectId: 1 })).toBe(true);

    db.query.mockResolvedValueOnce([[{ id: 99 }]]);
    expect(await gate.PREDICATES.settlement_pending({ projectId: 1 })).toBe(false);
  });

  test('is_services_stream / is_design_stream: read documentRow.stream', async () => {
    expect(await gate.PREDICATES.is_services_stream({
      documentRow: { stream: 'services' },
    })).toBe(true);
    expect(await gate.PREDICATES.is_services_stream({
      documentRow: { stream: 'design' },
    })).toBe(false);
    expect(await gate.PREDICATES.is_services_stream({})).toBe(false);

    expect(await gate.PREDICATES.is_design_stream({
      documentRow: { stream: 'design' },
    })).toBe(true);
    expect(await gate.PREDICATES.is_design_stream({
      documentRow: { stream: 'services' },
    })).toBe(false);
  });
});

// ── ACTIONS — individual tests ──────────────────────────────────────

describe('ACTIONS', () => {
  test('skip_role removes named role', () => {
    const out = gate.ACTIONS.skip_role(
      ['pmc', 'design_lead', 'principal'],
      { role_token: 'design_lead' }
    );
    expect(out).toEqual(['pmc', 'principal']);
  });

  test('skip_role no-op if role not in sequence', () => {
    const out = gate.ACTIONS.skip_role(
      ['pmc'], { role_token: 'principal' }
    );
    expect(out).toEqual(['pmc']);
  });

  test('append_role adds at end', () => {
    const out = gate.ACTIONS.append_role(
      ['pmc'], { role_token: 'client_rep' }
    );
    expect(out).toEqual(['pmc', 'client_rep']);
  });

  test('append_role no-op if already present (idempotent)', () => {
    const out = gate.ACTIONS.append_role(
      ['pmc', 'client_rep'], { role_token: 'client_rep' }
    );
    expect(out).toEqual(['pmc', 'client_rep']);
  });

  test('strip_initiator removes role derived from documentRow.source', () => {
    const out = gate.ACTIONS.strip_initiator(
      ['site_manager', 'pmc', 'design_lead', 'principal'],
      {},
      { documentRow: { source: 'site' } }
    );
    expect(out).toEqual(['pmc', 'design_lead', 'principal']);
  });

  test('strip_initiator no-op when initiator role not in sequence', () => {
    // source='statutory' maps to 'pmc'; if pmc is already in seq, strip it.
    const out = gate.ACTIONS.strip_initiator(
      ['design_lead', 'principal'],
      {},
      { documentRow: { source: 'statutory' } }
    );
    expect(out).toEqual(['design_lead', 'principal']);
  });
});
