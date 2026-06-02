// tests/api-call-discipline.test.js
// Prevent-return guard for B21 — frontend must use API.call() (which
// includes the audit-role intercept and 401-redirect handling) instead of
// raw fetch() for /api routes. Direct fetch is allowed only for the
// client-error reporter (which would recurse if it called itself via
// API.call, since /api/log/client-error is itself a state-changing endpoint).

'use strict';
const fs = require('fs');
const path = require('path');

describe('frontend — every /api request goes through API.call', () => {
  test('public/js/app.js has no direct fetch() to /api/...', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    // Look for fetch('/api/...) or fetch(`/api/...`)
    const matches = [...src.matchAll(/fetch\(['"`]\/api\b/g)];
    if (matches.length > 0) {
      // Find the line numbers for a useful failure message
      const lines = src.split('\n');
      const offending = [];
      let pos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (/fetch\(['"`]\/api\b/.test(lines[i])) offending.push(i + 1);
        pos += lines[i].length + 1;
      }
      throw new Error(
        `${matches.length} direct fetch('/api/...') call(s) found in app.js at line(s): ${offending.join(', ')}. ` +
        `Use API.call('POST', path, formData, true) for multipart uploads — that path includes the ` +
        `audit-role intercept (read-only test accounts) and 401-redirect handling that direct fetch skips.`
      );
    }
    expect(matches.length).toBe(0);
  });

  test('api.js itself is the ONLY file allowed to call fetch on /api', () => {
    // Sanity: confirm api.js DOES still have its single fetch (the one inside API.call)
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'api.js'), 'utf8');
    expect(src).toMatch(/fetch\(['"`]\/api/);
  });
});
