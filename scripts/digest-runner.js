#!/usr/bin/env node
// scripts/digest-runner.js
// ============================================================
// Digest cron entry point — reads notifications_config to determine
// which digest to send at which time.
//
// Called by cron three times daily. Cron times must match notifications_config:
//   0  7 * * * /usr/bin/node /path/to/scripts/digest-runner.js morning_pmc
//   0  8 * * * /usr/bin/node /path/to/scripts/digest-runner.js principal
//   0 21 * * * /usr/bin/node /path/to/scripts/digest-runner.js closeout
//
// Per v2 brief C11: "One function, three database configurations.
// No digest-specific code." The function is in services/digest.js.
// ============================================================

'use strict';

const db         = require('../middleware/db');
const { sendDigest } = require('../services/digest');

async function main() {
  const digestType = process.argv[2];
  if (!digestType) {
    console.error('Usage: digest-runner.js <morning_pmc|principal|closeout>');
    process.exit(1);
  }

  // Verify the digest type is active in notifications_config
  const [[cfg]] = await db.query(
    `SELECT active FROM notifications_config WHERE digest_type = ? LIMIT 1`,
    [digestType]
  );
  if (!cfg) {
    console.error(`[digest-runner] Unknown digestType: ${digestType}`);
    process.exit(1);
  }
  if (!cfg.active) {
    console.log(`[digest-runner] digestType ${digestType} is inactive — skipping`);
    await db.end().catch(() => {});
    process.exit(0);
  }

  console.log(`[digest-runner] Sending ${digestType} digest — ${new Date().toISOString()}`);

  await sendDigest({ digestType });

  console.log(`[digest-runner] Done — ${digestType}`);
  await db.end().catch(() => {});
  process.exit(0);
}

main().catch(err => {
  console.error('[digest-runner] Fatal:', err.message);
  process.exit(1);
});
