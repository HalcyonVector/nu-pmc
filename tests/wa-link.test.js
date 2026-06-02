// tests/wa-link.test.js
// ============================================================
// Tests for services/wa-link.js — phone normalisation + URL building.
// ============================================================

const wa = require('../services/wa-link');

describe('wa-link.normalisePhone', () => {
  test('handles +91 prefix', () => {
    expect(wa.normalisePhone('+919876543210')).toBe('919876543210');
  });
  test('handles 91 prefix without +', () => {
    expect(wa.normalisePhone('919876543210')).toBe('919876543210');
  });
  test('handles spaces and dashes', () => {
    expect(wa.normalisePhone('+91 98765-43210')).toBe('919876543210');
  });
  test('assumes Indian default for bare 10-digit number', () => {
    expect(wa.normalisePhone('9876543210')).toBe('919876543210');
  });
  test('returns null for empty input', () => {
    expect(wa.normalisePhone('')).toBeNull();
    expect(wa.normalisePhone(null)).toBeNull();
    expect(wa.normalisePhone(undefined)).toBeNull();
  });
  test('returns null for too-short numbers', () => {
    expect(wa.normalisePhone('12345')).toBeNull();
  });
  test('returns null for over-long numbers', () => {
    expect(wa.normalisePhone('1234567890123456')).toBeNull();
  });
  test('handles non-Indian +country codes', () => {
    // US number with country code
    expect(wa.normalisePhone('+1 (415) 555-1234')).toBe('14155551234');
  });

  test('strips leading zero (legacy Indian STD prefix)', () => {
    // Production vendor master has entries written as "0 98765 43210" —
    // wa.me refuses "09876543210" as routable. Normaliser must drop the
    // leading 0, then apply the +91 default.
    expect(wa.normalisePhone('0 98765 43210')).toBe('919876543210');
    expect(wa.normalisePhone('098765 43210')).toBe('919876543210');
  });

  test('strips double-zero international prefix', () => {
    // "00" is the European-style international dial prefix (equivalent to "+").
    // wa.me wants no leading 0s before the country code.
    expect(wa.normalisePhone('00919876543210')).toBe('919876543210');
  });

  test('returns null when input is all zeros', () => {
    expect(wa.normalisePhone('000')).toBeNull();
    expect(wa.normalisePhone('00000')).toBeNull();
  });

  // B10 — embedded trunk-prefix 0 after country code
  test('strips embedded trunk-prefix 0 after India CC (+91 0 NNN…)', () => {
    expect(wa.normalisePhone('+91 0 98765 43210')).toBe('919876543210');
  });
  test('strips embedded trunk-prefix 0 after UK CC (+44 0 NNN…)', () => {
    // UK numbers are commonly written with the trunk prefix in parentheses:
    // "+44 (0) 207 123 4567". After digit-strip the 0 sits between CC and the
    // local number; wa.me won't route it.
    expect(wa.normalisePhone('+44 (0) 207 123 4567')).toBe('442071234567');
  });
  test('does not strip middle digits when CC=44 length is already 12', () => {
    // 12-digit forms (no trunk prefix) must be left alone.
    expect(wa.normalisePhone('+44 207 1234567')).toBe('442071234567');
  });
});

describe('wa-link.buildLink', () => {
  test('produces a wa.me URL with encoded message', () => {
    const url = wa.buildLink({ phone: '+919876543210', message: 'Hello — confirm please' });
    expect(url).toBe('https://wa.me/919876543210?text=Hello%20%E2%80%94%20confirm%20please');
  });
  test('returns null when phone is unparseable', () => {
    expect(wa.buildLink({ phone: 'not-a-phone', message: 'x' })).toBeNull();
  });
  test('handles empty message', () => {
    expect(wa.buildLink({ phone: '919876543210' })).toBe('https://wa.me/919876543210?text=');
  });
  test('encodes URL-special characters', () => {
    const url = wa.buildLink({ phone: '919876543210', message: 'see https://x.com?a=1&b=2' });
    expect(url).toContain('https%3A%2F%2Fx.com%3Fa%3D1%26b%3D2');
  });
});

describe('wa-link.buildOnboardLink', () => {
  test('uses bank_confirm preamble', () => {
    const url = wa.buildOnboardLink({
      phone: '919876543210', vendorName: 'Acme Civil',
      tokenUrl: 'https://test.in/x/abc', purpose: 'bank_confirm',
    });
    expect(decodeURIComponent(url)).toContain('Acme Civil');
    expect(decodeURIComponent(url)).toContain('payment details');
    expect(decodeURIComponent(url)).toContain('https://test.in/x/abc');
    expect(decodeURIComponent(url)).toContain('48h');
  });
  test('uses re_validation preamble', () => {
    const url = wa.buildOnboardLink({
      phone: '919876543210', vendorName: 'Acme',
      tokenUrl: 'https://test.in/x/abc', purpose: 're_validation',
    });
    expect(decodeURIComponent(url)).toContain('migrating');
  });
  test('defaults to onboard preamble for unknown purpose', () => {
    const url = wa.buildOnboardLink({
      phone: '919876543210', vendorName: 'Acme',
      tokenUrl: 'https://test.in/x/abc', purpose: 'something_unknown',
    });
    expect(decodeURIComponent(url)).toContain('onboarding');
  });
});

describe('wa-link.buildTwilioRecipient', () => {
  const { buildTwilioRecipient } = require('../services/wa-link');

  test('formats raw 10-digit Indian number with whatsapp:+91 prefix', () => {
    expect(buildTwilioRecipient('9876543210')).toBe('whatsapp:+919876543210');
  });

  test('handles leading zero (legacy STD prefix) — bug that wa-link.normalisePhone fixed', () => {
    expect(buildTwilioRecipient('0 98765 43210')).toBe('whatsapp:+919876543210');
  });

  test('handles 00 international prefix — bug that wa-link.normalisePhone fixed', () => {
    expect(buildTwilioRecipient('00919876543210')).toBe('whatsapp:+919876543210');
  });

  test('passes through pre-formatted whatsapp: ID unchanged', () => {
    expect(buildTwilioRecipient('whatsapp:+12025551234')).toBe('whatsapp:+12025551234');
  });

  test('returns null for empty / null input', () => {
    expect(buildTwilioRecipient('')).toBeNull();
    expect(buildTwilioRecipient(null)).toBeNull();
    expect(buildTwilioRecipient(undefined)).toBeNull();
  });

  test('returns null for unparseable phone', () => {
    expect(buildTwilioRecipient('abc')).toBeNull();
  });
});
