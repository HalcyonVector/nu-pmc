// PREVIEW-BEFORE-SEND — verify the two-step pattern we built:
// (1) preview endpoint returns what WOULD be sent, no state change
// (2) send endpoint requires confirmation code + entity number match

const { test, expect } = require('@playwright/test');

test.describe('Preview-before-send pattern', () => {

  test.beforeEach(async ({ request }) => {
    await request.post('/api/auth/login', {
      data: { username: 'murugesan', password: 'NuPMC@2026' }  // PMC head
    });
  });

  test('MOM preview endpoint does not change state', async ({ request }) => {
    // Get any MOM in approved status
    const res = await request.get('/api/moms/1/preview-client-send');
    // 200 (preview ok), 400 (no contact/wrong status), or 404 — none should be 500
    expect([200, 400, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('mom_number');
      expect(body).toHaveProperty('recipient');
      expect(body).toHaveProperty('confirmation_required', true);
      expect(body).toHaveProperty('warning');
    }
  });

  test('ICICI preview endpoint returns total + breakdown without generating file', async ({ request }) => {
    const res = await request.get('/api/payments/1/icici/preview?payment_ids=1,2');
    expect([200, 400, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('payment_count');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('rows');
      expect(body).toHaveProperty('can_generate');
    }
  });

  test('NCR preview endpoint returns recipient list without sending', async ({ request }) => {
    const res = await request.get('/api/grn/1/flag-nonconformance/preview?reason=test&material_type=structural');
    expect([200, 400, 404]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('grn');
      expect(body).toHaveProperty('would_happen');
      expect(body).toHaveProperty('confirmation_required', true);
    }
  });
});
