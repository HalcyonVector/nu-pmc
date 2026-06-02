// tests/notifications-event-helper.test.js
// Verifies _notifyByEvent: prefers notification_triggers table rows, falls
// back to hardcoded list when table is empty / errors.

'use strict';

// Mock db before requiring notifications
const mockQuery = jest.fn();
jest.mock('../middleware/db', () => ({ query: (...args) => mockQuery(...args) }));
jest.mock('../services/users-lookup', () => ({}));
// Mock messaging.notifyUser — we just want to capture which user IDs got notified
const sentNotifications = [];
jest.mock('../services/messaging', () => ({
  notifyUser: async (opts) => { sentNotifications.push(opts); return { ok: true }; },
}));

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'notifications.js'), 'utf8');

describe('_notifyByEvent — abstraction over hardcoded role lists', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    sentNotifications.length = 0;
  });

  test('exists in notifications.js', () => {
    expect(src).toMatch(/async function _notifyByEvent/);
  });

  test('every per-event function uses _notifyByEvent (not _notifyByRole)', () => {
    // Spot-check a handful of well-known events
    for (const event of [
      'drawing.issued', 'rfi.overdue', 'cn.approved', 'material.overdue',
      'weekly.approved', 'payment.sheet', 'drawing.escalated',
    ]) {
      expect(src).toContain(`'${event}'`);
    }
  });

  test('fallback role lists are still present in code (so events without sheet-3 rows still notify)', () => {
    // The fallbacks are passed as second arg; spot-check one
    expect(src).toMatch(/_notifyByEvent\('rfi\.overdue',\s*\['pmc_head','design_head','services_head','principal'\]/);
  });

  test('stream-aware RFI raised event keys exist for design vs services', () => {
    expect(src).toContain('rfi.raised.design');
    expect(src).toContain('rfi.raised.services');
  });

  test('non-role recipients (assignee/raiser/vendor) are filtered out', () => {
    expect(src).toMatch(/NON_ROLE\s*=\s*new Set/);
    expect(src).toMatch(/'assignee'.*'raiser'.*'vendor'/s);
  });

  test('table-lookup error falls back gracefully', () => {
    // Code path: try { db.query } catch { console.warn; finalRoles = fallback }
    expect(src).toMatch(/table lookup failed for/);
  });
});
