// tests/wa-log-pii.test.js
// Prevent-return guard for B12 — WhatsApp transport must not log raw phone
// numbers or message body content. Use _redactPhone() (last-4-digit tail)
// and never interpolate `body` into a console line.

'use strict';
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('B12 — WhatsApp logs are PII-redacted', () => {
  test('services/whatsapp.js exposes _redactPhone helper', () => {
    const src = read('services/whatsapp.js');
    expect(src).toMatch(/function _redactPhone\(/);
  });

  test('services/whatsapp.js console.log/error never include raw `to` template var', () => {
    const src = read('services/whatsapp.js');
    // Find every console.* call and check it doesn't have ${to} (the un-redacted phone)
    const matches = [...src.matchAll(/console\.(log|warn|error)\([^;]*?\$\{to\}/g)];
    expect(matches).toEqual([]);
  });

  test('services/whatsapp.js console.log never includes ${body} or body excerpts', () => {
    const src = read('services/whatsapp.js');
    // body.substring or `${body...}` in a console line = leak
    const matches = [...src.matchAll(/console\.(log|warn|error)\([^;]*?(\$\{body|body\.substring)/g)];
    expect(matches).toEqual([]);
  });

  test('modules/system/routes/whatsapp.js sendWA logs redact phone', () => {
    const src = read('modules/system/routes/whatsapp.js');
    // file-scope helper present
    expect(src).toMatch(/function _redactPhone\(/);
    // All sendWA console lines pass to through the redactor (not raw)
    const sendWa = src.match(/async function sendWA\([\s\S]+?\n\}/);
    expect(sendWa).not.toBeNull();
    const matches = [...sendWa[0].matchAll(/console\.(log|error)\([^;]*?\$\{to\}/g)];
    expect(matches).toEqual([]);
  });

  test('_redactPhone produces last-4-digit format', () => {
    // Smoke-test the helper logic by exec-ing it
    const src = read('services/whatsapp.js');
    const fn = src.match(/function _redactPhone\(p\) \{[\s\S]+?\n\}/)[0];
    // eslint-disable-next-line no-new-func
    const helper = new Function(fn + '; return _redactPhone;')();
    expect(helper(null)).toBe('∅');
    expect(helper('')).toBe('∅');
    expect(helper('abc')).toBe('∅');             // <4 digits → blanked
    expect(helper('919876543210')).toBe('…3210');
    expect(helper('+91 98765 43210')).toBe('…3210');
    expect(helper('whatsapp:+919876543210')).toBe('…3210');
  });
});
