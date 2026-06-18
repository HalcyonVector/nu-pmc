// services/canary.js
// ============================================================
// runCanaryCheck — one function, five configurations.
//
// Per v2 brief C12 / P10.1:
//   "Five canary checks documented separately. One function, five
//    configurations. Called five times at 6AM from a scheduled job.
//    Each call has a different pingFn (what to test) and onFailureFn
//    (what to do if it fails). Results aggregated and posted to
//    #system-health."
//
// Adding a new canary = add a call in scripts/cron/canary-runner.js.
// No code change here.
// ============================================================

'use strict';

const matrixAdapter = require('./matrix-adapter');

/**
 * Run one canary check.
 *
 * @param {string}   name         human-readable check name for the report
 * @param {Function} pingFn       async () => void — throws on failure
 * @param {Function} onSuccessFn  async () => void — runs when pingFn passes
 * @param {Function} onFailureFn  async (err) => void — runs when pingFn throws
 * @returns {Promise<{name, passed, error}>}
 */
async function runCanaryCheck(name, pingFn, onSuccessFn, onFailureFn) {
  try {
    await pingFn();
    await onSuccessFn();
    return { name, passed: true, error: null };
  } catch (err) {
    try {
      await onFailureFn(err);
    } catch (hookErr) {
      console.error(`[canary] onFailureFn for "${name}" threw:`, hookErr.message);
    }
    return { name, passed: false, error: err.message };
  }
}

/**
 * Run an array of canary checks and post aggregated results to #system-health.
 *
 * Each entry: { name, pingFn, onSuccessFn, onFailureFn }
 * Results posted to the system-health Matrix room regardless of pass/fail.
 *
 * @param {Array} checks
 * @returns {Promise<{passed: number, failed: number, results: Array}>}
 */
async function runAllCanaryChecks(checks) {
  const results = [];

  for (const check of checks) {
    const result = await runCanaryCheck(
      check.name, check.pingFn, check.onSuccessFn, check.onFailureFn
    );
    results.push(result);
  }

  // Post aggregated result to #system-health
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const today  = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const statusEmoji = failed === 0 ? '🟢' : '❌';
  const lines = [
    `${statusEmoji} Canary — ${today} — ${passed}/${results.length} passed`,
    '──────────────────',
    ...results.map(r =>
      r.passed
        ? `  ✅ ${r.name}`
        : `  ❌ ${r.name} — ${r.error}`
    ),
  ];

  try {
    const systemHealthRoom = await matrixAdapter.getInternalRoomId('system_health');
    if (systemHealthRoom) {
      await matrixAdapter.sendText({
        roomId: systemHealthRoom,
        body: lines.join('\n'),
      });
    }
  } catch (postErr) {
    // If Matrix itself is down this will fail — that's expected.
    // The canary runner should have already fired the email fallback.
    console.error('[canary] failed to post results to #system-health:', postErr.message);
  }

  return { passed, failed, results };
}

module.exports = { runCanaryCheck, runAllCanaryChecks };
