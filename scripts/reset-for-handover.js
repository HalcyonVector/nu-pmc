#!/usr/bin/env node
/*
 * reset-for-handover.js
 * ---------------------------------------------------------------------------
 * Prepares the database for HANDOVER: removes every piece of operational /
 * transactional data (projects, drawings, registers, meetings/MOMs, vendors,
 * payments, measurements, issues, photos, documents, logs, queues, sessions,
 * etc.) while KEEPING:
 *   - the full schema (no tables are dropped),
 *   - all configuration / feature tables (nav, roles, permissions, workflows,
 *     approval configs, notification triggers, toggles, firm identity, global
 *     thresholds),
 *   - the original seed / role users (id <= SEED_MAX_USER_ID). Users added
 *     later (e.g. bulk-uploaded from Excel during testing) are removed.
 *
 * SAFETY MODEL
 *   - DRY RUN BY DEFAULT. Running with no flags only PRINTS the plan and row
 *     counts. Nothing is changed until you pass --confirm.
 *   - "Keep-list" approach: everything NOT explicitly kept is wiped. Missing a
 *     table from the keep-list is safe (it just gets cleared); the only tables
 *     preserved are the ones deliberately listed below.
 *   - With --confirm the script first takes a mysqldump backup to
 *     ./backups/ and aborts if the backup fails (override with --no-backup).
 *
 * USAGE
 *   node scripts/reset-for-handover.js                 # dry run (review plan)
 *   node scripts/reset-for-handover.js --confirm        # backup + wipe
 *   node scripts/reset-for-handover.js --confirm --no-backup
 *   SEED_MAX_USER_ID=21 node scripts/reset-for-handover.js --confirm
 *
 * DB connection is read from the same env vars the app uses (DB_HOST, DB_PORT,
 * DB_NAME, DB_USER, DB_PASSWORD/DB_PASS, DB_SOCKET).
 * ---------------------------------------------------------------------------
 */
'use strict';

const mysql = require('mysql2/promise');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Config tables to KEEP (verified against seed-config.sql, seed-firm.sql and
//    scripts/load-governance-sheets.js). Everything else is treated as data.
const KEEP_TABLES = new Set([
  // navigation + role config
  'role_nav', 'role_nav_audit', 'role_nav_drafts', 'role_permissions',
  // workflow / approval / signoff DEFINITIONS (not instances)
  'workflow_transitions', 'approval_type_config',
  'signoff_workflows', 'signoff_sequence_rules',
  // notifications config
  'notification_triggers', 'notifications_config',
  // security + external comms config
  'security_config', 'external_comm_config',
  // feature toggles
  'ai_feature_toggles',
  // form / checklist DEFINITIONS (not submissions/instances)
  'form_templates', 'setup_checklist_templates',
  // firm identity + global defaults (NU Associates' own config, project_id NULL)
  'company_entities', 'project_thresholds',
]);

// `users` is handled specially: keep id <= SEED_MAX_USER_ID, delete the rest.
const SEED_MAX_USER_ID = parseInt(process.env.SEED_MAX_USER_ID, 10) || 21;

const CONFIRM = process.argv.includes('--confirm');
const NO_BACKUP = process.argv.includes('--no-backup');

const dbConf = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  database: process.env.DB_NAME || 'nu_pmc',
  user: process.env.DB_USER || 'nu_app',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : {}),
  multipleStatements: true,
};

function log(...a) { console.log(...a); }

function takeBackup() {
  const dir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(dir, `pre-handover-${dbConf.database}-${stamp}.sql`);
  const args = [
    `-h${dbConf.host}`, `-P${dbConf.port}`, `-u${dbConf.user}`,
    '--single-transaction', '--routines', '--triggers', '--events',
    dbConf.database,
  ];
  log(`\n📦 Backing up to ${out} ...`);
  const res = spawnSync('mysqldump', args, {
    env: { ...process.env, MYSQL_PWD: dbConf.password },
    stdio: ['ignore', fs.openSync(out, 'w'), 'inherit'],
  });
  if (res.error || res.status !== 0) {
    log('❌ mysqldump failed. Aborting (no changes made).');
    log('   If mysqldump is unavailable, back up manually then re-run with --no-backup.');
    return false;
  }
  const kb = Math.round(fs.statSync(out).size / 1024);
  log(`✅ Backup complete (${kb} KB).`);
  return true;
}

