#!/usr/bin/env node
// scripts/iter1-deploy-day.js
// ============================================================
// Iteration 1 deploy-day script. Run ONCE on the production server
// after migration v5.24 has been applied.
//
// Per build-commit lock #3:
//   - All cleared vendors flip to clearance_status='pending'
//   - bank_validated_by_vendor=FALSE for all vendors
//   - Triggers wa.me re-validation flow for each (token issued lazily
//     when finance clicks "Send onboarding via WhatsApp")
//
// What this script does:
//   1. Counts vendors per current state (audit before)
//   2. Flips all is_active=1 vendors with clearance_status='cleared' to 'pending'
//   3. Resets bank_validated_by_vendor=0 on all vendors
//   4. Stamps an audit_log entry per vendor for traceability
//   5. Prints a final summary
//
// What this script does NOT do:
//   - Issue tokens (finance does that via the UI button, one vendor at
//     a time, so they can review the contact phone before sending)
//   - Send WhatsApp messages
//   - Touch already-pending or rejected vendors' clearance status
//
// Idempotency:
//   - Safe to re-run. Vendors already pending stay pending. Vendors
//     with bank_validated_by_vendor=0 stay at 0. Audit log only inserts
//     on actual state change (skip if no change needed).
//
// Usage:
//   node scripts/iter1-deploy-day.js               # apply
//   node scripts/iter1-deploy-day.js --dry-run     # preview only
// ============================================================

'use strict';

const db = require('../middleware/db');

function args() {
  const a = { dryRun: false, help: false };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === '--dry-run' || k === '--dry') a.dryRun = true;
    else if (k === '-h' || k === '--help') a.help = true;
  }
  return a;
}

function printHelp() {
  console.log(`
scripts/iter1-deploy-day.js — pre-emptive vendor re-validation

Runs ONCE per production deploy of Iteration 1. Idempotent.

Usage:
  node scripts/iter1-deploy-day.js
  node scripts/iter1-deploy-day.js --dry-run    # preview only

Operations:
  1. cleared vendors → pending (must re-clear after vendor confirms)
  2. bank_validated_by_vendor → 0 for all vendors
  3. Audit log entry per affected vendor
`);
}

async function snapshot() {
  const [[c]] = await db.query(
    `SELECT
        SUM(clearance_status='cleared')                  AS cleared,
        SUM(clearance_status='pending')                  AS pending,
        SUM(clearance_status='rejected')                 AS rejected,
        SUM(bank_validated_by_vendor=1)                  AS bank_validated,
        SUM(bank_validated_by_vendor=0)                  AS bank_unvalidated,
        COUNT(*)                                         AS total
       FROM vendors WHERE is_active = 1`
  );
  return c;
}

