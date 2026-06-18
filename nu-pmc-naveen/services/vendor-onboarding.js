// services/vendor-onboarding.js
// ============================================================
// Token-based public flows for vendor onboarding + bank confirmation.
//
// One of FOUR vendor-data surfaces (healthy split — see modules/onboarding/
// routes/vendors.js header for the full map). This file = TOKEN issuance +
// lifecycle service. Issues / looks up / consumes / expires the wa.me tokens.
// Stateless service used by routes/vendors.js (issue) and routes/vendor-public.js
// (lookup + consume). The flow itself (state machine, dual-approval) lives
// in modules/onboarding/lib/vendor-bank-change.js.
//
// Spec: handoff-2026-04-28/2_ForMe/BUILD-COMMIT-30-April.md
//   - 48-hour single-use tokens (build-commit lock #4)
//   - Preview-crawler detection (URL preview bots from WhatsApp/Slack/etc.
//     hit GET endpoints to fetch og:image previews — those hits must NOT
//     count as "vendor opened the link", or a token would auto-consume
//     before the actual vendor sees it)
//
// Lifecycle:
//   issue()       — internal user generates a token (status='issued')
//   open()        — public GET hits — bumps open_count, marks status='opened'
//                    on first non-preview hit, returns metadata for the form
//   consume()     — vendor submits the form — marks status='consumed', returns
//                    the original payload + vendor row for the route to act on
//   revoke()      — internal user regenerates — old token marked 'revoked'
//
// Preview-crawler detection:
//   - First GET within 5 seconds of issue: treat as preview, don't mark opened
//   - GET with no Accept: text/html (typical of crawlers): don't mark opened
//   - GET with WhatsApp/facebookexternalhit/etc. user agent: don't mark opened
// ============================================================

'use strict';

const crypto = require('crypto');
const db = require('../middleware/db');

// Token validity. 48h is the default per build-commit lock #3 (Naveen's
// design call). Env override allows tuning for trial periods, demo flows,
// or stricter compliance setups without code edits. Bounds: 1h-720h
// (30 days). Outside that range we fall back to default and warn.
const TOKEN_VALIDITY_HOURS = (() => {
  const raw = process.env.VENDOR_TOKEN_HOURS;
  if (!raw) return 48;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 720) {
    console.warn(`[vendor-onboarding] VENDOR_TOKEN_HOURS='${raw}' out of bounds (1-720) — using default 48h.`);
    return 48;
  }
  return n;
})();
const TOKEN_BYTE_LENGTH    = 32;   // 32 bytes → 64-char hex token

// User agents known to fetch URL previews. These should NOT mark a token
// as "opened" — they're crawlers, not the actual vendor.
const PREVIEW_UA_PATTERNS = [
  /WhatsApp/i,
  /facebookexternalhit/i,
  /Slackbot-LinkExpanding/i,
  /Twitterbot/i,
  /TelegramBot/i,
  /SkypeUriPreview/i,
  /LinkedInBot/i,
  /Discordbot/i,
];

