// middleware/csrf.js
//
// Synchronizer-token CSRF protection — double-submit cookie pattern.
//
// Threat model: an external site triggers the user's browser to make a
// state-changing request to nu PMC while the user is logged in. SameSite=strict
// on the session cookie filters most of this, but a small surface remains
// (e.g. some browser quirks, certain redirect chains, manually-saved bookmarks
// on a malicious page). This middleware closes that gap with a header token
// the attacker cannot read across origins.
//
// Token shape
// -----------
// At login, the server generates a random 32-byte hex token, stores it on the
// session as `req.session.csrf_token`, and writes it to a cookie named
// `nu_csrf` that is NOT httpOnly (so the frontend JS can read it) and IS
// sameSite=strict (so the attacker's site cannot read it).
//
// Per-session rotation: one token per login session, valid until logout.
// Decision recorded 2026-04-25 — covers the firm's CSRF threat without
// breaking WhatsApp deep-link flows, multi-tab usage, or the offline queue.
//
// Validation rules
// ----------------
// On POST / PATCH / PUT / DELETE:
//   - Skip if NODE_ENV='test' AND X-Test-User-Id header is set (matrix harness).
//   - Skip if path matches an EXEMPT prefix (webhooks, login).
//   - Otherwise: read X-Nu-CSRF header, compare to req.session.csrf_token.
//   - Mismatch or missing → 403 with { code: 'CSRF_INVALID' }.
//
// GETs are not validated (read-only by definition; CSRF requires state change).
//
// Feature flag
// ------------
// Enabled when CSRF_ENABLED env is unset OR set to anything other than 'false'.
// To temporarily disable for incident recovery: set CSRF_ENABLED=false and
// restart. Frontend will keep sending the header; server will simply not check.

'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'nu_csrf';
const HEADER_NAME = 'x-nu-csrf';            // Express lowercases header names

// Endpoints exempt from CSRF check. Webhooks use HMAC over the body and have
// no session; login issues the token, so cannot require it. Anything added
// here must have its own non-cookie authentication.
const EXEMPT_PREFIXES = [
  '/api/auth/login',
  '/api/payments/utr-webhook',             // ICICI bank — HMAC signed
  '/api/notifications/ses-webhook',        // AWS SES bounce/complaint — HMAC signed
  '/api/whatsapp/webhook',                 // Twilio inbound — HMAC signed
  '/api/whatsapp/status-callback',         // Twilio delivery status — HMAC signed
];

const STATE_CHANGING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function isEnabled() {
  return process.env.CSRF_ENABLED !== 'false';
}

// Generate a fresh token. 32 random bytes, hex-encoded → 64-char string.
function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Issue a token: store on session, set cookie. Call after a successful login.
// The cookie maxAge mirrors the session cookie (8h); both expire together.
function issueToken(req, res) {
  const token = newToken();
  req.session.csrf_token = token;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: false,                       // frontend JS reads this
    sameSite: 'strict',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   8 * 60 * 60 * 1000,          // 8h, same as session
  });
  return token;
}

// Clear the token. Call on logout.
function clearToken(req, res) {
  if (req.session) delete req.session.csrf_token;
  res.clearCookie(COOKIE_NAME);
}

// Constant-time string comparison — never use `===` on secrets.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// The middleware itself.
function csrfMiddleware(req, res, next) {
  if (!isEnabled()) return next();
  if (!STATE_CHANGING_METHODS.has(req.method)) return next();

  // Test-harness bypass — same gate as the X-Test-User-Id auth bypass.
  // NODE_ENV is 'test' only inside the matrix runner; in any other env this
  // branch is dead code.
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
    return next();
  }

  // Exempt endpoints (webhooks, login). Path-prefix match against the
  // server-mounted path (req.originalUrl strips the query string off
  // automatically when accessed via .path on the URL).
  const path = req.originalUrl.split('?')[0];
  for (const prefix of EXEMPT_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + '/')) return next();
  }

  // From here on: token must be present and match.
  let sessionToken = req.session?.csrf_token;
  const headerToken  = req.headers[HEADER_NAME];

  if (!sessionToken) {
    // Session exists but has no CSRF token — this happens for sessions that
    // were created before CSRF was enabled (e.g. after a server upgrade while
    // users were already logged in). Rather than forcing a re-login, backfill
    // a token now. The client must read the new nu_csrf cookie value and retry
    // the request with it in the X-Nu-CSRF header.
    if (req.session?.user) {
      sessionToken = issueToken(req, res);
      // The client doesn't have the token yet for this request — tell it to
      // read the cookie and retry rather than silently passing a request that
      // has no header token at all.
      return res.status(403).json({
        error: 'CSRF token was missing from your session and has been reissued. Please retry the request.',
        code:  'CSRF_TOKEN_REISSUED',
      });
    }
    // No session user at all — force re-login.
    return res.status(403).json({
      error: 'Session does not have a CSRF token. Please log in again.',
      code:  'CSRF_NO_SESSION_TOKEN',
    });
  }

  if (!headerToken) {
    return res.status(403).json({
      error: 'CSRF token missing from request header.',
      code:  'CSRF_HEADER_MISSING',
    });
  }

  if (!safeEqual(sessionToken, String(headerToken))) {
    return res.status(403).json({
      error: 'CSRF token invalid. Please log in again.',
      code:  'CSRF_INVALID',
    });
  }

  next();
}

module.exports = {
  csrfMiddleware,
  issueToken,
  clearToken,
  COOKIE_NAME,
  HEADER_NAME,
  EXEMPT_PREFIXES,
};
