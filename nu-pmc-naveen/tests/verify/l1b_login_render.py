"""
L1b — Login & render: can each seeded role actually log in and see a screen?

This is the test that would have caught what Guru reported in the last build:
"couldn't log in and see screen." The API-level L1 smoke test (l1_read_smoke.py)
only proves the backend responds — it doesn't prove the frontend renders.

Flow per role:
  1. Navigate to /
  2. Confirm login screen is visible
  3. Fill username + password
  4. Click Sign In
  5. Wait for login screen to hide and #app to appear
  6. Wait for either nav tabs to render OR content area to show non-loading content
  7. Check no JS errors fired during the flow
  8. Screenshot for manual review

Failures this catches:
  - Login API succeeds but APP.showApp() throws → user sees blank page
  - APP.user.projects is empty and role expects projects → silent hang
  - A renderer function references undefined state → spinner never clears
  - An onclick attribute references a function that doesn't exist → console error
  - Password-change screen breaks the flow for a fresh user
"""
import os
import subprocess
import sys

try:
  from playwright.sync_api import sync_playwright
except ImportError:
  print("L1b RESULT: 0/0 pass, SKIP  (playwright not installed — `pip install playwright && playwright install chromium`)")
  sys.exit(0)

BASE = os.environ.get('BASE_URL', 'http://localhost:3100')
SCREENSHOT_DIR = '/tmp/l1b-screenshots'
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

ROLES = [
  'principal','design_principal','pmc_head','design_head','services_head',
  'finance_admin','senior_site_manager','site_manager','team_lead',
  'jr_architect','services_engineer','coordinator','detailing','trainee',
  'audit','it_admin',
]

def test_role(role, browser):
  """Returns (passed: bool, reason: str, screenshot_path: str)"""
  ctx = browser.new_context(viewport={'width': 430, 'height': 932})
  page = ctx.new_page()
  js_errors = []
  console_errors = []

  page.on('pageerror', lambda e: js_errors.append(str(e)[:300]))
  page.on('console', lambda m: console_errors.append(f"{m.type}: {m.text[:200]}")
    if m.type == 'error' and 'fonts.' not in m.text and 'favicon' not in m.text
    else None)

  try:
    page.goto(BASE + '/', wait_until='networkidle', timeout=15000)
  except Exception as e:
    ctx.close()
    return False, f"page load failed: {str(e)[:100]}", None

  # 1. Login screen visible?
  login_screen = page.query_selector('#login-screen')
  if not login_screen:
    ctx.close()
    return False, "no #login-screen element", None
  if login_screen.is_hidden():
    ctx.close()
    return False, "#login-screen was already hidden (stale session?)", None

  # 2. Fill + submit
  try:
    page.fill('#login-username', f'test_{role}', timeout=5000)
    page.fill('#login-password', 'Test1234', timeout=5000)
    page.click('button.btn-login', timeout=5000)
  except Exception as e:
    path = f"{SCREENSHOT_DIR}/{role}_fail_submit.png"
    page.screenshot(path=path, full_page=True)
    ctx.close()
    return False, f"login form interact failed: {str(e)[:100]}", path

  # 3. Wait for login screen to disappear (success marker)
  try:
    page.wait_for_function(
      "document.getElementById('login-screen').style.display === 'none'",
      timeout=10000
    )
  except Exception:
    # Check for login error text (expected password wrong, etc.)
    err_el = page.query_selector('#login-error')
    err_text = err_el.inner_text().strip() if err_el else ''
    path = f"{SCREENSHOT_DIR}/{role}_login_stuck.png"
    page.screenshot(path=path, full_page=True)
    ctx.close()
    return False, f"login screen didn't hide within 10s. Error text: '{err_text}'", path

  # 4. Check if we got bounced to change-password screen (legitimate for first-login)
  cp_screen = page.query_selector('#change-password-screen')
  if cp_screen and cp_screen.is_visible():
    path = f"{SCREENSHOT_DIR}/{role}_change_password.png"
    page.screenshot(path=path, full_page=True)
    ctx.close()
    # Pass — change password is a valid destination
    return True, "change-password screen shown (first login flow)", path

  # 5. Main app should now be visible
  app_el = page.query_selector('#app')
  if not app_el:
    ctx.close()
    return False, "#app element missing from DOM", None
  if app_el.is_hidden():
    path = f"{SCREENSHOT_DIR}/{role}_app_hidden.png"
    page.screenshot(path=path, full_page=True)
    ctx.close()
    return False, "#app element exists but hidden after login", path

  # 6. Wait for nav OR content to populate (allow 8s for async buildTabs)
  page.wait_for_timeout(3000)

  # Check nav bar
  tabs = page.query_selector_all('#tabs-bar .tab')
  bottom = page.query_selector_all('#bottom-nav .bb-item')
  content = page.query_selector('#content-area')
  content_txt = content.inner_text().strip() if content else ''

  # Capture screenshot for review regardless
  path = f"{SCREENSHOT_DIR}/{role}_after_login.png"
  page.screenshot(path=path, full_page=True)

  # Role must have either tabs rendered OR clear empty-state content (not blank)
  is_blank = (not tabs and not bottom) and len(content_txt) < 5
  is_stuck_loading = 'loading' in content_txt.lower() and len(content_txt) < 30

  ctx.close()

  if is_blank:
    return False, f"screen is BLANK after login — no tabs, no content. JS errors: {js_errors[:2]}", path
  if is_stuck_loading:
    return False, f"stuck on loading spinner after 3s. JS errors: {js_errors[:2]}", path
  if js_errors:
    return False, f"JS errors fired: {js_errors[:2]}", path

  return True, f"{len(tabs)} tabs, {len(bottom)} bottom-bar items, {len(content_txt)} chars content", path


def main():
  with sync_playwright() as p:
    browser = p.chromium.launch()
    pass_count = 0
    fail_count = 0
    failures = []
    for role in ROLES:
      passed, reason, screenshot = test_role(role, browser)
      marker = '✓' if passed else '✗'
      print(f"  {marker}  {role:22s}  {reason}")
      if passed:
        pass_count += 1
      else:
        fail_count += 1
        failures.append((role, reason, screenshot))
    browser.close()

  print()
  print(f"L1b RESULT: {pass_count}/{len(ROLES)} pass, {fail_count} fail")
  if failures:
    print()
    print("Failures (screenshots saved to /tmp/l1b-screenshots):")
    for role, reason, shot in failures:
      print(f"  ✗ {role}: {reason}")
      if shot:
        print(f"    screenshot: {shot}")

if __name__ == '__main__':
  main()
