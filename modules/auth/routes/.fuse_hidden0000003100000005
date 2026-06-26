// modules/auth/routes/oidc.js
// ============================================================
// OIDC Provider HTTP endpoints.
//
// Mounted at app root (not under /api) so CSRF, session guards,
// and the trainee/audit read-only guards do NOT apply here.
// OIDC uses PKCE (RFC 7636) as its CSRF analogue; bearer tokens
// for userinfo/revoke.
//
// Endpoints:
//   GET  /.well-known/openid-configuration   — discovery document
//   GET  /oidc/jwks                          — JWK Set (public key)
//   GET  /oidc/authorize                     — show login form / auto-approve
//   POST /oidc/authorize                     — credential submission
//   POST /oidc/token                         — code → tokens (Synapse calls this)
//   GET  /oidc/userinfo                      — bearer token → profile
//   POST /oidc/userinfo                      — same, POST variant
//   POST /oidc/revoke                        — RFC 7009 token revocation
// ============================================================

'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db      = require('../../../middleware/db');
const oidc    = require('../../../services/oidc-provider');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit   = require('../../../services/audit');

const router = express.Router();

// ── Rate limiters ─────────────────────────────────────────────────────────
// Token endpoint — 100 req/15min (Synapse exchanges codes server-to-server)
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', error_description: 'Too many token requests. Try again shortly.' },
  skip: () => process.env.DISABLE_API_RATE_LIMIT === '1',
});

// Authorize POST endpoint — credential submission, strict brute-force limit.
// 10 login attempts per 15 minutes per IP. Mounted outside /api so the
// global API rate limit doesn't cover it — this explicit limiter is required.
const authorizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,   // don't count successful logins against the limit
  message: { error: 'too_many_requests', error_description: 'Too many login attempts. Try again in 15 minutes.' },
  skip: () => process.env.DISABLE_LOGIN_RATE_LIMIT === '1',
});

// ── Discovery document ────────────────────────────────────────────────────
router.get('/.well-known/openid-configuration', (req, res) => {
  const iss = oidc._issuer();
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    issuer:                                iss,
    authorization_endpoint:                `${iss}/oidc/authorize`,
    token_endpoint:                        `${iss}/oidc/token`,
    userinfo_endpoint:                     `${iss}/oidc/userinfo`,
    jwks_uri:                              `${iss}/oidc/jwks`,
    revocation_endpoint:                   `${iss}/oidc/revoke`,
    response_types_supported:              ['code'],
    grant_types_supported:                 ['authorization_code'],
    subject_types_supported:               ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported:                      ['openid', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    code_challenge_methods_supported:      ['S256'],
    claims_supported:                      ['sub', 'iss', 'aud', 'iat', 'exp', 'name', 'preferred_username'],
  });
});

// ── JWKS ──────────────────────────────────────────────────────────────────
router.get('/oidc/jwks', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(oidc.getJwks());
});

