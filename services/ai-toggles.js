// services/ai-toggles.js — Phase 2 AI feature toggle checks
// Cached in memory, reloads every 60s or on explicit invalidation.
// Backend routes call isEnabled(key) before invoking AI. Returns false
// if feature is off OR if no API key is configured.
'use strict';

const db = require('../middleware/db');

let _cache = null;   // Map<feature_key, boolean>
let _cacheAt = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function createAndSeedTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_feature_toggles (
      feature_key VARCHAR(60) NOT NULL PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      label VARCHAR(120) NOT NULL,
      description VARCHAR(300) DEFAULT NULL,
      updated_by INT UNSIGNED DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  const features = [
    ['drawing_sanity_check',    'Auto Drawing Sanity Check',    'Drawing upload metadata validation'],
    ['detail_drawing_analysis', 'Auto Detail Drawing Analysis', 'Extracts trade/reference info from detail uploads'],
    ['rfi_response_check',      'Auto RFI Response Check',      'Checks if uploaded drawing answers the RFI'],
    ['revision_change_analysis','Auto Revision Change Analysis','Compares old vs new drawing, flags impacts'],
    ['photo_auto_tagging',      'Photo Auto-Tagging',           'Suggests task association for uploaded site photos'],
    ['hsn_code_suggestion',     'HSN Code Suggestion',          'Auto-suggests HSN code on BOQ item edit'],
    ['similar_query_search',    'Similar Query Search',         'Shows past matching queries while raising a new one'],
    ['material_approval_check', 'Material Approval Check',      'Flags BOQ items needing client material approval'],
    ['autofill_boq_hsn',        'Auto-fill BOQ HSN',            'Wires suggestHSN button in BOQ edit modal'],
    ['similar_query_dedup',     'Similar Query Dedup',          'Wires checkSimilarQueries button in Raise Query modal'],
  ];

  for (const [key, label, desc] of features) {
    await db.query(
      'INSERT IGNORE INTO ai_feature_toggles (feature_key, enabled, label, description) VALUES (?, 0, ?, ?)',
      [key, label, desc]
    );
  }
}

async function _load() {
  try {
    const [rows] = await db.query('SELECT feature_key, enabled FROM ai_feature_toggles');
    _cache = new Map(rows.map(r => [r.feature_key, r.enabled === 1]));
    _cacheAt = Date.now();
  } catch (e) {
    if (e.message.includes("doesn't exist")) {
      try {
        await createAndSeedTable();
        const [rows] = await db.query('SELECT feature_key, enabled FROM ai_feature_toggles');
        _cache = new Map(rows.map(r => [r.feature_key, r.enabled === 1]));
        _cacheAt = Date.now();
        return;
      } catch (err) {
        console.error('[ai-toggles] Failed to auto-create and seed table:', err.message);
      }
    }
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
  try {
    const [rows] = await db.query(
      'SELECT feature_key, enabled, label, description, updated_by, updated_at FROM ai_feature_toggles ORDER BY feature_key'
    );
    return rows;
  } catch (e) {
    const features = [
      ['drawing_sanity_check',    'Auto Drawing Sanity Check',    'Drawing upload metadata validation'],
      ['detail_drawing_analysis', 'Auto Detail Drawing Analysis', 'Extracts trade/reference info from detail uploads'],
      ['rfi_response_check',      'Auto RFI Response Check',      'Checks if uploaded drawing answers the RFI'],
      ['revision_change_analysis','Auto Revision Change Analysis','Compares old vs new drawing, flags impacts'],
      ['photo_auto_tagging',      'Photo Auto-Tagging',           'Suggests task association for uploaded site photos'],
      ['hsn_code_suggestion',     'HSN Code Suggestion',          'Auto-suggests HSN code on BOQ item edit'],
      ['similar_query_search',    'Similar Query Search',         'Shows past matching queries while raising a new one'],
      ['material_approval_check', 'Material Approval Check',      'Flags BOQ items needing client material approval'],
      ['autofill_boq_hsn',        'Auto-fill BOQ HSN',            'Wires suggestHSN button in BOQ edit modal'],
      ['similar_query_dedup',     'Similar Query Dedup',          'Wires checkSimilarQueries button in Raise Query modal'],
    ];
    return features.map(([key, label, desc]) => ({
      feature_key: key,
      enabled: 0,
      label,
      description: desc,
      updated_by: null,
      updated_at: null
    }));
  }
}

async function setEnabled(featureKey, enabled, userId) {
  if (enabled && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API Key not configured on the server. Please set ANTHROPIC_API_KEY in the environment before enabling AI features.');
  }
  try {
    await db.query(
      'UPDATE ai_feature_toggles SET enabled = ?, updated_by = ? WHERE feature_key = ?',
      [enabled ? 1 : 0, userId, featureKey]
    );
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE' || e.message.includes("doesn't exist")) {
      await createAndSeedTable();
      await db.query(
        'UPDATE ai_feature_toggles SET enabled = ?, updated_by = ? WHERE feature_key = ?',
        [enabled ? 1 : 0, userId, featureKey]
      );
    } else {
      throw e;
    }
  }
  invalidateCache();
}

module.exports = { isEnabled, getAll, setEnabled, invalidateCache };
