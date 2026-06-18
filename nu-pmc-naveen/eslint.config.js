const globals = require('globals');

module.exports = [
  {
    files: ['server.js', 'routes/**/*.js', 'middleware/**/*.js', 'scripts/**/*.js', 'services/**/*.js'],
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
