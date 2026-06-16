#!/usr/bin/env node
// scripts/matrix-provision-rooms.js
// ============================================================
// Operator script: create the Matrix rooms a project needs and record
// them in the matrix_rooms table.
//
// Usage:
//   node scripts/matrix-provision-rooms.js --project <id>
//   node scripts/matrix-provision-rooms.js --internal              # creates internal_principal, internal_finance, system_health
//   node scripts/matrix-provision-rooms.js --project 5 --dry-run   # log only, no DB writes, no Matrix calls
//
// Pre-requisites:
//   - MATRIX_HOMESERVER, MATRIX_BOT_TOKEN env vars set
//   - Bot account exists (create manually via Element X — see brief §8.2)
//   - Bot has been invited to all rooms it should post in (Matrix
//     requirement: bot must be a room member to post)
//
// What this script does:
//   1. For a project: creates rooms #PV{n}-coordination, -internal, -finance
//   2. Records each as a row in matrix_rooms (project_id, room_type, room_id)
//   3. All three rooms created with encryption OFF (polls don't work in
//      encrypted rooms — brief §6.2, §7.2)
//   4. For --internal: creates org-wide rooms internal_principal,
//      internal_finance, system_health (project_id NULL)
//
// What this script does NOT do:
//   - Invite users to rooms — that's a manual step or future automation
//   - Create the bot account itself — must be done manually in Element X
//   - Configure power levels — uses Matrix defaults
//
// ⚠ Encryption cannot be toggled after creation. If a room is created
//   with the wrong encryption, abandon it and re-run this script after
//   manually deleting the bad row from matrix_rooms.
// ============================================================

'use strict';

const db = require('../middleware/db');
const http = require('../services/http');

const HOMESERVER = process.env.MATRIX_HOMESERVER || '';
const BOT_TOKEN  = process.env.MATRIX_BOT_TOKEN  || '';

// Project rooms — created per project. Encryption explicitly OFF for bot
// rooms (Matrix polls don't work in encrypted rooms — brief §6.2/§7.2).
//
// Updated per Principal May 2026 decision (see MATRIX_MIGRATION_PLAN.md):
// supersedes brief §7.1's site/finance/design/general split. Reasons:
//   - 'coordination' adds vendors to the room (bridged via wa.me / EMS
//     WhatsApp bridge), so bot+vendors+team share one project channel
//   - 'internal' is the team-only room (no vendors); covers what
//     -site/-design did separately
//   - 'general' (encrypted human-only) DROPPED — Element X covers
//     personal team chat without per-project replication
//   - 'finance' unchanged — Principal + Principal + Finance, bot posts
//     payment requests, batch approvals, UTR confirmations
//
// Three rooms per project. At 10 projects → 30 project rooms +
// 3 organisation-wide rooms = 33 total. Within EMS capacity per
// brief §14.2.
const PROJECT_ROOM_TYPES = [
  { type: 'coordination', encrypted: 0, suffix: 'coordination', description: 'Internal team + vendors — bot posts here' },
  { type: 'internal',     encrypted: 0, suffix: 'internal',     description: 'Internal team only (no vendors) — bot posts here' },
  { type: 'finance',      encrypted: 0, suffix: 'finance',      description: 'Finance + Principal + Principal — bot posts here' },
];

// Internal rooms — project_id NULL, one per type globally
const INTERNAL_ROOM_TYPES = [
  { type: 'internal_principal',  encrypted: 0, alias: 'internal-principal',  description: 'Principal only — personal digests' },
  { type: 'internal_finance', encrypted: 0, alias: 'internal-finance', description: 'Finance only — payment alerts' },
  { type: 'system_health',    encrypted: 0, alias: 'system-health',    description: 'Admin / Guru only — canary alerts' },
];

function args() {
  const a = { project: null, internal: false, dryRun: false };
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k === '--project')  a.project = parseInt(process.argv[++i], 10);
    else if (k === '--internal') a.internal = true;
    else if (k === '--dry-run' || k === '--dry') a.dryRun = true;
    else if (k === '-h' || k === '--help') a.help = true;
  }
  return a;
}

function printHelp() {
  console.log(`
scripts/matrix-provision-rooms.js — provision Matrix rooms

Usage:
  node scripts/matrix-provision-rooms.js --project <id>
  node scripts/matrix-provision-rooms.js --internal
  node scripts/matrix-provision-rooms.js --project 5 --dry-run

Flags:
  --project <id>   Provision rooms for a specific project
  --internal       Provision internal_principal, internal_finance, system_health
  --dry-run        Print intent only, no DB writes, no Matrix calls

Env required:
  MATRIX_HOMESERVER  e.g. https://nuassociates.ems.host
  MATRIX_BOT_TOKEN   syt_xxxxxxxxxxxxxxxxx

`);
}

/**
 * Call Matrix POST /createRoom. Returns { room_id, room_alias }.
 *
 * @param {object} opts
 * @param {string} opts.alias       e.g. PV90-site (no leading #)
 * @param {string} opts.name        human-readable e.g. "PV90 Site"
 * @param {string} opts.topic
 * @param {boolean} opts.encrypted
 */
