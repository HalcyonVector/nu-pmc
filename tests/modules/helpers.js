// tests/modules/helpers.js — shared utilities for all module tests
const fs      = require('fs');
const path    = require('path');
const http    = require('http');
const app     = require('../../server');
const request = require('supertest');

const STATE_FILE = path.join(__dirname, 'state.json');

// ── STATE — read/write shared state between modules
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return {}; }
}
function writeState(updates) {
  const current = readState();
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...current, ...updates }, null, 2));
}

// ── TEST HARNESS
let _passed = 0, _failed = 0;
const _results = [];

function reset() { _passed = 0; _failed = 0; _results.length = 0; }

async function test(name, fn) {
  try {
    await fn();
    _passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    _failed++;
    process.stdout.write(`  ✗ ${name}\n    → ${err.message}\n`);
    _results.push({ name, error: err.message });
  }
}

function summary() {
  const total = _passed + _failed;
  process.stdout.write(`  ${_passed}/${total} passed\n`);
  return { passed: _passed, failed: _failed };
}

// ── HTTP AGENT — maintains session cookies between requests
class Agent {
  constructor() { this.agent = request.agent(app); }

  async login(username = 'test_principal', password = 'NuPMC@2026') {
    const res = await this.agent.post('/api/auth/login').send({ username, password });
    if (res.status !== 200) throw new Error(`Login failed: ${res.body?.error || res.status}`);
    return res.body;
  }

  async get(path) {
    const res = await this.agent.get('/api' + path);
    return res;
  }

  async post(path, data) {
    const res = await this.agent.post('/api' + path).send(data);
    return res;
  }

  async patch(path, data) {
    const res = await this.agent.patch('/api' + path).send(data);
    return res;
  }

  async delete(path) {
    const res = await this.agent.delete('/api' + path);
    return res;
  }

  async upload(path, field, buffer, filename, mimeType = 'application/octet-stream', fields = {}) {
    const req = this.agent.post('/api' + path)
      .attach(field, buffer, { filename, contentType: mimeType });
    for (const [k, v] of Object.entries(fields || {})) req.field(k, String(v));
    const res = await req;
    return res;
  }
}

// ── ASSERTIONS
const assert = require('assert');

function ok(res, label = '') {
  assert.ok(res.status < 400,
    `${label} HTTP ${res.status}: ${JSON.stringify(res.body).substring(0, 120)}`
  );
  assert.ok(res.body?.success !== false,
    `${label} success=false: ${res.body?.error || JSON.stringify(res.body).substring(0, 80)}`
  );
}

function is(actual, expected, label = '') {
  assert.strictEqual(actual, expected, `${label} expected ${expected}, got ${actual}`);
}

function has(obj, key, label = '') {
  assert.ok(obj?.[key] !== undefined && obj?.[key] !== null,
    `${label} missing field: ${key}`
  );
}

function gt(actual, min, label = '') {
  assert.ok(actual > min, `${label} expected > ${min}, got ${actual}`);
}

// ── TEST DB HELPERS
const db = require('../../middleware/db');

async function dbClean(table, where, params) {
  await db.query(`DELETE FROM ${table} WHERE ${where}`, params);
}

async function dbInsert(table, data) {
  const keys   = Object.keys(data);
  const vals   = Object.values(data);
  const [res]  = await db.query(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,
    vals
  );
  return res.insertId;
}

module.exports = { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db, dbClean, dbInsert, assert };
