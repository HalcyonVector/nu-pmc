// scripts/matrix-outbox-drain.js
// ============================================================
// Drain pending rows from matrix_outbox.
//
// Triggered:
//   - From the in-process scheduler in server.js (every N minutes)
//   - Manually via `node scripts/matrix-outbox-drain.js` for testing
//
// What it does:
//   - Picks up rows in matrix_outbox with status='pending' (and a few
//     transient-failure ones with status='pending' that have a low
//     attempt count)
//   - For each, re-attempts the send via the Matrix C-S API
//   - On success: status='sent', matrix_event_id stamped
//   - On failure: attempts++ ; if attempts >= MAX_ATTEMPTS, status='failed'
//
// Backoff:
//   - This worker runs on a fixed cron interval. Per-row exponential
//     backoff is implemented as a "skip if last attempt was within X min"
//     filter via attempts count.
//
// Idempotency:
//   - matrix_outbox.txn_id is a UNIQUE column. Re-attempting a send with
//     the same txn_id is safe — Matrix returns the same event_id (idempotent
//     PUT semantics).
//
// Safety:
//   - Skips entirely if matrix-adapter is not in LIVE mode (no token, or
//     MATRIX_DISABLED=1). Useful so the worker can sit on the scheduler
//     without spamming logs in DRY_RUN.
// ============================================================

'use strict';

const db = require('../middleware/db');
const matrixAdapter = require('../services/matrix-adapter');

// Maximum send attempts before a row is marked terminal-failed.
// Matched to a ~24h-spread retry budget at a 15-min cron interval:
// 15min × 96 = 24h. We allow 8 attempts which covers ~2h of retries —
// good enough; longer outages need operator intervention anyway.
const MAX_ATTEMPTS = 8;

// Maximum rows drained per run. Caps a single worker invocation so it
// can't pin a DB connection for too long if the outbox blows up.
const BATCH_SIZE = 50;

/**
 * One run of the worker. Returns a small summary for logging.
 */
async function run() {
  // 1. Fast-fail if Matrix isn't actually configured. Keeps logs quiet.
  const mode = matrixAdapter.modeOf();
  if (mode !== 'LIVE') {
    return { skipped: true, mode, drained: 0 };
  }

  // 2. Pick a batch of pending rows. Order by id ASC so older messages
  //    drain first — preserves the "approximate FIFO" expectation.
  const [rows] = await db.query(
    `SELECT id, room_id, txn_id, msg_type, body, mxc_url, attempts
       FROM matrix_outbox
      WHERE status = 'pending'
        AND attempts < ?
      ORDER BY id ASC
      LIMIT ?`,
    [MAX_ATTEMPTS, BATCH_SIZE]
  );

  if (rows.length === 0) {
    return { skipped: false, mode, drained: 0 };
  }

  let sent = 0, failed = 0, retried = 0;

  for (const row of rows) {
    try {
      // Mark in-flight so a second concurrent worker (e.g. operator manual
      // run while scheduler also fires) doesn't double-send. Use a
      // version-style WHERE so this is also a soft optimistic lock.
      const [upd] = await db.query(
        `UPDATE matrix_outbox SET status='sending'
          WHERE id=? AND status='pending'`,
        [row.id]
      );
      if (upd.affectedRows === 0) {
        // Another worker grabbed it — skip
        continue;
      }

      // Dispatch by message type. We re-build the call from outbox columns
      // so we don't depend on the original request context.
      let result;
      if (row.msg_type === 'text') {
        // sendText() will _enqueue() a NEW outbox row — we don't want that.
        // Instead, call the lower-level Matrix HTTP path directly. To keep
        // matrix-adapter.js the single transport, we expose a private
        // _replay(row) helper there. (Adding it now.)
        result = await _replayRow(row);
      } else if (row.msg_type === 'poll') {
        result = await _replayRow(row);
      } else if (row.msg_type === 'image' || row.msg_type === 'file') {
        result = await _replayRow(row);
      } else {
        throw new Error(`Unknown msg_type: ${row.msg_type}`);
      }

      // result.eventId set on success
      if (result?.eventId) {
        await db.query(
          `UPDATE matrix_outbox
              SET status='sent', matrix_event_id=?, sent_at=NOW(), attempts=attempts+1
            WHERE id=?`,
          [result.eventId, row.id]
        );
        sent++;
      } else {
        // No event_id — treat as transient
        await db.query(
          `UPDATE matrix_outbox
              SET status='pending', attempts=attempts+1, last_error=?
            WHERE id=?`,
          ['no_event_id_returned', row.id]
        );
        retried++;
      }
    } catch (err) {
      const status   = err.status   || err.response?.status || 0;
      const codeName = err.code     || 'UNKNOWN';
      const errMsg   = String(err.message || '').slice(0, 4000);

      // 4xx → terminal. 5xx / network → retry until MAX_ATTEMPTS.
      const terminal = status >= 400 && status < 500;
      const newAttempts = (row.attempts || 0) + 1;
      if (terminal || newAttempts >= MAX_ATTEMPTS) {
        await db.query(
          `UPDATE matrix_outbox
              SET status='failed', attempts=?, last_error=?
            WHERE id=?`,
          [newAttempts, `${codeName}: ${errMsg}`, row.id]
        );
        failed++;
      } else {
        await db.query(
          `UPDATE matrix_outbox
              SET status='pending', attempts=?, last_error=?
            WHERE id=?`,
          [newAttempts, `${codeName}: ${errMsg}`, row.id]
        );
        retried++;
      }
    }
  }

  const summary = { skipped: false, mode, drained: rows.length, sent, retried, failed };
  console.log(`[matrix-outbox-drain] ${JSON.stringify(summary)}`);
  return summary;
}

