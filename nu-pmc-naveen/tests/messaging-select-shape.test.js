// tests/messaging-select-shape.test.js
// Pins the SELECT shape in messaging.notifyUser against the columns that
// _internalRoomForRole reads. Previously, role was dropped from the SELECT
// while _internalRoomForRole still read user.role — silently always returned
// null, causing principal/design_principal/finance_admin Matrix sends to fall
// through to WhatsApp. Tests that mock the user object directly missed the
// bug. This test reads the literal SELECT statement and verifies every
// property accessed inside _internalRoomForRole is present in the column list.

'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'messaging.js'), 'utf8');

describe('messaging.js — SELECT shape ↔ _internalRoomForRole reads', () => {
  test('SELECT includes role column', () => {
    // The SELECT for the user lookup in notifyUser must include 'role'
    // because _internalRoomForRole(user) reads user.role.
    const sel = src.match(/SELECT[\s\S]+?FROM users WHERE id = \?/);
    expect(sel).not.toBeNull();
    expect(sel[0]).toMatch(/\brole\b/);
  });

  test('every property read by _internalRoomForRole appears in the SELECT', () => {
    const fn = src.match(/function _internalRoomForRole\([^)]*\)\s*\{[\s\S]+?\n\}/);
    expect(fn).not.toBeNull();
    const reads = [...fn[0].matchAll(/user\.(\w+)/g)].map(m => m[1]);
    const sel = src.match(/SELECT[\s\S]+?FROM users WHERE id = \?/)[0];
    for (const prop of reads) {
      expect(sel).toMatch(new RegExp(`\\b${prop}\\b`));
    }
  });

  test('every property read by resolveChannels appears in the SELECT', () => {
    const fn = src.match(/function resolveChannels\([^)]*\)\s*\{[\s\S]+?\n\}/);
    expect(fn).not.toBeNull();
    const reads = [...fn[0].matchAll(/user\??\.(\w+)/g)].map(m => m[1]);
    const sel = src.match(/SELECT[\s\S]+?FROM users WHERE id = \?/)[0];
    for (const prop of reads) {
      // Skip props that are aliases or computed (e.g. 'role' inside parens)
      if (['toLowerCase'].includes(prop)) continue;
      expect(sel).toMatch(new RegExp(`\\b${prop}\\b`));
    }
  });
});
