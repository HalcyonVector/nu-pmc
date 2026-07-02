-- Add the Measurements tab to the nav for EVERY role in the measurement
-- lifecycle. 'measurements' is a full feature in the code but had no role_nav
-- entry (orphaned), so it was unreachable for all roles.
--
-- Roles that interact with measurements (from renderMeasurements + routes):
--   record / create sheet : pmc_head, site_manager, senior_site_manager
--   RS signoff            : design_head, services_head
--   client accept + cert  : pmc_head, principal, design_principal
--
-- Surface it (More menu, visible) for the union of those real roles. A sheet
-- must be RS-signed by a stream head before PMC can Client Accept + upload the
-- signed certificate — so ALL these roles need reachability or the flow stalls.
-- Idempotent + deterministic.

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
