-- scripts/reset-all-passwords-to-default.sql
-- ============================================================
-- Sets EVERY user's password to 'Start@123' and forces a password change on
-- next login. Run against the live DB (e.g. `mysql nu_pmc < this_file.sql`).
--
-- The hash below is bcrypt (cost 10) of 'Start@123'. bcrypt salts are random
-- and embedded in the hash, so this single value validates for all users via
-- bcrypt.compare at login time.
--
-- Prefer scripts/reset-all-passwords-to-default.js when possible — it
-- generates a fresh hash itself and reads DB config from .env.
-- ============================================================

UPDATE users
   SET password_hash         = '$2a$10$00EPTADBbGzOCkVA6Fc4k.KJLzVA1FRjp1hfq0J7CeW7aVS0KUJwW',
       force_password_change = 1,
       temp_password         = NULL,
       login_count           = 0;

-- Verify (optional):
-- SELECT id, username, role, force_password_change, login_count FROM users ORDER BY id;
