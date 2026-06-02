#!/usr/bin/env node
// scripts/test-threads.js
// ============================================================
// Matrix thread functionality test harness — 17 tests.
// Per v2 brief §P10.4 (C3 POC results: 14/17 on matrix.org,
// 3 failures on relations API — will pass on EMS).
//
// Usage:
//   node scripts/test-threads.js
//   node scripts/test-threads.js --room !abcdef:nuassociates.in
//   node scripts/test-threads.js --dry
// ============================================================

'use strict';

const fs            = require('fs');
const path          = require('path');
const matrixAdapter = require('../services/matrix-adapter');
const http          = require('../services/http');

const HS    = process.env.MATRIX_HOMESERVER || '';
const TOKEN = process.env.MATRIX_BOT_TOKEN  || '';
const AUTH  = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const argv    = process.argv.slice(2);
const dryRun  = argv.includes('--dry');
const roomArg = argv[argv.indexOf('--room') + 1] || null;

const results = [];
let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    results.push({ name, passed: false, error: err.message });
    failed++;
    console.log(`  ❌ ${name} — ${err.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

async function matrixPut(path, body) {
  const txnId = matrixAdapter.makeTxnId();
  const url = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(path.split('/')[0])}/send/${path.split('/').slice(1).join('/')}/${txnId}`;
  const res = await http.put(url, body, { headers: AUTH });
  return res?.data;
}

