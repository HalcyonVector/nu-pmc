// Shared helpers for Playwright tests
const ROLES = {
  principal:   { username: 'principal',    password: 'NuPMC@2026' },
  pmc_head:    { username: 'pmc_head', password: 'NuPMC@2026' },
  site_mgr:    { username: 'anjaneya',  password: 'NuPMC@2026' },
  design_head: { username: 'pmc_head',    password: 'NuPMC@2026' },
  trainee:     { username: 'test_trainee', password: 'NuPMC@2026' },  // create via seed if not present
};

async function login(page, roleKey) {
  const creds = ROLES[roleKey];
  if (!creds) throw new Error(`Unknown role: ${roleKey}`);
  await page.goto('/');
  // Wait for login form
  await page.waitForSelector('input[type="text"], input[name="username"], #login-username', { timeout: 10000 });
  // Fill with defensive selectors
  const userSel = await page.$('#login-username') ? '#login-username' : 'input[type="text"]:visible';
  const passSel = await page.$('#login-password') ? '#login-password' : 'input[type="password"]:visible';
  await page.fill(userSel, creds.username);
  await page.fill(passSel, creds.password);
  // Submit — either button or Enter
  const submitBtn = await page.$('button:has-text("Login"), button:has-text("Sign in"), button[type="submit"]');
  if (submitBtn) await submitBtn.click();
  else await page.keyboard.press('Enter');
  // Wait for dashboard or any logged-in element
  await page.waitForFunction(() => !document.querySelector('input[type="password"]:visible'), { timeout: 10000 });
}

async function logout(page) {
  // Find logout button — often in header or profile menu
  const logoutBtn = await page.$('button:has-text("Logout"), button:has-text("Sign out"), #logout');
  if (logoutBtn) await logoutBtn.click();
  await page.waitForTimeout(500);
}

module.exports = { login, logout, ROLES };
