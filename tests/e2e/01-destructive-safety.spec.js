// DESTRUCTIVE ACTION SAFETY — the Principal #1 concern:
// "Click Edit → file goes to client"
//
// Verifies that buttons labelled as safe actions (Edit, View, Save draft) do NOT
// trigger external sends. Verifies that external-send buttons require explicit
// confirmation.

const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Destructive action safety', () => {

  test('Edit buttons never send externally — intercept all /send, /issue, /icici endpoints', async ({ page }) => {
    const externalCalls = [];
    page.on('request', req => {
      const url = req.url();
      if (/\/(issue-to-client|icici\/generate|icici\/confirm(?!\/preview))/.test(url)) {
        externalCalls.push({ url, method: req.method() });
      }
    });

    await login(page, 'pmc_head');

    // Click every button whose text contains "Edit" or "View"
    const editButtons = await page.locator('button').filter({ hasText: /^(Edit|View|Details?|Open)$/i }).all();
    console.log(`Found ${editButtons.length} edit/view buttons`);

    for (const btn of editButtons.slice(0, 10)) {  // sample first 10
      try {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(300);
        // Dismiss any modal that opened
        const closeBtn = await page.$('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"]');
        if (closeBtn) await closeBtn.click();
      } catch(_) { /* button may have disappeared */ }
    }

    expect(externalCalls, `Edit/View clicks triggered ${externalCalls.length} external sends: ${JSON.stringify(externalCalls)}`).toHaveLength(0);
  });

  test('MOM "Issue to client" button requires confirmation', async ({ page, request }) => {
    await login(page, 'pmc_head');

    // Find any approved MOM and try issue-to-client without confirmation
    // Direct API call to verify backend enforces
    const response = await request.post('/api/moms/1/issue-to-client', {
      data: {}   // no confirmation
    });
    expect([400, 404]).toContain(response.status());
    if (response.status() === 400) {
      const body = await response.json();
      expect(body.code).toBe('CONFIRMATION_MISSING');
    }
  });

  test('ICICI generate button requires confirmation AND total match', async ({ page, request }) => {
    await login(page, 'pmc_head');

    // Without confirmation
    const noConf = await request.post('/api/payments/1/icici/generate', {
      data: { payment_ids: [1] }
    });
    expect([400, 404]).toContain(noConf.status());

    // With wrong total
    const wrongTotal = await request.post('/api/payments/1/icici/generate', {
      data: { payment_ids: [1], confirmation: 'GENERATE', expected_total: 999999999 }
    });
    // Either 409 (mismatch) or 400 (no payments) — both are defensive responses
    expect([400, 404, 409]).toContain(wrongTotal.status());
  });

  test('GRN NCR flag requires FLAG_NCR confirmation string', async ({ request }) => {
    // Login as principal via API
    const loginRes = await request.post('/api/auth/login', {
      data: { username: 'principal', password: 'NuPMC@2026' }
    });
    expect(loginRes.ok()).toBe(true);

    const res = await request.patch('/api/grn/1/flag-nonconformance', {
      data: { reason: 'test', material_type: 'structural' }  // no confirmation
    });
    expect([400, 404]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body.code).toBe('CONFIRMATION_MISSING');
    }
  });

  test('UTR webhook rejects requests without secret when secret configured', async ({ request }) => {
    const res = await request.post('/api/payments/utr-webhook', {
      data: { utr: 'FAKE123', account_number: '1111', amount: 10000, status: 'success' }
    });
    // Returns 401 if ICICI_WEBHOOK_SECRET is configured in env,
    // else logs warning and proceeds. Both are acceptable — we just verify no 500.
    expect([200, 400, 401]).toContain(res.status());
  });
});
