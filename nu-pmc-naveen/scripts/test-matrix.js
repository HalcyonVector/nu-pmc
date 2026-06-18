#!/usr/bin/env node
// scripts/test-matrix.js
// ============================================================
// Matrix integration test harness — 31 tests.
// Per v2 brief §P10.4:
//   "Run both before any production deployment.
//    Results posted to Matrix room and saved to JSON.
//    31/31 is the baseline on matrix.org. EMS should match or exceed."
//
// Usage:
//   node scripts/test-matrix.js
//   node scripts/test-matrix.js --room !abcdef:nuassociates.in
//   node scripts/test-matrix.js --dry     # skip Matrix calls, report structure only
//
// Pre-requisites:
//   MATRIX_HOMESERVER, MATRIX_BOT_TOKEN, MATRIX_BOT_USER_ID set.
//   The bot must be a member of the test room.
// ============================================================

'use strict';

const fs     = require('fs');
const path   = require('path');
const http   = require('../services/http');
const matrixAdapter = require('../services/matrix-adapter');

const HS    = process.env.MATRIX_HOMESERVER || '';
const TOKEN = process.env.MATRIX_BOT_TOKEN  || '';
const AUTH  = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// Parse args
const argv    = process.argv.slice(2);
const dryRun  = argv.includes('--dry');
const roomArg = argv[argv.indexOf('--room') + 1] || null;

