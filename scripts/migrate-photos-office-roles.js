#!/usr/bin/env node
// One-time migration:
//   Add 'photos' tab to office roles (design_head, services_head, team_lead)
//   so they can view site photos uploaded by site managers.
//
//   Previously these roles only had 'phototags' (AI dispute review) but
//   no way to browse the photo gallery itself.
//
// Run once from the project root:
//   node scripts/migrate-photos-office-roles.js

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../middleware/db');

const NAV_ENTRIES = [
  // design_head: photos at position 6 (after phototags at 5)
  { role: 'design_head',    bucket: 'work', tab_key: 'photos', sort_order: 6 },
  // services_head: photos at position 6 (after phototags at 5)
  { role: 'services_head',  bucket: 'work', tab_key: 'photos', sort_order: 6 },
  // team_lead: photos at position 6 (after phototags at 5)
  { role: 'team_lead',      bucket: 'work', tab_key: 'photos', sort_order: 6 },
];

async function run() {
  let added = 0;
  let skipped = 0;

  for (const entry of NAV_ENTRIES) {
    const [[existing]] = await db.query(
      'SELECT id FROM role_nav WHERE role = ? AND tab_key = ?',
      [entry.role, entry.tab_key]
    );
    if (existing) {
      console.log(`  SKIP ${entry.role}.${entry.tab_key} — already exists`);
      skipped++;
      continue;
    }
    await db.query(
      `INSERT INTO role_nav (role, bucket, tab_key, sort_order, is_visible)
       VALUES (?, ?, ?, ?, 1)`,
      [entry.role, entry.bucket, entry.tab_key, entry.sort_order]
    );
    console.log(`  ADD  ${entry.role}.${entry.tab_key} (bucket=${entry.bucket}, sort=${entry.sort_order})`);
    added++;
  }

  console.log(`\nDone. Added ${added}, skipped ${skipped}.`);
  console.log('Users must re-login (or server restart) for nav changes to take effect.');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
