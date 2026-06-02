// tests/phase3-mom-ack-migration.test.js
// Prevent-return: MOM client acknowledgement migrated from WhatsApp to signoff-gate.
'use strict';
const fs   = require('fs');
const path = require('path');
const src  = fs.readFileSync(
  path.join(__dirname, '..', 'modules/workflow/routes/meetings.js'), 'utf8'
);

describe('Phase 3 — MOM acknowledgement migrated to signoff-gate', () => {
  test('calls triggerSignoff with mom_acknowledgement', () => {
    expect(src).toMatch(/triggerSignoff\(\s*\n?\s*['"]mom_acknowledgement['"]/);
  });

  test('does NOT call sendMOMClientAck', () => {
    expect(src).not.toMatch(/sendMOMClientAck\s*\(/);
  });

  test('does NOT call registerPendingAction for MOM', () => {
    expect(src).not.toMatch(/registerPendingAction[\s\S]{0,200}meeting_client_ack/);
  });

  test('WhatsApp guard (NO_CLIENT_WHATSAPP) removed', () => {
    expect(src).not.toMatch(/NO_CLIENT_WHATSAPP/);
  });

  test('audit details no longer include recipient_whatsapp', () => {
    expect(src).not.toMatch(/recipient_whatsapp/);
  });

  test('response message does not reference WhatsApp', () => {
    // Find only the res.json call in the issue-to-client route
    const routeBlock = src.slice(
      src.indexOf("'/:id/issue-to-client'"),
      src.indexOf("'/:id/reissue'")
    );
    // The res.json message strings must not mention WhatsApp or contact_whatsapp
    const jsonBlock = routeBlock.slice(routeBlock.lastIndexOf('res.json('));
    expect(jsonBlock).not.toMatch(/WhatsApp|contact_whatsapp/);
  });
});
