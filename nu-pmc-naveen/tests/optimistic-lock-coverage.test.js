// tests/meetings-optimistic-lock.test.js
// Prevent-return guard for B28 — PATCH routes that edit user-content fields
// must require row_version from the client and 409 on stale. Earlier these
// were bare UPDATEs — two browser tabs of the same author would silently
// last-wins on save.
//
// Covers two routes that share the pattern:
//   PATCH /api/meetings/:id                            (draft MOM edit)
//   PATCH /api/schedule/:project_id/drift-acknowledge  (drift mitigation note)
//
// This test reads route source and asserts the safety pattern is present.
// A future regression that drops the row_version check would fail this guard.

'use strict';
const fs = require('fs');
const path = require('path');

function checkRoutePattern(src, label, routeMatcher) {
  const m = src.match(routeMatcher);
  if (!m) throw new Error(`Could not locate ${label} route — pattern stale?`);
  return m[0];
}

describe('B28 — meetings PATCH /:id has optimistic-lock guard', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'modules/workflow/routes/meetings.js'),
    'utf8'
  );
  const route = checkRoutePattern(src, 'meetings PATCH /:id',
    /router\.patch\('\/:id',[\s\S]+?\n\s*\}\)\);/);

  test('reads row_version from request body', () => {
    expect(route).toMatch(/row_version[\s,}]/);
    expect(route).toMatch(/const\s*\{[^}]*row_version[^}]*\}\s*=\s*req\.body/);
  });
  test('refuses missing row_version', () => {
    expect(route).toMatch(/row_version === undefined \|\| row_version === null/);
    expect(route).toMatch(/StaleVersionError\([\s\S]*?'missing'\)/);
  });
  test('UPDATE filters by row_version AND bumps it atomically', () => {
    expect(route).toMatch(/row_version = row_version \+ 1/);
    expect(route).toMatch(/WHERE id = \? AND row_version = \?/);
  });
  test('throws StaleVersionError when affectedRows = 0', () => {
    expect(route).toMatch(/upd\.affectedRows === 0/);
    expect(route).toMatch(/throw new ol\.StaleVersionError/);
  });
  test('returns the new row_version in the success payload', () => {
    expect(route).toMatch(/row_version:\s*parseInt\(row_version\)\s*\+\s*1/);
  });
  test('optimistic-lock helper is imported in the file', () => {
    expect(src).toMatch(/require\('\.\.\/\.\.\/\.\.\/middleware\/optimistic-lock'\)/);
  });
});

describe('B28 — schedule PATCH /:project_id/drift-acknowledge has optimistic-lock guard', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'modules/design-services/routes/schedule.js'),
    'utf8'
  );
  const route = checkRoutePattern(src, 'schedule drift-acknowledge',
    /router\.patch\('\/:project_id\/drift-acknowledge'[\s\S]+?\n\s*\}\)\);/);

  test('reads row_version from request body', () => {
    expect(route).toMatch(/const\s*\{[^}]*row_version[^}]*\}\s*=\s*req\.body/);
  });
  test('refuses missing row_version', () => {
    expect(route).toMatch(/row_version === undefined \|\| row_version === null/);
    expect(route).toMatch(/StaleVersionError/);
  });
  test('UPDATE includes row_version in WHERE and bumps it atomically', () => {
    expect(route).toMatch(/row_version = row_version \+ 1/);
    expect(route).toMatch(/AND row_version = \?/);
  });
  test('throws StaleVersionError when affectedRows = 0', () => {
    expect(route).toMatch(/upd\.affectedRows === 0/);
    expect(route).toMatch(/throw new ol\.StaleVersionError/);
  });
  test('returns the new row_version in success payload', () => {
    expect(route).toMatch(/row_version:\s*parseInt\(row_version\)\s*\+\s*1/);
  });
  test('optimistic-lock helper is imported', () => {
    expect(src).toMatch(/require\('\.\.\/\.\.\/\.\.\/middleware\/optimistic-lock'\)/);
  });
});
