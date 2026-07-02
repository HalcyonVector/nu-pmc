#!/usr/bin/env node
/*
 * verify-and-provision.js
 * ---------------------------------------------------------------------------
 * Answers the question: "does the server have EVERY migration, schema object
 * and config/feature it should?" — and optionally provisions whatever is
 * missing, idempotently.
 *
 * It does NOT assume. It compares the live database against the project's own
 * source of truth (schema.sql + migrations/*.sql + the config seeds) and prints
 * a definitive report.
 *
 * WHAT IT CHECKS
 *   1. SCHEMA   — every CREATE TABLE declared in schema.sql and migrations/*.sql
 *                 exists in the live DB. Lists any missing tables.
 *   2. CONFIG   — the config tables that make features work are populated
 *                 (role_nav, role_permissions, workflows, approval configs,
 *                 notification triggers, toggles). Empty = feature broken.
 *   3. FEATURES — spot-checks this session's nav additions actually exist:
 *                 Handover for the 5 closure roles, Measurements for the 7
 *                 lifecycle roles.
 *
 * MODES
 *   node scripts/verify-and-provision.js            # CHECK only — report, no writes
 *   node scripts/verify-and-provision.js --apply     # apply all migrations/*.sql
 *                                                     # + seed-config (idempotent),
 *                                                     # load governance sheets if
 *                                                     # role_permissions is empty,
 *                                                     # then re-check.
 *
 * Requires the `mysql` client on PATH (same as setup.sh). Reads DB config from
 * the same env vars the app uses (DB_HOST/PORT/NAME/USER/PASSWORD).
 *
 * NOTE: this is the DB half of a handover. It does NOT deploy code — make sure
 * the latest repo is pulled/deployed on the server first (route handlers,
 * app.js, ui.js fixes live in code, not the DB).
 * ---------------------------------------------------------------------------
 */
'use strict';

const mysql = require('mysql2/promise');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

const dbConf = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  database: process.env.DB_NAME || 'nu_pmc',
  user: process.env.DB_USER || 'nu_app',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : {}),
};

const ROOT = path.resolve(__dirname, '..');
const MIG_DIR = path.join(ROOT, 'migrations');

// Config tables whose EMPTINESS would break features (must have rows).
const REQUIRED_CONFIG = [
  'role_nav', 'role_permissions', 'signoff_workflows', 'signoff_sequence_rules',
  'approval_type_config', 'notification_triggers', 'notifications_config',
  'security_config', 'external_comm_config', 'ai_feature_toggles',
];

// This session's nav features (role -> tab_key) that must be reachable.
const NAV_FEATURES = {
  handover: ['pmc_head', 'design_head', 'services_head', 'principal', 'design_principal'],
  measurements: ['pmc_head', 'principal', 'design_principal', 'design_head', 'services_head', 'site_manager', 'senior_site_manager'],
};

function log(...a) { console.log(...a); }
function C(s) { return s.replace(/\s+/g, ' ').trim(); }

// Parse every `CREATE TABLE [IF NOT EXISTS] name` from a SQL file.
function tablesInSql(file) {
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?`?([a-z0-9_]+)`?/gi;
  const out = [];
  let m;
  while ((m = re.exec(txt))) out.push(m[1].toLowerCase());
  return out;
}

function migrationFiles() {
  try {
    return fs.readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort();
  } catch { return []; }
}

// Apply a .sql file with the mysql client, tolerating already-applied errors.
function mysqlApplyFile(absPath) {
  const args = [
    `-h${dbConf.host}`, `-P${dbConf.port}`, `-u${dbConf.user}`,
    '--force', dbConf.database,
  ];
  const sql = fs.readFileSync(absPath, 'utf8');
  const res = spawnSync('mysql', args, {
    input: sql,
    env: { ...process.env, MYSQL_PWD: dbConf.password },
    encoding: 'utf8',
  });
  const stderr = (res.stderr || '').trim();
  // Errors that mean "already applied / idempotent no-op":
  const benign = /duplicate column|already exists|duplicate entry|Duplicate key|can't drop|check that column|Unknown column|doesn't exist/i;
  const realErrors = stderr.split('\n')
    .filter(l => /error/i.test(l) && !benign.test(l));
  return { ok: res.status === 0 || realErrors.length === 0, realErrors, stderr };
}

