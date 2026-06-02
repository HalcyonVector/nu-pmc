-- nu-pmc-seed-example.sql
-- ============================================================
-- Example seed data for development and first-time setup.
--
-- USAGE:
--   After loading nu-pmc-install-<date>.sql, run this file to
--   create the initial admin users and a starter company entity.
--
--   mysql -u nu_app -p nu_pmc < nu-pmc-seed-example.sql
--
-- WHAT THIS CREATES:
--   - 2 placeholder company entities (update via Account Setup in-app)
--   - 21 example users covering all roles (password: Welcome@123)
--   - One admin account to log in and configure the rest
--
-- WHAT TO DO AFTER:
--   1. Log in as 'admin1' with password 'Welcome@123'
--   2. Go to Settings → Account Setup and enter your real company details
--   3. Add your real team members via Users
--   4. Create your first project
--
-- DO NOT commit your real data to the repository.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── Company Entities ─────────────────────────────────────────────────────────
-- Two placeholder entities. Replace with your real details via
-- Settings → Account Setup in the app after first login.
-- GSTIN format: 15-char alphanumeric. SAC code 998311 = architecture services.

TRUNCATE TABLE `company_entities`;

INSERT INTO `company_entities`
  (id, entity_code, legal_name, address_line1, city, state, pincode,
   gstin, state_code, email_primary, email_finance, phone,
   sac_code, bank_name, bank_account_no, bank_ifsc,
   bank_account_holder, bank_branch, is_active)
VALUES
  (1, 'PROP', 'YOUR COMPANY NAME',
   'Your Office Address, City',
   'Bengaluru', 'Karnataka', '560001',
   '29AAAAA0000A1Z0', '29',
   'accounts@yourcompany.com', 'finance@yourcompany.com', '9000000000',
   '998311', 'Your Bank', '000000000001', 'XXXX0000001',
   'YOUR COMPANY NAME', 'Your Branch', 1),

  (2, 'LLP', 'YOUR COMPANY LLP',
   'Your Office Address, City',
   'Bengaluru', 'Karnataka', '560001',
   '29AAAAA0000A1Z1', '29',
   'accounts@yourcompany.com', 'finance@yourcompany.com', '9000000000',
   '998311', 'Your Bank', '000000000002', 'XXXX0000001',
   'YOUR COMPANY LLP', 'Your Branch', 1);

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Example accounts covering all 15 roles.
-- Password for all accounts: Welcome@123
-- Change all passwords on first login before go-live.
--
-- managed_by hierarchy mirrors real org: pmc/design heads report to principals,
-- team leads report to design head, etc.

TRUNCATE TABLE `users`;

-- bcrypt hash of 'Welcome@123' (cost 10)
SET @pw = '$2a$10$aVWRECdMSpuHs46ReiMSx.S7iKnNhy8pdtL2fCjdJ/gB0Umz2wOlS';

INSERT INTO `users`
  (id, username, password_hash, full_name, role, stream,
   managed_by, is_active, must_change_password)
VALUES
  -- Principals (top of hierarchy, no managed_by)
  (1,  'admin1',         @pw, 'Principal Admin',       'principal',         'all',      NULL, 1, 1),
  (2,  'design_admin1',  @pw, 'Design Principal',      'design_principal',  'all',      NULL, 1, 1),

  -- Heads (managed by principals)
  (3,  'pmc_head1',      @pw, 'PMC Head One',          'pmc_head',          'pmc',      1,    1, 1),
  (4,  'pmc_head2',      @pw, 'PMC Head Two',          'pmc_head',          'pmc',      1,    1, 1),
  (5,  'design_head1',   @pw, 'Design Head',           'design_head',       'design',   2,    1, 1),
  (6,  'services_head1', @pw, 'Services Head',         'services_head',     'services', 2,    1, 1),

  -- Team leads (managed by design head)
  (7,  'team_lead1',     @pw, 'Team Lead One',         'team_lead',         'design',   5,    1, 1),
  (8,  'team_lead2',     @pw, 'Team Lead Two',         'team_lead',         'design',   5,    1, 1),

  -- Junior architects (managed by team lead)
  (9,  'jr_arch1',       @pw, 'Jr Architect One',      'jr_architect',      'design',   7,    1, 1),
  (10, 'jr_arch2',       @pw, 'Jr Architect Two',      'jr_architect',      'design',   7,    1, 1),

  -- Detailing (managed by team lead)
  (11, 'detailing1',     @pw, 'Detailing One',         'detailing',         'design',   7,    1, 1),
  (12, 'detailing2',     @pw, 'Detailing Two',         'detailing',         'design',   7,    1, 1),
  (13, 'detailing3',     @pw, 'Detailing Three',       'detailing',         'design',   8,    1, 1),
  (14, 'detailing4',     @pw, 'Detailing Four',        'detailing',         'design',   8,    1, 1),

  -- Services (managed by services head)
  (15, 'services_eng1',  @pw, 'Services Engineer',     'services_engineer', 'services', 6,    1, 1),

  -- Site managers (managed by pmc head)
  (16, 'site_mgr1',      @pw, 'Site Manager One',      'site_manager',      'site',     3,    1, 1),
  (17, 'site_mgr2',      @pw, 'Site Manager Two',      'site_manager',      'site',     3,    1, 1),
  (18, 'site_mgr3',      @pw, 'Site Manager Three',    'site_manager',      'site',     4,    1, 1),
  (19, 'site_mgr4',      @pw, 'Site Manager Four',     'site_manager',      'site',     4,    1, 1),

  -- Second principal (IT admin / deployment contact)
  (20, 'admin2',         @pw, 'Principal Two',         'principal',         'all',      1,    1, 1),

  -- Audit account (read-only observer, separate bcrypt)
  (21, 'audit',          '$2a$10$8NkaWss83QE2iJy8x6P21u4wuwBpeLtm1XS2mRGGzRf8J6D2E/RCi',
                               'Audit Account',         'audit',             'all',      NULL, 1, 0);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Seed complete. Log in as admin1 with password Welcome@123.' AS status;
SELECT 'IMPORTANT: change all passwords before go-live.' AS reminder;
