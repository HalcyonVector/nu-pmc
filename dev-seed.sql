-- dev-seed.sql
-- LOCAL TESTING ONLY. Do not run on production.
-- Adds user1 / Start@123 for the dev role switcher.
-- Disable by setting NODE_ENV=production in .env

-- bcrypt hash of 'Start@123' (cost 10)
INSERT INTO users (username, password_hash, full_name, role, is_active, force_password_change)
VALUES ('user1', '$2a$12$WR1J/znsNn5M64XBVHCfOOcV.U4BbdLXzZCLr/D5fp2CcaKixS0W.', 'Dev Tester', 'principal', 1, 0)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  is_active = 1,
  force_password_change = 0;

SELECT 'Dev user ready. Login: user1 / Start@123 at /api/auth/dev-login' AS status;

update users set password_hash='$2a$12$WR1J/znsNn5M64XBVHCfOOcV.U4BbdLXzZCLr/D5fp2CcaKixS0W.' where id>0;