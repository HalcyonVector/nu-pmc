// middleware/asyncHandler.js
// ============================================================
// Wrap an async route handler. Any thrown/rejected error is:
//   1. Logged with req context (method, path, user, error)
//   2. Converted to a JSON 500 (or preserves err.status if set)
// Callers stop writing try/catch + res.status(500).json({...}) themselves.
//
// Usage:
//   router.post('/foo', requireAuth, asyncHandler(async (req, res) => {
//     const rows = await db.query(...);
//     res.json({ rows });
//   }));
//
// For known-user-error cases, throw an object with { status, message }:
//   if (!body.name) throw { status: 400, message: 'name required' };
// ============================================================

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
      const userId = req.session?.user?.id || '-';
      const msg    = err?.message || String(err);
      console.error(`[${req.method} ${req.originalUrl}] user=${userId} status=${status} err=${msg}`);
      if (err?.stack && status === 500) console.error(err.stack);

      if (res.headersSent) return;  // already responded mid-handler

      // Sanitize 5xx error bodies — don't leak SQL errors, stack traces, or
      // internal state to the client. err.userMessage is opt-in for handlers
      // that want to surface a specific message (e.g. business-rule validation
      // that happens to throw rather than return). 4xx are always safe to
      // pass through — they're caller-error messages by definition.
      let clientMessage;
      if (status >= 500) {
        clientMessage = err?.userMessage || 'Internal server error';
      } else {
        clientMessage = err?.userMessage || msg || 'Bad request';
      }
      const body = { error: clientMessage };
      if (err?.code) body.code = err.code;
      res.status(status).json(body);
    });
  };
}

module.exports = asyncHandler;
