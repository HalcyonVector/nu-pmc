// tests/messaging.test.js
// ============================================================
// Tests for services/messaging.js — verifies channel-resolution rules
// and dispatcher routing to matrix vs whatsapp paths.
// ============================================================

const ORIG_ENV = { ...process.env };

jest.mock('../middleware/db', () => ({
  query: jest.fn(),
}));
jest.mock('../services/matrix-adapter', () => ({
  modeOf: jest.fn(() => 'DRY_RUN'),
  sendText: jest.fn(),
  sendPoll: jest.fn(),
  getProjectRoomId: jest.fn(),
  getInternalRoomId: jest.fn(),
}));
jest.mock('../services/whatsapp', () => ({
  send: jest.fn(),
}));
jest.mock('../services/notif-log', () => ({
  logBoth: jest.fn(() => Promise.resolve(123)),
}));

const db      = require('../middleware/db');
const matrix  = require('../services/matrix-adapter');
const whatsapp = require('../services/whatsapp');
const notifLog = require('../services/notif-log');

function freshMessaging() {
  jest.resetModules();
  jest.doMock('../middleware/db',      () => db);
  jest.doMock('../services/matrix-adapter', () => matrix);
  jest.doMock('../services/whatsapp',  () => whatsapp);
  jest.doMock('../services/notif-log', () => notifLog);
  return require('../services/messaging');
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIG_ENV };
  delete process.env.NOTIFICATIONS;
});

afterAll(() => {
  process.env = ORIG_ENV;
});

describe('messaging — resolveChannels()', () => {
  test('matrix-only when user pref is matrix and matrix_user_id present', () => {
    process.env.NOTIFICATIONS = 'matrix';
    const m = freshMessaging();
    const r = m.resolveChannels({
      notification_channel: 'matrix',
      matrix_user_id: '@user:server',
      phone: '919999999999',
      whatsapp_notifications: 1,
    });
    expect(r).toEqual({ matrix: true, whatsapp: false });
  });

  test('falls back to whatsapp when matrix selected but no matrix_user_id', () => {
    const m = freshMessaging();
    const r = m.resolveChannels({
      notification_channel: 'matrix',
      matrix_user_id: null,
      phone: '919999999999',
      whatsapp_notifications: 1,
    });
    expect(r).toEqual({ matrix: false, whatsapp: true });
  });

  test('both: NOT supported per v2 brief P10.2 — warns and defaults to matrix', () => {
    // v2 brief allows only matrix XOR whatsapp at the env level. The 'both'
    // value is gone — if a stray override hits, we route to matrix (the
    // normal state) and warn. notification_channel column is also dropped
    // (v5.30) so user-pref no longer surfaces 'both'.
    const m = freshMessaging();
    // Pass 'both' as the per-message override — same path that 'both' could
    // historically arrive on.
    const r = m.resolveChannels({
      matrix_user_id: '@user:server',
      phone: '919999999999',
      whatsapp_notifications: 1,
    }, 'both');
    // Falls back to global (= 'matrix' default) → matrix on, whatsapp off.
    expect(r).toEqual({ matrix: true, whatsapp: false });
  });

  test('whatsapp disabled when whatsapp_notifications=0', () => {
    // Override forces whatsapp; capability check disables it because the
    // user opted out of WhatsApp delivery.
    const m = freshMessaging();
    const r = m.resolveChannels({
      matrix_user_id: null,
      phone: '919999999999',
      whatsapp_notifications: 0,
    }, 'whatsapp');
    expect(r).toEqual({ matrix: false, whatsapp: false });
  });

  test('whatsapp disabled when phone is null', () => {
    const m = freshMessaging();
    const r = m.resolveChannels({
      notification_channel: 'whatsapp',
      matrix_user_id: null,
      phone: null,
      whatsapp_notifications: 1,
    });
    expect(r).toEqual({ matrix: false, whatsapp: false });
  });

  test('per-message channel override wins over user pref', () => {
    const m = freshMessaging();
    const r = m.resolveChannels(
      {
        notification_channel: 'whatsapp',
        matrix_user_id: '@user:server',
        phone: '919999999999',
        whatsapp_notifications: 1,
      },
      'matrix'   // override
    );
    expect(r).toEqual({ matrix: true, whatsapp: false });
  });
});

