// middleware/trainee-guard.js
// Trainees are read-only. Block all write operations and sensitive reads.
// Mounted at /api in server.js, so req.path comes in WITHOUT the /api prefix.
// Paths here are therefore '/payments' not '/api/payments'.
const TRAINEE_BLOCKED = [
  // Financial
  '/payments', '/payment-requests', '/invoices', '/finance',
  '/clients', '/vendors/fee-schedule',
  // Approvals and governance
  '/changes', '/approvals', '/claims',
  '/meetings/action-items', '/user-management',
  // Write operations on core data
  '/drawings/version',
  '/schedule/upload', '/schedule/update',
  '/measurements',
  '/handover/events', '/handover/closure',
  '/lessons/generate', '/lessons/publish',
  // (V5: /ncr folded into /issues — no separate block needed since /issues
  //  is in the allowlist for trainees to RAISE issues. Quality NCRs raised
  //  via grn workflow are auto-system-generated, not trainee-driven.)
  // (V5: /moms moved to /meetings — actions still blocked under /meetings/action-items.)
];

function traineeGuard(req, res, next) {
  const user = req.session?.user;
  if (!user || user.role !== 'trainee') return next();

  // Block all non-GET requests for trainees
  if (req.method !== 'GET') {
    // Allow: daily report submission, photo upload, site visit observations
    // Trainees can write only to specific sub-paths. Use full prefixes so
    // we don't accidentally allow MOM creation or approval (those live
    // under /meetings but are not for trainees).
    const allowedPrefixes = [
      '/reports',                        // daily report submission
      '/photos',                         // photo upload
      '/issues',                         // raise issues, drawing queries (queries folded in v2), snags (folded in v5.9)
      '/auth',                           // password change, logout
      '/lessons',                        // write own lessons-learned input (post-project reflection)
    ];
    // Site visit endpoints — trainees can record site visits + observations,
    // but NOT create MOMs or approve. Match exact suffixes within /meetings.
    const allowedExact = [
      // POST /meetings/:project_id/site-visit
      // POST /meetings/:meeting_id/observation
    ];
    const isPrefixAllowed = allowedPrefixes.some(p => req.path.startsWith(p));
    const isMeetingsSiteVisit = /^\/meetings\/\d+\/site-visit$/.test(req.path);
    const isMeetingsObservation = /^\/meetings\/\d+\/observation$/.test(req.path);
    const isAllowed = isPrefixAllowed || isMeetingsSiteVisit || isMeetingsObservation;
    if (!isAllowed) {
      return res.status(403).json({
        error: 'Trainees are read-only on this function. Ask your team head.',
      });
    }
  }

  // Block sensitive reads regardless of method
  const isBlocked = TRAINEE_BLOCKED.some(p => req.path.startsWith(p));
  if (isBlocked) {
    return res.status(403).json({
      error: 'Trainees do not have access to this section.',
    });
  }

  next();
}

module.exports = { traineeGuard };
