// tests/matrix-reply-actions.test.js
// ============================================================
// Tests for services/matrix-reply-actions.js
//
// Covers Phase 2 deliverables:
//   - registerPendingPoll: insert, supersede, idempotency
//   - processVotesForRoom: cursor advance, vote correlation, expected-voter check
//   - processVotes: per-room aggregation, error isolation
//   - expireOverdue: status transition
// ============================================================

'use strict';

jest.mock('../middleware/db', () => ({
  query: jest.fn(),
}));

jest.mock('../services/matrix-adapter', () => ({
  readMessages: jest.fn(),
  sendReaction: jest.fn(),
  closePoll:    jest.fn(),
}));

const db            = require('../middleware/db');
const matrixAdapter = require('../services/matrix-adapter');
const replyActions  = require('../services/matrix-reply-actions');

beforeEach(() => {
  db.query.mockReset();
  matrixAdapter.readMessages.mockReset();
  matrixAdapter.sendReaction.mockReset();
  matrixAdapter.closePoll.mockReset();
  // Default: matrix-side calls succeed unless a test overrides.
  matrixAdapter.sendReaction.mockResolvedValue({ eventId: '$react:s' });
  matrixAdapter.closePoll.mockResolvedValue({ eventId: '$close:s' });
});

;

// ── processVotesForRoom ────────────────────────────────────────────

