// ============================================================
// nu associates — Site PMC Application
// server.js — Main Express Server
// ============================================================

require('dotenv').config();

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

const express      = require('express');
const session      = require('express-session');
const MySQLStore   = require('express-mysql-session')(session);
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
// No cron library — pure Node.js interval scheduler
require('./middleware/db'); // initialise connection pool on startup

const app  = express();

// Ensure upload directories exist on startup
const fs   = require('fs');
const pth  = require('path');
['uploads','uploads/photos','uploads/documents','uploads/boq','uploads/drawings'].forEach(dir => {
  const fp = pth.join(__dirname, dir);
  if (!fs.existsSync(fp)) fs.mkdirSync(fp, { recursive: true });
});
const PORT = process.env.PORT || 3000;

// ── SECURITY
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'"],   // inline scripts + Alpine.js expression engine
      // Helmet defaults script-src-attr to 'none' which blocks ALL inline
      // onclick handlers. The app uses onclick extensively in rendered HTML —
      // migrating to addEventListener is a large refactor. For now, allow
      // inline event handlers (same risk profile as 'unsafe-inline' scriptSrc,
      // which is already permitted). Note: this is not a production posture;
      // plan is to migrate handlers to delegated listeners post-launch.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc:     ["'self'", 'data:', 'blob:',
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
      fontSrc:    ["'self'", 'https://fonts.gstatic.com', 'data:'],
      objectSrc:  ["'none'"],
      // frame-src stays 'none' — we do NOT embed Element widgets in
      // Iteration 1. If/when we do, add Element's hosted URL here.
      frameSrc:   ["'none'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
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
// in quick succession. NEVER set this env var outside test/CI environments.
if (process.env.DISABLE_LOGIN_RATE_LIMIT !== '1') {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,      // Don't count successful logins
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

// ── SESSION SECRET — refuse to boot without one in any non-development env.
// NODE_ENV values like 'staging', 'production', 'test-live' all require a real secret.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  if (process.env.NODE_ENV !== 'development') {
    console.error('✗ FATAL: SESSION_SECRET must be set (min 32 chars) outside NODE_ENV=development.');
    console.error('   Generate with:  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
  }
  console.warn('⚠ SESSION_SECRET not set — using dev fallback. NEVER deploy without setting this.');
}

// ── SESSION STORE — MySQL-backed (survives restart, supports multi-process)
// Uses the existing DB_* env vars; creates a `sessions` table on first boot.
// NOTE: express-mysql-session's built-in pool-creator only accepts
// host/port/user/password/database — it strips socketPath. To support
// Unix-socket deployments we build the mysql2 pool ourselves and pass it
// as the second constructor arg, which bypasses MySQLStore.createPool.
const mysql2 = require('mysql2/promise');
const sessionPoolConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'nu_app',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME     || 'nu_pmc',
};
if (process.env.DB_SOCKET) {
  sessionPoolConfig.socketPath = process.env.DB_SOCKET;
}
const sessionPool = mysql2.createPool(sessionPoolConfig);
const sessionStore = new MySQLStore({
  clearExpired:            true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration:              24 * 60 * 60 * 1000,
}, sessionPool);

