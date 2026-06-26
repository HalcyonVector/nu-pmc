// ============================================================
// nu associates — Site PMC Application
// server.js — Main Express Server
// ============================================================

require('dotenv').config();

// File logger must be required immediately after dotenv so LOG_DIR is
// honoured and console.* is patched before anything else logs.
require('./services/logger');

// ── PROCESS-LEVEL ERROR HANDLERS — surface silent async failures.
// unhandledRejection: log and continue (do not crash — production stability).
// uncaughtException: log and exit (state is undefined; let the process manager restart).
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
// No cron library — pure Node.js interval scheduler
require('./middleware/db'); // initialise connection pool on startup

const app = express();

// Trust the nginx reverse proxy — required so req.ip reflects the real client
// IP (not 127.0.0.1) for rate limiting, and so req.protocol reflects https
// (not http) for Twilio webhook signature validation and secure cookie flags.
// Without this, every user shares the same rate-limit bucket and every Twilio
// webhook call returns 403 in production.
app.set('trust proxy', 1);

// Ensure upload directories exist on startup
const fs = require('fs');
const pth = require('path');
['uploads', 'uploads/photos', 'uploads/documents', 'uploads/boq', 'uploads/drawings', 'uploads/schedules', 'uploads/daily-reports', 'uploads/urgent-payments'].forEach(dir => {
  const fp = pth.join(__dirname, dir);
  if (!fs.existsSync(fp)) fs.mkdirSync(fp, { recursive: true });
});
const PORT = process.env.PORT || 3100;

// ── SECURITY
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],   // inline scripts + Alpine.js expression engine
      // Helmet defaults script-src-attr to 'none' which blocks ALL inline
      // onclick handlers. The app uses onclick extensively in rendered HTML —
      // migrating to addEventListener is a large refactor. For now, allow
      // inline event handlers (same risk profile as 'unsafe-inline' scriptSrc,
      // which is already permitted). Note: this is not a production posture;
      // plan is to migrate handlers to delegated listeners post-launch.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:',
        // Matrix media URIs are mxc:// — the PWA fetches them as https
        // through the homeserver's /_matrix/media/v3/... endpoint. Allow
        // the configured homeserver origin so server-rendered <img> tags
        // pointing at media still load. Empty string is fine (no-op) when
        // the homeserver isn't yet configured.
        ...(process.env.MATRIX_HOMESERVER ? [process.env.MATRIX_HOMESERVER] : [])],
      connectSrc: ["'self'",
        // Allow client-side fetch() to the Matrix homeserver — not used by
        // the bot path (server-side, exempt from CSP) but used by any future
        // client-side widget that needs to read room state, vote in polls, etc.
        ...(process.env.MATRIX_HOMESERVER ? [process.env.MATRIX_HOMESERVER] : [])],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      objectSrc: ["'none'"],
      // frame-src stays 'none' — we do NOT embed Element widgets in
      // Iteration 1. If/when we do, add Element's hosted URL here.
      frameSrc: ["'none'"],
      // Helmet adds `upgrade-insecure-requests` by default, which forces the
      // browser to rewrite http:// subresource URLs to https://. Disable it
      // when the app is served over plain HTTP (no TLS terminator in front),
      // otherwise the browser fails to load same-origin /css, /js, /icons.
      ...(process.env.FORCE_HTTPS === '1' ? {} : { upgradeInsecureRequests: null }),
    }
  },
  // HSTS is only meaningful over HTTPS. Disable when not behind TLS so we
  // don't poison browsers that visit the HTTP-only EC2 box during testing.
  hsts: process.env.FORCE_HTTPS === '1'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
}));

// CORS — restrict to own domain in production
// Normalize configured origins: lowercase + trim trailing slash.
// Exact-match required (no startsWith) to prevent subdomain bypass.
const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'])
  .map(o => o.trim().toLowerCase().replace(/\/+$/, ''))
  .filter(Boolean);
// CORS — inline middleware — no external dependency
// Spec: Access-Control-Allow-Origin cannot be '*' when Allow-Credentials is true.
// We only send CORS headers when a real origin is supplied AND it's whitelisted.
app.use((req, res, next) => {
  const rawOrigin = req.headers.origin;
  const origin = rawOrigin ? rawOrigin.toLowerCase().replace(/\/+$/, '') : '';
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', rawOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  // Same-origin requests (no Origin header) pass through without CORS headers
  next();
});

