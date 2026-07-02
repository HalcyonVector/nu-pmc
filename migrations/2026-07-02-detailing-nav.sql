-- The detailing role had NO role_nav rows, so a detailing user was rejected at
-- login (auth.js 403s any role with zero visible nav). Seed its strip-bucket
-- nav (drawings, submittals), matching the intended detailing surface from the
-- original install snapshot. Its permissions come from the Detailing tab in the
-- governance sheet, loaded by scripts/load-governance-sheets.js.
--
-- Idempotent: re-running is a no-op once the rows exist.

INSERT INTO role_nav (role, bucket, tab_key, sort_order, is_visible, updated_at)
SELECT r.role, r.bucket, r.tab_key, r.sort_order, 1, NOW()
  FROM (SELECT 'detailing' AS role, 'strip' AS bucket, 'drawings' AS tab_key, 1 AS sort_order
        UNION SELECT 'detailing', 'strip', 'submittals', 2) r
 WHERE NOT EXISTS (
   SELECT 1 FROM role_nav rn
    WHERE rn.role = r.role AND rn.tab_key = r.tab_key AND rn.bucket = r.bucket
 );