async function applyChanges(dryRun) {
  // ── 1. Vendors needing clearance reset (currently cleared)
  const [toResetClearance] = await db.query(
    `SELECT id, vendor_name, clearance_status, bank_validated_by_vendor
       FROM vendors
      WHERE is_active = 1 AND clearance_status = 'cleared'
      ORDER BY id`
  );
  console.log(`  ${toResetClearance.length} cleared vendors → will flip to 'pending'`);

  // ── 2. Vendors needing bank validation reset (currently validated)
  const [toResetBank] = await db.query(
    `SELECT id, vendor_name
       FROM vendors
      WHERE is_active = 1 AND bank_validated_by_vendor = 1
      ORDER BY id`
  );
  console.log(`  ${toResetBank.length} vendors with bank_validated_by_vendor=1 → will reset to 0`);

  if (dryRun) {
    console.log('\n  [dry-run] no changes applied.');
    return { clearanceReset: toResetClearance.length, bankReset: toResetBank.length };
  }

  // ── 3. Apply in a single transaction so partial failure rolls back.
  await db.tx(async (conn) => {
    // Reset clearance — explicit ID list rather than blanket UPDATE so we
    // log per-vendor and so re-runs after a partial state change behave
    // sanely. Skip if list empty.
    if (toResetClearance.length) {
      const ids = toResetClearance.map(v => v.id);
      await conn.query(
        `UPDATE vendors
            SET clearance_status = 'pending',
                cleared_by = NULL,
                cleared_at = NULL
          WHERE id IN (?) AND clearance_status = 'cleared'`,
        [ids]
      );
      // Audit log per vendor — keeps the deploy-day reset auditable
      const auditRows = toResetClearance.map(v => [
        null,                                         // user_id — script, not human
        'vendor.iter1_deploy.clearance_reset',
        'vendors',
        v.id,
        JSON.stringify({
          previous_status: 'cleared',
          new_status: 'pending',
          reason: 'iteration_1_deploy_day_pre_emptive_revalidation',
        }),
        new Date(),
      ]);
      // Bulk insert
      if (auditRows.length) {
        const placeholders = auditRows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const flat = auditRows.flat();
        await conn.query(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at)
           VALUES ${placeholders}`,
          flat
        );
      }
    }

    // Reset bank validation flag for all is_active vendors. This is a
    // blanket UPDATE — every vendor needs vendor-side confirmation
    // regardless of prior state on a fresh Iteration 1 deploy.
    if (toResetBank.length) {
      const ids = toResetBank.map(v => v.id);
      await conn.query(
        `UPDATE vendors
            SET bank_validated_by_vendor = 0,
                bank_validated_at = NULL,
                bank_validation_method = NULL
          WHERE id IN (?) AND bank_validated_by_vendor = 1`,
        [ids]
      );
      const auditRows = toResetBank.map(v => [
        null,
        'vendor.iter1_deploy.bank_validation_reset',
        'vendors',
        v.id,
        JSON.stringify({
          reason: 'iteration_1_deploy_day_pre_emptive_revalidation',
        }),
        new Date(),
      ]);
      if (auditRows.length) {
        const placeholders = auditRows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const flat = auditRows.flat();
        await conn.query(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at)
           VALUES ${placeholders}`,
          flat
        );
      }
    }
  });

  return { clearanceReset: toResetClearance.length, bankReset: toResetBank.length };
}

async function main() {
  const a = args();
  if (a.help) { printHelp(); process.exit(0); }

  console.log('\n=== Iteration 1 deploy-day pre-emptive vendor re-validation ===');
  if (a.dryRun) console.log('   (DRY-RUN — no changes will be applied)\n');

  const before = await snapshot();
  console.log('\n  Before:');
  console.log(`    total active vendors:           ${before.total}`);
  console.log(`    clearance_status=cleared:       ${before.cleared}`);
  console.log(`    clearance_status=pending:       ${before.pending}`);
  console.log(`    clearance_status=rejected:      ${before.rejected}`);
  console.log(`    bank_validated_by_vendor=1:     ${before.bank_validated}`);
  console.log(`    bank_validated_by_vendor=0:     ${before.bank_unvalidated}`);

  console.log('\n  Applying:');
  const counts = await applyChanges(a.dryRun);

  if (!a.dryRun) {
    const after = await snapshot();
    console.log('\n  After:');
    console.log(`    clearance_status=cleared:       ${after.cleared}`);
    console.log(`    clearance_status=pending:       ${after.pending}`);
    console.log(`    bank_validated_by_vendor=1:     ${after.bank_validated}`);
    console.log(`    bank_validated_by_vendor=0:     ${after.bank_unvalidated}`);
  }

  console.log(`\n  Summary: ${counts.clearanceReset} clearances reset, ${counts.bankReset} bank-validations reset.`);
  console.log('\n  Next step (manual): finance team works through the pending list,');
  console.log('  tapping "Send onboarding via WhatsApp" on each cleared vendor to');
  console.log('  initiate vendor-side bank confirmation. ICICI batches will refuse');
  console.log('  any vendor without bank_validated_by_vendor=1.\n');
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}

module.exports = { snapshot, applyChanges };
