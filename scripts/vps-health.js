// scripts/vps-health.js
// Runs daily: DB backup, PM2 health check, SSL cert monitoring
// Add to cron: 0 2 * * * node /home/claude/nu-pmc/scripts/vps-health.js

require('dotenv').config({ path: require('path').join(__dirname,'../.env') });
const { execSync, exec } = require('child_process');
const https  = require('https');
const path   = require('path');
const fs     = require('fs');

const ALERT_PHONE = process.env.ALERT_PHONE || process.env.GURU_PHONE || '';
const DB_NAME     = process.env.DB_NAME     || 'nu_pmc';
const DB_USER     = process.env.DB_USER     || 'nu_app';
const DB_PASS     = process.env.DB_PASSWORD || '';
const BACKUP_DIR  = process.env.BACKUP_DIR  || '/home/backups/nu-pmc';
const S3_BUCKET   = process.env.S3_BUCKET   || '';
const APP_DOMAIN  = process.env.APP_DOMAIN  || 'nuassociates.in';

async function run() {
  console.log('[vps-health] Starting —', new Date().toISOString());

  await checkAndBackup();
  await checkPM2();
  await checkSSL();

  console.log('[vps-health] Done');
}

// ── 1. DAILY MYSQL BACKUP
async function checkAndBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename  = `${DB_NAME}_${timestamp}.sql.gz`;
    const filepath  = path.join(BACKUP_DIR, filename);

    execSync(
      `mysqldump -u${DB_USER} ${DB_PASS?'-p'+DB_PASS:''} ${DB_NAME} | gzip > ${filepath}`,
      { stdio: 'pipe' }
    );

    const sizeMB = (fs.statSync(filepath).size / 1048576).toFixed(1);
    console.log(`[vps-health] Backup: ${filename} (${sizeMB}MB)`);

    // Upload to S3 if configured
    if (S3_BUCKET) {
      execSync(`aws s3 cp ${filepath} s3://${S3_BUCKET}/db-backups/${filename}`, { stdio: 'pipe' });
      console.log('[vps-health] Uploaded to S3:', S3_BUCKET);
    }

    // Keep last 7 days locally
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(DB_NAME))
      .sort()
      .reverse();
    files.slice(7).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));

  } catch (err) {
    console.error('[vps-health] Backup FAILED:', err.message);
    await sendAlert('CRITICAL: Database backup failed — ' + err.message);
  }
}

// ── 2. PM2 HEALTH CHECK
async function checkPM2() {
  try {
    const output = execSync('pm2 jlist', { stdio: 'pipe' }).toString();
    const procs  = JSON.parse(output);
    const app    = procs.find(p => p.name === 'nu-pmc' || p.name === 'server');

    if (!app) {
      await sendAlert('WARNING: nu-pmc process not found in PM2');
      return;
    }

    if (app.pm2_env?.status !== 'online') {
      await sendAlert('WARNING: nu-pmc is ' + app.pm2_env?.status + ' — restarting');
      execSync('pm2 restart nu-pmc || pm2 restart server', { stdio: 'pipe' });
    }

    const memMB = Math.round((app.monit?.memory || 0) / 1048576);
    console.log('[vps-health] PM2 status:', app.pm2_env?.status, '| Memory:', memMB + 'MB | Restarts:', app.pm2_env?.restart_time);

    if (app.pm2_env?.restart_time > 5) {
      await sendAlert('WARNING: nu-pmc has restarted ' + app.pm2_env.restart_time + ' times — investigate');
    }

  } catch (err) {
    console.error('[vps-health] PM2 check error:', err.message);
    await sendAlert('WARNING: PM2 health check failed — ' + err.message);
  }
}

// ── 3. SSL CERTIFICATE MONITORING
async function checkSSL() {
  return new Promise((resolve) => {
    const req = https.request({ host: APP_DOMAIN, port: 443, method: 'HEAD' }, (res) => {
      const cert     = res.socket.getPeerCertificate();
      const expiry   = new Date(cert.valid_to);
      const daysLeft = Math.floor((expiry - Date.now()) / 86400000);

      console.log('[vps-health] SSL cert expires:', expiry.toDateString(), '(' + daysLeft + ' days)');

      if (daysLeft <= 7) {
        sendAlert('CRITICAL: SSL cert expires in ' + daysLeft + ' days — renew immediately').catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
      } else if (daysLeft <= 14) {
        sendAlert('WARNING: SSL cert expires in ' + daysLeft + ' days').catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
      }
      resolve();
    });
    req.on('error', (err) => {
      console.error('[vps-health] SSL check error:', err.message);
      sendAlert('WARNING: SSL check failed — ' + err.message).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
      resolve();
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(); });
    req.end();
  });
}

// ── ALERT via emergency SMTP (Matrix migration: Twilio path retired)
//
// Why SMTP and not Matrix here: this script runs as a host watchdog on a
// daily cron. The whole point is it must work when Matrix is broken — that
// is the failure mode it's meant to surface. Sending the "Matrix outbox
// stuck" alert through Matrix would be a closed loop. Same logic for "DB
// backup failed" and "SSL expiring" — these tend to be symptoms of broader
// host-level issues that a co-located notification path may also be hit by.
//
// The legacy ALERT_PHONE env var stays readable so an in-flight cron run
// that hasn't yet had its env updated still logs the alert text loudly to
// the journal. No silent drop. (Principal — May 2026.)
async function sendAlert(message) {
  // Always log, no matter what — the journal is the receipt of last resort.
  console.error('[vps-health] ALERT:', message);

  let emergencyMail;
  try {
    emergencyMail = require('../services/emergency-mail');
  } catch (e) {
    console.error('[vps-health] emergency-mail unavailable:', e.message);
    return;
  }

  const result = await emergencyMail.sendEmergency({
    subject: 'VPS health',
    body:    'nu PMC VPS health check has detected an issue:\n\n' + message + '\n\n'
           + 'Host:    ' + require('os').hostname() + '\n'
           + 'Time:    ' + new Date().toISOString() + '\n'
           + '\n'
           + 'This message was sent via the emergency SMTP fallback path\n'
           + '(Matrix substrate may also be affected — check independently).',
  });

  if (!result.sent) {
    console.error('[vps-health] emergency-mail send failed:', result.reason);
    // Last-resort: if the cron has ALERT_PHONE legacy env still configured AND
    // the Twilio package still loads, log a warning that operator action is
    // required. Do NOT actually call wa.send — Twilio is being decommissioned
    // and may already be unwired.
    if (ALERT_PHONE) {
      console.error('[vps-health] note: ALERT_PHONE is still configured but Twilio is retired; configure EMERGENCY_SMTP_* and EMERGENCY_ALERT_TO instead.');
    }
  }
}

run().catch(console.error);
