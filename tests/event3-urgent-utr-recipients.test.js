// tests/event3-urgent-utr-recipients.test.js
// Prevent-return: urgent UTR alert posts to project internal Matrix room.
// Originally sent WhatsApp to PMC + senior site managers individually.
// Now posts once to the project's internal community room — smaller code,
// same reach (everyone in the room sees it).
'use strict';
const fs   = require('fs');
const path = require('path');
const src  = fs.readFileSync(
  path.join(__dirname, '..', 'modules/finance/routes/payments.js'), 'utf8'
);

describe('Event 3 — urgent UTR alert migrated to Matrix project room', () => {
  test('urgent branch calls getProjectRoomId for internal room', () => {
    const branch = src.match(/if \(payment\.is_urgent\)[\s\S]+?(?=\} else)/);
    expect(branch).not.toBeNull();
    expect(branch[0]).toMatch(/getProjectRoomId/);
    expect(branch[0]).toMatch(/internal/);
  });

  test('urgent branch does NOT use wa.send', () => {
    const branch = src.match(/if \(payment\.is_urgent\)[\s\S]+?(?=\} else)/);
    expect(branch[0]).not.toMatch(/wa\.send/);
  });

  test('urgent branch posts to project room via sendText', () => {
    const branch = src.match(/if \(payment\.is_urgent\)[\s\S]+?(?=\} else)/);
    expect(branch[0]).toMatch(/sendText/);
  });
});
