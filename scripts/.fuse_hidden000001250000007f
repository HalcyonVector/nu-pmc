#!/usr/bin/env node
// One-time migration:
//   Close stale drawing_approval wa_pending_actions records.
//   Principals are not the L2 drawing approver (design_head is).
//   The approvals.register() call that created these has been removed from drawings.js.
//   This script cleans up records already in the DB.
//
// Run once from the project root:
//   node scripts/migrate-nav-grn-cleanup.js

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../middleware/db');

async function run() {
  const [result] = await db.query(
    `UPDATE wa_pending_actions SET status = 'acted'
     WHERE request_type = 'drawing_approval' AND status = 'pending'`
  );
  console.log(`Closed ${result.affectedRows} stale drawing_approval record(s).`);
  console.log('Done. Reload the app — "Approvals pending" card should be gone.');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