// ── RATE LIMITING
// General rate limit — 500 req/15min per IP.
// Can be disabled for automated test runs that hit many endpoints in quick
// succession. NEVER set this env var outside test/CI environments.
if (process.env.DISABLE_API_RATE_LIMIT !== '1') {
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
  app.use('/api/', limiter);
}

// Login-specific rate limit — 10 attempts/15min per IP (brute-force defence).
// Can be disabled for automated test runs that churn through many role logins
// in quick succession (DISABLE_LOGIN_RATE_LIMIT=1). NEVER set outside test/CI.
console.log(`Login rate limiter is ${process.env.DISABLE_LOGIN_RATE_LIMIT === '1' ? 'DISABLED' : 'ENABLED'}`);
if (process.env.DISABLE_LOGIN_RATE_LIMIT !== '1') {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,          // 15-minute window (matches error message)
    max: 10,                            // 10 attempts per 15 min per IP (was 50/min — too lax)
    skipSuccessfulRequests: true,       // don't count successful logins against the limit
    message: { error: 'Too many login attempts — try again in 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', loginLimiter);
}

// OTP send — strict rate limit to prevent abuse (someone spamming victim's WhatsApp)
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // 5 OTP requests per IP per hour
  message: { error: 'Too many OTP requests. Please try again in an hour.' },
  standardHeaders: true,
});
app.use('/api/auth/request-otp', otpLimiter);
app.use('/api/whatsapp/send-otp', otpLimiter);

// ── BODY PARSING
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ── SESSION SECRET — refuse to boot without one in ALL environments.
// A hardcoded fallback would allow session forgery if the app is accidentally
// deployed with NODE_ENV=development. No env value = no start.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('✗ FATAL: SESSION_SECRET must be set (min 32 chars).');
  console.error('   Generate with:  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

// ── SESSION STORE — MySQL-backed (survives restart, supports multi-process)
// Uses the existing DB_* env vars; creates a `sessions` table on first boot.
// NOTE: express-mysql-session's built-in pool-creator only accepts
// host/port/user/password/database — it strips socketPath. To support
// Unix-socket deployments we build the mysql2 pool ourselves and pass it
// as the second constructor arg, which bypasses MySQLStore.createPool.
const mysql2 = require('mysql2/promise');
const sessionPoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'nu_app',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'nu_pmc',
};
if (process.env.DB_SOCKET) {
  sessionPoolConfig.socketPath = process.env.DB_SOCKET;
}
const sessionPool = mysql2.createPool(sessionPoolConfig);
const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 24 * 60 * 60 * 1000,
}, sessionPool);

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,   // guaranteed non-empty by the startup check above
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Tie `secure` to FORCE_HTTPS=1 (same gate as HSTS) rather than NODE_ENV.
    // Previously NODE_ENV=production enabled secure cookies but FORCE_HTTPS could
    // be unset, meaning secure-only cookies were sent over cleartext HTTP.
    // Both HSTS and the secure cookie flag must be active together or not at all.
    secure: process.env.FORCE_HTTPS === '1',
    httpOnly: true,                               // XSS protection — JS cannot read cookie
    sameSite: 'strict',                           // CSRF protection
    maxAge: 8 * 60 * 60 * 1000                  // 8 hours — security over convenience
  }
}));

// ── TEST-HARNESS AUTH BYPASS ────────────────────────────────────────────────
// NODE_ENV=test only. Accepts X-Test-User-Id header and synthesises
// req.session.user from that user's DB row. Skips login + session store entirely.
// In any other NODE_ENV this middleware is not mounted. This exists so the
// runtime harness can test role gating without depending on the session store
// or auth flow working. Do NOT enable in production.
if (process.env.NODE_ENV === 'test') {
  const db = require('./middleware/db');
  app.use(async (req, res, next) => {
    const testUserId = req.headers['x-test-user-id'];
    if (!testUserId) return next();
    try {
      const [[row]] = await db.query(
        'SELECT id, username, full_name, role, stream FROM users WHERE id = ? AND is_active = 1',
        [testUserId]
      );
      if (row) {
        // Populate projects list — requireProjectScope reads me.projects to
        // decide if a project-scoped role is assigned. Without this, every
        // project-scoped role hits PROJECT_SCOPE_DENIED on every endpoint.
        const [projRows] = await db.query(
          'SELECT DISTINCT project_id AS id FROM project_assignments WHERE user_id = ? AND is_active = 1',
          [row.id]
        );
        req.session.user = {
          id: row.id,
          username: row.username,
          full_name: row.full_name,
          role: row.role,
          stream: row.stream,
          must_change_password: false,
          projects: projRows,
        };
      }
    } catch (e) {
      console.warn('[test-harness-auth]', e.message);
    }
    next();
  });
  console.log('[test-harness] X-Test-User-Id header auth bypass is ENABLED (NODE_ENV=test)');
}

