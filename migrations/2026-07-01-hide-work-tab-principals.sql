-- Remove the "Work" bottom-nav tab from principal & design_principal.
--
-- Rationale: the Work bucket held two items for these roles — `forms`
-- (Inspections) and `handover`. Inspections is a PMC + site-team workflow
-- (PMC creates/reviews, site managers fill); principals have no operational
-- role in it. Handover closure, however, needs principal sign-off, so it is
-- MOVED to the "More" menu rather than removed.
--
-- Net effect: principal / design_principal lose the Work tab (their Work
-- bucket becomes empty and empty buckets auto-hide), Inspections disappears
-- from their nav, and handover stays reachable under More.
--
-- Idempotent: re-running is a no-op once applied.

-- 1. Hide Inspections (forms) for the two roles.
UPDATE role_nav
   SET is_visible = 0, updated_at = NOW()
 WHERE role IN ('principal','design_principal')
   AND bucket = 'work'
   AND tab_key = 'forms';

-- 2. Move handover from Work -> More (only if it is still in Work).
UPDATE role_nav
   SET bucket = 'more', updated_at = NOW()
 WHERE role IN ('principal','design_principal')
   AND bucket = 'work'
   AND tab_key = 'handover';
