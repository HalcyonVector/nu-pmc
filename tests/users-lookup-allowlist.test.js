// tests/users-lookup-allowlist.test.js
// Prevent-return guard for B14 — the `fields` parameter to usersByRole and
// usersByRoleOnProject is a column name list that gets interpolated raw
// into SQL (placeholders can't parameterise column names). Without a
// whitelist, a future caller passing user input would have a SQL injection.

'use strict';

jest.mock('../middleware/db', () => {
  const m = { query: jest.fn() };
  m.tx = jest.fn((fn) => fn({ query: m.query }));
  return m;
});

const fs   = require('fs');
const path = require('path');
const db   = require('../middleware/db');
const users = require('../services/users-lookup');

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
});

describe('B14 — users-lookup column allowlist', () => {
  test('source defines _ALLOWED_FIELDS set and _safeFields validator', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'services/users-lookup.js'), 'utf8');
    expect(src).toMatch(/_ALLOWED_FIELDS\s*=\s*new Set\(/);
    expect(src).toMatch(/function _safeFields\(/);
    // Both lookup functions must call _safeFields BEFORE building the SQL
    expect(src).toMatch(/usersByRole\([\s\S]*?_safeFields/);
    expect(src).toMatch(/usersByRoleOnProject\([\s\S]*?_safeFields/);
  });

  test('default fields call still works', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]);
    const r = await users.usersByRole('principal');
    expect(r).toEqual([{ id: 1 }, { id: 2 }]);
    expect(db.query.mock.calls[0][0]).toMatch(/SELECT id FROM users/);
  });

  test('explicit valid fields list works', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, phone: '999', full_name: 'A' }]]);
    const r = await users.usersByRole('principal', 'id, phone, full_name');
    expect(r).toEqual([{ id: 1, phone: '999', full_name: 'A' }]);
    expect(db.query.mock.calls[0][0]).toMatch(/SELECT id, phone, full_name FROM users/);
  });

  test('rejects column not in allowlist (single bad column)', async () => {
    await expect(users.usersByRole('principal', 'password_hash'))
      .rejects.toThrow(/users-lookup: column 'password_hash' not in allowlist/);
  });

  test('rejects classic injection payload', async () => {
    await expect(users.usersByRole('principal', "id; DROP TABLE users --"))
      .rejects.toThrow(/not in allowlist/);
  });

  test('rejects mixed valid + invalid (whole list must be safe)', async () => {
    await expect(users.usersByRole('principal', 'id, phone, password_hash'))
      .rejects.toThrow(/'password_hash' not in allowlist/);
  });

  test('usersByRoleOnProject also enforces allowlist', async () => {
    await expect(users.usersByRoleOnProject('principal', 1, 'id; SELECT * FROM users'))
      .rejects.toThrow(/not in allowlist/);
  });

  test('whitespace-only column rejected (no empty-name bypass)', async () => {
    await expect(users.usersByRole('principal', 'id, , phone'))
      .rejects.toThrow(/not in allowlist/);
  });
});
