// services/password-policy.js
// Single source of truth for password rules.
// Called from:
//   - routes/auth.js /change-password  (user self-change)
//   - routes/auth.js /reset-password   (admin sets temp for another user)
//   - routes/whatsapp.js /verify-otp   (WhatsApp OTP → new password)
// Mirrored client-side in public/js/app.js submitChangePassword for fast UX,
// but the server-side check is the authority.

// Blocklist — top breached passwords + nu-specific known defaults.
// Case-insensitive match. Add to this list when incidents surface.
const BLOCKLIST = new Set([
  // Top-50 from published breach corpora
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  '12345678', '123456789', '1234567890', 'qwerty', 'qwerty123', 'qwertyuiop',
  'abc12345', 'abcd1234', 'admin123', 'administrator', 'login123',
  'welcome', 'welcome1', 'welcome123', 'welcome@123', 'welcome@1',
  'iloveyou', 'iloveyou1', 'princess', 'sunshine', 'monkey', 'dragon',
  'qazwsx', 'trustno1', 'letmein', 'letmein1', 'master', 'superman',
  'football', 'cricket', 'baseball', 'hello123', 'helloworld',
  'changeme', 'changeme1', 'changeme123', 'default', 'default1',
  'temporary', 'temppass', 'temp1234', 'newpass1', 'mypass123',
  // India-common
  'india123', 'bharat123', 'hindustan',
  // nu-specific defaults historically in use — NEVER allow these again
  'nupmc@2026', 'nupmc2026', 'nuassociates', 'nuassociates1',
  'naveen123', 'ajay123', 'udupa123',
  // Months + years combinations attackers try
  'january2026', 'february2026', 'march2026', 'april2026',
  'summer2026', 'winter2026', 'monsoon2026',
  'bengaluru', 'bengaluru1', 'bangalore', 'bangalore1',
]);

/**
 * validate(newPassword, { username })
 * @returns {{ok:true} | {ok:false, error:string}}
 */
function validate(newPassword, { username } = {}) {
  if (!newPassword || typeof newPassword !== 'string') {
    return { ok: false, error: 'Password is required' };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' };
  }
  if (newPassword.length > 128) {
    return { ok: false, error: 'Password must be at most 128 characters' };
  }
  if (!/[a-z]/.test(newPassword)) {
    return { ok: false, error: 'Password must contain a lowercase letter' };
  }
  if (!/[A-Z]/.test(newPassword)) {
    return { ok: false, error: 'Password must contain an uppercase letter' };
  }
  if (!/[0-9]/.test(newPassword)) {
    return { ok: false, error: 'Password must contain a digit' };
  }

  const lower = newPassword.toLowerCase();
  if (BLOCKLIST.has(lower)) {
    return { ok: false, error: 'Password is too common. Pick something unique.' };
  }

  // Username checks — exact match always rejected; "contains" only for usernames ≥4 chars
  // (shorter usernames like "ak" would cause too many false-positive rejections).
  if (username) {
    const u = String(username).toLowerCase().trim();
    if (u && lower === u) {
      return { ok: false, error: 'Password cannot be the same as your username' };
    }
    if (u.length >= 4 && lower.includes(u)) {
      return { ok: false, error: 'Password cannot contain your username' };
    }
  }

  return { ok: true };
}

// Human-readable rules — shown in the UI alongside the input fields.
const RULES = [
  'At least 8 characters',
  'Contains a lowercase letter',
  'Contains an uppercase letter',
  'Contains a digit',
  'Not on the common-passwords blocklist',
  'Does not contain your username',
];

module.exports = { validate, RULES, BLOCKLIST };
