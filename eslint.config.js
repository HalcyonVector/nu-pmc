const globals = require('globals');

module.exports = [
  {
    files: [
      'server.js',
      'modules/**/*.js',
      'middleware/**/*.js',
      'scripts/**/*.js',
      'services/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2021,
      globals: { ...globals.node, URLSearchParams: 'readonly' }
    },
    rules: {
      'no-undef':       'error',
      'no-unused-vars': ['warn', {
        vars:              'all',
        args:              'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-console': 'off',
      'no-empty':   'warn',
      'radix':      'error',
    }
  },
  {
    // Test files use the Jest global API (describe/test/expect/jest/beforeEach…).
    // Without these globals, no-undef reports ~1000 false errors across
    // modules/**/tests and tests/. This block applies in addition to the
    // Node block above (flat-config objects merge in order for matching files).
    files: ['**/tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2021,
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'radix': 'off',
    }
  },
  {
    files: ['public/js/app.js', 'public/js/api.js', 'public/js/ui.js'],
    languageOptions: {
      ecmaVersion: 2021,
      globals: { ...globals.browser, APP: 'writable', API: 'readonly', UI: 'readonly', GANTT: 'readonly' }
    },
    rules: { 'no-undef': 'off', 'no-unused-vars': 'warn', 'no-console': 'off' }
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2021,
      globals: { ...globals.browser, self: 'readonly', caches: 'readonly', indexedDB: 'readonly', Response: 'readonly', fetch: 'readonly' }
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'warn', 'no-console': 'off' }
  }
];