describe('processVotesForRoom', () => {
  test('returns zeroes when room has no events', async () => {
    matrixAdapter.readMessages.mockResolvedValueOnce([]);

    const out = await replyActions.processVotesForRoom(db, '!empty:s');
    expect(out).toEqual({ scanned: 0, dispatched: 0, ignored: 0 });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('dispatches a poll-response event matching a signoff_instance row', async () => {
    // After Phase 4, POLL_OWNERS has only signoff_instances.
    const pollEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@alice:server',
      event_id: '$vote1:s',
      origin_server_ts: 2000,
      content: {
        'm.relates_to': { event_id: '$poll1:s' },
        'org.matrix.msc3381.poll.response': { answers: ['yes'] },
      },
    };

    matrixAdapter.readMessages.mockResolvedValueOnce([pollEv]);
    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 1000 }]])  // cursor read
      .mockResolvedValueOnce([[{                          // signoff_instances lookup
        id: 11, status: 'in_progress',
        current_approver_id: 5, poll_event_id: '$poll1:s',
        remaining_approvers: '[]', options: null,
        workflow_type: 'grn_approval',
      }]])
      .mockResolvedValueOnce([[{ id: 5 }]])               // voter user lookup
      .mockResolvedValueOnce([{ insertId: 1 }])           // INSERT signoff_votes
      .mockResolvedValueOnce([{ affectedRows: 1 }])       // UPDATE completed
      .mockResolvedValueOnce([{ affectedRows: 1 }]);      // cursor advance

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out).toEqual({ scanned: 1, dispatched: 1, ignored: 0 });

    // Cursor advanced to event timestamp
    const cursorCall = db.query.mock.calls.find(c =>
      /INSERT INTO matrix_reader_cursor/.test(c[0])
    );
    expect(cursorCall).toBeTruthy();
    expect(cursorCall[1]).toEqual(['!r:s', 2000]);
  });

  test('ignores poll responses with no matching pending row', async () => {
    const pollEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@bob:s',
      event_id: '$vote:s',
      origin_server_ts: 2000,
      content: {
        'm.relates_to': { event_id: '$nonexistent:s' },
        'org.matrix.msc3381.poll.response': { answers: ['no'] },
      },
    };

    matrixAdapter.readMessages.mockResolvedValueOnce([pollEv]);
    db.query
      .mockResolvedValueOnce([[]])                   // no cursor row
      .mockResolvedValueOnce([[]])                   // no signoff_instances match
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // cursor advance

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out).toEqual({ scanned: 1, dispatched: 0, ignored: 1 });
  });

  test('does not act when wrong voter votes (current_approver_id mismatch)', async () => {
    const pollEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@stranger:s',
      event_id: '$v:s',
      origin_server_ts: 5000,
      content: {
        'm.relates_to': { event_id: '$p:s' },
        'org.matrix.msc3381.poll.response': { answers: ['yes'] },
      },
    };

    matrixAdapter.readMessages.mockResolvedValueOnce([pollEv]);
    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 0 }]])
      .mockResolvedValueOnce([[{
        id: 5, status: 'in_progress',
        current_approver_id: 42,   // expecting user 42
        poll_event_id: '$p:s',
        remaining_approvers: '[]', options: null,
        workflow_type: 'daily_report',
      }]])
      .mockResolvedValueOnce([[{ id: 99 }]])          // resolves to user 99 — wrong
      .mockResolvedValueOnce([{ affectedRows: 1 }]);  // cursor advance

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out).toEqual({ scanned: 1, dispatched: 0, ignored: 1 });
  });

  test('skips events older than cursor', async () => {
    const oldEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@a:s',
      event_id: '$old:s',
      origin_server_ts: 500,         // older than cursor
      content: {
        'm.relates_to': { event_id: '$p:s' },
        'org.matrix.msc3381.poll.response': { answers: ['yes'] },
      },
    };
    matrixAdapter.readMessages.mockResolvedValueOnce([oldEv]);
    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 1000 }]])   // cursor newer
      .mockResolvedValueOnce([{ affectedRows: 1 }]);       // cursor (no advance)

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out).toEqual({ scanned: 0, dispatched: 0, ignored: 0 });
  });

  test('non-poll events do not count as votes', async () => {
    const textEv = {
      type: 'm.room.message',
      sender: '@a:s', event_id: '$msg:s', origin_server_ts: 2000,
      content: { msgtype: 'm.text', body: 'hi' },
    };
    matrixAdapter.readMessages.mockResolvedValueOnce([textEv]);
    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out.dispatched).toBe(0);
    expect(out.scanned).toBe(0);
  });

  test('C8 — bot reacts ✅ on the vote message after dispatch', async () => {
    // Per v2 brief C8: within 5 seconds of recording a vote, bot reacts
    // ✅ on the vote event so the user sees physical confirmation.
    const pollEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@alice:s', event_id: '$vote_evt:s', origin_server_ts: 2000,
      content: {
        'm.relates_to': { event_id: '$poll1:s' },
        'org.matrix.msc3381.poll.response': { answers: ['yes'] },
      },
    };
    matrixAdapter.readMessages.mockResolvedValueOnce([pollEv]);
    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 0 }]])
      .mockResolvedValueOnce([[{
        id: 1, action_type: 'grn_approve', ref_id: 7, ref_table: 'grns',
        poll_event_id: '$poll1:s', expected_voter_uid: null,
      }]])
      .mockResolvedValueOnce([[{ id: 5 }]])           // user resolution
      .mockResolvedValueOnce([{ affectedRows: 1 }])   // UPDATE acted
      .mockResolvedValueOnce([{ affectedRows: 1 }]);  // cursor advance

    await replyActions.processVotesForRoom(db, '!r:s');

    // sendReaction MUST have been called targeting the vote event itself
    // (not the poll-start). C8 wants confirmation on the vote message.
    expect(matrixAdapter.sendReaction).toHaveBeenCalledTimes(1);
    expect(matrixAdapter.sendReaction).toHaveBeenCalledWith({
      roomId: '!r:s',
      targetEventId: '$vote_evt:s',
      emoji: '✅',
    });
  });

  test('reaction failure does not break vote dispatch', async () => {
    // If matrix-adapter.sendReaction throws, the dispatch must still
    // count as successful — vote-record is more important than emoji.
    const pollEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@alice:s', event_id: '$v:s', origin_server_ts: 1000,
      content: {
        'm.relates_to': { event_id: '$p:s' },
        'org.matrix.msc3381.poll.response': { answers: ['yes'] },
      },
    };
    matrixAdapter.readMessages.mockResolvedValueOnce([pollEv]);
    matrixAdapter.sendReaction.mockRejectedValueOnce(new Error('matrix down'));
    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 0 }]])
      .mockResolvedValueOnce([[{
        id: 1, action_type: 'grn_approve', ref_id: 1, ref_table: 'grns',
        poll_event_id: '$p:s', expected_voter_uid: null,
      }]])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out.dispatched).toBe(1);   // dispatch still counted
  });
});

// ── processVotes (multi-room) ──────────────────────────────────────

describe('processVotes', () => {
  test('aggregates per-room results and isolates failures', async () => {
    db.query.mockResolvedValueOnce([[
      { room_id: '!r1:s' },
      { room_id: '!r2:s' },
    ]]);

    // r1 succeeds with 1 dispatch
    // r2 throws — should not stop r1's totals
    matrixAdapter.readMessages
      .mockImplementationOnce(async () => [{
        type: 'org.matrix.msc3381.poll.response',
        sender: '@a:s', event_id: '$v:s', origin_server_ts: 100,
        content: {
          'm.relates_to': { event_id: '$p:s' },
          'org.matrix.msc3381.poll.response': { answers: ['yes'] },
        },
      }])
      .mockImplementationOnce(async () => { throw new Error('nope'); });

    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 0 }]])
      .mockResolvedValueOnce([[{
        id: 1, action_type: 'grn_approve', ref_id: 7, ref_table: 'grns',
        poll_event_id: '$p:s', expected_voter_uid: null,
      }]])
      .mockResolvedValueOnce([[{ id: 5 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await replyActions.processVotes(db);
    expect(out.rooms).toBe(2);
    expect(out.dispatched).toBe(1);
  });
});