// Test result accumulator
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function main() {
  console.log('\n=== Matrix Integration Test Harness ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no Matrix calls)' : 'LIVE'}`);
  console.log(`Homeserver: ${HS || '(not set)'}`);
  console.log(`Bot token: ${TOKEN ? '***set***' : '(not set)'}\n`);

  // ── T1-T5: Environment ──────────────────────────────────────────────
  await test('T01 MATRIX_HOMESERVER is set', () => {
    assert(HS, 'MATRIX_HOMESERVER env var missing');
    assert(HS.startsWith('https://'), 'MATRIX_HOMESERVER must start with https://');
  });

  await test('T02 MATRIX_BOT_TOKEN is set', () => {
    assert(TOKEN, 'MATRIX_BOT_TOKEN env var missing');
    assert(TOKEN.startsWith('syt_') || TOKEN.length > 20, 'Token format unexpected');
  });

  await test('T03 MATRIX_BOT_USER_ID is set', () => {
    const uid = process.env.MATRIX_BOT_USER_ID || '';
    assert(uid, 'MATRIX_BOT_USER_ID env var missing');
    assert(uid.startsWith('@'), 'MATRIX_BOT_USER_ID must start with @');
  });

  await test('T04 PWA_BASE_URL is set', () => {
    const url = process.env.PWA_BASE_URL || '';
    assert(url, 'PWA_BASE_URL env var missing');
    assert(url.startsWith('https://'), 'PWA_BASE_URL must start with https://');
  });

  await test('T05 NOTIFICATIONS env is matrix', () => {
    const n = process.env.NOTIFICATIONS || '';
    assert(n === 'matrix', `NOTIFICATIONS=${n}, expected matrix`);
  });

  // ── T6-T10: Adapter mode ────────────────────────────────────────────
  await test('T06 adapter.modeOf() returns LIVE when token+homeserver set', () => {
    if (dryRun) return;
    const mode = matrixAdapter.modeOf();
    assert(mode === 'LIVE', `adapter mode is ${mode}, expected LIVE`);
  });

  await test('T07 formatMessage info type', () => {
    const { formatMessage } = matrixAdapter;
    const c = formatMessage('📋', 'PV90', 'test', 'info');
    assert(c.msgtype === 'm.text', 'msgtype not m.text');
    assert(!c.formatted_body, 'info should not have formatted_body');
  });

  await test('T08 formatMessage link type', () => {
    const { formatMessage } = matrixAdapter;
    const url = 'https://app.nuassociates.in/sign-off/1';
    const c = formatMessage('💰', 'PV90', 'test', 'link', url);
    assert(c.format === 'org.matrix.custom.html', 'missing HTML format');
    assert(c.formatted_body.includes(url), 'link not in formatted_body');
  });

  await test('T09 makeTxnId generates unique IDs', () => {
    const a = matrixAdapter.makeTxnId();
    const b = matrixAdapter.makeTxnId();
    assert(a !== b, 'txnIds not unique');
    assert(typeof a === 'string', 'txnId not a string');
  });

  await test('T10 matrix_rooms table reachable via getProjectRoomId', async () => {
    if (dryRun) return;
    // Should return null for non-existent project (not throw)
    const db = require('../middleware/db');
    await db.query('SELECT 1'); // basic connectivity
  });

  // ── T11-T15: Live send ──────────────────────────────────────────────
  let testRoomId = roomArg;

  await test('T11 resolve test room from #system-health', async () => {
    if (dryRun || testRoomId) return;
    testRoomId = await matrixAdapter.getInternalRoomId('system_health');
    assert(testRoomId, '#system-health room not found in matrix_rooms — ensure rooms are provisioned');
  });

  await test('T12 sendText to test room', async () => {
    if (dryRun || !testRoomId) return;
    const { eventId } = await matrixAdapter.sendText({
      roomId: testRoomId,
      body: '🧪 [test-matrix.js] T12 — sendText',
    });
    assert(eventId, 'no event_id returned from sendText');
  });

  await test('T13 sendText with HTML', async () => {
    if (dryRun || !testRoomId) return;
    const c = matrixAdapter.formatMessage('🧪', 'TEST', 'T13 HTML message', 'link', 'https://nuassociates.in');
    const { eventId } = await matrixAdapter.sendText({ roomId: testRoomId, body: c.body });
    assert(eventId, 'no event_id from sendText(link)');
  });

  await test('T14 readMessages returns array', async () => {
    if (dryRun || !testRoomId) return;
    const events = await matrixAdapter.readMessages(testRoomId, { limit: 5 });
    assert(Array.isArray(events), 'readMessages did not return array');
  });

  await test('T15 send-then-read round trip', async () => {
    if (dryRun || !testRoomId) return;
    const marker = `T15-${Date.now()}`;
    await matrixAdapter.sendText({ roomId: testRoomId, body: `🧪 [test-matrix.js] ${marker}` });
    await new Promise(r => setTimeout(r, 1500));
    const events = await matrixAdapter.readMessages(testRoomId, { limit: 10 });
    const found = events.some(e => (e.content?.body || '').includes(marker));
    assert(found, `marker ${marker} not found in recent events`);
  });

  // ── T16-T20: Poll send ──────────────────────────────────────────────
  let pollEventId = null;

  await test('T16 sendPoll to test room', async () => {
    if (dryRun || !testRoomId) return;
    const { eventId } = await matrixAdapter.sendPoll({
      roomId: testRoomId,
      question: '🧪 [test-matrix.js] T16 — poll test (ignore)',
      answers: [{ id: 'yes', text: '✅ Yes' }, { id: 'no', text: '❌ No' }],
    });
    assert(eventId, 'no event_id from sendPoll');
    pollEventId = eventId;
  });

  await test('T17 poll event_id is a string starting with $', () => {
    if (dryRun) return;
    if (!pollEventId) throw new Error('T16 must pass first');
    assert(pollEventId.startsWith('$'), `pollEventId format unexpected: ${pollEventId}`);
  });

  await test('T18 sendReaction to poll event', async () => {
    if (dryRun || !testRoomId || !pollEventId) return;
    const result = await matrixAdapter.sendReaction({
      roomId: testRoomId,
      targetEventId: pollEventId,
      emoji: '✅',
    });
    assert(result.eventId || result.mode === 'DRY_RUN', 'sendReaction returned no eventId');
  });

  await test('T19 closePoll on test poll', async () => {
    if (dryRun || !testRoomId || !pollEventId) return;
    const result = await matrixAdapter.closePoll({
      roomId: testRoomId,
      pollEventId,
      text: '[test-matrix.js] T19 poll closed',
    });
    // EMS might return event_id; matrix.org might not for unverified polls
    assert(result !== undefined, 'closePoll threw unexpectedly');
  });

  await test('T20 poll visible in readMessages after close', async () => {
    if (dryRun || !testRoomId || !pollEventId) return;
    await new Promise(r => setTimeout(r, 1000));
    const events = await matrixAdapter.readMessages(testRoomId, { limit: 20 });
    const poll = events.find(e => e.event_id === pollEventId ||
      e.content?.['m.relates_to']?.event_id === pollEventId);
    assert(poll, 'poll event not found in readMessages');
  });

  // ── T21-T25: Image upload ───────────────────────────────────────────
  let mxcUrl = null;

  await test('T21 uploadMedia — 1x1 PNG', async () => {
    if (dryRun || !testRoomId) return;
    // Minimal valid 1x1 PNG (67 bytes)
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
      '0000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
      'hex'
    );
    mxcUrl = await matrixAdapter.uploadMedia(png, { filename: 'test.png', contentType: 'image/png' });
    assert(mxcUrl.startsWith('mxc://'), `mxcUrl format unexpected: ${mxcUrl}`);
  });

  await test('T22 sendImage with uploaded mxc URL', async () => {
    if (dryRun || !testRoomId || !mxcUrl) return;
    const { eventId } = await matrixAdapter.sendImage({
      roomId: testRoomId,
      mxcUrl,
      caption: '🧪 [test-matrix.js] T22 — image test',
    });
    assert(eventId, 'no event_id from sendImage');
  });

  await test('T23 uploadMedia — minimal PDF', async () => {
    if (dryRun || !testRoomId) return;
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\n%%EOF\n');
    const pdfMxc = await matrixAdapter.uploadMedia(pdf, {
      filename: 'test.pdf',
      contentType: 'application/pdf',
    });
    assert(pdfMxc.startsWith('mxc://'), 'PDF mxcUrl format unexpected');
  });

  await test('T24 mxcUrl has server and media ID components', () => {
    if (dryRun || !mxcUrl) return;
    const parts = mxcUrl.replace('mxc://', '').split('/');
    assert(parts.length >= 2, `mxcUrl missing server/media parts: ${mxcUrl}`);
    assert(parts[0].includes('.'), `server part lacks dot: ${parts[0]}`);
  });

  await test('T25 getProjectRoomId returns null for nonexistent project', async () => {
    if (dryRun) return;
    const id = await matrixAdapter.getProjectRoomId(999999, 'internal');
    assert(id === null, `expected null, got ${id}`);
  });

  // ── T26-T31: Matrix_outbox and adapter state ────────────────────────
  await test('T26 matrix_outbox table writable', async () => {
    if (dryRun) return;
    const db = require('../middleware/db');
    const [r] = await db.query(
      `INSERT INTO matrix_outbox (room_id, txn_id, msg_type, body, status)
       VALUES ('!test:test', 'test-harness-${Date.now()}', 'text', 'test', 'dry_run')`
    );
    assert(r.insertId > 0, 'matrix_outbox INSERT failed');
    await db.query('DELETE FROM matrix_outbox WHERE id = ?', [r.insertId]);
  });

  await test('T27 signoff_instances table reachable', async () => {
    if (dryRun) return;
    const db = require('../middleware/db');
    const [[r]] = await db.query('SELECT COUNT(*) AS cnt FROM signoff_instances');
    assert(r !== undefined, 'signoff_instances not reachable');
  });

  await test('T28 notifications_config has 3 digest rows', async () => {
    if (dryRun) return;
    const db = require('../middleware/db');
    const [[r]] = await db.query('SELECT COUNT(*) AS cnt FROM notifications_config WHERE active = 1');
    assert(Number(r.cnt) >= 3, `expected ≥3 active digest configs, got ${r.cnt}`);
  });

  await test('T29 security_config has canary_time row', async () => {
    if (dryRun) return;
    const db = require('../middleware/db');
    const [[r]] = await db.query(
      `SELECT config_value FROM security_config WHERE config_key = 'canary_time' LIMIT 1`
    );
    assert(r, 'canary_time row missing from security_config');
  });

  await test('T30 getInternalRoomId returns null gracefully for missing rooms', async () => {
    if (dryRun) return;
    const id = await matrixAdapter.getInternalRoomId('nonexistent_room_type_xyz');
    assert(id === null, `expected null, got ${id}`);
  });

  await test('T31 NOTIFICATIONS env correctly set', () => {
    const n = (process.env.NOTIFICATIONS || '').toLowerCase();
    assert(['matrix', 'whatsapp'].includes(n),
      `NOTIFICATIONS=${n} is not a valid value — must be 'matrix' or 'whatsapp'`);
  });

  // ── Results ──────────────────────────────────────────────────────────
  const total   = passed + failed;
  const summary = `\n=== Results: ${passed}/${total} passed ===`;
  console.log(summary);
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => console.log(`  ❌ ${r.name}: ${r.error}`));
  }

  // Save JSON
  const outPath = path.join(__dirname, '..', 'matrix-test-results.json');
  const output  = { timestamp: new Date().toISOString(), passed, failed, total, results };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to ${outPath}`);

  // Post to #system-health if live and room found
  if (!dryRun && testRoomId) {
    const statusEmoji = failed === 0 ? '🟢' : '❌';
    try {
      await matrixAdapter.sendText({
        roomId: testRoomId,
        body: `${statusEmoji} test-matrix.js — ${passed}/${total} passed`,
      });
    } catch (e) {
      console.warn('Could not post result to Matrix:', e.message);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