describe('messaging — notifyUser()', () => {
  test('inactive user: returns early with errors', async () => {
    const m = freshMessaging();
    db.query.mockResolvedValueOnce([[{ id: 5, is_active: 0 }]]);
    const r = await m.notifyUser({
      userId: 5, messageType: 'test', body: 'hi',
    });
    expect(r).toEqual({ matrix: false, whatsapp: false, errors: ['user_inactive'] });
    expect(matrix.sendText).not.toHaveBeenCalled();
    expect(whatsapp.send).not.toHaveBeenCalled();
  });

  test('whatsapp path: writes log + sends + updates provider_msg_id', async () => {
    process.env.NOTIFICATIONS = 'whatsapp';
    const m = freshMessaging();
    db.query.mockResolvedValueOnce([[{
      id: 5, full_name: 'Test', phone: '919999999999',
      matrix_user_id: null, notification_channel: 'whatsapp',
      whatsapp_notifications: 1, is_active: 1,
    }]]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);  // provider_msg_id update
    whatsapp.send.mockResolvedValueOnce({ messageId: 'SM_xyz', status: 'queued' });

    const r = await m.notifyUser({
      userId: 5, messageType: 'test', body: 'hello',
    });

    expect(r.whatsapp).toBe(true);
    expect(r.matrix).toBe(false);
    expect(whatsapp.send).toHaveBeenCalledWith({ to: '919999999999', body: 'hello' });
    expect(notifLog.logBoth).toHaveBeenCalledWith(expect.objectContaining({
      userId: 5, messageType: 'test', channel: 'whatsapp',
    }));
  });

  test('matrix path: resolves project room and posts there', async () => {
    process.env.NOTIFICATIONS = 'matrix';
    const m = freshMessaging();
    db.query.mockResolvedValueOnce([[{
      id: 5, full_name: 'Test', phone: '919999999999',
      matrix_user_id: '@u:srv', notification_channel: 'matrix',
      whatsapp_notifications: 1, is_active: 1,
    }]]);
    matrix.getProjectRoomId.mockResolvedValueOnce('!room:srv');
    matrix.sendText.mockResolvedValueOnce({ outboxId: 99, eventId: '$evt', mode: 'DRY_RUN' });

    const r = await m.notifyUser({
      userId: 5, messageType: 'drawing_issued', body: 'Drawing X issued',
      projectId: 7, roomType: 'site',
    });

    expect(r.matrix).toBe(true);
    expect(r.whatsapp).toBe(false);
    expect(matrix.getProjectRoomId).toHaveBeenCalledWith(7, 'site');
    expect(matrix.sendText).toHaveBeenCalledWith(expect.objectContaining({
      roomId: '!room:srv', body: 'Drawing X issued',
    }));
  });

  test('matrix-with-no-room: errors but does NOT throw', async () => {
    process.env.NOTIFICATIONS = 'matrix';
    const m = freshMessaging();
    db.query.mockResolvedValueOnce([[{
      id: 5, full_name: 'Test', phone: null,
      matrix_user_id: '@u:srv', notification_channel: 'matrix',
      whatsapp_notifications: 1, is_active: 1, role: 'site_manager',
    }]]);
    matrix.getProjectRoomId.mockResolvedValueOnce(null);  // no room found

    const r = await m.notifyUser({
      userId: 5, messageType: 't', body: 'hi',
      projectId: 7, roomType: 'site',
    });
    expect(r.matrix).toBe(false);
    expect(r.errors).toContain('no_matrix_room_resolved');
  });

  test('matrix-only pref + room-not-resolved: falls back to WhatsApp if user has phone', async () => {
    // Catches the bug where non-principal/non-finance roles on matrix-only
    // preference would silently drop messages because _internalRoomForRole
    // returns null for them.
    process.env.NOTIFICATIONS = 'matrix';
    const m = freshMessaging();
    db.query.mockResolvedValueOnce([[{
      id: 5, full_name: 'Pmc Head', phone: '919999999999',
      matrix_user_id: '@pmc:srv', notification_channel: 'matrix',
      whatsapp_notifications: 1, is_active: 1, role: 'pmc_head',
    }]]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);  // provider_msg_id update
    matrix.getProjectRoomId.mockResolvedValueOnce(null);  // no room
    whatsapp.send.mockResolvedValueOnce({ messageId: 'SM_fallback', status: 'queued' });

    const r = await m.notifyUser({
      userId: 5, messageType: 't', body: 'hi',
      projectId: 7, roomType: 'site',
    });

    // Matrix attempt failed, but WhatsApp picked up
    expect(r.matrix).toBe(false);
    expect(r.whatsapp).toBe(true);
    expect(r.errors).toContain('no_matrix_room_resolved');
    expect(whatsapp.send).toHaveBeenCalledWith({ to: '919999999999', body: 'hi' });
  });

  test('matrix-only pref + room-not-resolved + no phone: drops without error', async () => {
    // The legitimate drop case — user has no phone, no fallback possible.
    process.env.NOTIFICATIONS = 'matrix';
    const m = freshMessaging();
    db.query.mockResolvedValueOnce([[{
      id: 5, full_name: 'Phoneless', phone: null,
      matrix_user_id: '@u:srv', notification_channel: 'matrix',
      whatsapp_notifications: 0, is_active: 1, role: 'site_manager',
    }]]);
    matrix.getProjectRoomId.mockResolvedValueOnce(null);

    const r = await m.notifyUser({
      userId: 5, messageType: 't', body: 'hi',
      projectId: 7, roomType: 'site',
    });
    expect(r.matrix).toBe(false);
    expect(r.whatsapp).toBe(false);
    expect(whatsapp.send).not.toHaveBeenCalled();
  });
});

