// middleware/error-handler.js — unified error handling

/**
 * Async route wrapper — catches errors and forwards to error handler.
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Error response envelope — single format for all errors
 * { error: string, code: string, details?: object }
 */
function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  const status = err.status || err.statusCode || 500;
  const code   = err.code   || (status === 400 ? 'BAD_REQUEST' :
                                status === 401 ? 'UNAUTHORIZED' :
                                status === 403 ? 'FORBIDDEN' :
                                status === 404 ? 'NOT_FOUND' :
                                'SERVER_ERROR');

  // Log server errors but don't leak internals to client
  if (status >= 500) {
    console.error('[Error]', req.method, req.path, '-', err.message);
    if (err.stack && process.env.NODE_ENV !== 'production') console.error(err.stack);
  }

  res.status(status).json({
    error:  status >= 500 ? 'Internal server error' : err.message,
    code,
    ...(err.details && { details: err.details }),
    ...(process.env.NODE_ENV !== 'production' && status >= 500 && { stack: err.stack?.split('\n').slice(0,5) }),
  });
}

/**
 * Throw a structured error from anywhere in route code
 */
class AppError extends Error {
  constructor(message, status = 400, code = null, details = null) {
    super(message);
    this.status  = status;
    this.code    = code;
    this.details = details;
  }
}

module.exports = { asyncHandler, errorHandler, AppError };
