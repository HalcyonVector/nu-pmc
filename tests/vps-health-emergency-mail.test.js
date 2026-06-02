// tests/vps-health-emergency-mail.test.js
// ============================================================
// Prevent-return test for the Phase 2 migration of scripts/vps-health.js:
// it must NOT call services/whatsapp (Twilio path is being retired) and
// MUST go through services/emergency-mail (the decoupled fallback).
//
// If a future refactor accidentally re-introduces wa.send here, this test
// fails. Pair this with the dispatch-substrate-lint allowlist update in
// the same migration to ensure both directions are guarded.
// ============================================================

'use strict';

const fs = require('fs');
const path = require('path');

describe('scripts/vps-health.js — emergency-mail migration', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'scripts/vps-health.js'),
    'utf8'
  );

  test('does NOT require services/whatsapp', () => {
    // Twilio path is retired for VPS alerts. The whole point of this
    // migration is that VPS alerts go via SMTP, not via the substrate
    // that is itself one of the things being checked.
    expect(src).not.toMatch(/require\(['"][^'"]*services\/whatsapp['"]\)/);
  });

  test('does NOT actually call wa.send (await/return form, not just mention)', () => {
    // Match real call sites: `await wa.send(`, `wa.send(...)` as a statement,
    // `return wa.send(...)`. This permits a code-comment that REFERENCES
    // wa.send to explain the migration without tripping the test.
    expect(src).not.toMatch(/\bawait\s+wa\.send\b/);
    expect(src).not.toMatch(/\breturn\s+wa\.send\b/);
    expect(src).not.toMatch(/^\s*wa\.send\(/m);
  });

  test('uses services/emergency-mail for alerts', () => {
    expect(src).toMatch(/require\(['"][^'"]*services\/emergency-mail['"]\)/);
    expect(src).toMatch(/sendEmergency\(/);
  });

  test('logs alert text to console.error before attempting send', () => {
    // The journal is the receipt of last resort. Even if SMTP is also
    // broken, the alert text MUST land in stderr so it survives in the
    // host journal / docker logs / pm2 logs.
    const sendAlert = src.match(/async function sendAlert\(message\) \{[\s\S]*?\n\}/);
    expect(sendAlert).not.toBeNull();
    expect(sendAlert[0]).toMatch(/console\.error.*ALERT.*message/);
  });

  test('sendAlert tolerates emergency-mail being unavailable', () => {
    // The require() is wrapped in try/catch so a missing nodemailer
    // dep doesn't crash the cron run.
    const sendAlert = src.match(/async function sendAlert\(message\) \{[\s\S]*?\n\}/)[0];
    expect(sendAlert).toMatch(/try \{[\s\S]*require\(['"][^'"]*emergency-mail['"]\)/);
  });

  test('does NOT throw — it is a fire-alarm path', () => {
    // sendAlert must never throw. Errors are logged.
    const sendAlert = src.match(/async function sendAlert\(message\) \{[\s\S]*?\n\}/)[0];
    expect(sendAlert).not.toMatch(/\bthrow\b/);
  });
});
