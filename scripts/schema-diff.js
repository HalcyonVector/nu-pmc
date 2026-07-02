#!/usr/bin/env node
/*
 * schema-diff.js
 * ---------------------------------------------------------------------------
 * COLUMN-LEVEL schema verification. verify-and-provision.js checks that tables
 * exist; this checks that every COLUMN declared in schema.sql actually exists
 * in the live database. It exists because table-level checks miss drift like a
 * missing `meeting_revisions.locked_at`, which then throws at runtime.
 *
 * It parses schema.sql (the source of truth) into {table: {column: definition}}
 * and compares against information_schema.columns on the live DB.
 *
 *   MISSING  = declared in schema.sql, absent live  → causes "Unknown column" errors
 *   EXTRA    = present live, not in schema.sql        → informational (older/ad-hoc cols)
 *
 * For every MISSING column it emits a ready ALTER TABLE ... ADD COLUMN statement
 * (using the exact definition from schema.sql) to scripts/out/schema-fix.sql.
 *
 * MODES
 *   node scripts/schema-diff.js           # report + write scripts/out/schema-fix.sql
 *   node scripts/schema-diff.js --apply    # also execute the ADD COLUMN statements
 *
 * Reads DB config from the same env the app uses (loads .env from project root).
 * ---------------------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch { /* optional */ }

const mysql = require('mysql2/promise');
const { spawnSync } = require('child_process');

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve(__dirname, '..');
const SCHEMA = path.join(ROOT, 'schema.sql');

const dbConf = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  database: process.env.DB_NAME || 'nu_pmc',
  user: process.env.DB_USER || 'nu_app',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : {}),
};

function log(...a) { console.log(...a); }

// Parse schema.sql into { table: { column: fullColumnDefinition } }.
function parseSchema() {
  const txt = fs.readFileSync(SCHEMA, 'utf8');
  const blockRe = /create\s+table\s+`?([a-z0-9_]+)`?\s*\(([\s\S]*?)\n\)\s*engine/gi;
  const tables = {};
  let b;
  while ((b = blockRe.exec(txt))) {
    const table = b[1].toLowerCase();
    const body = b[2];
    const cols = {};
    for (let line of body.split('\n')) {
      line = line.trim().replace(/,$/, '');
      // A column line starts with a backtick-quoted name followed by a type.
      // Key/constraint lines (PRIMARY KEY, KEY, UNIQUE, CONSTRAINT, FULLTEXT,
      // SPATIAL) do NOT start with a backtick, so they are skipped naturally.
      const m = line.match(/^`([a-z0-9_]+)`\s+(.+)$/i);
      if (m) cols[m[1].toLowerCase()] = `\`${m[1]}\` ${m[2]}`;
    }
    tables[table] = cols;
  }
  return tables;
}

async function main() {
  const expected = parseSchema();
  const conn = await mysql.createConnection(dbConf);
  try {
    const [rows] = await conn.query(
      `SELECT LOWER(table_name) t, LOWER(column_name) c
         FROM information_schema.columns WHERE table_schema = ?`, [dbConf.database]);
    const live = {};
    for (const r of rows) (live[r.t] = live[r.t] || new Set()).add(r.c);

    log('='.repeat(72));
    log(`SCHEMA COLUMN DIFF — "${dbConf.database}" @ ${dbConf.host}`);
    log(`Mode: ${APPLY ? 'APPLY (will ADD missing columns)' : 'REPORT ONLY'}`);
    log('='.repeat(72));

    const alters = [];
    let missingCount = 0, extraCount = 0, tablesAbsent = 0;

    for (const table of Object.keys(expected).sort()) {
      if (!live[table]) { tablesAbsent++; log(`\n⚠ table absent live: ${table}`); continue; }
      const liveCols = live[table];
      const missing = Object.keys(expected[table]).filter(c => !liveCols.has(c));
      const extra = [...liveCols].filter(c => !(c in expected[table]));
      if (missing.length || extra.length) {
        log(`\n${table}`);
        for (const c of missing) {
          log(`   ✗ MISSING column: ${c}`);
          alters.push(`ALTER TABLE \`${table}\` ADD COLUMN ${expected[table][c]};`);
          missingCount++;
        }
        for (const c of extra) { log(`   • extra (live only): ${c}`); extraCount++; }
      }
    }

    log('\n' + '='.repeat(72));
    log(`Summary: ${missingCount} missing column(s), ${extraCount} extra, ${tablesAbsent} table(s) absent.`);

    if (alters.length) {
      const outDir = path.join(ROOT, 'scripts', 'out');
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'schema-fix.sql');
      fs.writeFileSync(outFile, 'SET FOREIGN_KEY_CHECKS=0;\n' + alters.join('\n') + '\nSET FOREIGN_KEY_CHECKS=1;\n');
      log(`\nWrote ${alters.length} ALTER statement(s) to ${outFile}`);
      alters.forEach(a => log('   ' + a));

      if (APPLY) {
        log('\n🔧 Applying missing columns...');
        const res = spawnSync('mysql', [`-h${dbConf.host}`, `-P${dbConf.port}`, `-u${dbConf.user}`, '--force', dbConf.database],
          { input: fs.readFileSync(outFile, 'utf8'), env: { ...process.env, MYSQL_PWD: dbConf.password }, encoding: 'utf8' });
        log((res.stderr || '').trim() || '   ✓ applied (re-run to confirm 0 missing).');
      } else {
        log('\nRe-run with --apply to add them, or apply scripts/out/schema-fix.sql manually.');
      }
    } else {
      log('\n✅ No missing columns — live schema matches schema.sql at column level.');
    }
    process.exitCode = missingCount ? 2 : 0;
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
