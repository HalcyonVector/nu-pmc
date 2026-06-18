// tests/phase3-mom-acknowledgement-migration.test.js
// ============================================================
// Prevent-return: MOM issue-to-client now sends via signoff-gate
// (mom_acknowledgement workflow) instead of WhatsApp.
//
// The gate's 'client_rep' resolver reads clients.matrix_room_id via
// projects.client_id. Personal destination — poll goes to client's
// 1-1 Matrix room. If matrix_room_id is NULL (client not on Element X),
// pollEventId is null and caller falls through to existing fallback.
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'modules/workflow/routes/meetings.js'), 'utf8'
);

describe('MOM issue-to-client — migrated to signoff-gate', () => {
  test('calls triggerSignoff with mom_acknowledgement', () => {
    expect(src).toMatch(/triggerSignoff\(\s*\n?\s*['"]mom_acknowledgement['"]/);
  });

  test('no longer calls waInteractive.sendMOMClientAck', () => {
    expect(src).not.toMatch(/sendMOMClientAck\s*\(/);
  });

  test('no longer registers wa-reply pending actions for MOM ack', () => {
    // The registerPendingAction call for meeting_client_ack must be gone.
    expect(src).not.toMatch(/meeting_client_ack/);
  });

  test('passes project_id so client_rep resolver can find the client', () => {
    // mom.project_id must be passed as the projectId argument
    expect(src).toMatch(/mom\.project_id/);
  });

  test('gate failure is non-blocking', () => {
    expect(src).toMatch(/try \{[\s\S]*signoffGate[\s\S]*\} catch/);
  });
});
