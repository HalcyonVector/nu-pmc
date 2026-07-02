-- Ensure the Handover tab is reachable for EVERY role that must sign off a
-- project closure: pmc_head, design_head, services_head, principal,
-- design_principal (matches CLOSURE_SIGNOFF_ROLES in handover.js).
--
-- Symptom: those roles couldn't reach Handover in the nav, so they couldn't
-- view the checklist, attach discipline docs, or sign their closure slot —
-- which (combined with the requirePMC gate bug) meant closure could never
-- complete. This migration handles the nav half; the gate half is fixed in
-- handover.js.
--
-- Places 'handover' in the More menu, visible, for all five roles.
-- Deterministic + idempotent (safe to re-run).

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
