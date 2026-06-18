// tests/matrix-retry-4xx.test.js
// Prevent-return guard for B15 — Matrix retry classifier must treat
// 408/425/429 as retryable, not terminal. Earlier the rule was
// "all 4xx → terminal" which silently dropped messages whenever Synapse
// timed out (408), MSC2832-raced (425), or rate-limited us (429).

'use strict';
const fs = require('fs');
const path = require('path');

describe('B15 — matrix-adapter 4xx classifier', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'services/matrix-adapter.js'), 'utf8'
  );

  test('exports a RETRYABLE_4XX set including 408, 425, 429', () => {
    expect(src).toMatch(/RETRYABLE_4XX\s*=\s*new Set\(\[\s*408\s*,\s*425\s*,\s*429\s*\]\s*\)/);
  });

  test('exposes _isTerminal4xx helper', () => {
    expect(src).toMatch(/function _isTerminal4xx\(/);
  });

  test('every catch block routes via _isTerminal4xx, not raw 4xx range check', () => {
    // The 3 send paths (sendText, sendPoll, sendImage) each have a catch
    // block that classifies the error. All three must use the shared helper.
    const helperCalls = [...src.matchAll(/_isTerminal4xx\(/g)];
    expect(helperCalls.length).toBeGreaterThanOrEqual(3);

    // No raw `status >= 400 && status < 500` pattern outside the helper
    // definition itself. The helper itself contains exactly that expression.
    const rawRangeChecks = [...src.matchAll(/status >= 400 && status < 500/g)];
    // Exactly one — inside _isTerminal4xx itself.
    expect(rawRangeChecks.length).toBe(1);
  });

  test('helper logic: 408/425/429 are NOT terminal; 400/403/404/409 ARE', () => {
    // exec the source-defined helper in an isolated function
    const setMatch = src.match(/RETRYABLE_4XX\s*=\s*new Set\([\s\S]+?\);/)[0];
    const fnMatch  = src.match(/function _isTerminal4xx[\s\S]+?\}/)[0];
    // eslint-disable-next-line no-new-func
    const helper   = new Function(`const ${setMatch} ${fnMatch} return _isTerminal4xx;`)();

    expect(helper(408)).toBe(false);
    expect(helper(425)).toBe(false);
    expect(helper(429)).toBe(false);

    expect(helper(400)).toBe(true);
    expect(helper(401)).toBe(true);
    expect(helper(403)).toBe(true);
    expect(helper(404)).toBe(true);
    expect(helper(409)).toBe(true);

    // Network / 5xx → not terminal-4xx (separate bucket — also retryable)
    expect(helper(0)).toBe(false);
    expect(helper(500)).toBe(false);
    expect(helper(503)).toBe(false);
  });
});
