-- Add petty_cash tab to PMC Head's Money nav
-- Run once; INSERT IGNORE is safe to re-run
INSERT IGNORE INTO role_nav (role, tab_group, tab_key, sort_order, is_active)
VALUES ('pmc_head', 'money', 'petty_cash', 5, 1);
