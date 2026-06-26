// services/wa-link.js
// ============================================================
// wa.me deep-link URL generator.
//
// wa.me URLs let an internal user tap a button that opens WhatsApp
// (mobile app or web) pre-populated with a message to a specific number.
// Used to send vendors / clients a tokenised onboarding or confirmation
// link they can act on without us paying Twilio/AiSensy fees.
//
// Spec: https://faq.whatsapp.com/5913398998672934
//   - URL form: https://wa.me/<phone>?text=<urlencoded-message>
//   - phone: digits only, country code, no leading +
//   - text:  URL-encoded
//
// Example output:
//   https://wa.me/919876543210?text=Hi%20Acme%20%E2%80%94%20please%20confirm%20your%20bank%20details%3A%20https%3A%2F%2Fnuassociates.in%2Fvendor-onboard%2Fab12cd34
//
// ⚠ wa.me does NOT send messages — it deep-links to WhatsApp. The internal
//   user MUST tap "Send" themselves. This is an intentional human-in-the-loop:
//   they verify the destination phone before transmission.
// ============================================================

'use strict';

/**
 * Normalise a phone number for wa.me. Accepts:
 *   "+919876543210"        → "919876543210"
 *   "919876543210"         → "919876543210"
 *   " +91 98765 43210 "    → "919876543210"
 *   "98765 43210"          → assumes Indian default "919876543210"
 *
 * Returns null if the result isn't a sensible phone (under 10 digits or
 * over 15). Caller decides whether null is fatal.
 */
function normalisePhone(raw) {
  if (!raw) return null;
  // Strip everything that isn't a digit
  let digits = String(raw).replace(/\D+/g, '');
  if (digits.length === 0) return null;
  // Drop leading zeros — handles two real input patterns:
  //   "0 98765 43210"     → legacy Indian STD prefix (national-direct dial)
  //   "00919876543210"    → European-style international prefix (00 = +)
  // Without this, wa.me sees a leading 0 and fails to route.
  digits = digits.replace(/^0+/, '');
  if (digits.length === 0) return null;
  // Indian default: 10 digits → assume +91 prefix
  // (production data has many entries without country code).
  if (digits.length === 10) digits = '91' + digits;

  // B10 fix: strip embedded trunk-prefix 0 after a country code.
  // Inputs like "+91 0 98765 43210" or "+44 (0) 207 123 4567" yield
  // digits "9109876543210" / "4402071234567" which break wa.me. We
  // recognise the two country codes that are relevant to nu Associates'
  // data (India, UK) and remove the trunk 0 immediately following.
  // 91 → 12 digits without trunk-0, 13 with → strip the 0.
  // 44 → 12 digits without trunk-0, 13 with → strip the 0.
  if (digits.length === 13 && digits.startsWith('910'))  digits = '91' + digits.slice(3);
  if (digits.length === 13 && digits.startsWith('440'))  digits = '44' + digits.slice(3);

  // Sanity bounds — international E.164 max is 15 digits
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/**
 * Build a wa.me URL.
 *
 * @param {object} opts
 * @param {string} opts.phone   raw phone (any format)
 * @param {string} opts.message human message body — will be URL-encoded
 * @returns {string|null}        wa.me URL, or null if phone unparseable
 */
function buildLink({ phone, message = '' }) {
  const num = normalisePhone(phone);
  if (!num) return null;
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${num}?text=${encoded}`;
}

/**
 * Build a wa.me URL for a vendor onboarding token.
 *
 * @param {object} opts
 * @param {string} opts.phone     vendor's WhatsApp phone
 * @param {string} opts.vendorName   for the message preamble
 * @param {string} opts.tokenUrl   full URL the vendor should open
 *                                  (e.g. https://nuassociates.in/vendor-onboard/abc123)
 * @param {string} [opts.purpose]   'bank_confirm' | 'onboard' | 're_validation'
 * @returns {string|null}
 */
function buildOnboardLink({ phone, vendorName, tokenUrl, purpose = 'onboard' }) {
  // Validity string sourced from vendor-onboarding so it tracks env-driven
  // VENDOR_TOKEN_HOURS. Previously hardcoded "valid 48h" in 3 messages —
  // would lie if the env was changed. Lazy require avoids circular import
  // (services/vendor-onboarding.js loads this module's normalisePhone too).
  let validity = '48h';
  try { validity = require('./vendor-onboarding').humanReadableValidity(); }
  catch (_) { /* fallback to default */ }
  const preamble = {
    bank_confirm:   `Hi ${vendorName} — nu Associates needs to update your payment details. Please confirm by tapping this link (valid ${validity}):`,
    onboard:        `Hi ${vendorName} — nu Associates is onboarding you as a vendor. Please verify your details (valid ${validity}):`,
    re_validation:  `Hi ${vendorName} — nu Associates is migrating to a new payments process. Please re-confirm your details (valid ${validity}):`,
  };
  const message = `${preamble[purpose] || preamble.onboard} ${tokenUrl}`;
  return buildLink({ phone, message });
}

/**
 * Build a Twilio WhatsApp recipient string ("whatsapp:+CCNNN…").
 *
 * Accepts either:
 *   - A raw phone in any format (delegates to normalisePhone)
 *   - An already-formatted Twilio recipient ("whatsapp:+91…"); passes through
 *
 * Returns null if the raw phone cannot be parsed — caller decides if fatal.
 *
 * Created to replace the in-line `'whatsapp:+91' + toStr.replace(/\D/g,'')`
 * pattern that existed in services/whatsapp-interactive.js, which silently
 * produced broken numbers for inputs with leading 0 / 00 / +91 prefixes.
 */
function buildTwilioRecipient(raw) {
  if (!raw) return null;
  const s = String(raw);
  if (s.startsWith('whatsapp:')) return s;
  const digits = normalisePhone(s);
  if (!digits) return null;
  return 'whatsapp:+' + digits;
}

/**
 * buildWaMe({ phone, body }) → wa.me URL
 *
 * Generates a tap-to-open WhatsApp link pre-filled with the message body.
 * The assigned person taps this link, WhatsApp opens with the message ready
 * to send. They hit Send, come back to the PWA, and mark it sent.
 *
 * No Twilio. No automated send. Intentional friction — creates incentive
 * to onboard the vendor to Matrix.
 */
function buildWaMe({ phone, body }) {
  const digits = normalisePhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

module.exports = {
  normalisePhone,
  buildLink,
  buildOnboardLink,
  buildTwilioRecipient,
  buildWaMe,
};
