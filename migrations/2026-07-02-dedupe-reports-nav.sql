-- De-duplicate the "Reports" / "Weekly Reports" nav entries.
--
-- The app dispatcher maps BOTH tab_key 'reports' (label "Reports") and
-- 'reports_weekly' (label "Weekly Reports") to the same renderWeeklyReports()
-- screen. So a role that has both sees two tabs that open the identical page.
--
-- Fix: hide the generic 'reports' tab for any role that ALSO has a visible
-- 'reports_weekly' tab (so no role loses weekly-report access — they keep the
-- clearly-labelled "Weekly Reports", plus "Daily Reports"). Idempotent.

UPDATE role_nav rn
  JOIN role_nav w
    ON w.role = rn.role
   AND w.tab_key = 'reports_weekly'
   AND w.is_visible = 1
   SET rn.is_visible = 0, rn.updated_at = NOW()
 WHERE rn.tab_key = 'reports'
   AND rn.is_visible = 1;