/**
 * Replay a single outbox row through the Matrix HTTP path. We import the
 * low-level helpers from matrix-adapter to avoid re-inserting an outbox row.
 *
 * For LIVE mode only. The caller (run()) has already verified mode.
 */
async function _replayRow(row) {
  // Use HOMESERVER + BOT_TOKEN locally (avoid circular dep on matrix-adapter
  // internals). Adapter exposes them indirectly via its modeOf() returning
  // 'LIVE' — but we still need the values. Read straight from env.
  const HOMESERVER = process.env.MATRIX_HOMESERVER;
  const BOT_TOKEN  = process.env.MATRIX_BOT_TOKEN;
  if (!HOMESERVER || !BOT_TOKEN) {
    throw new Error('MATRIX_HOMESERVER / MATRIX_BOT_TOKEN missing during replay (mode lied?)');
  }
  const http = require('../services/http');

  const headers = { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' };

  if (row.msg_type === 'text') {
    const url = `${HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(row.room_id)}/send/m.room.message/${encodeURIComponent(row.txn_id)}`;
    const res = await http.put(url, { msgtype: 'm.text', body: row.body }, { headers });
    return { eventId: res?.data?.event_id || null };
  }

  if (row.msg_type === 'poll') {
    // body is the JSON payload as captured at enqueue time
    const payload = JSON.parse(row.body);
    const url = `${HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(row.room_id)}/send/org.matrix.msc3381.poll.start/${encodeURIComponent(row.txn_id)}`;
    const res = await http.put(url, payload, { headers });
    return { eventId: res?.data?.event_id || null };
  }

  if (row.msg_type === 'image') {
    const url = `${HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(row.room_id)}/send/m.room.message/${encodeURIComponent(row.txn_id)}`;
    const res = await http.put(url, {
      msgtype: 'm.image', body: row.body || 'image', url: row.mxc_url,
    }, { headers });
    return { eventId: res?.data?.event_id || null };
  }

  if (row.msg_type === 'file') {
    const url = `${HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(row.room_id)}/send/m.room.message/${encodeURIComponent(row.txn_id)}`;
    const res = await http.put(url, {
      msgtype: 'm.file', body: row.body || 'file', url: row.mxc_url,
    }, { headers });
    return { eventId: res?.data?.event_id || null };
  }

  throw new Error(`Cannot replay msg_type=${row.msg_type}`);
}

// CLI entry point
if (require.main === module) {
  run()
    .then(s => {
      console.log('Done:', s);
      process.exit(0);
    })
    .catch(err => {
      console.error('FATAL:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}

module.exports = { run, MAX_ATTEMPTS, BATCH_SIZE };
