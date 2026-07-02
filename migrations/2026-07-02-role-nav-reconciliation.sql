-- ============================================================================
-- CONSOLIDATED role_nav reconciliation — 2026-07-02
-- ============================================================================
-- Single, idempotent, deterministic migration that reconciles the role_nav
-- table with the features actually implemented in the app dispatcher. It
-- SUPERSEDES the five individual nav migrations produced during the audit:
--
--   2026-07-02-measurements-nav.sql
--   2026-07-02-handover-nav-senior-roles.sql
--   2026-07-01-hide-work-tab-principals.sql
--   2026-07-02-dedupe-reports-nav.sql
--   2026-07-01-pair-photos-with-review.sql
--
-- Running this file once brings a fresh DB to the same end state as applying
-- all five. It is safe to re-run (every statement is idempotent) and does not
-- depend on execution order beyond what is enforced inline below.
--
-- Schema assumed (live): role_nav(role, bucket, tab_key, sort_order,
-- is_visible, updated_at). NOTE: the older add-pmc-petty-cash-nav.sql uses a
-- different column set (tab_group/is_active) and is intentionally NOT folded in
-- here — it targets a different schema revision.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MEASUREMENTS — orphaned feature (in dispatcher, absent from role_nav).
--    Surface under "More" for every role in the measurement lifecycle:
--      record/create sheet : pmc_head, site_manager, senior_site_manager
--      RS signoff          : design_head, services_head
--      client accept + cert: pmc_head, principal, design_principal
--    All are needed or the RS-signoff -> Client-Accept flow stalls.
-- ----------------------------------------------------------------------------
UPDATE role_nav
   SET bucket = 'more', is_visible = 1, updated_at = NOW()
 WHERE tab_key = 'measurements'
   AND role IN ('pmc_head','principal','design_principal','design_head','services_head','site_manager','senior_site_manager');

INSERT INTO role_nav (role, bucket, tab_key, sort_order, is_visible, updated_at)
SELECT r.role, 'more', 'measurements', 85, 1, NOW()
  FROM (SELECT 'pmc_head' AS role
        UNION SELECT 'principal'
        UNION SELECT 'design_principal'
        UNION SELECT 'design_head'
        UNION SELECT 'services_head'
        UNION SELECT 'site_manager'
        UNION SELECT 'senior_site_manager') r
 WHERE NOT EXISTS (
   SELECT 1 FROM role_nav rn WHERE rn.role = r.role AND rn.tab_key = 'measurements'
 );

-- ----------------------------------------------------------------------------
-- 2. HANDOVER — reachable for every role that must sign off closure
--    (matches CLOSURE_SIGNOFF_ROLES in handover.js). Placed in "More", visible.
--    Runs BEFORE the principal Work->More move (step 3) so principals' handover
--    is already in "More" and step 3's move becomes a clean no-op.
-- ----------------------------------------------------------------------------
UPDATE role_nav
   SET bucket = 'more', is_visible = 1, updated_at = NOW()
 WHERE tab_key = 'handover'
   AND role IN ('pmc_head','design_head','services_head','principal','design_principal');

INSERT INTO role_nav (role, bucket, tab_key, sort_order, is_visible, updated_at)
SELECT r.role, 'more', 'handover', 90, 1, NOW()
  FROM (SELECT 'pmc_head' AS role
        UNION SELECT 'design_head'
        UNION SELECT 'services_head'
        UNION SELECT 'principal'
        UNION SELECT 'design_principal') r
 WHERE NOT EXISTS (
   SELECT 1 FROM role_nav rn WHERE rn.role = r.role AND rn.tab_key = 'handover'
 );

-- ----------------------------------------------------------------------------
-- 3. PRINCIPALS' WORK TAB — principal & design_principal have no operational
--    role in Inspections (forms). Hide it; their Work bucket then auto-hides
--    (empty). Handover already moved to More in step 2; the move here is a
--    defensive no-op for any residual Work-bucket handover row.
-- ----------------------------------------------------------------------------
UPDATE role_nav
   SET is_visible = 0, updated_at = NOW()
 WHERE role IN ('principal','design_principal')
   AND bucket = 'work'
   AND tab_key = 'forms';

UPDATE role_nav
   SET bucket = 'more', updated_at = NOW()
 WHERE role IN ('principal','design_principal')
   AND bucket = 'work'
   AND tab_key = 'handover';

-- ----------------------------------------------------------------------------
-- 4. DEDUPE REPORTS — tab_key 'reports' and 'reports_weekly' both render the
--    same renderWeeklyReports() screen. Hide the generic 'reports' tab for any
--    role that ALSO has a visible 'reports_weekly' tab (no role loses access).
-- ----------------------------------------------------------------------------
UPDATE role_nav rn
  JOIN role_nav w
    ON w.role = rn.role
   AND w.tab_key = 'reports_weekly'
   AND w.is_visible = 1
   SET rn.is_visible = 0, rn.updated_at = NOW()
 WHERE rn.tab_key = 'reports'
   AND rn.is_visible = 1;

-- ----------------------------------------------------------------------------
-- 5. PAIR PHOTOS WITH PHOTO REVIEW — "Photo Review" (phototags) is useless
--    without "Photos" (photos) to view the uploads. For every role that can see
--    Photo Review, ensure a visible Photos tab exists in the same bucket.
-- ----------------------------------------------------------------------------
UPDATE role_nav p
  JOIN role_nav pt ON pt.role = p.role AND pt.tab_key = 'phototags' AND pt.is_visible = 1
   SET p.is_visible = 1, p.updated_at = NOW()
 WHERE p.tab_key = 'photos' AND p.is_visible = 0;

INSERT INTO role_nav (role, bucket, tab_key, sort_order, is_visible, updated_at)
SELECT pt.role, pt.bucket, 'photos', pt.sort_order + 1, 1, NOW()
  FROM role_nav pt
 WHERE pt.tab_key = 'phototags' AND pt.is_visible = 1
   AND NOT EXISTS (SELECT 1 FROM role_nav p WHERE p.role = pt.role AND p.tab_key = 'photos');

-- ============================================================================
-- End of consolidated reconciliation.
-- ============================================================================
