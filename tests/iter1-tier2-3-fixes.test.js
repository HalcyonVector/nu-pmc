// tests/iter1-tier2-3-fixes.test.js
// Static checks that pin the Tier 2 + Tier 3 fixes from the discipline-mode
// audit. These are NOT functional tests — they're prevent-return guards that
// fail if the fix is reverted.

'use strict';
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('Tier 2 — env reads at call time (P-α)', () => {
  test('messaging.js uses _globalChannel(), not module-level GLOBAL_CHANNEL', () => {
    const src = read('services/messaging.js');
    expect(src).toMatch(/function _globalChannel\(\)/);
    // No module-level const reading the env directly
    expect(src).not.toMatch(/^const GLOBAL_CHANNEL\s*=\s*\(?process\.env/m);
  });

  test('notifications.js does not cache TWILIO_* at module-load', () => {
    const src = read('services/notifications.js');
    expect(src).not.toMatch(/^const TWILIO_ACCOUNT_SID\s*=/m);
    expect(src).not.toMatch(/^const TWILIO_AUTH_TOKEN\s*=/m);
  });

  test('whatsapp-interactive.js uses _from() / _baseUrl() helpers', () => {
    const src = read('services/whatsapp-interactive.js');
    expect(src).toMatch(/function _from\(\)/);
    expect(src).toMatch(/function _baseUrl\(\)/);
    expect(src).not.toMatch(/^const FROM\s*=\s*process\.env/m);
    expect(src).not.toMatch(/^const BASE_URL\s*=\s*process\.env/m);
  });

  test('whatsapp.js uses _provider() helper', () => {
    const src = read('services/whatsapp.js');
    expect(src).toMatch(/function _provider\(\)/);
    expect(src).not.toMatch(/^const PROVIDER\s*=\s*process\.env/m);
  });

  test('ai.js uses _provider() / _model() / _modelHeavy()', () => {
    const src = read('services/ai.js');
    expect(src).toMatch(/function _provider\(\)/);
    expect(src).toMatch(/function _model\(\)/);
    expect(src).toMatch(/function _modelHeavy\(\)/);
    expect(src).not.toMatch(/^const PROVIDER\s*=\s*process\.env/m);
    expect(src).not.toMatch(/^const MODEL\s*=\s*process\.env/m);
  });

  test('email.js uses _provider() / _from() / _fromName()', () => {
    const src = read('services/email.js');
    expect(src).toMatch(/function _provider\(\)/);
    expect(src).not.toMatch(/^const PROVIDER\s*=\s*process\.env/m);
  });

  test('payment-format.js uses _bank() helper; currentBank export is a function', () => {
    const src = read('services/payment-format.js');
    expect(src).toMatch(/function _bank\(\)/);
    expect(src).not.toMatch(/^const BANK\s*=\s*process\.env/m);
    // currentBank is exported as the function, not a captured string
    expect(src).toMatch(/currentBank: _bank/);
  });

  test('modules/system/routes/whatsapp.js uses _twilio() helper', () => {
    const src = read('modules/system/routes/whatsapp.js');
    expect(src).toMatch(/function _twilio\(\)/);
    expect(src).not.toMatch(/^const TWILIO_ACCOUNT_SID\s*=\s*process\.env/m);
    expect(src).not.toMatch(/^const TWILIO_AUTH_TOKEN\s*=\s*process\.env/m);
    expect(src).not.toMatch(/^const TWILIO_WA_NUMBER\s*=\s*process\.env/m);
  });
});

describe('Tier 3 — bug fixes', () => {
  test('B11: whatsapp.js routes To: through buildTwilioRecipient', () => {
    const src = read('services/whatsapp.js');
    expect(src).toMatch(/buildTwilioRecipient/);
    // Defensive null check on unparseable phone
    expect(src).toMatch(/Unparseable WhatsApp recipient/);
    // The actual To: assignment uses the helper, not an inline ternary
    expect(src).toMatch(/To:\s+toRecipient/);
  });

  test('B4: notification_triggers query filters by is_active=1', () => {
    const src = read('services/notifications.js');
    expect(src).toMatch(/FROM notification_triggers WHERE event_key = \? AND is_active = 1/);
  });

  test('B8: vendor-onboarding exports humanReadableValidity', () => {
    const src = read('services/vendor-onboarding.js');
    expect(src).toMatch(/function humanReadableValidity\(\)/);
    expect(src).toMatch(/humanReadableValidity[,\s}]/);  // in exports
  });

  test('B8: wa-link.buildOnboardLink interpolates dynamic validity', () => {
    const src = read('services/wa-link.js');
    expect(src).toMatch(/humanReadableValidity\(\)/);
    expect(src).toMatch(/\(valid \$\{validity\}\)/);
  });

  test('B8: vendor-public.js uses humanReadableValidity in expired-page', () => {
    const src = read('modules/onboarding/routes/vendor-public.js');
    expect(src).toMatch(/humanReadableValidity\(\)/);
    expect(src).not.toMatch(/are valid for 48 hours/);
  });

  test('B8: onboard-link route returns validity in response', () => {
    const src = read('modules/onboarding/routes/vendors.js');
    expect(src).toMatch(/validity:\s*require.*humanReadableValidity\(\)/);
  });

  test('B8: app.js toast uses res.validity from API response', () => {
    const src = read('public/js/app.js');
    expect(src).toMatch(/Link valid \$\{validity\}/);
    expect(src).toMatch(/res\.validity/);
  });

  test('S-7: notifications.js no longer references AiSensy', () => {
    const src = read('services/notifications.js');
    expect(src.toLowerCase()).not.toMatch(/aisensy\.com/);
    // Per Principal — replaced by Twilio via services/whatsapp
    expect(src).toMatch(/sendOTP/);
  });
});

describe('B6: WhatsApp interactive senders dropped unused (to, phone, ...) → (phone, ...)', () => {
  test('signatures no longer take leading `to` arg', () => {
    const src = read('services/whatsapp-interactive.js');
    expect(src).not.toMatch(/^async function sendGRNApproval\(to,/m);
    expect(src).not.toMatch(/^async function sendIssueConfirm\(to,/m);
    expect(src).not.toMatch(/^async function sendVendorDefectAck\(to,/m);
    expect(src).not.toMatch(/^async function sendUrgentPaymentFYI\(to,/m);
    expect(src).not.toMatch(/^async function sendMOMClientAck\(to,/m);
    expect(src).not.toMatch(/^async function sendAnomalyAlert\(to,/m);
  });

  test('callers updated to drop user.id arg', () => {
    // All callers migrated to services/signoff-gate (Phase 3).
    // meetings.js MOM ack now uses triggerSignoff('mom_acknowledgement', ...)
    // — the sendMOMClientAck call is gone. B6 is fully resolved.
    const mtg = read('modules/workflow/routes/meetings.js');
    expect(mtg).not.toMatch(/sendMOMClientAck\s*\(/);
    expect(mtg).toMatch(/triggerSignoff[\s\S]*mom_acknowledgement/);
  });
});
