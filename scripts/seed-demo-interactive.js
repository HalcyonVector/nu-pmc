// scripts/seed-demo-interactive.js
// SAFETY GUARD — this script drops and recreates the entire database.
// It must never run on the production server.
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: seed-demo-interactive.js is a development-only script.');
  console.error('NODE_ENV is "production" — refusing to run. Exiting.');
  process.exit(1);
}

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

    console.log('Loading pmc_initial_schema_with_data.sql to initialize database structure and data...');
    const dumpPath = path.join(__dirname, '../pmc_initial_schema_with_data.sql');
    const dumpSql = fs.readFileSync(dumpPath, 'utf8');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query(dumpSql);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Database schema and data initialized successfully.');

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
