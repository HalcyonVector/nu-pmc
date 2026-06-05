// scratch/run-migration.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../middleware/db');

async function run() {
  const sqlPath = path.join(__dirname, '../patch-schema-wa-pending-actions-simplification.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  // Strip comments
  const cleanSql = sql
    .split('\n')
    .map(line => line.trim().startsWith('--') ? '' : line)
    .join('\n');

  // Split sql statements by semicolon, filtering out empty queries
  const queries = cleanSql
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0);

  console.log(`Executing ${queries.length} migration queries...`);
  
  for (const query of queries) {
    console.log(`Running: ${query}`);
    try {
      await db.query(query);
      console.log('✓ Success');
    } catch (err) {
      console.error(`✗ Error: ${err.message}`);
      process.exit(1);
    }
  }
  
  console.log('✓ All migration queries executed successfully.');
  process.exit(0);
}

run();
