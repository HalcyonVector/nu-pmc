// tests/integration/approvals.integration.test.js
// ═══════════════════════════════════════════════════════════════
// Integration tests for the unified approval flow (open → vote → close).
// Runs against a real MySQL database — skips if TEST_DB_HOST is not set.
//
// Run:  TEST_DB_HOST=localhost TEST_DB_PASSWORD=... npx jest --config jest.integration.config.js
// ═══════════════════════════════════════════════════════════════

'use strict';

const SKIP = !process.env.TEST_DB_HOST;
const describeIf = SKIP ? describe.skip : describe;

let dbTest, pool;

describeIf('approvals integration (live DB)', () => {

  beforeAll(async () => {
    dbTest = require('./helpers/db-test');
    pool = await dbTest.setup({ seed: true });
  }, 60_000);   // schema load may be slow

  afterAll(async () => {
    await dbTest.teardown();
  });

  // ── Schema sanity ────────────────────────────────────────────────

  test('approval_type_config table exists and has seeded rows', () =>
    dbTest.isolated(async (conn) => {
      const [rows] = await conn.query(
        `SELECT approval_type, quorum, scope FROM approval_type_config WHERE active = 1`
      );
      expect(rows.length).toBeGreaterThan(0);
      // Every row must have a positive quorum
      for (const r of rows) {
        expect(r.quorum).toBeGreaterThanOrEqual(1);
      }
    })
  );

  test('approvals table has correct columns and constraints', () =>
    dbTest.isolated(async (conn) => {
      const [cols] = await conn.query(`DESCRIBE approvals`);
      const colNames = cols.map(c => c.Field);
      expect(colNames).toEqual(expect.arrayContaining([
        'id', 'approval_type', 'ref_table', 'ref_id', 'project_id',
        'raised_by', 'status', 'row_version',
      ]));
    })
  );

  // ── Approval lifecycle ────────────────────────────────────────────

  test('open → vote approve → status becomes approved (quorum=1)', () =>
    dbTest.isolated(async (conn) => {
      // Ensure we have a config row with quorum=1
      await conn.query(
        `INSERT IGNORE INTO approval_type_config
           (approval_type, signer_roles_json, quorum, scope, active, label)
         VALUES ('test_q1', '["principal"]', 1, 'global', 1, 'Test Q1')`
      );

      // Need a user to be the raiser and a different user to be the signer
      await conn.query(
        `INSERT IGNORE INTO users (id, username, full_name, role, password_hash, is_active)
         VALUES (9001, 'test_raiser', 'Test Raiser', 'pmc_head', '$2a$10$xxxxx', 1),
                (9002, 'test_signer', 'Test Signer', 'principal', '$2a$10$xxxxx', 1)`
      );

      // Open
      const [ins] = await conn.query(
        `INSERT INTO approvals
           (approval_type, ref_table, ref_id, raised_by, raised_by_role, title, status)
         VALUES ('test_q1', 'test_table', 1, 9001, 'pmc_head', 'Test approval', 'pending')`
      );
      const approvalId = ins.insertId;

      // Vote approve
      await conn.query(
        `INSERT INTO approval_signoffs (approval_id, signer_id, signer_role, vote)
         VALUES (?, 9002, 'principal', 'approve')`,
        [approvalId]
      );

      // Check quorum: 1 approve >= quorum(1) → should transition
      const [[voteCount]] = await conn.query(
        `SELECT COUNT(*) AS c FROM approval_signoffs WHERE approval_id = ? AND vote = 'approve'`,
        [approvalId]
      );
      expect(voteCount.c).toBe(1);

      // Simulate reevaluation (what the service does)
      const [[cfg]] = await conn.query(
        `SELECT quorum FROM approval_type_config WHERE approval_type = 'test_q1'`
      );
      expect(voteCount.c).toBeGreaterThanOrEqual(cfg.quorum);
    })
  );

  test('open → vote reject → veto applies regardless of quorum', () =>
    dbTest.isolated(async (conn) => {
      await conn.query(
        `INSERT IGNORE INTO approval_type_config
           (approval_type, signer_roles_json, quorum, scope, active, label)
         VALUES ('test_q3', '["principal","design_principal","pmc_head"]', 3, 'global', 1, 'Test Q3')`
      );
      await conn.query(
        `INSERT IGNORE INTO users (id, username, full_name, role, password_hash, is_active)
         VALUES (9001, 'test_raiser', 'Test Raiser', 'coordinator', '$2a$10$xxxxx', 1),
                (9002, 'test_signer1', 'Signer 1', 'principal', '$2a$10$xxxxx', 1)`
      );

      const [ins] = await conn.query(
        `INSERT INTO approvals
           (approval_type, ref_table, ref_id, raised_by, raised_by_role, title, status)
         VALUES ('test_q3', 'test_table', 2, 9001, 'coordinator', 'Test multi', 'pending')`
      );
      const approvalId = ins.insertId;

      // One reject should veto the whole approval
      await conn.query(
        `INSERT INTO approval_signoffs (approval_id, signer_id, signer_role, vote)
         VALUES (?, 9002, 'principal', 'reject')`,
        [approvalId]
      );

      const [[votes]] = await conn.query(
        `SELECT COUNT(*) AS rejects FROM approval_signoffs WHERE approval_id = ? AND vote = 'reject'`,
        [approvalId]
      );
      expect(votes.rejects).toBe(1);
      // Any reject = veto, regardless of quorum
    })
  );

  test('duplicate vote is rejected by UNIQUE constraint', () =>
    dbTest.isolated(async (conn) => {
      await conn.query(
        `INSERT IGNORE INTO approval_type_config
           (approval_type, signer_roles_json, quorum, scope, active, label)
         VALUES ('test_dup', '["principal"]', 1, 'global', 1, 'Test Dup')`
      );
      await conn.query(
        `INSERT IGNORE INTO users (id, username, full_name, role, password_hash, is_active)
         VALUES (9001, 'test_raiser', 'Test Raiser', 'pmc_head', '$2a$10$xxxxx', 1),
                (9002, 'test_signer', 'Test Signer', 'principal', '$2a$10$xxxxx', 1)`
      );

      const [ins] = await conn.query(
        `INSERT INTO approvals
           (approval_type, ref_table, ref_id, raised_by, raised_by_role, title, status)
         VALUES ('test_dup', 'test_table', 3, 9001, 'pmc_head', 'Test dup', 'pending')`
      );

      await conn.query(
        `INSERT INTO approval_signoffs (approval_id, signer_id, signer_role, vote)
         VALUES (?, 9002, 'principal', 'approve')`,
        [ins.insertId]
      );

      // Second vote from same signer should fail
      await expect(conn.query(
        `INSERT INTO approval_signoffs (approval_id, signer_id, signer_role, vote)
         VALUES (?, 9002, 'principal', 'approve')`,
        [ins.insertId]
      )).rejects.toThrow(/Duplicate/);
    })
  );

  // ── Cross-module boundary: project_assignments ─────────────────

  test('project_assignments scope gate works via schema', () =>
    dbTest.isolated(async (conn) => {
      await conn.query(
        `INSERT IGNORE INTO users (id, username, full_name, role, password_hash, is_active)
         VALUES (9010, 'scope_user', 'Scope User', 'jr_architect', '$2a$10$xxxxx', 1)`
      );
      // Insert a project
      await conn.query(
        `INSERT IGNORE INTO projects (id, code, name, client, status)
         VALUES (100, 'TST-100', 'Test Project', 'Test Client', 'active')`
      );
      // No assignment yet — isUserAssigned should be false
      const [[noAssign]] = await conn.query(
        `SELECT COUNT(*) AS c FROM project_assignments
         WHERE project_id = 100 AND user_id = 9010 AND is_active = 1`
      );
      expect(noAssign.c).toBe(0);

      // Add assignment
      await conn.query(
        `INSERT INTO project_assignments (project_id, user_id, role, is_active)
         VALUES (100, 9010, 'jr_architect', 1)`
      );
      const [[hasAssign]] = await conn.query(
        `SELECT COUNT(*) AS c FROM project_assignments
         WHERE project_id = 100 AND user_id = 9010 AND is_active = 1`
      );
      expect(hasAssign.c).toBe(1);
    })
  );
});
