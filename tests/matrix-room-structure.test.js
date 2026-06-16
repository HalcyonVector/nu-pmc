// tests/matrix-room-structure.test.js
// ============================================================
// Prevent-return guard for the May 2026 room structure decision
// (recorded in MATRIX_MIGRATION_PLAN.md).
//
// Lock in:
//   - Per project: coordination + internal + finance (3 rooms)
//   - Org-wide:   internal_principal + internal_finance + system_health
//   - 'general' is NOT a project room type (Element X covers personal chat)
//   - 'system_health' is org-wide ONLY (project_id NULL) — NOT replicated
//
// If a future change reintroduces 'site' / 'design' / 'general' as
// active project room types, or replicates 'system_health' per project,
// these tests fail. Update tests intentionally if the design changes;
// the failure is a signal to revisit the decision, not silently re-add.
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const PROVISIONER = path.join(__dirname, '..', 'scripts', 'matrix-provision-rooms.js');

// May 2026 deploy bundle: individual migration files were collapsed into a
// single nu-pmc-install-<date>.sql at repo root. The v5.28 section is still
// present verbatim inside that file, identified by the migration header.
// We read the install SQL and assert against its contents.
function resolveInstallSql() {
  const root = path.join(__dirname, '..');
  const matches = fs.readdirSync(root).filter(f => /^nu-pmc-install-\d+\.sql$/.test(f));
  if (matches.length === 0) {
    throw new Error('no nu-pmc-install-<date>.sql at repo root');
  }
  // Most recent by filename (date-sorted lexically).
  matches.sort();
  return path.join(root, matches[matches.length - 1]);
}
const MIGRATION = resolveInstallSql();

describe('Matrix room structure (May 2026 decision)', () => {
  let provSrc;
  beforeAll(() => {
    provSrc = fs.readFileSync(PROVISIONER, 'utf8');
  });

  test('PROJECT_ROOM_TYPES has exactly coordination + internal + finance', () => {
    // Find the array literal
    const m = provSrc.match(/const PROJECT_ROOM_TYPES\s*=\s*\[([\s\S]*?)\];/);
    expect(m).not.toBeNull();
    const block = m[1];

    // Active project room types
    expect(block).toMatch(/type:\s*'coordination'/);
    expect(block).toMatch(/type:\s*'internal'(?!_)/);   // not 'internal_principal'
    expect(block).toMatch(/type:\s*'finance'/);

    // Removed / dropped — must NOT appear as active project types
    // (a doc comment mentioning them is fine; an array entry is not)
    const typeMatches = block.match(/type:\s*'(\w+)'/g) || [];
    const types = typeMatches.map(t => t.match(/'(\w+)'/)[1]);
    expect(types).toEqual(['coordination', 'internal', 'finance']);

    // 'site', 'design', 'general' must not be active project room types
    expect(types).not.toContain('site');
    expect(types).not.toContain('design');
    expect(types).not.toContain('general');
  });

  test('INTERNAL_ROOM_TYPES has exactly the three org-wide rooms', () => {
    const m = provSrc.match(/const INTERNAL_ROOM_TYPES\s*=\s*\[([\s\S]*?)\];/);
    expect(m).not.toBeNull();
    const block = m[1];

    expect(block).toMatch(/type:\s*'internal_principal'/);
    expect(block).toMatch(/type:\s*'internal_finance'/);
    expect(block).toMatch(/type:\s*'system_health'/);

    const typeMatches = block.match(/type:\s*'(\w+)'/g) || [];
    expect(typeMatches.length).toBe(3);
  });

  test('system_health is ONLY in INTERNAL_ROOM_TYPES (org-wide, not per-project)', () => {
    // system_health must not appear in PROJECT_ROOM_TYPES
    const m = provSrc.match(/const PROJECT_ROOM_TYPES\s*=\s*\[([\s\S]*?)\];/);
    expect(m).not.toBeNull();
    expect(m[1]).not.toMatch(/system_health/);
  });

  test('migration v5.28 retypes the enum and archives general rooms', () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    // Maps old → new
    expect(sql).toMatch(/UPDATE matrix_rooms SET room_type = 'coordination' WHERE room_type = 'site'/);
    expect(sql).toMatch(/UPDATE matrix_rooms SET room_type = 'internal'\s+WHERE room_type = 'design'/);
    // Archives 'general' rather than deleting
    expect(sql).toMatch(/SET archived_at = NOW\(\) WHERE room_type = 'general'/);
    // New active values present in re-declared enum
    expect(sql).toMatch(/'coordination'/);
    expect(sql).toMatch(/'internal'/);
  });
});
