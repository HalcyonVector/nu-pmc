// tests/phase2-abstractions.test.js
// Prevent-return: three Phase 2 abstractions from v2 brief C11/C12/C13.
'use strict';

const fs   = require('fs');
const path = require('path');

describe('C13 — formatMessage in matrix-adapter', () => {
  const { formatMessage } = require('../services/matrix-adapter');
  const THICK = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬';   // 14 chars per delta brief §10.2

  test('exists as exported function', () => {
    expect(typeof formatMessage).toBe('function');
  });

  test('info returns plain text content object', () => {
    const c = formatMessage('✍️', 'PV90', 'Daily report submitted', 'info');
    expect(c.msgtype).toBe('m.text');
    expect(c.body).toContain('✍️');
    expect(c.body).toContain('PV90');
    expect(c.body).toContain('Daily report submitted');
    expect(c.formatted_body).toBeUndefined();
  });

  test('link returns HTML content object with href', () => {
    const url = 'https://app.nuassociates.in/sign-off/123';
    const c = formatMessage('💰', 'PV90', 'Payment batch', 'link', url);
    expect(c.msgtype).toBe('m.text');
    expect(c.format).toBe('org.matrix.custom.html');
    expect(c.formatted_body).toContain(`href='${url}'`);
    expect(c.body).toContain(url);
  });

  test('no hardcoded domain — uses actionPayload verbatim', () => {
    const url = 'https://staging.nuassociates.in/sign-off/99';
    const c = formatMessage('📄', 'NW22', 'Change notice', 'link', url);
    expect(c.body).toContain(url);
    expect(c.formatted_body).toContain(url);
  });

  // Delta brief §10.2 — visual format tested on iPhone 16 Pro Max.
  test('info messages are bookended by THICK rule', () => {
    const c = formatMessage('✍️', 'PV90', 'Daily report submitted', 'info');
    // Opening rule
    expect(c.body.startsWith(THICK + '\n')).toBe(true);
    // Closing rule
    expect(c.body).toContain('\n\n' + THICK);
    // NBSP final line — survives whitespace stripping
    expect(c.body.endsWith('\n\u00A0')).toBe(true);
  });

  test('link messages are bookended by THICK rule (text + html)', () => {
    const url = 'https://app.example.com/sign-off/1';
    const c = formatMessage('✍️', 'PV90', 'GRN approval', 'link', url);
    expect(c.body.startsWith(THICK + '\n')).toBe(true);
    expect(c.body).toContain('\n\n' + THICK);
    expect(c.body.endsWith('\n\u00A0')).toBe(true);
    expect(c.formatted_body.startsWith('<p>' + THICK + '</p>')).toBe(true);
    expect(c.formatted_body.endsWith('<p>&nbsp;</p>')).toBe(true);
  });

  test('THICK rule is exactly 14 chars (do not lengthen — wraps on phones)', () => {
    expect(THICK.length).toBe(14);
    const c = formatMessage('✍️', 'PV90', 'x', 'info');
    // Source line up to first newline must equal THICK
    const firstLine = c.body.split('\n')[0];
    expect(firstLine).toBe(THICK);
  });
});

describe('C11 — sendDigest shape', () => {
  const digestSrc = fs.readFileSync(
    path.join(__dirname, '..', 'services/digest.js'), 'utf8'
  );

  test('exports sendDigest as the single entry point', () => {
    expect(digestSrc).toMatch(/module\.exports\s*=\s*\{[^}]*sendDigest/);
  });

  test('reads thresholds from project_thresholds — not hardcoded', () => {
    expect(digestSrc).toMatch(/FROM project_thresholds/);
    expect(digestSrc).not.toMatch(/overdue_days\s*=\s*2\b/);
    expect(digestSrc).not.toMatch(/float_days\s*=\s*3\b/);
  });

  test('reads digest schedule from notifications_config, not hardcoded times', () => {
    // The runner reads from notifications_config; the digest function
    // receives digestType. No hardcoded '07:00' or '21:00' here.
    expect(digestSrc).not.toMatch(/'07:00'/);
    expect(digestSrc).not.toMatch(/'21:00'/);
  });

  test('three digest types handled', () => {
    expect(digestSrc).toMatch(/morning_pmc/);
    expect(digestSrc).toMatch(/principal/);
    expect(digestSrc).toMatch(/closeout/);
  });
});

describe('C12 — runCanaryCheck shape', () => {
  const { runCanaryCheck, runAllCanaryChecks } = require('../services/canary');

  test('runCanaryCheck exported', () => {
    expect(typeof runCanaryCheck).toBe('function');
  });

  test('runAllCanaryChecks exported', () => {
    expect(typeof runAllCanaryChecks).toBe('function');
  });

  test('runCanaryCheck returns {name, passed, error}', async () => {
    const result = await runCanaryCheck(
      'test-pass',
      async () => {},
      async () => {},
      async () => {},
    );
    expect(result).toMatchObject({ name: 'test-pass', passed: true, error: null });
  });

  test('runCanaryCheck captures failure correctly', async () => {
    const result = await runCanaryCheck(
      'test-fail',
      async () => { throw new Error('ping failed'); },
      async () => {},
      async () => {},
    );
    expect(result.passed).toBe(false);
    expect(result.error).toMatch(/ping failed/);
  });
});
