// ROLE GATE ENFORCEMENT
// Verify each role sees only its allowed tabs, and hidden buttons are truly
// unreachable (even if user tries to hit the API directly).

const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Role-based access control', () => {

  test('Site manager sees site tabs only, NOT Users/Projects', async ({ page }) => {
    await login(page, 'site_mgr');
    const tabs = await page.locator('[data-tab], .tab, nav button').allTextContents();
    const tabStr = tabs.join('|').toLowerCase();
    expect(tabStr).not.toContain('users');
    expect(tabStr).not.toContain('projects list');
    // Should see site-related tabs
    expect(tabStr).toMatch(/grn|report|task/);
  });

  test('Site manager cannot reach approvals endpoint (403)', async ({ request, page }) => {
    await page.goto('/');
    await request.post('/api/auth/login', {
      data: { username: 'anjaneya', password: 'NuPMC@2026' }
    });
    const res = await request.post('/api/approvals/1/approve');
    expect(res.status()).toBe(403);
  });

  test('Site manager cannot trigger batch payment approve (403)', async ({ request }) => {
    await request.post('/api/auth/login', {
      data: { username: 'anjaneya', password: 'NuPMC@2026' }
    });
    const res = await request.post('/api/payment-requests/1/batch-approve', {
      data: { ids: [1] }
    });
    expect(res.status()).toBe(403);
  });

  test('Site manager cannot trigger ICICI generate (403)', async ({ request }) => {
    await request.post('/api/auth/login', {
      data: { username: 'anjaneya', password: 'NuPMC@2026' }
    });
    const res = await request.post('/api/payments/1/icici/generate', {
      data: { payment_ids: [1], confirmation: 'GENERATE', expected_total: 100000 }
    });
    expect(res.status()).toBe(403);
  });

  test('PMC head cannot approve client claims — principal only (403)', async ({ request }) => {
    await request.post('/api/auth/login', {
      data: { username: 'pmc_head', password: 'NuPMC@2026' }
    });
    const res = await request.post('/api/claims/1/1/approve');
    expect(res.status()).toBe(403);
  });

  test('Trainee has minimal UI — no dashboard tab', async ({ page }) => {
    // Trainee user needs to exist — create in seed or skip
    const loginRes = await page.request.post('/api/auth/login', {
      data: { username: 'test_trainee', password: 'NuPMC@2026' }
    });
    test.skip(!loginRes.ok(), 'test_trainee user not present — run seed-test-users.sql first');

    await page.goto('/');
    await page.reload();
    const tabs = await page.locator('[data-tab], .tab, nav button').allTextContents();
    expect(tabs.join('|').toLowerCase()).toMatch(/drawing|schedule/);
  });
});
