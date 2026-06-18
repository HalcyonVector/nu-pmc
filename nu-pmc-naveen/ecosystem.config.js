// PM2 ecosystem config — nu PMC app
// Usage: pm2 start ecosystem.config.js --env production
// Docs:  pm2.keymetrics.io/docs/usage/application-declaration

module.exports = {
  apps: [
    {
      name:        'nu-pmc',
      script:      './server.js',
      cwd:         __dirname,
      instances:   1,          // Single instance — MySQL on same VPS
      exec_mode:   'fork',
      autorestart: true,
      watch:       false,       // Never watch in production
      max_memory_restart: '400M',

      // Graceful restart
      kill_timeout:      5000,
      listen_timeout:    10000,
      shutdown_with_message: true,

      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file:   '/var/log/nu-pmc/out.log',
      error_file: '/var/log/nu-pmc/error.log',
      merge_logs:  true,

      // Environment — production
      env_production: {
        NODE_ENV: 'production',
        PORT:     3000,
      },

      // Environment — development
      env_development: {
        NODE_ENV: 'development',
        PORT:     3001,
      },
    },
  ],
};