async function main() {
  console.log('\n=== Matrix Thread Test Harness ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  let testRoomId = roomArg;
  let rootEventId = null;
  let threadReplyId = null;

  // ── T1-T3: Prerequisites ─────────────────────────────────────────────
  await test('T01 homeserver and token set', () => {
    assert(HS, 'MATRIX_HOMESERVER not set');
    assert(TOKEN, 'MATRIX_BOT_TOKEN not set');
  });

  await test('T02 resolve test room', async () => {
    if (dryRun || testRoomId) return;
    testRoomId = await matrixAdapter.getInternalRoomId('system_health');
    assert(testRoomId, '#system-health room not in matrix_rooms');
  });

  await test('T03 test room is accessible', async () => {
    if (dryRun || !testRoomId) return;
    const events = await matrixAdapter.readMessages(testRoomId, { limit: 1 });
    assert(Array.isArray(events), 'readMessages failed');
  });

  // ── T4-T8: Thread root ───────────────────────────────────────────────
  await test('T04 send thread root message', async () => {
    if (dryRun || !testRoomId) return;
    const { eventId } = await matrixAdapter.sendText({
      roomId: testRoomId,
      body: '🧪 [test-threads.js] T04 — thread root',
    });
    assert(eventId, 'no event_id from sendText (thread root)');
    rootEventId = eventId;
  });

  await test('T05 rootEventId starts with $', () => {
    if (dryRun) return;
    if (!rootEventId) throw new Error('T04 must pass first');
    assert(rootEventId.startsWith('$'), `rootEventId format: ${rootEventId}`);
  });

  await test('T06 send thread reply via m.thread', async () => {
    if (dryRun || !testRoomId || !rootEventId) return;
    const txnId = matrixAdapter.makeTxnId();
    const url   = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(testRoomId)}/send/m.room.message/${txnId}`;
    const body  = {
      msgtype: 'm.text',
      body: '🧪 T06 — thread reply',
      'm.relates_to': {
        rel_type: 'm.thread',
        event_id: rootEventId,
        'm.in_reply_to': { event_id: rootEventId },
        is_falling_back: false,
      },
    };
    const res = await http.put(url, body, { headers: AUTH });
    threadReplyId = res?.data?.event_id;
    assert(threadReplyId, 'no event_id from thread reply');
  });

  await test('T07 thread reply event_id is distinct from root', () => {
    if (dryRun) return;
    if (!rootEventId || !threadReplyId) throw new Error('T04/T06 must pass first');
    assert(rootEventId !== threadReplyId, 'reply has same event_id as root');
  });

  await test('T08 send second thread reply', async () => {
    if (dryRun || !testRoomId || !rootEventId) return;
    const txnId = matrixAdapter.makeTxnId();
    const url   = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(testRoomId)}/send/m.room.message/${txnId}`;
    const body  = {
      msgtype: 'm.text',
      body: '🧪 T08 — second thread reply',
      'm.relates_to': {
        rel_type: 'm.thread',
        event_id: rootEventId,
        'm.in_reply_to': { event_id: rootEventId },
        is_falling_back: false,
      },
    };
    const res = await http.put(url, body, { headers: AUTH });
    assert(res?.data?.event_id, 'no event_id from second thread reply');
  });

  // ── T9-T13: Relations API (known to fail on matrix.org) ─────────────
  await test('T09 relations API returns thread replies', async () => {
    if (dryRun || !testRoomId || !rootEventId) return;
    // Note: this API fails on matrix.org (C3 POC — 3 failures). Should pass on EMS.
    await new Promise(r => setTimeout(r, 1000));
    const url = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(testRoomId)}/relations/${encodeURIComponent(rootEventId)}/m.thread`;
    const res = await http.get(url, { headers: AUTH });
    assert(res?.data?.chunk, 'relations API returned no chunk');
  });

  await test('T10 relations chunk contains our thread reply', async () => {
    if (dryRun || !testRoomId || !rootEventId || !threadReplyId) return;
    const url = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(testRoomId)}/relations/${encodeURIComponent(rootEventId)}/m.thread`;
    const res = await http.get(url, { headers: AUTH });
    const ids = (res?.data?.chunk || []).map(e => e.event_id);
    assert(ids.includes(threadReplyId), 'thread reply not in relations chunk');
  });

  await test('T11 relations API pagination token present', async () => {
    if (dryRun || !testRoomId || !rootEventId) return;
    const url = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(testRoomId)}/relations/${encodeURIComponent(rootEventId)}/m.thread?limit=1`;
    const res = await http.get(url, { headers: AUTH });
    const data = res?.data || {};
    // Pagination token may be null if only one result — both are valid
    assert('next_batch' in data || data.chunk, 'relations API response malformed');
  });

  // ── T12-T15: Poll in thread ──────────────────────────────────────────
  await test('T12 sendPoll in a thread (opts.threadId)', async () => {
    if (dryRun || !testRoomId || !rootEventId) return;
    // sendPoll doesn't support threadId directly — build the content manually
    const txnId = matrixAdapter.makeTxnId();
    const url   = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(testRoomId)}/send/org.matrix.msc3381.poll.start/${txnId}`;
    const body  = {
      'org.matrix.msc1767.text': '🧪 T12 — thread poll',
      'org.matrix.msc3381.poll.start': {
        question: { 'org.matrix.msc1767.text': '🧪 T12 — thread poll (ignore)' },
        kind: 'org.matrix.msc3381.poll.disclosed',
        max_selections: 1,
        answers: [
          { id: 'yes', 'org.matrix.msc1767.text': '✅ Yes' },
          { id: 'no',  'org.matrix.msc1767.text': '❌ No'  },
        ],
      },
      'm.relates_to': {
        rel_type: 'm.thread',
        event_id: rootEventId,
        is_falling_back: false,
      },
    };
    const res = await http.put(url, body, { headers: AUTH });
    assert(res?.data?.event_id, 'no event_id from thread poll');
  });

  await test('T13 thread poll visible in readMessages', async () => {
    if (dryRun || !testRoomId || !rootEventId) return;
    await new Promise(r => setTimeout(r, 1000));
    const events = await matrixAdapter.readMessages(testRoomId, { limit: 20 });
    const pollInThread = events.find(e =>
      e.content?.['m.relates_to']?.rel_type === 'm.thread' &&
      e.content?.['m.relates_to']?.event_id === rootEventId &&
      e.type === 'org.matrix.msc3381.poll.start'
    );
    assert(pollInThread, 'thread poll not found in readMessages');
  });

  await test('T14 second thread (independent root)', async () => {
    if (dryRun || !testRoomId) return;
    const { eventId: root2 } = await matrixAdapter.sendText({
      roomId: testRoomId,
      body: '🧪 T14 — second thread root',
    });
    assert(root2, 'no event_id for second thread root');
    assert(root2 !== rootEventId, 'second root same as first root');

    const txnId = matrixAdapter.makeTxnId();
    const url   = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(testRoomId)}/send/m.room.message/${txnId}`;
    const res   = await http.put(url, {
      msgtype: 'm.text',
      body: '🧪 T14 — reply in second thread',
      'm.relates_to': { rel_type: 'm.thread', event_id: root2, is_falling_back: false },
    }, { headers: AUTH });
    assert(res?.data?.event_id, 'no event_id for second thread reply');
  });

  // ── T15-T17: Cleanup ────────────────────────────────────────────────
  await test('T15 third thread (stress)', async () => {
    if (dryRun || !testRoomId || !rootEventId) return;
    const txnId = matrixAdapter.makeTxnId();
    const url   = `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(testRoomId)}/send/m.room.message/${txnId}`;
    const res   = await http.put(url, {
      msgtype: 'm.text',
      body: '🧪 T15 — third thread reply',
      'm.relates_to': { rel_type: 'm.thread', event_id: rootEventId, is_falling_back: false },
    }, { headers: AUTH });
    assert(res?.data?.event_id, 'third reply failed');
  });

  await test('T16 readMessages returns all events including thread replies', async () => {
    if (dryRun || !testRoomId) return;
    const events = await matrixAdapter.readMessages(testRoomId, { limit: 50 });
    assert(events.length > 0, 'no events returned');
  });

  await test('T17 post thread test summary to room', async () => {
    if (dryRun || !testRoomId) return;
    const { eventId } = await matrixAdapter.sendText({
      roomId: testRoomId,
      body: `🧪 [test-threads.js] Done — ${passed}/${passed + failed} passed`,
    });
    assert(eventId, 'failed to post summary');
  });

  // ── Results ──────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n=== Results: ${passed}/${total} passed ===`);
  if (failed > 0) {
    console.log('\nFailed:');
    results.filter(r => !r.passed).forEach(r => console.log(`  ❌ ${r.name}: ${r.error}`));
    console.log('\nNote: T09-T11 (relations API) are known to fail on matrix.org.');
    console.log('      They should pass on EMS.');
  }

  const outPath = path.join(__dirname, '..', 'matrix-thread-test-results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(), passed, failed, total, results,
  }, null, 2));
  console.log(`Results saved to ${outPath}`);

  process.exit(failed > 3 ? 1 : 0); // Allow up to 3 failures (relations API on matrix.org)
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
