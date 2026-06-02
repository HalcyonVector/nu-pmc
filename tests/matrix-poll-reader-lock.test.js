// tests/matrix-poll-reader-lock.test.js
// ============================================================
// Tests for the PID-file lock in scripts/matrix-poll-reader.js.
//
// Concurrency safety is critical: two concurrent runs would race on
// the matrix_pending_polls table and could double-dispatch a vote
// (firing the state transition twice). The lock must:
//
//   1. Acquire when no lock file exists (happy path)
//   2. Refuse to acquire when a live process holds it
//   3. Take over a stale lock (file exists but PID is dead)
//   4. Release cleanly
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

// Re-require fresh per test so LOCK_FILE constant is consistent.
function freshReader() {
  jest.resetModules();
  return require('../scripts/matrix-poll-reader');
}

beforeEach(() => {
  // Ensure no stale lock from a previous test run.
  try { fs.unlinkSync('/tmp/matrix-poll-reader.lock'); } catch (_e) { /* fine */ }
});

afterAll(() => {
  try { fs.unlinkSync('/tmp/matrix-poll-reader.lock'); } catch (_e) { /* fine */ }
});

describe('matrix-poll-reader lock', () => {
  test('acquires when no lock file exists', () => {
    const r = freshReader();
    expect(r._acquireLock()).toBe(true);
    expect(fs.existsSync(r.LOCK_FILE)).toBe(true);
    // Lock file contains current PID
    const pid = parseInt(fs.readFileSync(r.LOCK_FILE, 'utf8'), 10);
    expect(pid).toBe(process.pid);
    r._releaseLock();
  });

  test('release removes the lock file', () => {
    const r = freshReader();
    r._acquireLock();
    r._releaseLock();
    expect(fs.existsSync(r.LOCK_FILE)).toBe(false);
  });

  test('refuses to acquire when a live process holds the lock', () => {
    const r = freshReader();
    r._acquireLock();
    // Try to acquire a second time in the same process — same PID, but
    // process.kill(pid, 0) succeeds, so the lock is "held by a live
    // process" and we refuse.
    expect(r._acquireLock()).toBe(false);
    r._releaseLock();
  });

  test('takes over a stale lock whose PID is dead', () => {
    const r = freshReader();
    // Write a lock file for a definitely-dead PID. PID 0 is invalid
    // for kill but our check accepts any unkillable PID; using a
    // very high number that almost certainly does not exist.
    const deadPid = 2147483646; // INT_MAX - 1 — wildly unlikely to be live
    fs.writeFileSync(r.LOCK_FILE, String(deadPid));
    expect(r._acquireLock()).toBe(true);
    // Lock now held by us
    const pid = parseInt(fs.readFileSync(r.LOCK_FILE, 'utf8'), 10);
    expect(pid).toBe(process.pid);
    r._releaseLock();
  });

  test('handles garbled lock file as stale', () => {
    const r = freshReader();
    fs.writeFileSync(r.LOCK_FILE, 'not-a-pid');
    expect(r._acquireLock()).toBe(true);
    r._releaseLock();
  });
});
