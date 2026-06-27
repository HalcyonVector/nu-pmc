// jest.integration.config.js
// Separate Jest config for integration tests that run against a live MySQL database.
// Does NOT use the global mock from tests/setup.js.
//
// Usage:
//   TEST_DB_HOST=localhost TEST_DB_PASSWORD=secret npx jest --config jest.integration.config.js
//
// The test database is created/dropped automatically (TEST_DB_NAME, default: nu_pmc_test).
// The DB user needs CREATE/DROP DATABASE privileges.

module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  // NO setupFiles — integration tests bring their own DB connection
  testMatch: ['**/tests/integration/**/*.integration.test.js'],
};
