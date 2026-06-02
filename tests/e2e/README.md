# Playwright E2E Test Suite

These tests run real browser clicks against a live nu PMC server. They catch
three classes of bug that module tests can't:

1. **Browser-rendering bugs** — wrong state shown, hydration mismatches
2. **UI wiring bugs** — buttons that click but call nothing, silent failures
3. **End-to-end flow bugs** — full journeys from login to send

## When to run

- After every deployment to production (part of post-deploy smoke)
- Weekly, as a regression guard
- After any change to `public/js/` or `routes/`

## Setup (one-time)

```bash
cd /path/to/nu-pmc
npm install --save-dev playwright
npx playwright install chromium
```

On a fresh Ubuntu 22.04 VPS, `playwright install` will download Chromium
(~180 MB) from Microsoft's CDN. If the VPS has strict outbound firewall,
allowlist `cdn.playwright.dev` and `playwright.azureedge.net`.

## Run

```bash
# Against local dev server (default http://localhost:3000)
npx playwright test --config=tests/e2e/playwright.config.js

# Against production
PLAYWRIGHT_BASE=https://nuassociates.in npx playwright test --config=tests/e2e/playwright.config.js

# Run a single spec
npx playwright test tests/e2e/01-destructive-safety.spec.js

# HTML report opens automatically on failure; manually:
npx playwright show-report
```

## Test files

| File                              | What it checks                                                       |
|-----------------------------------|----------------------------------------------------------------------|
| `01-destructive-safety.spec.js`   | Edit/View buttons never trigger external sends; confirmation codes  |
| `02-role-gates.spec.js`           | Each role gets only allowed tabs; 403s on privileged endpoints      |
| `03-happy-paths.spec.js`          | Login → dashboard → core list endpoints                             |
| `04-ui-wiring.spec.js`            | No undefined APP methods called from onclick handlers               |
| `05-preview-before-send.spec.js`  | Preview endpoints don't change state; send requires confirmation    |
| `06-audit-log.spec.js`            | Sensitive actions leave audit_log entries                           |

## Understanding failures

- **Red test with screenshot**: check `playwright-report/` — Playwright captures
  screenshots and videos on failure. Open the HTML report for interactive trace.
- **"Timeout exceeded"**: usually means the UI took too long to render or a
  selector doesn't match. Increase timeout with `{ timeout: 10000 }` or fix
  the selector.
- **"Expected 200, got 500"**: backend error. Check server logs at the time
  of the test run.

## Critical tests — never skip

- `01-destructive-safety` — if this fails, you have a one-click-sends-file bug
- `02-role-gates` — if this fails, permissions are broken

## Known-skipped tests

- `02-role-gates > Trainee has minimal UI` — requires `test_trainee` seed user
  (not in schema.sql by default). Skip is automatic.
- `06-audit-log > audit_log table exists` — requires `/api/audit/recent`
  endpoint which is admin-only and not yet built.

## Adding new tests

Follow the pattern: each `.spec.js` file groups related tests.
Use the helper: `const { login } = require('./helpers')`.
Prefer `request.X()` for API assertions; use `page.X()` only when verifying
browser-rendered behaviour.
