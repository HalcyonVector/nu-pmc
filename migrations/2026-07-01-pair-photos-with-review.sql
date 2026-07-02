-- Pair the "Photos" tab with the "Photo Review" tab.
--
-- "Photo Review" (tab_key = phototags) lets a role tag/review site photos, but
-- that is redundant without the "Photos" tab (tab_key = photos) to actually see
-- the photos uploaded by site managers. On the live DB, services_engineer,
-- jr_engineer and jr_architect had Photo Review but no visible Photos tab.
--
-- This restores the pairing: for every role that can see Photo Review, ensure a
-- visible Photos tab exists in the SAME bucket, placed right after it.
-- Idempotent: re-running is a no-op.

-- 1. Un-hide a Photos tab that exists but is hidden, for any Photo-Review role.
UPDATE role_nav p
  JOIN role_nav pt ON pt.role = p.role AND pt.tab_key = 'phototags' AND pt.is_visible = 1
   SET p.is_visible = 1, p.updated_at = NOW()
 WHERE p.tab_key = 'photos' AND p.is_visible = 0;

-- 2. Insert a Photos tab for any Photo-Review role that has no Photos row at all.
INSERT INTO role_nav (role, bucket, tab_key, sort_order, is_visible, updated_at)
SELECT pt.role, pt.bucket, 'photos', pt.sort_order + 1, 1, NOW()
  FROM role_nav pt
 WHERE pt.tab_key = 'phototags' AND pt.is_visible = 1
   AND NOT EXISTS (SELECT 1 FROM role_nav p WHERE p.role = pt.role AND p.tab_key = 'photos');
