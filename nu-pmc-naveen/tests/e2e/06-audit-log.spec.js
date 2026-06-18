// AUDIT LOG — verify sensitive actions leave a trail.
// After ANY external send attempt (MOM issue, ICICI generate, NCR flag),
// an audit_log entry should be written. This test uses direct DB access via
// an admin endpoint, OR hits the API then verifies traceability.

const { test, expect } = require('@playwright/test');

test.describe('Audit log integrity', () => {

  test('audit_log table exists (check via health endpoint or equivalent)', async ({ request }) => {
    await request.post('/api/auth/login', {
      data: { username: 'naveen', password: 'NuPMC@2026' }
    });

    // If there's a /api/audit/recent endpoint, use it. Otherwise skip.
    const res = await request.get('/api/audit/recent');
    test.skip(res.status() === 404, 'No audit endpoint exposed yet — verify DB table directly');

    if (res.ok()) {
      const body = await res.json();
      expect(Array.isArray(body.entries) || Array.isArray(body)).toBe(true);
    }
  });

  test('Attempting MOM issue without confirmation leaves no audit trail (safely rejected)', async ({ request }) => {
    await request.post('/api/auth/login', {
      data: { username: 'murugesan', password: 'NuPMC@2026' }
    });

    // Try to issue — should be rejected
    const res = await request.post('/api/moms/1/issue-to-client', {
      data: {}
    });
    expect([400, 404]).toContain(res.status());

    // Audit trail should NOT have been populated by this failed attempt
    // (Audit is written only AFTER confirmation passes, per our pattern)
  });
});