// ── expireOverdue ──────────────────────────────────────────────────

// ── signoff_instance vote routing ─────────────────────────────────
//
// When a vote correlates to a signoff_instances row (rather than a
// matrix_pending_polls row), the handler must:
//   1. Skip if voter isn't the current_approver_id
//   2. INSERT into signoff_votes
//   3. On 'no' / reject → mark instance completed/rejected
//   4. On 'yes' / approve → call signoff-gate.triggerNextRelayStep

jest.mock('../services/signoff-gate', () => ({
  triggerNextRelayStep: jest.fn(),
  markRejected:         jest.fn(),
}));
const gate = require('../services/signoff-gate');

describe('signoff_instance vote handler', () => {
  beforeEach(() => {
    gate.triggerNextRelayStep.mockReset();
    gate.markRejected.mockReset();
    gate.triggerNextRelayStep.mockResolvedValue({ advanced: true, completed: false, nextApproverId: 22 });
    gate.markRejected.mockResolvedValue({ terminal: true });
  });

  test('YES vote inserts signoff_votes and calls triggerNextRelayStep', async () => {
    const pollEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@alice:s', event_id: '$vote:s', origin_server_ts: 2000,
      content: {
        'm.relates_to': { event_id: '$p:s' },
        'org.matrix.msc3381.poll.response': { answers: ['yes'] },
      },
    };
    matrixAdapter.readMessages.mockResolvedValueOnce([pollEv]);
    db.query
      // cursor
      .mockResolvedValueOnce([[{ last_seen_ts: 0 }]])
      // POLL_OWNERS: signoff_instances — found (only one owner now)
      .mockResolvedValueOnce([[{
        id: 11, status: 'in_progress',
        current_approver_id: 5, poll_event_id: '$p:s',
      }]])
      // voter user lookup
      .mockResolvedValueOnce([[{ id: 5 }]])
      // INSERT signoff_votes
      .mockResolvedValueOnce([{ insertId: 99 }])
      // cursor advance
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out.dispatched).toBe(1);

    // signoff_votes INSERT happened
    const insertCall = db.query.mock.calls.find(c =>
      /INSERT INTO signoff_votes/.test(c[0])
    );
    expect(insertCall).toBeTruthy();
    // (instance_id, voter_user_id, voter_mxid, vote_answer_id, vote_event_id)
    expect(insertCall[1]).toEqual([11, 5, '@alice:s', 'yes', '$vote:s']);

    // triggerNextRelayStep was called
    expect(gate.triggerNextRelayStep).toHaveBeenCalledWith(11);
  });

  test('NO vote calls gate.markRejected; does NOT advance relay', async () => {
    const pollEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@alice:s', event_id: '$vote:s', origin_server_ts: 2000,
      content: {
        'm.relates_to': { event_id: '$p:s' },
        'org.matrix.msc3381.poll.response': { answers: ['no'] },
      },
    };
    matrixAdapter.readMessages.mockResolvedValueOnce([pollEv]);
    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 0 }]])
      .mockResolvedValueOnce([[{        // signoff_instances — found
        id: 22, status: 'in_progress',
        current_approver_id: 5, poll_event_id: '$p:s',
      }]])
      .mockResolvedValueOnce([[{ id: 5 }]])
      .mockResolvedValueOnce([{ insertId: 1 }])     // INSERT signoff_votes
      .mockResolvedValueOnce([{ affectedRows: 1 }]);// cursor advance

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out.dispatched).toBe(1);

    // gate.markRejected was called for the right instance
    expect(gate.markRejected).toHaveBeenCalledWith(22);

    // Relay was NOT advanced
    expect(gate.triggerNextRelayStep).not.toHaveBeenCalled();

    // No inline UPDATE on signoff_instances from the reply-actions side —
    // all terminal transitions go through the gate now.
    const updateCall = db.query.mock.calls.find(c =>
      /UPDATE signoff_instances/.test(c[0])
    );
    expect(updateCall).toBeFalsy();
  });

  test('wrong voter (not current_approver_id) — no INSERT, no advance', async () => {
    const pollEv = {
      type: 'org.matrix.msc3381.poll.response',
      sender: '@stranger:s', event_id: '$vote:s', origin_server_ts: 1000,
      content: {
        'm.relates_to': { event_id: '$p:s' },
        'org.matrix.msc3381.poll.response': { answers: ['yes'] },
      },
    };
    matrixAdapter.readMessages.mockResolvedValueOnce([pollEv]);
    db.query
      .mockResolvedValueOnce([[{ last_seen_ts: 0 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{
        id: 33, status: 'in_progress',
        current_approver_id: 5,    // expected voter
        poll_event_id: '$p:s',
      }]])
      .mockResolvedValueOnce([[{ id: 99 }]])  // stranger's user_id is 99 ≠ 5
      .mockResolvedValueOnce([{ affectedRows: 1 }]);  // cursor advance only

    const out = await replyActions.processVotesForRoom(db, '!r:s');
    expect(out.dispatched).toBe(0);
    expect(out.ignored).toBe(1);

    // No signoff_votes INSERT
    const insertCall = db.query.mock.calls.find(c =>
      /INSERT INTO signoff_votes/.test(c[0])
    );
    expect(insertCall).toBeFalsy();

    // No relay advance
    expect(gate.triggerNextRelayStep).not.toHaveBeenCalled();
  });

});