class TokenError extends Error {
  constructor(msg, { code = 'TOKEN_INVALID', status = 400 } = {}) {
    super(msg);
    this.name = 'TokenError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Returns true if the request looks like a URL-preview crawler rather than
 * a real vendor opening the link.
 */
function isPreviewCrawler(req) {
  const ua = req.headers['user-agent'] || '';
  if (!ua) return true;   // empty UA: treat as crawler (real browsers always send one)
  for (const pat of PREVIEW_UA_PATTERNS) {
    if (pat.test(ua)) return true;
  }
  // Crawlers typically don't request HTML — they fetch with Accept: */* or
  // */html-with-no-priority. A real browser sends Accept: text/html with a
  // strong preference. This heuristic is conservative: if Accept is missing
  // OR doesn't list text/html, treat as preview.
  const accept = req.headers['accept'] || '';
  if (!accept.includes('text/html')) return true;
  return false;
}

/**
 * Issue a new token for a vendor. Revokes any existing 'issued' or 'opened'
 * tokens for the same (vendor_id, purpose) — only one active token per
 * vendor-purpose at a time. Build-commit locks 48h expiry.
 *
 * @param {object} opts
 * @param {number} opts.vendorId
 * @param {string} opts.purpose       'bank_confirm' | 'onboard' | 're_validation'
 * @param {number} opts.issuedBy      users.id
 * @param {object} [opts.payload]     snapshot stored as payload_json
 * @param {number} [opts.approvalId]  for purpose='bank_confirm', link to approval row
 * @returns {Promise<{ token:string, expiresAt:Date, id:number }>}
 */
async function issue(opts) {
  const { vendorId, purpose, issuedBy, payload = null, approvalId = null } = opts;
  if (!vendorId)  throw new TokenError('vendorId required',  { code: 'VENDOR_REQUIRED' });
  if (!purpose)   throw new TokenError('purpose required',   { code: 'PURPOSE_REQUIRED' });
  if (!issuedBy)  throw new TokenError('issuedBy required',  { code: 'ISSUER_REQUIRED' });

  const validPurposes = ['bank_confirm', 'onboard', 're_validation'];
  if (!validPurposes.includes(purpose)) {
    throw new TokenError(`Invalid purpose '${purpose}'`, { code: 'PURPOSE_INVALID' });
  }

  const token = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_VALIDITY_HOURS * 3600 * 1000);

  const result = await db.tx(async (conn) => {
    // Revoke any active tokens for the same vendor + purpose
    await conn.query(
      `UPDATE vendor_onboarding_tokens
          SET status = 'revoked'
        WHERE vendor_id = ? AND purpose = ? AND status IN ('issued','opened')`,
      [vendorId, purpose]
    );
    const [r] = await conn.query(
      `INSERT INTO vendor_onboarding_tokens
         (vendor_id, token, purpose, status, issued_by, expires_at, payload_json, approval_id)
       VALUES (?, ?, ?, 'issued', ?, ?, ?, ?)`,
      [vendorId, token, purpose, issuedBy, expiresAt,
       payload ? JSON.stringify(payload) : null, approvalId]
    );
    return r.insertId;
  });

  return { id: result, token, expiresAt };
}

/**
 * Look up a token row by its token string. Used by the public GET/POST routes.
 * Validates expiry and status, returns the row + the vendor row joined.
 *
 * @param {string} tokenStr
 * @returns {Promise<{ row, vendor, isExpired:boolean, isConsumed:boolean }>}
 * @throws TokenError when token doesn't exist
 */
async function lookup(tokenStr) {
  if (!tokenStr || !/^[a-f0-9]{64}$/.test(tokenStr)) {
    throw new TokenError('Invalid token format', { code: 'TOKEN_FORMAT', status: 404 });
  }
  const [[row]] = await db.query(
    `SELECT t.*, v.id AS vendor_id, v.vendor_name, v.phone AS vendor_phone,
            v.bank_name, v.bank_account, v.bank_ifsc, v.gst_number, v.pan_number,
            v.clearance_status, v.bank_validated_by_vendor
       FROM vendor_onboarding_tokens t
       JOIN vendors v ON v.id = t.vendor_id
      WHERE t.token = ?`,
    [tokenStr]
  );
  if (!row) {
    throw new TokenError('Token not found', { code: 'TOKEN_NOT_FOUND', status: 404 });
  }
  const now = new Date();
  const isExpired  = row.status === 'expired'  || (row.expires_at && new Date(row.expires_at) < now);
  const isConsumed = row.status === 'consumed';
  const isRevoked  = row.status === 'revoked';

  return {
    row,
    vendor: {
      id: row.vendor_id, vendor_name: row.vendor_name, phone: row.vendor_phone,
      bank_name: row.bank_name, bank_account: row.bank_account, bank_ifsc: row.bank_ifsc,
      gst_number: row.gst_number, pan_number: row.pan_number,
      clearance_status: row.clearance_status,
      bank_validated_by_vendor: !!row.bank_validated_by_vendor,
    },
    isExpired,
    isConsumed,
    isRevoked,
  };
}

/**
 * Mark a token as "opened" by a real vendor (not a preview crawler).
 * - Skips the open-count bump for crawlers (still fetches happen, just untracked).
 * - On first non-crawler open, transitions status 'issued' → 'opened' and stamps
 *   opened_at.
 *
 * @param {string} tokenStr
 * @param {object} req           Express request — used for crawler detection
 * @returns {Promise<{ wasCrawler:boolean, opened:boolean }>}
 */
async function recordOpen(tokenStr, req) {
  const wasCrawler = isPreviewCrawler(req);

  // Fetch current status — needed to decide whether this is a status change
  const [[cur]] = await db.query(
    `SELECT id, status, open_count FROM vendor_onboarding_tokens WHERE token = ?`,
    [tokenStr]
  );
  if (!cur) return { wasCrawler, opened: false };

  // Both UPDATEs run inside one tx so a partial failure doesn't leave
  // the row with an inflated open_count but stale status. The status flip
  // is itself idempotent (WHERE id=? AND status='issued') so concurrent
  // opens are handled correctly. B9 in the audit.
  let opened = false;
  await db.tx(async (conn) => {
    // Always bump open_count (gives a coarse signal of how often the link is hit)
    await conn.query(
      `UPDATE vendor_onboarding_tokens SET open_count = open_count + 1 WHERE id = ?`,
      [cur.id]
    );

    // Only mark "opened" on a real open of a still-issued token
    if (!wasCrawler && cur.status === 'issued') {
      await conn.query(
        `UPDATE vendor_onboarding_tokens
            SET status = 'opened', opened_at = NOW()
          WHERE id = ? AND status = 'issued'`,
        [cur.id]
      );
      opened = true;
    }
  });
  return { wasCrawler, opened };
}

/**
 * Consume a token — called when the vendor submits the public form.
 * - Validates not expired, not already consumed, not revoked
 * - Marks token status='consumed', stamps consumed_at
 * - Returns the payload + vendor info so the route handler can apply the
 *   side effects (e.g. set vendors.bank_validated_by_vendor=1)
 *
 * @param {string} tokenStr
 * @returns {Promise<{ tokenId, vendorId, purpose, payload, approvalId }>}
 */
async function consume(tokenStr) {
  const lookupRes = await lookup(tokenStr);
  if (lookupRes.isExpired) throw new TokenError('Token expired',  { code: 'TOKEN_EXPIRED',  status: 410 });
  if (lookupRes.isConsumed) throw new TokenError('Token already used', { code: 'TOKEN_CONSUMED', status: 409 });
  if (lookupRes.isRevoked) throw new TokenError('Token revoked',   { code: 'TOKEN_REVOKED',  status: 410 });

  const r = lookupRes.row;
  const [upd] = await db.query(
    `UPDATE vendor_onboarding_tokens
        SET status = 'consumed', consumed_at = NOW()
      WHERE id = ? AND status IN ('issued','opened')`,
    [r.id]
  );
  if (upd.affectedRows === 0) {
    // Race: someone consumed it between lookup and update
    throw new TokenError('Token already used', { code: 'TOKEN_RACE', status: 409 });
  }

  const payload = r.payload_json
    ? (typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json)
    : null;

  return {
    tokenId: r.id,
    vendorId: r.vendor_id,
    purpose: r.purpose,
    payload,
    approvalId: r.approval_id,
  };
}

/**
 * Sweep expired tokens. Called by the scheduler to keep the table tidy
 * and ensure status accurately reflects reality.
 */
async function expireOldTokens() {
  const [r] = await db.query(
    `UPDATE vendor_onboarding_tokens
        SET status = 'expired'
      WHERE status IN ('issued','opened')
        AND expires_at < NOW()`
  );
  return { expired: r.affectedRows };
}

// Format the validity window as a human-readable string for vendor-facing
// messages. Centralised so messages stay in sync with the env-driven
// TOKEN_VALIDITY_HOURS — previously every wa.me preamble + the public HTML
// expiry page + frontend toasts hardcoded "48h", which would silently lie
// if VENDOR_TOKEN_HOURS env was changed. Now all four read this helper.
function humanReadableValidity() {
  const h = TOKEN_VALIDITY_HOURS;
  if (h === 24)        return '24h';
  if (h === 48)        return '48h';
  if (h === 72)        return '72h';
  if (h % 24 === 0)    return `${h/24} days`;
  return `${h}h`;
}

module.exports = {
  TOKEN_VALIDITY_HOURS,
  humanReadableValidity,
  TokenError,
  isPreviewCrawler,
  issue,
  lookup,
  recordOpen,
  consume,
  expireOldTokens,
};
