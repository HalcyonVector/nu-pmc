// tests/e2e/07-semantic-click-inference.spec.js
//
// SEMANTIC CLICK INFERENCE TEST
//
// For every clickable element in every tab across every role:
//   1. Read WHO is logged in (role, name)
//   2. Read WHERE they are (bucket → tab → card/section = breadcrumb)
//   3. Read WHAT the element says (label, surrounding context)
//   4. Ask Claude: "What should this click do?"
//   5. Click it
//   6. Ask Claude: "Does what happened match what was expected?"
//   7. Record PASS / FAIL / SKIP
//
// Requires: running server at PLAYWRIGHT_BASE + seed data (seed-test-data.sql)
// Run: npx playwright test tests/e2e/07-semantic-click-inference.spec.js \
//        --config=tests/e2e/playwright.config.js --reporter=html

const { test, expect } = require('@playwright/test');
const { login, ROLES } = require('./helpers');
const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Roles to test — maps harness role key to helpers.js key
const ROLES_TO_TEST = [
  { roleKey: 'principal',   helpersKey: 'principal'   },
  { roleKey: 'pmc_head',    helpersKey: 'pmc_head'    },
  { roleKey: 'design_head', helpersKey: 'design_head' },
  { roleKey: 'site_mgr',    helpersKey: 'site_mgr'    },
];

// Skip these APP functions — they are destructive, navigate away, or open
// external URLs. We do not want them executed in automated tests.
const SKIP_FUNCTIONS = new Set([
  'logout', 'deleteProject', 'deleteVendor', 'deleteUser',
  'revokeEngagement', 'resetPassword', 'switchProject',
  'showProjectPicker', 'openExternal', 'downloadExcel',
  'exportTally', 'downloadGSTStatement', 'generatePI',
]);

// ── Claude API helper ─────────────────────────────────────────────────────────
async function askClaude(prompt) {
  if (!ANTHROPIC_API_KEY) {
    return { error: 'ANTHROPIC_API_KEY not set — inference skipped', skipped: true };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return { text };
}

// ── State reader — runs inside browser via page.evaluate() ───────────────────
async function readAppState(page) {
  return page.evaluate(() => ({
    role:          window.APP?.user?.role         || 'unknown',
    fullName:      window.APP?.user?.full_name    || 'unknown',
    currentTab:    window.APP?.currentTab         || 'unknown',
    activeBucket:  window.APP?._activeBucket      || 'unknown',
    projectId:     window.APP?.state?.selectedProject || null,
  }));
}

// ── Breadcrumb builder ────────────────────────────────────────────────────────
function buildBreadcrumb(state) {
  return [
    `Role: ${state.role} (${state.fullName})`,
    `Bucket: ${state.activeBucket}`,
    `Tab: ${state.currentTab}`,
  ].join(' › ');
}

// ── Context extractor for a clickable element ─────────────────────────────────
async function extractElementContext(page, element) {
  return page.evaluate((el) => {
    const onclick = el.getAttribute('onclick') || '';

    // Extract APP function name
    const fnMatch = onclick.match(/APP\.(\w+)/);
    const appFn = fnMatch ? fnMatch[1] : null;

    // Element's own visible text
    const label = (el.innerText || el.textContent || el.title || el.getAttribute('aria-label') || '').trim().slice(0, 80);

    // Walk up to find nearest card/section heading
    let cardHeading = '';
    let parent = el.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!parent) break;
      const headings = parent.querySelectorAll('.card-title, .ai-title, h3, h4, .sec-label, .acc-title, [class*="title"]');
      if (headings.length > 0) {
        cardHeading = headings[0].innerText?.trim().slice(0, 80) || '';
        break;
      }
      parent = parent.parentElement;
    }

    // Sibling text — what other text is in the same card
    const cardEl = el.closest('.card, .action-item, .approval-card, .acc-item, .drawing-row') || el.parentElement;
    const siblingText = cardEl ? (cardEl.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 150) : '';

    return { onclick, appFn, label, cardHeading, siblingText };
  }, element);
}

