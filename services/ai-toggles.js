// services/ai-toggles.js — Phase 2 AI feature toggle checks
// Cached in memory, reloads every 60s or on explicit invalidation.
// Backend routes call isEnabled(key) before invoking AI. Returns false
// if feature is off OR if no API key is configured.
'use strict';

const db = require('../middleware/db');

let _cache = null;   // Map<feature_key, boolean>
let _cacheAt = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function _load() {
  try {
    const [rows] = await db.query('SELECT feature_key, enabled FROM ai_feature_toggles');
    _cache = new Map(rows.map(r => [r.feature_key, r.enabled === 1]));
    _cacheAt = Date.now();
  } catch (e) {
    // Table may not exist yet (fresh install before migration). Treat as all-off.
    _cache = new Map();
    _cacheAt = Date.now();
  }
}

async function isEnabled(featureKey) {
  if (!_cache || (Date.now() - _cacheAt) > CACHE_TTL) {
    await _load();
  }
  return _cache.get(featureKey) === true;
}

function invalidateCache() {
  _cache = null;
}

async function getAll() {
  if (!_cache || (Date.now() - _cacheAt) > CACHE_TTL) {
    await _load();
  }
  const [rows] = await db.query(
    'SELECT feature_key, enabled, label, description, updated_by, updated_at FROM ai_feature_toggles ORDER BY feature_key'
  );
  return rows;
}

async function setEnabled(featureKey, enabled, userId) {
  await db.query(
    'UPDATE ai_feature_toggles SET enabled = ?, updated_by = ? WHERE feature_key = ?',
    [enabled ? 1 : 0, userId, featureKey]
  );
  invalidateCache();
}

module.exports = { isEnabled, getAll, setEnabled, invalidateCache };
