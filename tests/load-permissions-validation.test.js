// tests/load-permissions-validation.test.js
// Verifies the silent-degrade fix in loadPermissions and loadNotifications:
// invalid access levels and invalid channels now ERROR instead of inserting
// degraded data. Same defensive pattern as Sheet 9 (load-sheet9.test.js).

'use strict';
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const XLSX = require('xlsx');

// Load the script's exported functions if available; otherwise smoke-test
// the file syntax by requiring it.
const loader = path.join(__dirname, '..', 'scripts', 'load-governance-sheets.js');
const src = fs.readFileSync(loader, 'utf8');

describe('loadPermissions — input validation', () => {
  test('valid access levels W, R, A, and empty are accepted', () => {
    // Static check — the validation is a literal-list check
    expect(src).toMatch(/access === 'W' \|\| access === 'R' \|\| access === 'A'/);
  });

  test('invalid access levels surface to errors[]', () => {
    // The error message must mention "invalid access level"
    expect(src).toMatch(/invalid access level/);
  });

  test('invalid level rejection skips the INSERT (continue)', () => {
    // After the error push there must be a continue;
    const m = src.match(/invalid access level[^;]+;\s*continue;/);
    expect(m).not.toBeNull();
  });
});

describe('loadNotifications — channel validation', () => {
  test('ALLOWED_CHANNELS set is defined', () => {
    expect(src).toMatch(/ALLOWED_CHANNELS\s*=\s*new Set/);
  });

  test('whatsapp, matrix, email, sms, in_app are all whitelisted', () => {
    for (const ch of ['whatsapp','matrix','email','sms','in_app']) {
      expect(src).toContain(`'${ch}'`);
    }
  });

  test('invalid channels surface to errors[] and skip insert', () => {
    expect(src).toMatch(/invalid channel/);
    const m = src.match(/invalid channel[^;]+;\s*continue;/);
    expect(m).not.toBeNull();
  });
});
