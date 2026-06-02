// middleware/auth.js — canonical short-form import path for auth middleware.
//
// The real implementation lives at modules/auth/middleware/auth.js (which
// is where new code SHOULD live; auth concerns belong inside the auth
// module). This file is the short-form re-export that 64+ route files use
// because '../middleware/auth' is shorter than relativising into
// '../../modules/auth/middleware/auth' from each route file's depth.
//
// Reframed (Concept-Map Audit, May 2026): an earlier comment here said
// "delete this shim once all consumers have migrated." That migration
// would mean rewriting 64 route imports — high cost, zero benefit
// (the shim has no runtime overhead beyond a single require indirection
// which Node caches). The dual-path is healthy: short-form for
// consumers, long-form for the implementation it lives next to.
//
// If you're a route author: use require('../middleware/auth') here.
// If you're maintaining the auth module: edit modules/auth/middleware/auth.js.
module.exports = require('../modules/auth/middleware/auth');