// ── Outcome reader — what happened after the click ────────────────────────────
async function readOutcome(page, beforeState) {
  await page.waitForTimeout(800); // Let render settle

  const afterState = await page.evaluate(() => ({
    currentTab:   window.APP?.currentTab || '',
    modalOpen:    !!document.querySelector('.modal-overlay.open'),
    modalTitle:   document.querySelector('.modal-title')?.innerText?.trim() || '',
    toastText:    document.querySelector('.toast.show')?.innerText?.trim() || '',
    contentHead:  document.querySelector('.sec-label, h2, .bucket-header .bh-name')?.innerText?.trim() || '',
    errorVisible: !!document.querySelector('.error, .alert-error, [class*="error"]:not(#login-error)'),
    consoleErrors: window.__testErrors || [],
  }));

  const observations = [];
  if (afterState.modalOpen)                             observations.push(`Modal opened: "${afterState.modalTitle}"`);
  if (afterState.toastText)                             observations.push(`Toast shown: "${afterState.toastText}"`);
  if (afterState.currentTab !== beforeState.currentTab) observations.push(`Navigated to tab: ${afterState.currentTab}`);
  if (afterState.errorVisible)                          observations.push('Error state visible on screen');
  if (observations.length === 0)                        observations.push('No visible change detected');

  return { afterState, observations: observations.join('; ') };
}