describe('messaging — notifyRoom()', () => {
  test('skipped when global channel is whatsapp', async () => {
    process.env.NOTIFICATIONS = 'whatsapp';
    const m = freshMessaging();
    const r = await m.notifyRoom({ projectId: 1, roomType: 'site', body: 'x' });
    expect(r.matrix).toBe(false);
    expect(r.errors).toContain('global_channel_is_whatsapp');
    expect(matrix.sendText).not.toHaveBeenCalled();
  });

  test('posts to resolved room when matrix is enabled', async () => {
    process.env.NOTIFICATIONS = 'matrix';
    const m = freshMessaging();
    matrix.getProjectRoomId.mockResolvedValueOnce('!finance:srv');
    matrix.sendText.mockResolvedValueOnce({ outboxId: 1, eventId: null, mode: 'DRY_RUN' });
    const r = await m.notifyRoom({ projectId: 5, roomType: 'finance', body: 'hi' });
    expect(r.matrix).toBe(true);
  });
});

describe('messaging — pollRoom()', () => {
  test('whatsapp-only mode: returns polls_only_via_matrix error', async () => {
    process.env.NOTIFICATIONS = 'whatsapp';
    const m = freshMessaging();
    const r = await m.pollRoom({
      projectId: 1, roomType: 'site',
      question: 'Approve?', answers: [{id:'y',text:'yes'},{id:'n',text:'no'}],
    });
    expect(r.matrix).toBe(false);
    expect(r.errors).toContain('polls_only_via_matrix');
  });

  test('matrix mode: dispatches to matrix.sendPoll', async () => {
    process.env.NOTIFICATIONS = 'matrix';
    const m = freshMessaging();
    matrix.getProjectRoomId.mockResolvedValueOnce('!r:srv');
    matrix.sendPoll.mockResolvedValueOnce({ outboxId: 7, eventId: null, mode: 'DRY_RUN' });
    const r = await m.pollRoom({
      projectId: 1, roomType: 'site',
      question: 'Approve?', answers: [{id:'y',text:'yes'},{id:'n',text:'no'}],
    });
    expect(r.matrix).toBe(true);
    expect(r.outboxId).toBe(7);
  });
});
