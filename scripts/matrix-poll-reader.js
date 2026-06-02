#!/usr/bin/env node
// scripts/matrix-poll-reader.js
// ============================================================
// Matrix poll-vote reader cron worker.
//
// Invoked by cron (or systemd timer) every 60 seconds. Runs:
//   1. expireOverdue()  — mark past-expiry rows
//   2. processVotes()   — scan rooms-with-pending-polls for new responses
//
// Single-instance via PID file lock. If a previous run is still in
// flight we exit immediately rather than risk double-dispatch. The cron
// frequency assumes a normal cycle takes <60s; if it consistently
// overshoots, increase the interval rather than allowing concurrency.
//
// Designed to be safe to restart: cursor advances per-room, idempotent
// supersede on registration, status='acted' is terminal.
//
// Phase 2 deliverable: this script wires the loop. Per-action handlers
// fire from a structured log line (Phase 2 stub) until Phase 3 ports
// them off services/wa-reply-actions.js.
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const LOCK_FILE = path.join('/tmp', 'matrix-poll-reader.lock');

// ── Lock handling ───────────────────────────────────────────────────

function _acquireLock() {
  try {
    // O_EXCL: fails if file exists. Atomic.
    const fd = fs.openSync(LOCK_FILE, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    // Lock exists. Check if owner is alive.
    try {
      const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
      if (Number.isFinite(pid) && pid > 0) {
        try {
          process.kill(pid, 0);  // signal 0 = check only
          return false;          // process still alive — abort
        } catch (_e) {
          // Stale lock — owner is dead. Take over.
          fs.unlinkSync(LOCK_FILE);
          return _acquireLock();
        }
      }
      // Garbled lock file — treat as stale.
      fs.unlinkSync(LOCK_FILE);
      return _acquireLock();
    } catch (e) {
      // Couldn't read lock — fail safe, abort.
      console.error('[matrix-poll-reader] lock check failed:', e.message);
      return false;
    }
  }
}

function _releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch (_e) { /* fine */ }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  if (!_acquireLock()) {
    // Previous run still in flight. Silent exit — cron will try again
    // next minute. Logging this would flood the journal under contention.
    process.exit(0);
  }

  // Late require so a missing DB module doesn't prevent lock release on
  // a misconfigured host. Both modules read env at call time.
  let db, replyActions;
  try {
    db           = require('../middleware/db');
    replyActions = require('../services/matrix-reply-actions');
  } catch (err) {
    console.error('[matrix-poll-reader] module load failed:', err.message);
    _releaseLock();
    process.exit(1);
  }

  const startedAt = Date.now();
  let expireResult = { expired: 0, closed: 0, errors: [] };
  let totals       = { rooms: 0, scanned: 0, dispatched: 0, ignored: 0 };

  try {
    expireResult = await replyActions.expireOverdue(db);
    totals       = await replyActions.processVotes(db);
  } catch (err) {
    console.error('[matrix-poll-reader] cycle failed:', err.message);
    _releaseLock();
    process.exit(1);
  }

  const ms = Date.now() - startedAt;
  // Single structured log line per cycle — operations can grep for
  // 'matrix-poll-reader cycle' to monitor health.
  console.log('[matrix-poll-reader] cycle', JSON.stringify({
    duration_ms: ms,
    rooms:       totals.rooms,
    scanned:     totals.scanned,
    dispatched:  totals.dispatched,
    ignored:     totals.ignored,
    expired:     expireResult.expired,
    closed:      expireResult.closed,
    expire_errors: expireResult.errors.length,
  }));

  _releaseLock();
  // Don't process.exit(0) — let the event loop drain naturally so any
  // pending DB writes complete. db.end() is owned by the host process
  // not us; we're a one-shot script.
}

if (require.main === module) {
  main().catch(err => {
    console.error('[matrix-poll-reader] fatal:', err);
    _releaseLock();
    process.exit(1);
  });
}

module.exports = { _acquireLock, _releaseLock, LOCK_FILE };