// ── Report writer ─────────────────────────────────────────────────────────────
function writeReport(results) {
  const outDir = path.join(__dirname, 'semantic-click-report');
  fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `report-${timestamp}.json`);
  const htmlPath = path.join(outDir, `report-${timestamp}.html`);

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  const pass   = results.filter(r => r.verdict === 'PASS').length;
  const fail   = results.filter(r => r.verdict === 'FAIL').length;
  const skip   = results.filter(r => r.verdict === 'SKIP').length;
  const total  = results.length;

  const rows = results.map(r => `
    <tr class="${r.verdict.toLowerCase()}">
      <td>${r.role}</td>
      <td>${r.breadcrumb}</td>
      <td><code>${r.appFn || r.label}</code></td>
      <td>${r.expected}</td>
      <td>${r.observed}</td>
      <td><strong>${r.verdict}</strong></td>
      <td>${r.reason || ''}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>nu PMC — Semantic Click Inference Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; font-size: 13px; padding: 24px; background: #f5f5f5; }
    h1 { color: #1D3D62; }
    .summary { display: flex; gap: 24px; margin: 16px 0; }
    .stat { background: white; border-radius: 8px; padding: 16px 24px; text-align: center; }
    .stat-n { font-size: 28px; font-weight: 700; }
    .stat-l { font-size: 12px; color: #666; }
    .pass .stat-n { color: #2a7a4b; }
    .fail .stat-n { color: #c0392b; }
    .skip .stat-n { color: #657B90; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
    th { background: #1D3D62; color: white; padding: 10px 12px; text-align: left; font-size: 12px; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr.pass td { background: #f0faf4; }
    tr.fail td { background: #fff0ee; }
    tr.skip td { background: #f8f8f8; color: #999; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>nu PMC — Semantic Click Inference Report</h1>
  <p>Generated: ${new Date().toLocaleString('en-IN')} | Model: ${CLAUDE_MODEL}</p>
  <div class="summary">
    <div class="stat pass"><div class="stat-n">${pass}</div><div class="stat-l">PASS</div></div>
    <div class="stat fail"><div class="stat-n">${fail}</div><div class="stat-l">FAIL</div></div>
    <div class="stat skip"><div class="stat-n">${skip}</div><div class="stat-l">SKIP</div></div>
    <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">TOTAL</div></div>
  </div>
  <table>
    <tr>
      <th>Role</th><th>Breadcrumb</th><th>Function / Label</th>
      <th>Expected</th><th>Observed</th><th>Verdict</th><th>Reason</th>
    </tr>
    ${rows}
  </table>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html);
  console.log(`\n📊 Report written: ${htmlPath}`);
  return { pass, fail, skip, total };
}

// ── Main test ─────────────────────────────────────────────────────────────────
test.describe('Semantic click inference', () => {
  test.setTimeout(300000); // 5 min — inference takes time

  const allResults = [];

  for (const { roleKey, helpersKey } of ROLES_TO_TEST) {

    test(`${roleKey} — all tabs, all clicks`, async ({ page }) => {

      // Capture console errors
      await page.addInitScript(() => { window.__testErrors = []; });
      page.on('console', msg => {
        if (msg.type() === 'error') page.evaluate(t => window.__testErrors.push(t), msg.text());
      });

      await login(page, helpersKey);

      // Get all tabs for this role from APP._nav
      const tabs = await page.evaluate(() => {
        const nav = window.APP?._nav?.buckets || {};
        const all = [];
        for (const [bucket, tabList] of Object.entries(nav)) {
          for (const tab of tabList) all.push({ bucket, key: tab.key });
        }
        return all;
      });

      for (const { bucket, key: tabKey } of tabs) {

        // Navigate to this tab
        await page.evaluate((t) => window.APP?.switchTab(t), tabKey);
        await page.waitForTimeout(600);

        const state = await readAppState(page);
        const breadcrumb = buildBreadcrumb({ ...state, activeBucket: bucket, currentTab: tabKey });

        // Find all visible clickable elements with APP.xxx onclick
        const elements = await page.locator('[onclick*="APP."]').all();

        for (const element of elements) {
          // Skip if not visible
          if (!await element.isVisible()) continue;

          const ctx = await extractElementContext(page, element);
          if (!ctx.appFn) continue;

          // Skip destructive / navigation functions
          if (SKIP_FUNCTIONS.has(ctx.appFn)) {
            allResults.push({
              role: roleKey, breadcrumb, appFn: ctx.appFn, label: ctx.label,
              expected: 'SKIPPED — destructive or navigation function',
              observed: '—', verdict: 'SKIP', reason: 'In skip list',
            });
            continue;
          }

          // Build inference prompt
          const inferencePrompt = `You are auditing a construction project management mobile app called nu PMC.

Context:
- ${breadcrumb}
- Card/section heading: "${ctx.cardHeading}"
- Nearby content: "${ctx.siblingText}"
- Element label: "${ctx.label}"
- onclick calls: APP.${ctx.appFn}

In one sentence, what should happen when this element is clicked?
Then on a new line write: EXPECT: <your one-sentence expectation>
Be specific — say whether it opens a modal, navigates to a tab, fires an API call, or shows a confirmation.`;

          const inference = await askClaude(inferencePrompt);

          let expected = 'Inference unavailable';
          if (!inference.skipped && inference.text) {
            const match = inference.text.match(/EXPECT:\s*(.+)/i);
            expected = match ? match[1].trim() : inference.text.trim().slice(0, 120);
          }

          // Record state before click
          const beforeState = await readAppState(page);

          // Click
          try {
            await element.click({ timeout: 3000 });
          } catch (e) {
            allResults.push({
              role: roleKey, breadcrumb, appFn: ctx.appFn, label: ctx.label,
              expected, observed: `Click failed: ${e.message.slice(0, 80)}`,
              verdict: 'FAIL', reason: 'Element not clickable',
            });
            // Close any open modal before continuing
            await page.keyboard.press('Escape');
            continue;
          }

          // Read what happened
          const { observations } = await readOutcome(page, beforeState);

          // Ask Claude to judge
          let verdict = 'SKIP';
          let reason = '';

          if (!inference.skipped) {
            const judgePrompt = `You are auditing a click in nu PMC, a construction project management app.

Expected: "${expected}"
Observed: "${observations}"

Does the observed outcome match the expected outcome? 
Reply with exactly one word on the first line: PASS or FAIL
Then on the next line: one sentence explaining why.`;

            const judgement = await askClaude(judgePrompt);
            if (judgement.text) {
              const lines = judgement.text.trim().split('\n');
              verdict = lines[0].trim().toUpperCase().includes('PASS') ? 'PASS' : 'FAIL';
              reason = lines.slice(1).join(' ').trim().slice(0, 150);
            }
          } else {
            // No API key — just check something happened
            verdict = observations.includes('No visible change') ? 'FAIL' : 'PASS';
            reason = 'API key not set — judged by visible change only';
          }

          allResults.push({
            role: roleKey, breadcrumb, appFn: ctx.appFn, label: ctx.label,
            expected, observed: observations, verdict, reason,
          });

          // Close any modal before next element
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        }
      }

      // Summary after each role
      const roleResults = allResults.filter(r => r.role === roleKey);
      const roleFail = roleResults.filter(r => r.verdict === 'FAIL').length;
      console.log(`\n${roleKey}: ${roleResults.length} clicks tested, ${roleFail} failed`);

      // Write interim report after each role
      writeReport(allResults);

      // Fail the test if any FAIL verdicts
      const failDetails = roleResults
        .filter(r => r.verdict === 'FAIL')
        .map(r => `  ✗ ${r.breadcrumb} → ${r.appFn}: ${r.reason}`)
        .join('\n');

      expect(roleFail, `${roleFail} clicks failed semantic inference check:\n${failDetails}`).toBe(0);
    });
  }
});
