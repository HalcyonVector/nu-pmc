#!/usr/bin/env node
// scripts/canary-runner.js
// ============================================================
// Runs all five canary checks at 6AM daily.
// Per v2 brief C12 / P10.1.
//
// Called by the system cron:
//   0 6 * * * /usr/bin/node /path/to/scripts/canary-runner.js >> /var/log/nu-pmc-canary.log 2>&1
//
// canary_time in security_config controls the scheduled time;
// the cron entry must match it. Default: 06:00 IST.
// ============================================================

'use strict';

const { runAllCanaryChecks } = require('../services/canary');
const matrixAdapter           = require('../services/matrix-adapter');
const http                    = require('../services/http');
const db                      = require('../middleware/db');

const HS    = process.env.MATRIX_HOMESERVER || '';
const TOKEN = process.env.MATRIX_BOT_TOKEN  || '';
const AUTH  = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// ── Check definitions ─────────────────────────────────────────────────
// Per v2 brief P10.1 table. All five checks.
// Adding a new check = add an entry to this array. No code change elsewhere.

const CHECKS = [
  {
    name: 'Matrix connectivity',
    pingFn: async () => {
      // Send a test message to #system-health and read it back.
      const room = await matrixAdapter.getInternalRoomId('system_health');
      if (!room) throw new Error('#system-health room not provisioned');
      const marker = `canary-${Date.now()}`;
      await matrixAdapter.sendText({ roomId: room, body: `[canary] ${marker}` });
      await new Promise(r => setTimeout(r, 1000));
      const events = await matrixAdapter.readMessages(room, { limit: 5 });
      const found = events.some(e => (e.content?.body || '').includes(marker));
      if (!found) throw new Error('Send/read round-trip failed');
    },
    onSuccessFn: async () => {},
    onFailureFn: async (err) => {
      console.error('[canary] Matrix connectivity failed:', err.message);
      // Per brief P10.1: flip to WhatsApp fallback.
      // Note: this would be done via ops config update, not code.
      // Logging here is the signal for ops to act.
      console.error('[canary] ACTION REQUIRED: set NOTIFICATIONS=whatsapp and restart app');
    },
  },

  {
    name: 'Matrix poll',
    pingFn: async () => {
      const room = await matrixAdapter.getInternalRoomId('system_health');
      if (!room) throw new Error('#system-health room not provisioned');
      const { eventId } = await matrixAdapter.sendPoll({
        roomId: room,
        question: '[canary] poll test — ignore',
        answers: [{ id: 'ok', text: 'OK' }, { id: 'fail', text: 'Fail' }],
      });
      if (!eventId) throw new Error('sendPoll returned no event_id');
      // Close immediately
      await matrixAdapter.closePoll({ roomId: room, pollEventId: eventId, text: '[canary] closing test poll' });
    },
    onSuccessFn: async () => {},
    onFailureFn: async (err) => {
      console.error('[canary] Matrix poll failed:', err.message);
      // Per brief P10.1: alert Guru, log warning.
      console.error('[canary] ACTION REQUIRED: Matrix poll functionality degraded — alert Guru');
    },
  },

  {
    name: 'ICICI webhook',
    pingFn: async () => {
      // Per brief P10.1: POST test payload to /api/payments/utr-webhook.
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3999';
      const secret  = process.env.ICICI_WEBHOOK_SECRET || '';
      if (!secret) throw new Error('ICICI_WEBHOOK_SECRET not set — cannot test webhook');
      const res = await http.post(
        `${baseUrl}/api/payments/utr-webhook`,
        { utr: 'CANARY_TEST', account_number: '000000000000', amount: '0', status: 'canary', _secret: secret },
        { headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': secret } }
      );
      // Webhook should return 200 (even if no matching payment)
      if (!res || res.status >= 500) throw new Error(`Webhook returned status ${res?.status}`);
    },
    onSuccessFn: async () => {},
    onFailureFn: async (err) => {
      console.error('[canary] ICICI webhook failed:', err.message);
      // Per brief P10.1: alert finance, manual mode.
      console.error('[canary] ACTION REQUIRED: ICICI webhook unreachable — finance must process UTRs manually');
    },
  },

  {
    name: 'GSTIN API',
    pingFn: async () => {
      // Per brief P10.1: lookup a known valid GSTIN.
      const knownGstin = process.env.CANARY_GSTIN || '29ABCDE1234F1Z5';
      const apiKey     = process.env.GSTIN_API_KEY || '';
      if (!apiKey) throw new Error('GSTIN_API_KEY not set — cannot test GSTIN API');
      // Generic GSTIN lookup — endpoint varies by provider
      const apiUrl = `https://sheet.gstincheck.co.in/check/${apiKey}/${knownGstin}`;
      const res    = await http.get(apiUrl);
      if (!res?.data) throw new Error('GSTIN API returned empty response');
    },
    onSuccessFn: async () => {},
    onFailureFn: async (err) => {
      console.error('[canary] GSTIN API failed:', err.message);
      // Per brief P10.1: disable form validation, log warning.
      console.error('[canary] WARNING: GSTIN validation degraded — form validation may be disabled');
    },
  },

  {
    name: 'IFSC API',
    pingFn: async () => {
      // Per brief P10.1: lookup a known valid IFSC.
      // Razorpay's free IFSC API — no key needed.
      const knownIfsc = 'SBIN0000001'; // SBI main branch, always valid
      const res = await http.get(`https://ifsc.razorpay.com/${knownIfsc}`);
      if (!res?.data?.BANK) throw new Error('IFSC API returned unexpected response');
    },
    onSuccessFn: async () => {},
    onFailureFn: async (err) => {
      console.error('[canary] IFSC API failed:', err.message);
      // Per brief P10.1: disable form validation, log warning.
      console.error('[canary] WARNING: IFSC validation degraded — bank detail form validation may be disabled');
    },
  },
];

async function main() {
  console.log(`[canary] Starting — ${new Date().toISOString()}`);

  const { passed, failed, results } = await runAllCanaryChecks(CHECKS);

  console.log(`[canary] Done — ${passed}/${results.length} passed`);
  if (failed > 0) {
    console.error(`[canary] ${failed} check(s) failed — see above for ACTION REQUIRED items`);
    process.exit(1);
  }

  await db.end().catch(() => {});
  process.exit(0);
}

main().catch(err => {
  console.error('[canary] Fatal error:', err.message);
  process.exit(1);
});
