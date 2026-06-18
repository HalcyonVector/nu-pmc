// tests/wa-sendtemplate-guard.test.js
// Prevent-return guard for B13 — sendTemplate must mirror send()'s dev-guard.
// Without this, calling sendTemplate in dev (no Twilio env vars) throws
// inside the provider on every call, gets caught, and floods stderr with
// "Twilio credentials not configured" once per send.

'use strict';
const fs = require('fs');
const path = require('path');

describe('B13 — sendTemplate has same dev-guard as send', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'services/whatsapp.js'), 'utf8'
  );

  test('_isConfigured helper exists and is shared', () => {
    expect(src).toMatch(/function _isConfigured\(/);
    // Both send and sendTemplate use it
    const sendFn = src.match(/async function send\([\s\S]+?\n\}/)[0];
    const tmplFn = src.match(/async function sendTemplate\([\s\S]+?\n\}/)[0];
    expect(sendFn).toMatch(/_isConfigured\(\)/);
    expect(tmplFn).toMatch(/_isConfigured\(\)/);
  });

  test('sendTemplate returns null and does not call provider when creds missing', async () => {
    // Stash + clear envs
    const savedSid    = process.env.TWILIO_ACCOUNT_SID;
    const savedAuth   = process.env.TWILIO_AUTH_TOKEN;
    const savedNumber = process.env.TWILIO_WA_NUMBER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WA_NUMBER;

    // Clear cached require
    delete require.cache[require.resolve('../services/whatsapp')];
    const wa = require('../services/whatsapp');

    // Quiet the warning
    const orig = console.warn;
    console.warn = () => {};
    try {
      const r = await wa.sendTemplate('919876543210', 'drawing_issued', { v: 1 });
      expect(r).toBeNull();
    } finally {
      console.warn = orig;
      // Restore envs
      if (savedSid)    process.env.TWILIO_ACCOUNT_SID = savedSid;
      if (savedAuth)   process.env.TWILIO_AUTH_TOKEN  = savedAuth;
      if (savedNumber) process.env.TWILIO_WA_NUMBER   = savedNumber;
    }
  });
});
