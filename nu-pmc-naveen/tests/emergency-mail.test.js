// tests/emergency-mail.test.js
// ============================================================
// Tests for services/emergency-mail.js
//
// Covers:
//   - Soft-fail when env vars missing (never throws)
//   - Soft-fail when nodemailer not installed (never throws)
//   - Argument validation (subject + body required)
//
// Does NOT test actual SMTP delivery — that belongs in integration
// tests against a real relay. The unit boundary is "the helper
// builds the right call and surfaces the right outcome shape."
// ============================================================

'use strict';

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  // Clear emergency env vars between tests so config() returns a clean
  // missing-vars list in the negative cases.
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('EMERGENCY_')) delete process.env[k];
  }
});

afterAll(() => {
  process.env = { ...ORIG_ENV };
});

describe('emergency-mail.sendEmergency', () => {
  test('returns sent:false with reason when subject is missing', async () => {
    const em = require('../services/emergency-mail');
    const out = await em.sendEmergency({ body: 'something is on fire' });
    expect(out.sent).toBe(false);
    expect(out.reason).toMatch(/subject and body required/);
  });

  test('returns sent:false with reason when body is missing', async () => {
    const em = require('../services/emergency-mail');
    const out = await em.sendEmergency({ subject: 'x' });
    expect(out.sent).toBe(false);
    expect(out.reason).toMatch(/subject and body required/);
  });

  test('returns sent:false with missing-env reason when no SMTP env set', async () => {
    const em = require('../services/emergency-mail');
    const out = await em.sendEmergency({ subject: 'fire', body: 'hot' });
    expect(out.sent).toBe(false);
    expect(out.reason).toMatch(/missing env/);
    expect(out.reason).toMatch(/EMERGENCY_SMTP_HOST/);
    expect(out.reason).toMatch(/EMERGENCY_SMTP_USER/);
    expect(out.reason).toMatch(/EMERGENCY_SMTP_PASS/);
    expect(out.reason).toMatch(/EMERGENCY_ALERT_TO/);
  });

  test('does not throw when nodemailer is unavailable', async () => {
    process.env.EMERGENCY_SMTP_HOST = 'smtp.example.com';
    process.env.EMERGENCY_SMTP_USER = 'alerts@example.com';
    process.env.EMERGENCY_SMTP_PASS = 'app-password';
    process.env.EMERGENCY_ALERT_TO  = 'naveen@example.com';

    // Force require('nodemailer') to throw by stubbing the module loader.
    // Easiest reliable way: jest.doMock with a factory that throws.
    jest.doMock('nodemailer', () => {
      throw new Error('Cannot find module');
    }, { virtual: true });

    const em = require('../services/emergency-mail');
    const out = await em.sendEmergency({ subject: 'x', body: 'y' });
    expect(out.sent).toBe(false);
    expect(out.reason).toMatch(/nodemailer not installed/);
  });
});

describe('emergency-mail._config', () => {
  test('reports all four required env vars when none set', () => {
    const em = require('../services/emergency-mail');
    const { missing } = em._config();
    expect(missing).toEqual(expect.arrayContaining([
      'EMERGENCY_SMTP_HOST',
      'EMERGENCY_SMTP_USER',
      'EMERGENCY_SMTP_PASS',
      'EMERGENCY_ALERT_TO',
    ]));
  });

  test('defaults FROM to SMTP_USER when EMERGENCY_ALERT_FROM not set', () => {
    process.env.EMERGENCY_SMTP_HOST = 'smtp.example.com';
    process.env.EMERGENCY_SMTP_USER = 'alerts@example.com';
    process.env.EMERGENCY_SMTP_PASS = 'p';
    process.env.EMERGENCY_ALERT_TO  = 'naveen@example.com';

    const em = require('../services/emergency-mail');
    const { cfg, missing } = em._config();
    expect(missing).toEqual([]);
    expect(cfg.from).toBe('alerts@example.com');
  });

  test('uses EMERGENCY_ALERT_FROM when set', () => {
    process.env.EMERGENCY_SMTP_HOST = 'smtp.example.com';
    process.env.EMERGENCY_SMTP_USER = 'svc@example.com';
    process.env.EMERGENCY_SMTP_PASS = 'p';
    process.env.EMERGENCY_ALERT_TO  = 'n@example.com';
    process.env.EMERGENCY_ALERT_FROM = 'no-reply-alerts@example.com';

    const em = require('../services/emergency-mail');
    const { cfg } = em._config();
    expect(cfg.from).toBe('no-reply-alerts@example.com');
  });

  test('parses port as integer with default 587', () => {
    process.env.EMERGENCY_SMTP_HOST = 'smtp.example.com';
    process.env.EMERGENCY_SMTP_USER = 'a@b.c';
    process.env.EMERGENCY_SMTP_PASS = 'p';
    process.env.EMERGENCY_ALERT_TO  = 'x@y.z';

    const em = require('../services/emergency-mail');
    expect(em._config().cfg.port).toBe(587);

    process.env.EMERGENCY_SMTP_PORT = '465';
    jest.resetModules();
    const em2 = require('../services/emergency-mail');
    expect(em2._config().cfg.port).toBe(465);
  });
});
