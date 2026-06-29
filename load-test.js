#!/usr/bin/env node
/**
 * nu-pmc load test — simulates 30-50 concurrent users
 *
 * Run: node load-test.js
 * Requires: npm install autocannon (run once)
 *
 * What it tests:
 *   - 10 key endpoints hit by real users every minute
 *   - 30-second ramp-up with 50 concurrent connections
 *   - Measures p50/p95/p99 latency and error rate
 */

const autocannon = require('autocannon');
const http = require('http');

// ── Step 1: Get a real session using dev-login → dev-switch ───────────────
// Uses the dev auth flow (only active in NODE_ENV=development)
function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login() {
  // Step 1a: dev-login to get list of users
  const devBody = JSON.stringify({ username: 'user1', password: 'Start@123' });
  const devRes = await httpRequest({
    hostname: 'localhost', port: 5100,
    path: '/api/auth/dev-login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(devBody) },
  }, devBody);

  if (devRes.status !== 200) throw new Error('dev-login failed: ' + devRes.body);
  const cookies1 = devRes.headers['set-cookie'] || [];
  const sid1 = (cookies1.find(c => c.startsWith('connect.sid=')) || '').split(';')[0];
  const csrf1 = (cookies1.find(c => c.startsWith('nu_csrf=')) || '').split(';')[0].split('=')[1] || '';

  // Step 1b: dev-switch to pmc_head (user_id=3) to get a real scoped session
  const switchBody = JSON.stringify({ user_id: 3 });
  const switchRes = await httpRequest({
    hostname: 'localhost', port: 5100,
    path: '/api/auth/dev-switch', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(switchBody),
      'Cookie': sid1,
      'X-Nu-CSRF': csrf1,
    },
  }, switchBody);

  if (switchRes.status !== 200) throw new Error('dev-switch failed: ' + switchRes.body);
  const cookies2 = switchRes.headers['set-cookie'] || [];
  const sid2 = (cookies2.find(c => c.startsWith('connect.sid=')) || '').split(';')[0];
  const csrf2 = (cookies2.find(c => c.startsWith('nu_csrf=')) || '').split(';')[0].split('=')[1] || '';

  return { sessionCookie: sid2 || sid1, csrfToken: csrf2 || csrf1 };
}

// ── Step 2: Run autocannon ──────────────────────────────────────────────────
async function runLoadTest({ sessionCookie, csrfToken }) {
  console.log('\n🔫  nu-pmc Load Test — 50 connections × 30 seconds\n');

  const requests = [
    { method: 'GET', path: '/api/auth/me' },
    { method: 'GET', path: '/api/projects' },
    { method: 'GET', path: '/api/labour/2' },
    { method: 'GET', path: '/api/payments/2' },
    { method: 'GET', path: '/api/meetings/2' },
    { method: 'GET', path: '/api/finance/2/petty-cash' },
    { method: 'GET', path: '/api/changes/2' },
    { method: 'GET', path: '/api/issues/2' },
    { method: 'GET', path: '/api/pending/me' },
    { method: 'GET', path: '/api/notifications/log' },
  ];

  const statusCounts = {};
  const instance = autocannon({
    url: 'http://localhost:5100',
    connections: 50,         // concurrent users
    duration: 30,            // seconds
    pipelining: 1,
    headers: {
      'Cookie': sessionCookie,
      'X-Nu-CSRF': csrfToken,
    },
    requests,
  }, (err, result) => {
    if (err) { console.error('Load test error:', err); process.exit(1); }
    console.log('\nStatus code breakdown:', statusCounts);
    printResult(result);
  });

  instance.on('response', (client, statusCode) => {
    statusCounts[statusCode] = (statusCounts[statusCode] || 0) + 1;
  });

  autocannon.track(instance, { renderProgressBar: true });
}

function printResult(r) {
  const ok = r['2xx'] || 0;
  const total = r.requests.total;
  const errRate = ((total - ok) / total * 100).toFixed(1);

  console.log('\n═══════════════════════════════════════');
  console.log('  nu-pmc Load Test Results');
  console.log('═══════════════════════════════════════');
  console.log(`  Requests:      ${total.toLocaleString()} total`);
  console.log(`  Throughput:    ${r.requests.average.toFixed(0)} req/s`);
  console.log(`  2xx:           ${ok.toLocaleString()} (${(ok/total*100).toFixed(1)}%)`);
  console.log(`  Errors:        ${(total-ok).toLocaleString()} (${errRate}%)`);
  console.log('');
  console.log('  Latency:');
  console.log(`    p50    ${r.latency.p50} ms`);
  console.log(`    p75    ${r.latency.p75} ms`);
  console.log(`    p97.5  ${r.latency.p97_5} ms`);
  console.log(`    p99    ${r.latency.p99} ms`);
  console.log(`    max    ${r.latency.max} ms`);
  console.log('');

  const THRESHOLDS = { p975: 2000, errRate: 1.0 };
  const p95Pass = r.latency.p97_5 <= THRESHOLDS.p975;
  const errPass = parseFloat(errRate) <= THRESHOLDS.errRate;
  console.log('  Verdict:');
  console.log(`    p97.5 ≤ ${THRESHOLDS.p975}ms  ${p95Pass ? '✅ PASS' : '❌ FAIL — too slow'}`);
  console.log(`    errors ≤ ${THRESHOLDS.errRate}%    ${errPass ? '✅ PASS' : '❌ FAIL — too many errors'}`);
  console.log('═══════════════════════════════════════\n');

  if (!p95Pass || !errPass) process.exit(1);
}

// ── Run ────────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('Logging in...');
    const auth = await login();
    console.log('✓ Got session cookie');
    await runLoadTest(auth);
  } catch (e) {
    console.error('Fatal:', e.message);
    process.exit(1);
  }
})();
