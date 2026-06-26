#!/usr/bin/env node
// scripts/gen-oidc-key.js
// ============================================================
// One-time tool: generate an RSA-2048 key pair for the OIDC provider.
//
// Usage:
//   node scripts/gen-oidc-key.js
//
// Output:
//   Prints OIDC_PRIVATE_KEY and OIDC_KEY_ID values you paste into .env
//   Also writes public key to stdout so you can verify it.
//
// Run once on the production server, paste the private key into .env,
// keep the public key for reference. The key never changes unless you
// deliberately rotate it (and rerun this script).
//
// WARNING: Never commit the private key to git. It belongs in .env only.
// ============================================================

'use strict';

const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const keyId = `nu-pmc-${Date.now()}`;

console.log('# ──────────────────────────────────────────────────');
console.log('# Add these lines to your .env file:');
console.log('# ──────────────────────────────────────────────────');
console.log(`OIDC_KEY_ID=${keyId}`);
console.log('');
// Multi-line PEM in .env: use escaped newlines
const escapedKey = privateKey.replace(/\n/g, '\\n');
console.log(`OIDC_PRIVATE_KEY="${escapedKey}"`);
console.log('');
console.log('# ──────────────────────────────────────────────────');
console.log('# Public key (for reference / external verification):');
console.log('# ──────────────────────────────────────────────────');
console.log(publicKey);
