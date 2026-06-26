// scripts/setup-ai-toggles.js — Create ai_feature_toggles table + seed Phase 2 features
'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function run() {
  const conn = {
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'nu_pmc',
    user:     process.env.DB_USER     || 'nu_app',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  };
  if (process.env.DB_PORT) conn.port = parseInt(process.env.DB_PORT, 10);
  const db = await mysql.createConnection(conn);

  await db.execute(`
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
    await db.execute(
      'INSERT IGNORE INTO ai_feature_toggles (feature_key, enabled, label, description) VALUES (?, 0, ?, ?)',
      [key, label, desc]
    );
  }

  console.log(`ai_feature_toggles: ${features.length} features seeded (all OFF by default)`);
  await db.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
