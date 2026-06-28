// tests/setup.js — Mock database so tests run without MySQL

// sharp is a native image library not installed in the test sandbox.
// Mock it globally so any route that transitively requires middleware/upload
// can be loaded without the native binary.
jest.mock('sharp', () => {
  const fn = jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg:   jest.fn().mockReturnThis(),
    png:    jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({}),
    toBuffer: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  }));
  return fn;
});

jest.mock('../middleware/db', () => {
  const mockQuery = jest.fn();
  // db.tx(fn) — invokes fn with a "conn" object that delegates query/execute
  // to the same mock as the pool. Tests can mockResolvedValueOnce on db.query
  // and the calls inside a tx will consume those mocks in order, matching
  // production behaviour. Compartment 2 audit (B4, B22, B35, B39, B41) added
  // routes that use db.tx — without this the mock returned undefined and
  // callers got 500.
  const tx = async (fn) => {
    const conn = { query: mockQuery, execute: mockQuery, release: jest.fn() };
    return await fn(conn);
  };
  const pool = {
    query:         mockQuery,
    execute:       mockQuery,
    getConnection: jest.fn().mockResolvedValue({ release: jest.fn() }),
    tx,
  };
  return pool;
});

// Seed the permissions cache so middleware/permissions doesn't try to load
// from the (mocked, empty) DB on first call. Includes the actions tested
// across the suite. Individual test files can extend by calling
// perms._setCacheForTests([...]) again with additional rows.
const perms = require('../middleware/permissions');
perms._setCacheForTests([
  // User management
  { role: 'principal',         action: 'users.create',                     level: 'A' },
  { role: 'design_principal',  action: 'users.create',                     level: 'A' },
  { role: 'principal',         action: 'clients.bulk_upload',              level: 'A' },
  { role: 'finance_admin',     action: 'clients.bulk_upload',              level: 'A' },
  // Measurements
  { role: 'principal',         action: 'pmc.measurement.create',           level: 'A' },
  { role: 'design_principal',  action: 'pmc.measurement.create',           level: 'A' },
  { role: 'pmc_head',          action: 'pmc.measurement.create',           level: 'A' },
  { role: 'design_head',       action: 'pmc.measurement.create',           level: 'A' },
  { role: 'services_head',     action: 'pmc.measurement.create',           level: 'A' },
  { role: 'principal',         action: 'pmc.measurement.add-items',        level: 'A' },
  { role: 'pmc_head',          action: 'pmc.measurement.add-items',        level: 'A' },
  // Client BOQ
  { role: 'principal',         action: 'finance.client-boq.edit-rate',     level: 'A' },
  { role: 'design_principal',  action: 'finance.client-boq.edit-rate',     level: 'A' },
  { role: 'pmc_head',          action: 'finance.client-boq.edit-rate',     level: 'A' },
  { role: 'finance_admin',     action: 'finance.client-boq.edit-rate',     level: 'A' },
  { role: 'principal',         action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'design_principal',  action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'pmc_head',          action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'design_head',       action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'services_head',     action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'finance_admin',     action: 'finance.client-boq.edit-hsn',      level: 'A' },
]);
