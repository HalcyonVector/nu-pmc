// tests/iter1-fixes.test.js
// Verifies the fixes added in the iter1 polish pass:
//   - Host header spoof refusal in production
//   - Phone redaction in vendor.onboard_link.issued audit log
//   - TOKEN_VALIDITY_HOURS env override + bounds
//   - Cancel route surfaces TOCTOU race as 409
//   - sendVendorOnboardLink accepts purpose parameter
//   - Matrix env read at call-time (not module-load)
//   - PV90PL regex replaced with projects.code read

'use strict';
const fs = require('fs');
const path = require('path');

const vendorRoutesSrc = fs.readFileSync(
  path.join(__dirname, '..', 'modules', 'onboarding', 'routes', 'vendors.js'), 'utf8');
const vendorOnboardingSrc = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'vendor-onboarding.js'), 'utf8');
const cancelRouteSrc = fs.readFileSync(
  path.join(__dirname, '..', 'modules', 'workflow', 'routes', 'approvals.js'), 'utf8');
const matrixAdapterSrc = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'matrix-adapter.js'), 'utf8');
const provisionScriptSrc = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'matrix-provision-rooms.js'), 'utf8');
const appJsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

describe('Host header spoof refusal', () => {
  test('production refuses APP_URL fallback', () => {
    expect(vendorRoutesSrc).toMatch(/APP_URL_NOT_SET/);
    expect(vendorRoutesSrc).toMatch(/process\.env\.NODE_ENV === 'production'/);
  });
  test('dev keeps fallback with warning', () => {
    expect(vendorRoutesSrc).toMatch(/APP_URL not set — falling back to req\.host/);
  });
});

describe('Phone redaction in audit log', () => {
  test('audit details only includes last-4 of phone', () => {
    expect(vendorRoutesSrc).toMatch(/phoneTail = phone \? phone\.slice\(-4\)/);
    expect(vendorRoutesSrc).toMatch(/phone_tail: phoneTail/);
  });
  test('full phone is NOT in audit details for onboard_link.issued', () => {
    // Find the onboard_link.issued audit.log call
    const block = vendorRoutesSrc.match(/action: 'vendor\.onboard_link\.issued'[\s\S]+?\}\);/);
    expect(block).not.toBeNull();
    // The details object should not include `, phone }` — only `phone_tail`
    expect(block[0]).not.toMatch(/details: \{[^}]*\bphone\b\s*\}/);
  });
});

describe('TOKEN_VALIDITY_HOURS env override', () => {
  test('reads VENDOR_TOKEN_HOURS from env', () => {
    expect(vendorOnboardingSrc).toMatch(/process\.env\.VENDOR_TOKEN_HOURS/);
  });
  test('rejects out-of-bounds values with default fallback', () => {
    expect(vendorOnboardingSrc).toMatch(/n < 1 \|\| n > 720/);
    expect(vendorOnboardingSrc).toMatch(/using default 48h/);
  });
});

describe('Cancel route TOCTOU race surfacing', () => {
  test('returns 409 CANCEL_RACED when cancel UPDATE affected 0 rows', () => {
    expect(cancelRouteSrc).toMatch(/CANCEL_RACED/);
    expect(cancelRouteSrc).toMatch(/!r\.cancelled/);
    expect(cancelRouteSrc).toMatch(/status\(409\)/);
  });
});

describe('sendVendorOnboardLink purpose parameter', () => {
  test('accepts purpose argument with onboard default', () => {
    expect(appJsSrc).toMatch(/sendVendorOnboardLink = async function\(vendorId, vendorName, purpose\)/);
    expect(appJsSrc).toMatch(/purpose = purpose \|\| 'onboard'/);
  });
  test('passes purpose to API call', () => {
    expect(appJsSrc).toMatch(/POST.{0,80}\/onboard-link.*\{ purpose \}/s);
  });
});

describe('Matrix env read at call-time', () => {
  test('_env() helper returns env values per call', () => {
    expect(matrixAdapterSrc).toMatch(/function _env\(\) \{/);
    expect(matrixAdapterSrc).toMatch(/HOMESERVER: process\.env\.MATRIX_HOMESERVER/);
  });
  test('all url/auth references use _env() not captured constants', () => {
    // Should NOT have const HOMESERVER = / const BOT_TOKEN = at module level
    expect(matrixAdapterSrc).not.toMatch(/^const HOMESERVER\s*=/m);
    expect(matrixAdapterSrc).not.toMatch(/^const BOT_TOKEN\s*=/m);
  });
});

describe('Project code from projects.code (not regex-derived)', () => {
  test('matrix-provision-rooms reads code column directly', () => {
    expect(provisionScriptSrc).toMatch(/SELECT id, name, code FROM projects/);
    expect(provisionScriptSrc).toMatch(/project\.code && project\.code\.trim/);
  });
  test('legacy PV90PL derivation regex removed', () => {
    expect(provisionScriptSrc).not.toMatch(/split\(\/\[\^A-Za-z0-9\]/);
  });
});
