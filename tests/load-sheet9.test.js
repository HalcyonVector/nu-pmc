// tests/load-sheet9.test.js
// ════════════════════════════════════════════════════════════════════════════
// Tests for scripts/load-governance-sheets.js loadApprovalTypes() — the
// Sheet 9 ingestion that populates approval_type_config.
//
// Generates a temp xlsx file in-memory, points the loader at it, captures
// the SQL the loader would run.
// ════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const { loadApprovalTypes } = require('../scripts/load-governance-sheets');

// Helper: build an xlsx file with the given rows in the 'Approval Types' tab,
// place it at governance_sheets/09_Approval_Type_Config.xlsx, then restore
// the original after the test. Yes, this writes to the real filesystem —
// it's the only way without mocking out fs in the loader, which would be
// far more invasive than the value of testing this end-to-end.
const TARGET = path.join(__dirname, '..', 'governance_sheets', '09_Approval_Type_Config.xlsx');
let backupContent = null;

function writeSheet(rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Approval Types');
  XLSX.writeFile(wb, TARGET);
}

beforeAll(() => {
  if (fs.existsSync(TARGET)) {
    backupContent = fs.readFileSync(TARGET);
  }
});

afterAll(() => {
  if (backupContent) {
    fs.writeFileSync(TARGET, backupContent);
  } else if (fs.existsSync(TARGET)) {
    fs.unlinkSync(TARGET);
  }
});

function makeFakeConn() {
  const calls = [];
  return {
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1, insertId: 1 }];
    }),
    _calls: calls,
  };
}

describe('loadApprovalTypes — file present', () => {
  test('reads rows, INSERTs with ON DUPLICATE KEY UPDATE, returns count', async () => {
    writeSheet([
      {
        approval_type: 'test_one', label: 'Test one',
        description: 'first test type',
        signer_roles: 'principal,design_principal',
        quorum: 1, scope: 'project',
        requires_vendor_confirm: 'No', expires_after_hours: 72, active: 'Yes',
      },
      {
        approval_type: 'test_two', label: 'Test two',
        description: '',
        signer_roles: 'finance_admin,principal',
        quorum: 2, scope: 'global',
        requires_vendor_confirm: 'Yes', expires_after_hours: '', active: 'Yes',
      },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(2);
    expect(r.errors).toEqual([]);

    expect(conn._calls).toHaveLength(2);
    expect(conn._calls[0].sql).toMatch(/INSERT INTO approval_type_config/);
    expect(conn._calls[0].sql).toMatch(/ON DUPLICATE KEY UPDATE/);

    // First row's params: [approval_type, signer_roles_json, quorum, scope,
    //                     requires_vendor_confirm, expires_after_hours,
    //                     label, description, active]
    const p1 = conn._calls[0].params;
    expect(p1[0]).toBe('test_one');
    expect(JSON.parse(p1[1])).toEqual(['principal', 'design_principal']);
    expect(p1[2]).toBe(1);
    expect(p1[3]).toBe('project');
    expect(p1[4]).toBe(0);  // requires_vendor_confirm No → 0
    expect(p1[5]).toBe(72);
    expect(p1[6]).toBe('Test one');
    expect(p1[7]).toBe('first test type');
    expect(p1[8]).toBe(1);  // active Yes → 1

    // Second row: blank expires_after_hours → null
    const p2 = conn._calls[1].params;
    expect(p2[0]).toBe('test_two');
    expect(p2[5]).toBeNull();
    expect(p2[4]).toBe(1);  // requires_vendor_confirm Yes → 1
    expect(p2[3]).toBe('global');
  });

  test('skips rows without approval_type', async () => {
    writeSheet([
      { approval_type: '', label: 'no type', signer_roles: 'principal',
        quorum: 1, scope: 'project', active: 'Yes' },
      { approval_type: 'real_type', label: 'real', signer_roles: 'principal',
        quorum: 1, scope: 'project', active: 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(1);
    expect(conn._calls).toHaveLength(1);
    expect(conn._calls[0].params[0]).toBe('real_type');
  });

  test('reports row error when signer_roles is empty', async () => {
    writeSheet([
      { approval_type: 'broken', label: 'no signers',
        signer_roles: '', quorum: 1, scope: 'project', active: 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/no signer_roles/);
    expect(conn._calls).toHaveLength(0);
  });

  test('reports row error when quorum is invalid', async () => {
    writeSheet([
      { approval_type: 'broken', label: 'bad quorum',
        signer_roles: 'principal', quorum: 0, scope: 'project', active: 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(0);
    expect(r.errors[0]).toMatch(/invalid quorum/);
  });

  test('rejects decimal quorum (silent truncation would lose info)', async () => {
    writeSheet([
      { approval_type: 'broken', label: 'decimal quorum',
        signer_roles: 'principal,design_principal,pmc_head', quorum: '2.5',
        scope: 'project', active: 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(0);
    expect(r.errors[0]).toMatch(/integer/);
  });

  test('rejects unreachable quorum (greater than signer count)', async () => {
    writeSheet([
      { approval_type: 'broken', label: 'unreachable',
        signer_roles: 'principal,design_principal', quorum: 5,
        scope: 'project', active: 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(0);
    expect(r.errors[0]).toMatch(/exceeds signer count/);
  });

  test('deduplicates signer roles', async () => {
    writeSheet([
      { approval_type: 'dup_signers', label: 'duplicates',
        signer_roles: 'principal,principal,design_principal,principal',
        quorum: 1, scope: 'project', active: 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(1);
    const passed = JSON.parse(conn._calls[0].params[1]);
    expect(passed).toEqual(['principal', 'design_principal']);
  });

  test('reports row error when scope is unknown', async () => {
    writeSheet([
      { approval_type: 'broken', label: 'bad scope',
        signer_roles: 'principal', quorum: 1, scope: 'team', active: 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(0);
    expect(r.errors[0]).toMatch(/scope must be/);
  });

  test('handles signer roles separated by | or ;', async () => {
    writeSheet([
      { approval_type: 'pipe', label: 'pipe-separated',
        signer_roles: 'principal | finance_admin', quorum: 1, scope: 'project', active: 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(1);
    expect(JSON.parse(conn._calls[0].params[1])).toEqual(['principal', 'finance_admin']);
  });

  test('case-insensitive header lookup', async () => {
    writeSheet([
      { 'Approval Type': 'cap_one', 'Label': 'Cap one',
        'Signer Roles': 'principal', 'Quorum': 1, 'Scope': 'project',
        'Requires Vendor Confirm': '✓', 'Active': 'Yes' },
    ]);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(1);
    expect(conn._calls[0].params[0]).toBe('cap_one');
    expect(conn._calls[0].params[4]).toBe(1);  // ✓ → 1
  });
});

describe('loadApprovalTypes — file absent', () => {
  test('returns skipped_reason without error when sheet 9 file missing', async () => {
    if (fs.existsSync(TARGET)) fs.unlinkSync(TARGET);
    const conn = makeFakeConn();
    const r = await loadApprovalTypes(conn);
    expect(r.added).toBe(0);
    expect(r.errors).toEqual([]);
    expect(r.skipped_reason).toMatch(/not found/i);
    expect(conn._calls).toHaveLength(0);
  });
});
