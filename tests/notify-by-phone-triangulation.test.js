// tests/notify-by-phone-triangulation.test.js
// ============================================================
// Prevent-return guard for the May 2026 Matrix migration's
// phone→userId triangulation in services/notifications.js.
//
// Background: Matrix migration kept caller signatures as `phone`
// (no churn at 50+ call sites). Inside notifications.js, helpers
// route through _notifyByPhone, which:
//   1. Looks up users.id from phone (with normalisation)
//   2. If a user matches → notify(userId, ...) which uses Matrix
//   3. If no user matches → external recipient, route via WA bridge
//
// This test pins the contract: a known phone resolves to its userId
// AND notify() (the messaging-routed path) gets called — not the
// legacy direct WhatsApp send.
// ============================================================

'use strict';

jest.mock('../middleware/db', () => ({
  query: jest.fn(),
}));

jest.mock('../services/messaging', () => ({
  notifyUser: jest.fn(),
  notifyExternal: jest.fn(),
}));

jest.mock('../services/whatsapp', () => ({
  send: jest.fn(),
}));

const db        = require('../middleware/db');
const messaging = require('../services/messaging');
const wa        = require('../services/whatsapp');
const notifs    = require('../services/notifications');

beforeEach(() => {
  db.query.mockReset();
  messaging.notifyUser.mockReset();
  messaging.notifyExternal.mockReset();
  wa.send.mockReset();
});

describe('_notifyByPhone triangulation (Matrix migration May 2026)', () => {
  test('phone matching a users row routes via messaging.notifyUser (Matrix path)', async () => {
    db.query.mockResolvedValueOnce([[{ id: 42 }]]);   // user lookup hit
    messaging.notifyUser.mockResolvedValue({ matrix: true, errors: [] });

    await notifs.notifyUserActivated('919876543210', 'newuser', 'pwd123');

    // Matrix-routed call happened
    expect(messaging.notifyUser).toHaveBeenCalledTimes(1);
    expect(messaging.notifyUser.mock.calls[0][0]).toMatchObject({
      userId: 42, messageType: 'user_activated',
    });

    // Legacy WhatsApp direct send did NOT fire
    expect(wa.send).not.toHaveBeenCalled();
    // External-recipient path also did NOT fire
    expect(messaging.notifyExternal).not.toHaveBeenCalled();
  });

  test('phone with no matching user creates external comm assignment', async () => {
    db.query
      .mockResolvedValueOnce([[]])    // no user matches phone
      .mockResolvedValueOnce([[{ responsible_role: 'finance_admin', due_hours: 4, label: 'Test' }]]) // external_comm_config
      .mockResolvedValueOnce([[{ id: 5, full_name: 'Finance Admin', matrix_room_id: null }]])        // _resolveResponsible
      .mockResolvedValueOnce([{ insertId: 99 }]);  // INSERT external_comm_assignments

    await notifs.notifyUserActivated('919999999999', 'extuser', 'pwd');

    // userId-based path did NOT fire
    expect(messaging.notifyUser).not.toHaveBeenCalled();
    // Legacy wa.send did NOT fire
    expect(wa.send).not.toHaveBeenCalled();
  });

  test('lookup query checks both raw and normalised phone forms', async () => {
    // Caller uses the formatted form '+91 98765 43210', stored in DB as
    // '919876543210'. The lookup must match both shapes.
    db.query.mockResolvedValueOnce([[{ id: 7 }]]);
    messaging.notifyUser.mockResolvedValue({ matrix: true, errors: [] });

    await notifs.notifyUserActivated('+91 98765 43210', 'u', 'p');

    const sql = db.query.mock.calls[0][0];
    const params = db.query.mock.calls[0][1];
    expect(sql).toMatch(/phone = \?\s*OR\s*phone = \?/);
    // First param is the raw form, second is the normalised form
    expect(params[0]).toBe('+91 98765 43210');
    expect(params[1]).toBe('919876543210');
  });

  test('inactive user is skipped (is_active=1 filter)', async () => {
    // Phone matches an inactive user → lookup returns no row → external path
    db.query.mockResolvedValueOnce([[]]);
    messaging.notifyExternal.mockResolvedValue({ ok: true });

    await notifs.notifyUserActivated('919876543210', 'u', 'p');

    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/is_active = 1/);
  });

  test('notifyUserCreated requires tempPassword (no default-password leak)', async () => {
    await notifs.notifyUserCreated('919876543210', 'newuser', null);
    expect(db.query).not.toHaveBeenCalled();
    expect(messaging.notifyUser).not.toHaveBeenCalled();
    expect(wa.send).not.toHaveBeenCalled();
  });

  test('missing phone is a no-op (does not throw)', async () => {
    await expect(
      notifs.notifyUserActivated(null, 'u', 'p')
    ).resolves.toBeUndefined();
    expect(db.query).not.toHaveBeenCalled();
  });
});