// ── Login page HTML (self-contained, no SPA dependency) ───────────────────
function renderLoginPage({ error, clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod, nonce, responseType }) {
  const esc = v => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in — nu Associates PMC</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
      padding: 40px 36px;
      width: 100%;
      max-width: 400px;
    }
    .logo {
      text-align: center;
      margin-bottom: 28px;
    }
    .logo-circle {
      width: 56px; height: 56px;
      background: #1a56db;
      border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      color: #fff; font-size: 22px; font-weight: 700;
      margin-bottom: 10px;
    }
    h1 { font-size: 20px; font-weight: 700; color: #111827; text-align: center; margin-bottom: 4px; }
    .sub { font-size: 13px; color: #6b7280; text-align: center; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
    input[type=text], input[type=password] {
      width: 100%; padding: 10px 12px;
      border: 1.5px solid #d1d5db;
      border-radius: 8px; font-size: 14px;
      outline: none; transition: border .15s;
      margin-bottom: 16px;
    }
    input:focus { border-color: #1a56db; }
    .error-box {
      background: #fef2f2; border: 1px solid #fca5a5;
      color: #b91c1c; border-radius: 8px;
      padding: 10px 14px; font-size: 13px; margin-bottom: 16px;
    }
    button[type=submit] {
      width: 100%; padding: 11px;
      background: #1a56db; color: #fff;
      border: none; border-radius: 8px; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: background .15s;
    }
    button:hover { background: #1e40af; }
    .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 20px; }
    .badge {
      display: inline-block; background: #eff6ff; color: #1e40af;
      border: 1px solid #bfdbfe; border-radius: 6px;
      font-size: 11px; padding: 2px 8px; margin-bottom: 6px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-circle">nu</div>
      <h1>nu Associates PMC</h1>
      <p class="sub">Sign in to continue to Element X</p>
      <span class="badge">Single Sign-On</span>
    </div>
    ${error ? `<div class="error-box">${esc(error)}</div>` : ''}
    <form method="POST" action="/oidc/authorize">
      <input type="hidden" name="client_id"             value="${esc(clientId)}">
      <input type="hidden" name="redirect_uri"          value="${esc(redirectUri)}">
      <input type="hidden" name="state"                 value="${esc(state)}">
      <input type="hidden" name="scope"                 value="${esc(scope)}">
      <input type="hidden" name="code_challenge"        value="${esc(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${esc(codeChallengeMethod)}">
      <input type="hidden" name="nonce"                 value="${esc(nonce)}">
      <input type="hidden" name="response_type"         value="${esc(responseType)}">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" autocomplete="username"
             placeholder="your username" autocapitalize="none" required>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password"
             placeholder="••••••••" required>
      <button type="submit">Sign in</button>
    </form>
    <p class="footer">Use your nu PMC application username and password.<br>Not your personal email or WhatsApp.</p>
  </div>
</body>
</html>`;
}

// ── GET /oidc/authorize — show login form or auto-approve ─────────────────
router.get('/oidc/authorize', asyncHandler(async (req, res) => {
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    scope = 'openid profile',
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod = 'S256',
    state = '',
    nonce = '',
  } = req.query;

  // Validate required params
  if (!clientId || !redirectUri || responseType !== 'code') {
    return res.status(400).send(renderLoginPage({
      error: 'Missing or invalid authorization request parameters.',
      clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod, nonce, responseType,
    }));
  }

  // PKCE is required for public clients (no client_secret in the authorize request).
  // This follows RFC 9700 best current practice. Synapse always sends code_challenge.
  if (!codeChallenge) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'code_challenge (PKCE S256) is required for authorization requests',
    });
  }
  if (codeChallengeMethod !== 'S256') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: `code_challenge_method '${codeChallengeMethod}' is not supported — use S256`,
    });
  }

  try {
    oidc.validateClient(clientId, null, redirectUri);
  } catch (err) {
    return res.status(400).json({ error: err.oidcCode || 'invalid_request', error_description: err.oidcDescription });
  }

  // If user already has an active PWA session, auto-approve (SSO!)
  if (req.session && req.session.user) {
    const user = req.session.user;
    // Re-verify user is still active
    const [[dbUser]] = await db.query(
      'SELECT id, username, full_name, role, is_active FROM users WHERE id = ? LIMIT 1',
      [user.id]
    );
    if (dbUser && dbUser.is_active) {
      const code = await oidc.createAuthCode({
        userId:              dbUser.id,
        clientId,
        redirectUri,
        scope,
        codeChallenge:       codeChallenge || null,
        codeChallengeMethod: codeChallenge ? codeChallengeMethod : null,
        nonce:               nonce || null,
      });
      const params = new URLSearchParams({ code, state }).toString();
      return res.redirect(`${redirectUri}?${params}`);
    }
  }

  // No session — render login form
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(renderLoginPage({ clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod, nonce, responseType }));
}));

// ── POST /oidc/authorize — credential submission ──────────────────────────
router.post('/oidc/authorize', authorizeLimiter, asyncHandler(async (req, res) => {
  const {
    username = '',
    password = '',
    client_id: clientId,
    redirect_uri: redirectUri,
    state = '',
    scope = 'openid profile',
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod = 'S256',
    nonce = '',
    response_type: responseType,
  } = req.body;

  const renderError = (error) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).send(renderLoginPage({
      error, clientId, redirectUri, state, scope,
      codeChallenge, codeChallengeMethod, nonce, responseType,
    }));
  };

  if (!clientId || !redirectUri) {
    return renderError('Missing required OIDC parameters. Please return to Element X and try again.');
  }

  try {
    oidc.validateClient(clientId, null, redirectUri);
  } catch (err) {
    return renderError(`Configuration error: ${err.oidcDescription}`);
  }

  if (!username.trim() || !password) {
    return renderError('Please enter your username and password.');
  }

  // Validate credentials
  const [[user]] = await db.query(
    'SELECT id, username, full_name, role, is_active, password_hash FROM users WHERE username = ? LIMIT 1',
    [username.toLowerCase().trim()]
  );

  let valid = false;
  if (user) {
    valid = await bcrypt.compare(password, user.password_hash);
  }

  if (!user || !valid || !user.is_active) {
    // Delay to prevent timing attacks
    if (!user || !valid) await new Promise(r => setTimeout(r, 300));
    audit.log({
      userId:     user?.id || null,
      action:     'oidc.login.failed',
      entityType: 'users',
      entityId:   user?.id || null,
      details:    { attempted_username: username.toLowerCase().trim(), reason: !user ? 'user_not_found' : !user.is_active ? 'inactive' : 'wrong_password' },
      req,
    });
    return renderError('Incorrect username or password. Please try again.');
  }

  // Issue auth code
  const code = await oidc.createAuthCode({
    userId:              user.id,
    clientId,
    redirectUri,
    scope,
    codeChallenge:       codeChallenge || null,
    codeChallengeMethod: codeChallenge ? codeChallengeMethod : null,
    nonce:               nonce || null,
  });

  audit.log({
    userId:     user.id,
    action:     'oidc.login.success',
    entityType: 'users',
    entityId:   user.id,
    details:    { client_id: clientId, scope },
    req,
  });

  const params = new URLSearchParams({ code, state }).toString();
  res.redirect(`${redirectUri}?${params}`);
}));

// ── POST /oidc/token — code → access_token + id_token ────────────────────
router.post('/oidc/token', tokenLimiter, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  const {
    grant_type,
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  } = req.body;

  const oidcError = (errCode, desc, status = 400) => {
    return res.status(status).json({ error: errCode, error_description: desc });
  };

  if (grant_type !== 'authorization_code') {
    return oidcError('unsupported_grant_type', `Only authorization_code is supported; got: ${grant_type}`);
  }
  if (!code || !redirectUri || !clientId) {
    return oidcError('invalid_request', 'code, redirect_uri, and client_id are required');
  }

  try {
    oidc.validateClient(clientId, clientSecret, redirectUri);
  } catch (err) {
    return oidcError(err.oidcCode, err.oidcDescription, 401);
  }

  let exchanged;
  try {
    exchanged = await oidc.exchangeCode({ code, codeVerifier, clientId, redirectUri });
  } catch (err) {
    if (err instanceof oidc.OidcError) {
      return oidcError(err.oidcCode, err.oidcDescription);
    }
    throw err;
  }

  const tokens = await oidc.issueTokens({
    user:     exchanged.user,
    clientId,
    scope:    exchanged.scope,
    nonce:    exchanged.nonce,
  });

  res.json(tokens);
}));

// ── GET + POST /oidc/userinfo — bearer token → profile ───────────────────
async function userinfoHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Accept Bearer token from Authorization header or body
  const authHeader = req.headers.authorization || '';
  const bodyToken  = req.body && req.body.access_token;
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : bodyToken;

  if (!token) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="nu-pmc"');
    return res.status(401).json({ error: 'invalid_token', error_description: 'No bearer token provided' });
  }

  const row = await oidc.verifyAccessToken(token);
  if (!row) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="nu-pmc", error="invalid_token"');
    return res.status(401).json({ error: 'invalid_token', error_description: 'Token invalid, expired, or revoked' });
  }

  const domain = oidc._matrixDomain();

  res.json({
    sub:                `@${row.username}:${domain}`,
    name:               row.full_name,
    preferred_username: row.username,
    'nu_pmc:role':      row.role,
  });
}
router.get('/oidc/userinfo',  asyncHandler(userinfoHandler));
router.post('/oidc/userinfo', asyncHandler(userinfoHandler));

// ── POST /oidc/revoke — RFC 7009 token revocation ─────────────────────────
router.post('/oidc/revoke', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const { token, client_id: clientId, client_secret: clientSecret } = req.body;

  if (!token || !clientId) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'token and client_id required' });
  }

  try {
    oidc.validateClient(clientId, clientSecret, null);
  } catch (err) {
    return res.status(401).json({ error: err.oidcCode, error_description: err.oidcDescription });
  }

  await oidc.revokeToken(token);
  // RFC 7009: always return 200 (even if token was already revoked or not found)
  res.json({ success: true });
}));

module.exports = router;