// ── STATIC FILES
// Optimistic lock error handler — must be registered, applies to all routes below
const { errorHandler: olErrorHandler } = require('./middleware/optimistic-lock');

app.use(express.static(path.join(__dirname, 'public')));

// Serve outbox directory — WhatsApp media URLs point here
// Twilio fetches files from public URL when sending media messages
const OUTBOX_DIR = path.join(process.env.UPLOAD_DIR || require('os').tmpdir(), 'outbox');
require('fs').mkdirSync(OUTBOX_DIR, { recursive: true });
app.use('/outbox', express.static(OUTBOX_DIR, {
  // Files expire after 7 days; Twilio fetches within seconds
  maxAge: '7d',
  // Content-Disposition ensures WhatsApp treats as download
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));
// Uploads served via /api/files/:subdir/:filename — authenticated route only (not static)

// ── TRAINEE GUARD — read-only enforcement
const { traineeGuard } = require('./middleware/trainee-guard');
app.use('/api', traineeGuard);

// ── IT_ADMIN GUARD — IT support can read all, but cannot write to project data
const { itAdminReadonly } = require('./middleware/it-admin-readonly');
app.use('/api', itAdminReadonly);

// ── AUDIT GUARD — read-only test account enforcement (blocks non-GET for role=audit)
const { blockAuditWrites } = require('./middleware/auth');
app.use('/api', blockAuditWrites);

// ── MUST-CHANGE-PASSWORD GUARD — blocks API access until forced password
// change is done. Frontend already shows the modal; this catches API consumers
// (mobile app, scripts, curl) that bypass the web UI flow.
const { mustChangePasswordGuard } = require('./middleware/must-change-password');
app.use('/api', mustChangePasswordGuard);

// ── CSRF GUARD — synchronizer-token check on state-changing requests
// Mounted AFTER session + test-bypass + trainee-guard + audit-guard so all
// those layers can short-circuit before CSRF runs. Mounted BEFORE any route
// handler so every state-changing request is checked.
// Disable with CSRF_ENABLED=false (env var) for emergency rollback.
const { csrfMiddleware } = require('./middleware/csrf');
app.use('/api', csrfMiddleware);

// Closed-project write guard logic lives inside requireProjectScope() and
// requireScopeFromEntity() in modules/auth/middleware/auth.js — those are the
// only middlewares that know which project a request targets.

// ── TEMPLATE DOWNLOADS — bulk upload Excel templates
app.get('/api/uploads/template/:type', require('./middleware/auth').requireAuth, (req, res) => {
  const path2 = require('path');
  const templates = {
    users: 'nu_PMC_BulkUpload_Templates_v1.xlsx',
    vendors: 'nu_PMC_BulkUpload_Templates_v1.xlsx',
    clients: 'nu_PMC_BulkUpload_Templates_v1.xlsx',
    engagements: 'nu_PMC_BulkUpload_Templates_v1.xlsx',
    fee: 'nu_PMC_BulkUpload_Templates_v1.xlsx',
  };
  const file = templates[req.params.type];
  if (!file) return res.status(404).json({ error: 'Template not found' });
  // Template stored in public/templates/
  const tplPath = path2.join(__dirname, 'public', 'templates', file);
  res.download(tplPath, file, err => {
    if (err) res.status(404).json({ error: 'Template file not found on server' });
  });
});

// ── HEALTH CHECK
app.get('/api/health', async (req, res) => {
  const start = Date.now();
  try {
    const db = require('./middleware/db');
    await db.query('SELECT 1');
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      version: '1.0',
      uptime: Math.floor(uptime) + 's',
      db: 'connected',
      memory: Math.round(mem.rss / 1048576) + 'MB',
      latency: (Date.now() - start) + 'ms',
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ── CONTRACT-BASED API ROUTE MOUNTING (M1-M8 contracts)
const authContract = require('./modules/auth/contract');
const systemContract = require('./modules/system/contract');
const siteContract = require('./modules/site/contract');
const designServicesContract = require('./modules/design-services/contract');
const financeContract = require('./modules/finance/contract');
const workflowContract = require('./modules/workflow/contract');
const onboardingContract = require('./modules/onboarding/contract');
const reportingContract = require('./modules/reporting/contract');

app.use('/api/auth', authContract.routes.auth);
app.use('/api/nav', systemContract.routes.nav);
app.use('/api/nav-admin', systemContract.routes.navAdmin);
app.use('/api/needs-you', reportingContract.routes.needsYou);
app.use('/api/needs-you', reportingContract.routes.accSummary);
app.use('/api/pending', reportingContract.routes.pending);
app.use('/api/project-slas', systemContract.routes.projectSlas);
app.use('/api/daily-reports', siteContract.routes.dailyReports);
app.use('/api/projects', onboardingContract.routes.projects);
app.use('/api/schedule-quick', designServicesContract.routes.scheduleQuick);
app.use('/api/schedule', designServicesContract.routes.schedule);
app.use('/api/drawings', designServicesContract.routes.drawings);
app.use('/api/register', designServicesContract.routes.register);
app.use('/api/photo-tags', siteContract.routes.photoTags);
app.use('/api/delegations', systemContract.routes.delegations);
app.use('/api/weekly-signoff', reportingContract.routes.weeklySignoff);
app.use('/api/materials', designServicesContract.routes.materials);
app.use('/api/rfi',      designServicesContract.routes.rfis);
app.use('/api/approvals', workflowContract.routes.approvals);
app.use('/api/changes', workflowContract.routes.changes);
app.use('/api/reports', reportingContract.routes.reports);
app.use('/api/photos', siteContract.routes.photos);
app.use('/api/documents', onboardingContract.routes.documents);
app.use('/api/meetings', workflowContract.routes.meetings);
app.use('/api/whatsapp', systemContract.routes.whatsapp);
app.use('/api/vendors', onboardingContract.routes.vendors);

// PUBLIC vendor onboarding routes — mounted OUTSIDE /api so they bypass
// CSRF, session auth, and the trainee/audit guards. Token-gated; see
// modules/onboarding/routes/vendor-public.js for the security model.
// /vendor-onboard public route — limit by IP since there's no session.
// 60 hits per 5 minutes per IP is generous for a real vendor (1-3 hits per
// flow: GET to view, POST to confirm/reject) but cuts off drive-by floods.
// WhatsApp/Slack preview crawlers are part of the budget.
if (process.env.DISABLE_API_RATE_LIMIT !== '1') {
  const vendorOnboardLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,  // 5 minutes
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/vendor-onboard', vendorOnboardLimiter);
}
app.use('/vendor-onboard', onboardingContract.routes.vendorPublic);
app.use('/api/notifications', systemContract.routes.notifications);
app.use('/api/client-boq', onboardingContract.routes.clientBOQ);
app.use('/api/clients', onboardingContract.routes.clients);
app.use('/api/weekly-health', reportingContract.routes.weeklyHealth);
// Legacy /api/snags removed in v5.9 — snag tracking unified in /api/issues
// with issue_type='snag'. See migrations/v5.9-collapse-legacy-snags.sql.
app.use('/api/comms', systemContract.routes.comms);
app.use('/api/measurements', workflowContract.routes.measurements);
app.use('/api/claims', financeContract.routes.claims);
app.use('/api/gantt', reportingContract.routes.gantt);
app.use('/api/users', authContract.routes.users);
app.use('/api/invoices', financeContract.routes.invoices);
app.use('/api/project-setup', onboardingContract.routes.projectSetup);
app.use('/api/finance', financeContract.routes.finance);
app.use('/api/user-management', authContract.routes.userManagement);
app.use('/api/admin-reset', authContract.routes.adminReset);
app.use('/api/lookup', systemContract.routes.lookup);
app.use('/api/ai', systemContract.routes.aiTriggers);
app.use('/api/sse', require('./modules/system/routes/sse'));
app.use('/api/ai-settings', require('./modules/system/routes/ai-settings'));
app.use('/api/payment-requests', financeContract.routes.paymentRequests);
app.use('/api/payments', financeContract.routes.payments);
app.use('/api/pi-generator', financeContract.routes.piGenerator);
app.use('/api/vendor-documents', financeContract.routes.vendorDocuments);
app.use('/api/dashboard', reportingContract.routes.dashboard);
app.use('/api/issues', siteContract.routes.issues);
app.use('/api/submittals', workflowContract.routes.submittals);
app.use('/api/forms', siteContract.routes.forms);
app.use('/api/labour-quick', siteContract.routes.labourQuick);
app.use('/api/labour', siteContract.routes.labour);
app.use('/api/grn', siteContract.routes.grn);
app.use('/api/budget', financeContract.routes.budget);
app.use('/api/boq-mapping', financeContract.routes.boqMapping);
app.use('/api/gst-statement', financeContract.routes.gstStatement);
app.use('/api/urgent-payments', financeContract.routes.urgentPayments);
app.use('/api/external-comms', financeContract.routes.externalComms);
app.use('/api/pmc-assignments', systemContract.routes.pmcAssignments);
app.use('/api/governance', systemContract.routes.governance);
app.use('/api/company-entities', systemContract.routes.companyEntities);
app.use('/api/handover', siteContract.routes.handover);
app.use('/api/lessons', reportingContract.routes.lessons);

// Client-side error reporting — see modules/system/routes/client-errors.js.
// POST /api/log/client-error captures any non-2xx response from the API
// wrapper. GET/PATCH on /api/client-errors are Principal-only triage tools.
app.use('/api/log/client-error', systemContract.routes.clientErrors);
app.use('/api/client-errors', systemContract.routes.clientErrorsRead);

// ── AUTHENTICATED FILE SERVING
app.get('/api/files/:subdir/:filename', require('./middleware/auth').requireAuth, (req, res) => {
  const path2 = require('path');
  const fs2 = require('fs');
  const safeSub = (req.params.subdir || '').replace(/[^a-z0-9-]/gi, '');
  const safeFile = (req.params.filename || '').replace(/[^a-z0-9._-]/gi, '');
  if (!safeSub || !safeFile) return res.status(400).json({ error: 'Invalid path' });
  const uploadRoot = path2.resolve(process.env.UPLOAD_DIR || path2.join(__dirname, 'uploads'));
  const filePath = path2.resolve(path2.join(uploadRoot, safeSub, safeFile));
  if (!filePath.startsWith(uploadRoot)) return res.status(403).json({ error: 'Forbidden' });
  if (!fs2.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// ── HEALTH CHECK — dedicated endpoint for Docker/load-balancer probes
//    and Uptime Kuma monitoring.
//
// Checks:
//   1. DB connectivity  — SELECT 1 against the pool
//   2. Matrix reachability — GET /health on the homeserver (if configured)
//      Uses a 3s timeout so the health check never hangs the probe.
//
// Response shape:
//   { status: 'ok' | 'degraded' | 'error', ts, checks: { db, matrix } }
//
// HTTP status:
//   200 — all checks pass (status='ok')
//   200 — Matrix unreachable but DB fine (status='degraded') — app still
//         serves requests; Uptime Kuma can alert on 'degraded' if desired
//   503 — DB unreachable — app cannot serve (status='error')
//
// Deliberately unauthenticated.
app.get('/health', async (req, res) => {
  const checks = { db: 'ok', matrix: 'not_configured' };
  let dbOk = false;

  // 1. DB check
  try {
    const db = require('./middleware/db');
    await db.query('SELECT 1');
    dbOk = true;
    checks.db = 'ok';
  } catch (err) {
    console.error('[health] DB check failed:', err.message);
    checks.db = 'error';
    return res.status(503).json({ status: 'error', reason: 'db_unreachable', ts: new Date().toISOString(), checks });
  }

  // 2. Matrix check (best-effort, non-fatal for overall health)
  const homeserver = process.env.MATRIX_HOMESERVER;
  if (homeserver && process.env.MATRIX_DISABLED !== '1') {
    try {
      const http = require('./services/http');
      await http.get(`${homeserver}/_matrix/client/versions`, { timeout: 3000 });
      checks.matrix = 'ok';
    } catch (err) {
      console.warn('[health] Matrix check failed:', err.message);
      checks.matrix = 'unreachable';
    }
  }

  const degraded = checks.matrix === 'unreachable';
  res.json({
    status: degraded ? 'degraded' : 'ok',
    ts:     new Date().toISOString(),
    checks,
  });
});

// ── STARTUP CHECKS — catch obvious misconfigurations before they become incidents
if (process.env.NODE_ENV !== 'development' && process.env.OIDC_CLIENT_ID) {
  // Only enforce when OIDC is actually enabled (OIDC_CLIENT_ID configured).
  // Otherwise a non-OIDC deploy with no secret set would fatal-exit on boot.
  const placeholderOidcSecret = 'change-this-to-a-strong-secret';
  if (!process.env.OIDC_CLIENT_SECRET || process.env.OIDC_CLIENT_SECRET === placeholderOidcSecret) {
    console.error('✗ FATAL: OIDC is enabled (OIDC_CLIENT_ID is set) but OIDC_CLIENT_SECRET is ' +
      'missing or still the placeholder. Set a strong unique secret in .env before deploying.');
    process.exit(1);
  }
}

// ── OIDC PROVIDER — mounted outside /api so CSRF + session guards don't apply.
// PKCE (RFC 7636) is the OIDC equivalent of CSRF protection.
// Endpoints: /.well-known/openid-configuration, /oidc/jwks,
//            /oidc/authorize (GET+POST), /oidc/token, /oidc/userinfo, /oidc/revoke
// Only active when OIDC_CLIENT_ID is set; routes always load but return
// config errors when OIDC_CLIENT_ID is absent — makes misconfiguration visible.
app.use(require('./modules/auth/routes/oidc'));

// ── PWA — serve index.html for all non-API routes
// Note: /uploads/ is intentionally NOT served statically — all uploaded
// content is accessible only via the authenticated /api/files/:subdir/:filename
// route above. There is no express.static() call for the uploads directory.
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── SCHEDULED TASKS — native Node.js, no cron library
const overdueCheck = require('./scripts/overdue-checker');
const matrixOutboxDrain = require('./scripts/matrix-outbox-drain');

function scheduleTask(fn, intervalMs, label) {
  // Run once at startup after 30s, then on interval
  setTimeout(() => {
    fn().catch(e => console.error('[Scheduler]', label, e.message));
    setInterval(() => fn().catch(e => console.error('[Scheduler]', label, e.message)), intervalMs);
  }, 30000);
}

// Check overdue items every 15 minutes
scheduleTask(() => overdueCheck.run(), 15 * 60 * 1000, 'overdue-checker');

// Drain Matrix outbox every 2 minutes — short interval so failed transient
// sends recover quickly; the worker no-ops when matrix-adapter isn't LIVE,
// so it costs nothing in DRY_RUN environments.
scheduleTask(() => matrixOutboxDrain.run(), 2 * 60 * 1000, 'matrix-outbox-drain');

// Matrix poll reader — scan rooms for new votes and expire overdue polls.
// Runs every 60 seconds (same cadence as the standalone cron script).
// The standalone scripts/matrix-poll-reader.js can also be set up as an
// external cron for redundancy; having both is safe — processVotesForRoom
// advances a per-room cursor (matrix_reader_cursor), so concurrent runs
// just skip already-seen events rather than double-dispatching.
const matrixReplyActions = require('./services/matrix-reply-actions');
const db = require('./middleware/db');
scheduleTask(async () => {
  await matrixReplyActions.expireOverdue(db);
  await matrixReplyActions.processVotes(db);
}, 60 * 1000, 'matrix-poll-reader');

// Expire overdue approvals every 15 minutes. Cheap UPDATE; only touches
// rows whose expires_at has passed and that are still 'pending'.
const approvalsService = require('./services/approvals');
scheduleTask(() => approvalsService.expireOverdue(), 15 * 60 * 1000, 'approvals-expire-overdue');

// Expire vendor onboarding tokens past their 48h window every 30 minutes.
// Cheap UPDATE on a tiny table — keeps status/expires_at in sync so dashboards
// don't over-count active tokens. consume() also validates expiry inline,
// so security is correct even if this scheduler doesn't run.
const vendorOnboarding = require('./services/vendor-onboarding');
scheduleTask(() => vendorOnboarding.expireOldTokens(), 30 * 60 * 1000, 'vendor-onboarding-token-expiry');

// ── START
// Optimistic lock: 409 for stale versions — must be BEFORE generic handler
app.use(olErrorHandler);
// Global error handler — MUST be last middleware
app.use(require('./middleware/error-handler').errorHandler);

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`nu PMC server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown on SIGTERM (PM2 sends this before SIGKILL).
  process.on('SIGTERM', () => {
    console.log('[SIGTERM] Graceful shutdown initiated');
    server.close(() => {
      console.log('[SIGTERM] All connections closed — exiting.');
      process.exit(0);
    });
  });
}

module.exports = app;
