#!/usr/bin/env node
// scripts/backfill-matrix-ids.js
//
// One-time backfill: derives matrix_user_id from username for all internal
// users who don't have one, then attempts to create a personal DM room
// between the bot and each user.
//
// Safe to re-run — skips users who already have matrix_user_id set.
// Run AFTER deploying to EMS with a live MATRIX_BOT_TOKEN.
//
// USAGE
//   node scripts/backfill-matrix-ids.js
//   node scripts/backfill-matrix-ids.js --dry-run   # prints what would change
//
// REQUIREMENTS
//   MATRIX_BOT_USER_ID and MATRIX_BOT_TOKEN must be set in .env
//   MATRIX_HOMESERVER must be set and reachable

'use strict';

require('dotenv').config();

const db           = require('../middleware/db');
const matrixAdapter = require('../services/matrix-adapter');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  console.log(`\nBackfill Matrix IDs — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Verify MATRIX_BOT_USER_ID is set — needed for domain derivation
  if (!process.env.MATRIX_BOT_USER_ID) {
    console.error('MATRIX_BOT_USER_ID not set — cannot derive user IDs. Set it in .env and retry.');
    process.exit(1);
  }

  const [users] = await db.query(
    `SELECT id, username, full_name, role, matrix_user_id, matrix_room_id
       FROM users
      WHERE is_active = 1
        AND matrix_user_id IS NULL
      ORDER BY id ASC`
  );

  console.log(`Found ${users.length} users without matrix_user_id\n`);
  if (!users.length) {
    console.log('Nothing to do.');
    await db.end?.();
    return;
  }

  let derivedCount  = 0;
  let roomCount     = 0;
  let roomFailed    = 0;

  for (const user of users) {
    const matrixUserId = matrixAdapter.deriveMatrixUserId(user.username);
    if (!matrixUserId) {
      console.log(`  SKIP  ${user.username} — could not derive Matrix user ID (check MATRIX_BOT_USER_ID)`);
      continue;
    }

    let matrixRoomId = null;

    if (!DRY_RUN) {
      // Attempt to create personal DM room
      matrixRoomId = await matrixAdapter.createUserDMRoom(matrixUserId);
      if (matrixRoomId) {
        roomCount++;
      } else {
        roomFailed++;
        console.log(`  WARN  ${user.username} — room creation failed (user may not be on EMS yet)`);
      }

      await db.query(
        'UPDATE users SET matrix_user_id = ?, matrix_room_id = ? WHERE id = ?',
        [matrixUserId, matrixRoomId, user.id]
      );
    }

    derivedCount++;
    const roomStr = matrixRoomId ? `room ${matrixRoomId}` : 'no room';
    console.log(`  ${DRY_RUN ? 'WOULD SET' : 'SET'}  ${user.username.padEnd(20)} → ${matrixUserId}  (${DRY_RUN ? 'room: pending' : roomStr})`);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Users processed:   ${derivedCount}`);
  if (!DRY_RUN) {
    console.log(`Rooms created:     ${roomCount}`);
    console.log(`Rooms failed:      ${roomFailed} (user not yet on EMS — set matrix_room_id manually after onboarding)`);
  }
  console.log(`\nDone.`);

  await db.end?.();
}

run().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
