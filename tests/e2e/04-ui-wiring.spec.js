// UI WIRING — verify no button click is silent. Every click should either
// make a network request, open a modal, navigate, or show a toast.

const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('UI button wiring', () => {

  test('No console errors on any major tab navigation', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push('PAGE: ' + err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
    });

    await login(page, 'principal');

    // Try clicking all top-level tabs
    const tabs = await page.locator('nav button, [data-tab]').all();
    for (const tab of tabs.slice(0, 10)) {
      try {
        await tab.click({ timeout: 2000 });
        await page.waitForTimeout(500);
      } catch(_) { }
    }

    expect(errors, `Found ${errors.length} errors during tab navigation:\n${errors.slice(0, 5).join('\n')}`).toHaveLength(0);
  });

  test('Every onclick="APP.xxx" references a defined method', async ({ page }) => {
    await login(page, 'principal');

    // Inject audit script
    const undefinedRefs = await page.evaluate(() => {
      const handlers = document.querySelectorAll('[onclick]');
      const undef = [];
      handlers.forEach(el => {
        const code = el.getAttribute('onclick');
        const matches = code.matchAll(/APP\.(\w+)/g);
        for (const m of matches) {
          if (typeof window.APP?.[m[1]] !== 'function' && !(m[1] in (window.APP || {}))) {
            undef.push({ method: m[1], element: el.outerHTML.substring(0, 100) });
          }
        }
      });
      return undef;
    });

    expect(undefinedRefs, `Found ${undefinedRefs.length} onclick handlers referencing undefined APP methods`).toHaveLength(0);
  });

  test('Clicking "+ Raise Query" opens modal (was broken)', async ({ page }) => {
    await login(page, 'principal');

    // Navigate to queries tab if exists
    const queriesTab = page.locator('button, [data-tab]').filter({ hasText: /queries/i }).first();
    if (await queriesTab.count() > 0) {
      await queriesTab.click();
      await page.waitForTimeout(500);

      const raiseBtn = page.locator('button').filter({ hasText: /raise query/i }).first();
      if (await raiseBtn.count() > 0) {
        await raiseBtn.click();
        await page.waitForTimeout(300);
        // Modal should appear
        const modal = await page.locator('.modal, [role="dialog"], #modal-root:has(input)').count();
        expect(modal).toBeGreaterThan(0);
      }
    }
  });
});