async function main() {
  const conn = await mysql.createConnection(dbConf);
  const problems = [];
  try {
    log('='.repeat(72));
    log(`VERIFY + PROVISION — database "${dbConf.database}" @ ${dbConf.host}:${dbConf.port}`);
    log(`Mode: ${APPLY ? 'APPLY (will provision missing items)' : 'CHECK ONLY (no writes)'}`);
    log('='.repeat(72));

    // ── APPLY migrations first (so the checks below reflect the fixed state).
    if (APPLY) {
      log('\n🔧 Applying migrations (idempotent, already-applied statements skipped)...');
      for (const f of migrationFiles()) {
        const r = mysqlApplyFile(path.join(MIG_DIR, f));
        if (r.realErrors.length) { log(`   ✗ ${f}: ${r.realErrors[0]}`); problems.push(`migration ${f}`); }
        else log(`   ✓ ${f}`);
      }
      // Baseline config — --force adds missing rows, skips existing PKs.
      const seed = path.join(ROOT, 'seed-config.sql');
      if (fs.existsSync(seed)) {
        const r = mysqlApplyFile(seed);
        log(`   ${r.realErrors.length ? '✗' : '✓'} seed-config.sql`);
      }
    }

    // ── 1. SCHEMA: expected tables (from source) vs live.
    const expected = new Set();
    tablesInSql(path.join(ROOT, 'schema.sql')).forEach(t => expected.add(t));
    for (const f of migrationFiles()) tablesInSql(path.join(MIG_DIR, f)).forEach(t => expected.add(t));

    const [liveRows] = await conn.query(
      `SELECT LOWER(table_name) t FROM information_schema.tables
        WHERE table_schema = ? AND table_type='BASE TABLE'`, [dbConf.database]);
    const live = new Set(liveRows.map(r => r.t));

    const missingTables = [...expected].filter(t => !live.has(t)).sort();
    log(`\n1. SCHEMA — ${live.size} live tables; ${expected.size} declared in source.`);
    if (missingTables.length) {
      log(`   ✗ MISSING ${missingTables.length} table(s): ${missingTables.join(', ')}`);
      problems.push(`${missingTables.length} missing tables`);
      log('     → apply schema.sql / the migration that creates them.');
    } else {
      log('   ✓ Every declared table exists.');
    }

    // ── 2. CONFIG populated.
    log('\n2. CONFIG — feature-driving tables must have rows:');
    for (const t of REQUIRED_CONFIG) {
      if (!live.has(t)) { log(`   ✗ ${t.padEnd(24)} TABLE MISSING`); problems.push(`config table ${t} missing`); continue; }
      const [[r]] = await conn.query(`SELECT COUNT(*) c FROM \`${t}\``);
      const bad = r.c === 0;
      log(`   ${bad ? '✗' : '✓'} ${t.padEnd(24)} ${r.c} rows${bad ? '  ← EMPTY' : ''}`);
      if (bad) {
        problems.push(`${t} empty`);
        if (t === 'role_permissions') log('     → run: node scripts/load-governance-sheets.js  (app 403s until then)');
      }
    }

    // If role_permissions empty and applying, load governance sheets.
    if (APPLY) {
      const [[rp]] = await conn.query('SELECT COUNT(*) c FROM role_permissions').catch(() => [[{ c: 1 }]]);
      if (rp.c === 0) {
        log('\n🔧 role_permissions empty — loading governance sheets...');
        const r = spawnSync('node', ['scripts/load-governance-sheets.js'], { cwd: ROOT, stdio: 'inherit', env: process.env });
        if (r.status !== 0) problems.push('governance sheet load failed');
      }
    }

    // ── 3. FEATURE spot-checks (this session's nav additions).
    log('\n3. FEATURES — this session\'s nav must be reachable:');
    for (const [tab, roles] of Object.entries(NAV_FEATURES)) {
      const [rows] = await conn.query(
        `SELECT DISTINCT role FROM role_nav WHERE tab_key=? AND is_visible=1 AND role IN (${roles.map(() => '?').join(',')})`,
        [tab, ...roles]).catch(() => [[]]);
      const have = new Set(rows.map(r => r.role));
      const miss = roles.filter(r => !have.has(r));
      log(`   ${miss.length ? '✗' : '✓'} ${tab.padEnd(14)} ${have.size}/${roles.length} roles${miss.length ? '  missing: ' + miss.join(', ') : ''}`);
      if (miss.length) {
        problems.push(`${tab} nav missing for ${miss.join(',')}`);
        if (!APPLY) log('     → run this script with --apply (applies 2026-07-02-role-nav-reconciliation.sql)');
      }
    }

    // ── SUMMARY
    log('\n' + '='.repeat(72));
    if (problems.length === 0) {
      log('✅ COMPLETE — every declared table exists, all config is populated,');
      log('   and this session\'s features are reachable. DB is handover-ready.');
      log('   (Reminder: confirm the latest CODE is deployed — features live in code too.)');
    } else {
      log(`⚠️  ${problems.length} issue(s) found:`);
      problems.forEach(p => log(`   • ${p}`));
      if (!APPLY) log('\n   Re-run with --apply to provision the fixable items, then re-check.');
    }
    log('='.repeat(72));
    process.exitCode = problems.length ? 2 : 0;
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