app.use(session({
  store:  sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-only-change-in-production-do-not-use',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,                               // XSS protection — JS cannot read cookie
    sameSite: 'strict',                           // CSRF protection
    maxAge:   8 * 60 * 60 * 1000                  // 8 hours — security over convenience
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
          id:        row.id,
          username:  row.username,
          full_name: row.full_name,
          role:      row.role,
          stream:    row.stream,
          must_change_password: false,
          projects:  projRows,
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
const OUTBOX_DIR = path.join(process.env.UPLOAD_DIR || '/tmp', 'outbox');
require('fs').mkdirSync(OUTBOX_DIR, { recursive: true });
app.use('/outbox', express.static(OUTBOX_DIR, {
  // Files expire after 7 days; Twilio fetches within seconds
  maxAge: '7d',
  // Content-Disposition ensures WhatsApp treats as download
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));
// Uploads served via /api/files/:filename — authenticated route only (not static)

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
app.get('/api/uploads/template/:type', (req, res) => {
  const path2 = require('path');
  const templates = {
    users:       'nu_PMC_BulkUpload_Templates_v1.xlsx',
    vendors:     'nu_PMC_BulkUpload_Templates_v1.xlsx',
    clients:     'nu_PMC_BulkUpload_Templates_v1.xlsx',
    engagements: 'nu_PMC_BulkUpload_Templates_v1.xlsx',
    fee:         'nu_PMC_BulkUpload_Templates_v1.xlsx',
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
    const mem    = process.memoryUsage();
    res.json({
      status:   'ok',
      version:  '1.0',
      uptime:   Math.floor(uptime) + 's',
      db:       'connected',
      memory:   Math.round(mem.rss / 1048576) + 'MB',
      latency:  (Date.now() - start) + 'ms',
      ts:       new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ── API ROUTES
app.use('/api/auth',      require('./modules/auth/routes/auth'));
app.use('/api/nav',       require('./modules/system/routes/nav'));
app.use('/api/nav-admin', require('./modules/system/routes/nav-admin'));
app.use('/api/needs-you', require('./modules/reporting/routes/needs-you'));
app.use('/api/needs-you', require('./modules/reporting/routes/acc-summary'));
app.use('/api/pending',   require('./modules/reporting/routes/pending'));
app.use('/api/project-slas', require('./modules/system/routes/project-slas'));
app.use('/api/daily-reports', require('./modules/site/routes/daily-reports'));
app.use('/api/projects',  require('./modules/onboarding/routes/projects'));
app.use('/api/schedule',  require('./modules/design-services/routes/schedule'));
app.use('/api/drawings',  require('./modules/design-services/routes/drawings'));
app.use('/api/register',  require('./modules/design-services/routes/register'));
app.use('/api/photo-tags',      require('./modules/site/routes/photo-tags'));
app.use('/api/delegations',     require('./modules/system/routes/delegations'));
app.use('/api/weekly-signoff',  require('./modules/reporting/routes/weekly-signoff'));
app.use('/api/materials', require('./modules/design-services/routes/materials'));
app.use('/api/approvals', require('./modules/workflow/routes/approvals'));
app.use('/api/changes',   require('./modules/workflow/routes/changes'));
app.use('/api/reports',   require('./modules/reporting/routes/reports'));
app.use('/api/photos',    require('./modules/site/routes/photos'));
app.use('/api/documents', require('./modules/onboarding/routes/documents'));   // V5 Fix 3 — document library
app.use('/api/meetings',   require('./modules/workflow/routes/meetings'));
app.use('/api/whatsapp',  require('./modules/system/routes/whatsapp').router);
app.use('/api/vendors',   require('./modules/onboarding/routes/vendors'));
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
app.use('/vendor-onboard', require('./modules/onboarding/routes/vendor-public'));
app.use('/api/notifications', require('./modules/system/routes/notifications'));
app.use('/api/client-boq',    require('./modules/onboarding/routes/client-boq'));
app.use('/api/clients',       require('./modules/onboarding/routes/clients'));
app.use('/api/weekly-health', require('./modules/reporting/routes/weekly-health'));
// Legacy /api/snags removed in v5.9 — snag tracking unified in /api/issues
// with issue_type='snag'. See migrations/v5.9-collapse-legacy-snags.sql.
app.use('/api/comms',        require('./modules/system/routes/comms'));
app.use('/api/measurements',  require('./modules/workflow/routes/measurements'));
app.use('/api/claims',        require('./modules/finance/routes/claims'));
app.use('/api/gantt',         require('./modules/reporting/routes/gantt'));
app.use('/api/users',     require('./modules/auth/routes/users'));
app.use('/api/invoices',          require('./modules/finance/routes/invoices'));
app.use('/api/project-setup',     require('./modules/onboarding/routes/project-setup'));
app.use('/api/finance',           require('./modules/finance/routes/finance'));
app.use('/api/user-management',   require('./modules/auth/routes/user-management'));
app.use('/api/admin-reset',       require('./modules/auth/routes/admin-reset'));
app.use('/api/lookup',            require('./modules/system/routes/lookup'));
app.use('/api/ai',                require('./modules/system/routes/ai-triggers'));
app.use('/api/payment-requests',  require('./modules/finance/routes/payment-requests'));
app.use('/api/payments',   require('./modules/finance/routes/payments'));
app.use('/api/pi-generator',         require('./modules/finance/routes/pi-generator'));
app.use('/api/dashboard',      require('./modules/reporting/routes/dashboard'));
app.use('/api/issues',         require('./modules/site/routes/issues'));
app.use('/api/submittals',     require('./modules/workflow/routes/submittals'));
app.use('/api/forms',          require('./modules/site/routes/forms'));
app.use('/api/labour',         require('./modules/site/routes/labour'));
app.use('/api/grn',            require('./modules/site/routes/grn'));
app.use('/api/budget',           require('./modules/finance/routes/budget'));
app.use('/api/boq-mapping',      require('./modules/finance/routes/boq-mapping'));
app.use('/api/gst-statement',    require('./modules/finance/routes/gst-statement'));
app.use('/api/urgent-payments',  require('./modules/finance/routes/urgent-payments'));
app.use('/api/pmc-assignments',  require('./modules/system/routes/pmc-assignments'));
app.use('/api/governance',       require('./modules/system/routes/governance'));
app.use('/api/handover',         require('./modules/site/routes/handover'));
app.use('/api/lessons',          require('./modules/reporting/routes/lessons'));

// Client-side error reporting — see modules/system/routes/client-errors.js.
// POST /api/log/client-error captures any non-2xx response from the API
// wrapper. GET/PATCH on /api/client-errors are Principal-only triage tools.
const clientErrorRoutes = require('./modules/system/routes/client-errors');
app.use('/api/log/client-error', clientErrorRoutes);
app.use('/api/client-errors',    clientErrorRoutes.readRouter);

// ── PWA — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── AUTHENTICATED FILE SERVING
app.get('/api/files/:subdir/:filename', require('./middleware/auth').requireAuth, (req, res) => {
  const path2 = require('path');
  const fs2   = require('fs');
  const safeSub  = (req.params.subdir  || '').replace(/[^a-z0-9-]/gi, '');
  const safeFile = (req.params.filename|| '').replace(/[^a-z0-9._-]/gi, '');
  if (!safeSub || !safeFile) return res.status(400).json({ error: 'Invalid path' });
  const uploadRoot = path2.resolve(process.env.UPLOAD_DIR || path2.join(__dirname, 'uploads'));
  const filePath   = path2.resolve(path2.join(uploadRoot, safeSub, safeFile));
  if (!filePath.startsWith(uploadRoot)) return res.status(403).json({ error: 'Forbidden' });
  if (!fs2.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
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
app.listen(PORT, () => {
  console.log(`nu PMC server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
}

module.exports = app;