async function main() {
  const conn = await mysql.createConnection(dbConf);
  try {
    const [rows] = await conn.query(
      `SELECT table_name AS t FROM information_schema.tables
        WHERE table_schema = ? AND table_type = 'BASE TABLE'
        ORDER BY table_name`, [dbConf.database]);
    const allTables = rows.map(r => r.t || r.table_name);

    const wipeTables = allTables.filter(t => !KEEP_TABLES.has(t) && t !== 'users');
    const keptPresent = allTables.filter(t => KEEP_TABLES.has(t));

    // Row counts for the plan.
    async function count(t) {
      try { const [[r]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t}\``); return r.c; }
      catch { return '?'; }
    }
    const [[uAll]] = await conn.query('SELECT COUNT(*) c FROM users');
    const [[uKeep]] = await conn.query('SELECT COUNT(*) c FROM users WHERE id <= ?', [SEED_MAX_USER_ID]);
    const uDel = uAll.c - uKeep.c;

    log('='.repeat(72));
    log(`HANDOVER RESET PLAN — database "${dbConf.database}" @ ${dbConf.host}:${dbConf.port}`);
    log('='.repeat(72));
    log(`\nKEEP — config/feature tables (${keptPresent.length}), rows untouched:`);
    for (const t of keptPresent) log(`   • ${t.padEnd(28)} ${await count(t)} rows`);

    log(`\nUSERS — keep id <= ${SEED_MAX_USER_ID}:`);
    log(`   • keep ${uKeep.c} seed/role users, DELETE ${uDel} later-added user(s)`);
    if (uDel > 0) {
      const [delUsers] = await conn.query(
        `SELECT id, username, full_name, role, created_at FROM users
          WHERE id > ? ORDER BY id`, [SEED_MAX_USER_ID]);
      log('   Users that WOULD be deleted (verify these are all test/bulk additions):');
      for (const u of delUsers) {
        log(`      #${u.id}  ${(u.username||'').padEnd(16)} ${(u.role||'').padEnd(20)} ${(u.full_name||'')}  [${u.created_at}]`);
      }
      log('   If any of these should be KEPT, set SEED_MAX_USER_ID or remove them from the list first.');
    }

    log(`\nWIPE — operational/data tables (${wipeTables.length}) to be TRUNCATED:`);
    let totalRows = 0;
    for (const t of wipeTables) {
      const c = await count(t);
      if (typeof c === 'number') totalRows += c;
      if (c !== 0) log(`   • ${t.padEnd(28)} ${c} rows`);
    }
    log(`   (tables already empty are hidden; ~${totalRows} data rows total)`);

    if (!CONFIRM) {
      log('\n🔎 DRY RUN — nothing was changed. Re-run with --confirm to execute.');
      return;
    }

    if (!NO_BACKUP && !takeBackup()) { process.exitCode = 1; return; }

    log('\n🧹 Wiping operational data ...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of wipeTables) {
      await conn.query(`TRUNCATE TABLE \`${t}\``);
    }
    // Users: drop later-added, keep seed range.
    await conn.query('DELETE FROM users WHERE id > ?', [SEED_MAX_USER_ID]);
    // Null any self-references now pointing at deleted users.
    for (const col of ['managed_by', 'deputy_id', 'reset_by']) {
      await conn.query(
        `UPDATE users SET \`${col}\` = NULL WHERE \`${col}\` > ?`, [SEED_MAX_USER_ID]
      ).catch(() => {}); // column may not exist on all schema revisions
    }
    await conn.query('ALTER TABLE users AUTO_INCREMENT = ?', [SEED_MAX_USER_ID + 1]).catch(() => {});
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // After counts.
    const [[uAfter]] = await conn.query('SELECT COUNT(*) c FROM users');
    log('\n✅ Done.');
    log(`   users remaining: ${uAfter.c} (seed/role accounts)`);
    log(`   ${wipeTables.length} data tables cleared; ${keptPresent.length} config tables kept.`);
    log('\nNext: verify login with a seed account, then hand over.');
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
