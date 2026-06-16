// scripts/seed-demo-interactive.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  console.log('Starting interactive demo database seed...');

  const dbName = process.env.DB_NAME || 'nu_pmc';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  try {
    // 0. Recreate database cleanly
    console.log(`Recreating database ${dbName}...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
    await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);

    console.log('Loading schema.sql to initialize database structure...');
    const schemaPath = path.join(__dirname, '../schema.sql');
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');
    // Strip "IF NOT EXISTS" from CREATE INDEX statements for MySQL 8 compatibility
    schemaSql = schemaSql.replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX')
                         .replace(/ADD COLUMN IF NOT EXISTS/g, 'ADD COLUMN');
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query(schemaSql);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Database schema initialized successfully.');

    // 1. Load users & company entities from nu-pmc-seed-example.sql
    console.log('Loading users and company entities...');
    const seedExamplePath = path.join(__dirname, '../nu-pmc-seed-example.sql');
    let seedExampleSql = fs.readFileSync(seedExamplePath, 'utf8');
    // Replace column name mapping
    seedExampleSql = seedExampleSql.replace(/must_change_password/g, 'force_password_change');
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query(seedExampleSql);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Users and company entities seeded successfully.');

    // 2. Load projects, drawings, versions, RFIs, material requests, and vendors from tests/seed.sql
    console.log('Loading projects, drawings, versions, RFIs, and material requests...');
    const testsSeedPath = path.join(__dirname, '../tests/seed.sql');
    let testsSeedSql = fs.readFileSync(testsSeedPath, 'utf8');
    // Strip stale tables truncate statements
    testsSeedSql = testsSeedSql
      .replace(/TRUNCATE TABLE site_visit_photos;/gi, '')
      .replace(/TRUNCATE TABLE site_visit_observations;/gi, '')
      .replace(/TRUNCATE TABLE site_visits;/gi, '')
      .replace(/TRUNCATE TABLE approval_requests;/gi, '')
      .replace(/TRUNCATE TABLE drawing_queries;/gi, '')
      .replace(/-- ── APPROVAL REQUESTS[\s\S]*?pending'\);/g, '')
      .replace(/-- ── DRAWING QUERIES[\s\S]*?closed', 0\);/g, '');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query(testsSeedSql);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Projects, drawings, versions, RFIs, and material requests seeded successfully.');

    // 3. Ensure dev-seed user is present (user1 / Start@123)
    console.log('Ensuring dev user user1 is present...');
    const devSeedPath = path.join(__dirname, '../dev-seed.sql');
    const devSeedSql = fs.readFileSync(devSeedPath, 'utf8');
    await connection.query(devSeedSql);
    console.log('✓ Dev user user1 registered successfully.');

    console.log('\n========================================================================');
    console.log('Demo database seeded successfully!');
    console.log('You can now log in and test visibility across different roles:');
    console.log('  - Principal Admin:       username: admin1       | password: Welcome@123');
    console.log('  - PMC Head:              username: pmc_head1    | password: Welcome@123');
    console.log('  - Design Head:           username: design_head1 | password: Welcome@123');
    console.log('  - Team Lead:             username: team_lead1   | password: Welcome@123');
    console.log('  - Services Engineer:     username: services_eng1| password: Welcome@123');
    console.log('  - Site Manager:          username: site_mgr1    | password: Welcome@123');
    console.log('  - Dev Tester (Principal):username: user1        | password: Start@123');
    console.log('========================================================================');

  } catch (error) {
    console.error('Seed failed with error:', error);
  } finally {
    await connection.end();
  }
}

main();