async function createRoom({ alias, name, topic, encrypted }) {
  if (!HOMESERVER || !BOT_TOKEN) {
    throw new Error('MATRIX_HOMESERVER and MATRIX_BOT_TOKEN env vars are required for live mode');
  }
  const url = `${HOMESERVER}/_matrix/client/v3/createRoom`;
  const body = {
    preset: 'private_chat',
    name,
    topic,
    room_alias_name: alias,
    visibility: 'private',
    initial_state: encrypted
      ? [{
          type: 'm.room.encryption',
          state_key: '',
          content: { algorithm: 'm.megolm.v1.aes-sha2' },
        }]
      : [],
  };
  const res = await http.post(url, body, {
    headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
  });
  if (!res?.data?.room_id) {
    throw new Error(`Matrix createRoom returned no room_id: ${JSON.stringify(res?.data)}`);
  }
  return {
    room_id: res.data.room_id,
    room_alias: res.data.room_alias || `#${alias}:${(new URL(HOMESERVER)).hostname}`,
  };
}

/**
 * Set room power levels per brief P8.3:
 *   - Bot at level 50 (can send + end polls)
 *   - users_default = 0 (can chat but cannot create/end polls)
 */
async function setPowerLevels(roomId) {
  const botUserId = process.env.MATRIX_BOT_USER_ID;
  if (!botUserId || !HOMESERVER || !BOT_TOKEN) return;

  const url = `${HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`;
  await http.put(url, {
    users: { [botUserId]: 50 },
    users_default: 0,
    events: {
      'org.matrix.msc3381.poll.start': 50,
      'org.matrix.msc3381.poll.end':   50,
    },
  }, {
    headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
  });
}

async function provisionProject(projectId, dryRun) {
  const [[project]] = await db.query('SELECT id, name, code FROM projects WHERE id = ?', [projectId]);
  if (!project) {
    console.error(`[matrix-provision] Project ${projectId} not found`);
    process.exit(2);
  }
  // Project code comes from projects.code (set at project creation, see
  // routes/projects.js). Earlier this function derived a code via name-regex
  // ("PV 90 Production Line" → "PV90PL") which was fragile and could drift
  // from Principal's actual project-code convention. Use the real column.
  // Fall back to "P{id}" only if the row somehow lacks a code.
  const code = (project.code && project.code.trim()) || `P${projectId}`;
  console.log(`\n=== Provisioning rooms for ${project.name} (project ${projectId}, code ${code}) ===`);

  for (const spec of PROJECT_ROOM_TYPES) {
    // Idempotency: skip if already in matrix_rooms
    const [[existing]] = await db.query(
      `SELECT id, room_id FROM matrix_rooms
        WHERE project_id = ? AND room_type = ? AND archived_at IS NULL LIMIT 1`,
      [projectId, spec.type]
    );
    if (existing) {
      console.log(`  ✓ ${spec.type}: already provisioned (${existing.room_id})`);
      continue;
    }

    const aliasLocal = `${code}-${spec.suffix}`;
    const name = `${code} ${spec.suffix}`;
    const topic = `${spec.description} — created by nu PMC`;

    if (dryRun) {
      console.log(`  ⊘ ${spec.type}: would create alias=${aliasLocal} encrypted=${spec.encrypted}`);
      continue;
    }

    try {
      const result = await createRoom({ alias: aliasLocal, name, topic, encrypted: !!spec.encrypted });
      await db.query(
        `INSERT INTO matrix_rooms (project_id, room_type, room_id, room_alias, encrypted)
         VALUES (?, ?, ?, ?, ?)`,
        [projectId, spec.type, result.room_id, result.room_alias, spec.encrypted]
      );
      console.log(`  ✓ ${spec.type}: created ${result.room_id} (alias ${result.room_alias})`);

      // Set power levels per brief P8.3: bot at 50, users at 0.
      // Bot can create and end polls; users can only chat.
      await setPowerLevels(result.room_id);
      console.log(`    ✓ power levels set`);
    } catch (err) {
      console.error(`  ✗ ${spec.type}: FAILED — ${err.message}`);
      // Continue with other rooms — don't bail entire script on one failure
    }
  }
}

async function provisionInternal(dryRun) {
  console.log('\n=== Provisioning internal/system rooms ===');
  for (const spec of INTERNAL_ROOM_TYPES) {
    const [[existing]] = await db.query(
      `SELECT id, room_id FROM matrix_rooms
        WHERE project_id IS NULL AND room_type = ? AND archived_at IS NULL LIMIT 1`,
      [spec.type]
    );
    if (existing) {
      console.log(`  ✓ ${spec.type}: already provisioned (${existing.room_id})`);
      continue;
    }
    if (dryRun) {
      console.log(`  ⊘ ${spec.type}: would create alias=${spec.alias}`);
      continue;
    }
    try {
      const result = await createRoom({
        alias: spec.alias,
        name: spec.alias,
        topic: spec.description,
        encrypted: !!spec.encrypted,
      });
      await db.query(
        `INSERT INTO matrix_rooms (project_id, room_type, room_id, room_alias, encrypted)
         VALUES (NULL, ?, ?, ?, ?)`,
        [spec.type, result.room_id, result.room_alias, spec.encrypted]
      );
      console.log(`  ✓ ${spec.type}: created ${result.room_id}`);
      await setPowerLevels(result.room_id);
      console.log(`    ✓ power levels set`);
    } catch (err) {
      console.error(`  ✗ ${spec.type}: FAILED — ${err.message}`);
    }
  }
}

async function main() {
  const a = args();
  if (a.help || (!a.project && !a.internal)) {
    printHelp();
    process.exit(a.help ? 0 : 1);
  }
  if (!a.dryRun && (!HOMESERVER || !BOT_TOKEN)) {
    console.error('ERROR: MATRIX_HOMESERVER and MATRIX_BOT_TOKEN env vars required');
    console.error('       (use --dry-run to test the script without Matrix credentials)');
    process.exit(2);
  }

  if (a.internal) {
    await provisionInternal(a.dryRun);
  }
  if (a.project) {
    await provisionProject(a.project, a.dryRun);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
