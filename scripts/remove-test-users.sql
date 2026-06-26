-- scripts/remove-test-users.sql
-- ============================================================
-- One-off cleanup: removes every harness/test user so only the real
-- generic users (user1, principal, design_head, design_principal, …) remain.
-- The tests/modules harness that created these has been deleted from the repo.
--
-- Run:  mysql -h <host> -u <user> -p nu_pmc < scripts/remove-test-users.sql
-- ============================================================

-- Show what will be removed first (optional sanity check):
-- SELECT id, username, role FROM users WHERE username LIKE 'test\_%';

DELETE FROM users WHERE username LIKE 'test\_%';

-- If the harness ever managed to create test projects/clients/vendors, they
-- would carry obvious test names; inspect and remove as needed, e.g.:
-- SELECT id, name FROM projects WHERE name LIKE '%Test%';
-- SELECT id, client_name FROM clients WHERE client_name LIKE '%Test%';
-- SELECT id, vendor_name FROM vendors WHERE vendor_name LIKE '%Test%';