// ── expireOverdue ──────────────────────────────────────────────────

describe('expireOverdue', () => {
  test('returns zeros when no overdue rows', async () => {
    db.query.mockResolvedValueOnce([[]]);   // SELECT returns no rows
    const out = await replyActions.expireOverdue(db);
    expect(out).toEqual({ expired: 0, closed: 0, errors: [] });
    expect(matrixAdapter.closePoll).not.toHaveBeenCalled();
  });

  test('snapshots overdue rows then UPDATEs status to expired', async () => {
    db.query
      .mockResolvedValueOnce([[                   // SELECT snapshot from signoff_instances
        { id: 1, room_id: '!r:s', poll_event_id: '$p1:s' },
        { id: 2, room_id: '!r:s', poll_event_id: '$p2:s' },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);  // UPDATE timed_out

    const out = await replyActions.expireOverdue(db);

    expect(out.expired).toBe(2);
    expect(out.closed).toBe(2);

    // First call: snapshot SELECT from signoff_instances
    expect(db.query.mock.calls[0][0]).toMatch(/FROM signoff_instances[\s\S]*closes_at <= NOW/);
    // Second call: UPDATE to timed_out
    expect(db.query.mock.calls[1][0]).toMatch(/UPDATE signoff_instances[\s\S]*timed_out/);
  });

  test('sends closePoll + ✅ reaction for each expired poll', async () => {
    db.query
      .mockResolvedValueOnce([[
        { id: 1, room_id: '!r1:s', poll_event_id: '$p1:s' },
        { id: 2, room_id: '!r2:s', poll_event_id: '$p2:s' },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);

    const out = await replyActions.expireOverdue(db);

    expect(matrixAdapter.closePoll).toHaveBeenCalledTimes(2);
    expect(matrixAdapter.closePoll).toHaveBeenCalledWith({
      roomId: '!r1:s', pollEventId: '$p1:s',
      text: 'Poll closed (timed out).',
    });

    expect(matrixAdapter.sendReaction).toHaveBeenCalledTimes(2);
    expect(matrixAdapter.sendReaction).toHaveBeenCalledWith({
      roomId: '!r1:s', targetEventId: '$p1:s', emoji: '✅',
    });

    expect(out.errors).toEqual([]);
  });

  test('matrix-side failure does not block DB expiry', async () => {
    db.query
      .mockResolvedValueOnce([[
        { id: 1, room_id: '!r:s', poll_event_id: '$p:s' },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    matrixAdapter.closePoll.mockRejectedValueOnce(new Error('matrix down'));
    matrixAdapter.sendReaction.mockRejectedValueOnce(new Error('matrix down'));

    const out = await replyActions.expireOverdue(db);

    // DB row was still expired; matrix-side errors captured for telemetry.
    expect(out.expired).toBe(1);
    expect(out.closed).toBe(0);
    expect(out.errors.length).toBe(2);   // closePoll + reaction both errored
    expect(out.errors[0]).toMatch(/matrix down/);
  });
});

// ── EXPIRY_HOURS table sanity ──────────────────────────────────────

describe('EXPIRY_HOURS', () => {
  test('mirrors WA expiry windows for the 7 ported actions', () => {
    expect(replyActions.EXPIRY_HOURS.anomaly_ack).toBe(24);
    expect(replyActions.EXPIRY_HOURS.grn_approve).toBe(12);
    expect(replyActions.EXPIRY_HOURS.issue_confirm).toBe(24);
    expect(replyActions.EXPIRY_HOURS.vendor_defect_ack).toBe(48);
    expect(replyActions.EXPIRY_HOURS.urgent_payment_fyi).toBe(4);
    expect(replyActions.EXPIRY_HOURS.mom_client_ack).toBe(72);
    expect(replyActions.EXPIRY_HOURS.report_update).toBe(4);
  });
});
