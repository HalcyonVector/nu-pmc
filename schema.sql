-- ============================================================
-- nu associates — Site PMC Application
-- Database Schema v2  (cleaned: 89 tables, FK-ordered, no stale ALTERs)
-- MySQL 8.0+
-- Generated: April 2026
--
-- Tables are TOPOLOGICALLY ORDERED — every FK references a table
-- already defined. FK checks stay ON during CREATE so real FK errors
-- surface at build time. If you edit this file, preserve the order.
-- See scripts/schema-reorder-v2.js for the ordering pass.
-- ============================================================

SET NAMES utf8mb4;

-- FK checks off ONLY for the drop phase (so we can drop in any order
-- without hitting "cannot drop, referenced by..."). Turned back on
-- immediately after, before the first CREATE TABLE.
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- DROP ORDER (reverse of creation for clean rebuilds)
-- ============================================================
-- ── Auto-generated DROP block (reverse-FK-safe)
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS client_comms;
DROP TABLE IF EXISTS snags;
DROP TABLE IF EXISTS claim_items;
DROP TABLE IF EXISTS client_claims;
DROP TABLE IF EXISTS measurement_items;
DROP TABLE IF EXISTS measurements;
DROP TABLE IF EXISTS client_boq_items;
DROP TABLE IF EXISTS client_boq_versions;
DROP TABLE IF EXISTS whatsapp_notifications;
DROP TABLE IF EXISTS vendor_boq_items;
DROP TABLE IF EXISTS delegations;
DROP TABLE IF EXISTS drawing_ai_checks;
DROP TABLE IF EXISTS photo_tags;
DROP TABLE IF EXISTS vendor_boq_mapping;
DROP TABLE IF EXISTS site_checkins;
DROP TABLE IF EXISTS comms_log;
DROP TABLE IF EXISTS issue_photos;
DROP TABLE IF EXISTS validation_retry_queue;
DROP TABLE IF EXISTS wa_pending_actions;
DROP TABLE IF EXISTS budget_flags;
DROP TABLE IF EXISTS budget_cost_heads;
DROP TABLE IF EXISTS schedule_risk_narratives;
DROP TABLE IF EXISTS pmc_deputy;
DROP TABLE IF EXISTS grns;
DROP TABLE IF EXISTS labour_register;
DROP TABLE IF EXISTS form_submissions;
DROP TABLE IF EXISTS form_templates;
DROP TABLE IF EXISTS submittals;
DROP TABLE IF EXISTS weekly_report_documents;
DROP TABLE IF EXISTS user_pending;
DROP TABLE IF EXISTS archival_log;
DROP TABLE IF EXISTS pre_handover_snags;
DROP TABLE IF EXISTS tds_records;
DROP TABLE IF EXISTS client_receipts;
DROP TABLE IF EXISTS principal_direct_payments;
DROP TABLE IF EXISTS petty_cash_transactions;
DROP TABLE IF EXISTS vendor_payment_exceptions;
DROP TABLE IF EXISTS vendor_payments;
DROP TABLE IF EXISTS advance_recovery_schedule;
DROP TABLE IF EXISTS vendor_acknowledgements;
DROP TABLE IF EXISTS labour_compliance;
DROP TABLE IF EXISTS material_approvals;
DROP TABLE IF EXISTS date_sanity_checks;
DROP TABLE IF EXISTS project_scope;
DROP TABLE IF EXISTS fee_schedule_history;
DROP TABLE IF EXISTS vendor_contract_history;
DROP TABLE IF EXISTS payment_request_evidence;
DROP TABLE IF EXISTS payment_requests;
DROP TABLE IF EXISTS vendor_engagements;
DROP TABLE IF EXISTS vendor_payment_cycles;
DROP TABLE IF EXISTS site_manager_leave;
DROP TABLE IF EXISTS proforma_invoices;
DROP TABLE IF EXISTS fee_schedule;
DROP TABLE IF EXISTS password_reset_otps;
DROP TABLE IF EXISTS weekly_report_photos;
DROP TABLE IF EXISTS weekly_reports;
DROP TABLE IF EXISTS change_notice_signatories;
DROP TABLE IF EXISTS change_notices;
DROP TABLE IF EXISTS meeting_photos;
DROP TABLE IF EXISTS meeting_revisions;
DROP TABLE IF EXISTS meeting_actions;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS material_requests;
DROP TABLE IF EXISTS boq_items;
DROP TABLE IF EXISTS boq_versions;
DROP TABLE IF EXISTS drawing_versions;
DROP TABLE IF EXISTS drawings;
DROP TABLE IF EXISTS drawing_register;
DROP TABLE IF EXISTS project_documents;
DROP TABLE IF EXISTS project_photos;
DROP TABLE IF EXISTS task_validations;
DROP TABLE IF EXISTS task_updates;
DROP TABLE IF EXISTS daily_reports;
DROP TABLE IF EXISTS schedule_tasks;
DROP TABLE IF EXISTS schedule_versions;
DROP TABLE IF EXISTS project_assignments;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS company_entities;
DROP TABLE IF EXISTS users;

-- Drop block done — re-enable FK validation before CREATE phase.
-- If any CREATE TABLE fails below with an FK error, the topological
-- order has been broken. Run scripts/schema-reorder-v2.js to fix.
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,                    -- bcrypt hash
  full_name     VARCHAR(100) NOT NULL,
  role          ENUM(
                  'principal',
                  'design_principal',
                  'design_head',
                  'team_lead',              -- senior architect/engineer, leads a sub-team
                  'services_head',
                  'detailing_head',
                  'jr_architect',
                  'detailing',
                  'services_engineer',
                  'coordinator',            -- cross-functional: design + site + PMC
                  'pmc_head',
                  'site_manager',
                  'senior_site_manager',    -- GRN approval below 5% project value
                  'finance_admin',
                  'trainee',
                  'audit',                  -- read-only test/audit account; blocked on all writes
                  'it_admin'                -- nav configuration editor; changes gated by principal approval
                ) NOT NULL,
  stream        ENUM('design','services','pmc','site','all') NOT NULL DEFAULT 'all',
  phone         VARCHAR(20) NULL,                         -- WhatsApp + SMS, country code no +
  matrix_user_id VARCHAR(255) NULL,                        -- v5.23: e.g. @sm_pv90:nuassociates.ems.host
  notification_channel ENUM('matrix','whatsapp','both') NOT NULL DEFAULT 'whatsapp',  -- v5.23
  email         VARCHAR(100) NULL,
  force_password_change TINYINT(1) NOT NULL DEFAULT 1,    -- first login must change default
  managed_by    INT UNSIGNED NULL,                        -- FK to users.id (who manages this user)
  deputy_id     INT UNSIGNED NULL,                        -- FK to users.id (deputy when unavailable)
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (managed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (deputy_id)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================

-- ============================================================
-- COMPANY ENTITIES (NU ASSOCIATES proprietorship + LLP)
-- ============================================================
CREATE TABLE company_entities (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_code         VARCHAR(20) NOT NULL UNIQUE,   -- 'PROP' | 'LLP'
  legal_name          VARCHAR(200) NOT NULL,
  address_line1       VARCHAR(200) NOT NULL,
  address_line2       VARCHAR(200) NULL,
  city                VARCHAR(100) NOT NULL DEFAULT 'Bengaluru',
  state               VARCHAR(50)  NOT NULL DEFAULT 'Karnataka',
  pincode             VARCHAR(10)  NOT NULL DEFAULT '560070',
  gstin               VARCHAR(20)  NOT NULL,
  state_code          VARCHAR(5)   NOT NULL DEFAULT '29',
  email_primary       VARCHAR(100) NOT NULL,
  email_finance       VARCHAR(100) NULL,
  phone               VARCHAR(15)  NULL,
  sac_code            VARCHAR(10)  NOT NULL DEFAULT '998311',
  -- Primary bank account
  bank_name           VARCHAR(100) NOT NULL,
  bank_account_no     VARCHAR(30)  NOT NULL,
  bank_ifsc           VARCHAR(15)  NOT NULL,
  bank_account_holder VARCHAR(200) NOT NULL,
  bank_branch         VARCHAR(100) NULL,
  upi_id              VARCHAR(100) NULL,
  -- Secondary bank account (suspense — fill later)
  bank2_name          VARCHAR(100) NULL,
  bank2_account_no    VARCHAR(30)  NULL,
  bank2_ifsc          VARCHAR(15)  NULL,
  bank2_account_holder VARCHAR(200) NULL,
  bank2_branch        VARCHAR(100) NULL,
  bank2_upi_id        VARCHAR(100) NULL,
  is_active           TINYINT(1)  NOT NULL DEFAULT 1,
  created_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 36. CLIENTS (master data — Udupa manages)
-- ============================================================
CREATE TABLE clients (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_name           VARCHAR(200) NOT NULL,
  display_name          VARCHAR(100) NULL,
  gstin                 VARCHAR(15) NULL,                  -- NULL for stubs created during project setup
  pan                   VARCHAR(10) NULL,
  state_name            VARCHAR(50) NULL,
  state_code            TINYINT UNSIGNED NULL,
  -- Contact details (for MOM acks, invoices, notifications)
  contact_person        VARCHAR(100) NULL,
  contact_phone         VARCHAR(20) NULL,
  contact_whatsapp      VARCHAR(20) NULL,
  contact_email         VARCHAR(100) NULL,
  address               TEXT NULL,
  gst_treatment         ENUM('regular','unregistered','sez','exempt') NOT NULL DEFAULT 'regular',
  tally_party_ledger    VARCHAR(200) NULL,
  tally_income_ledger   VARCHAR(200) NOT NULL DEFAULT 'Construction Works Income',
  invoice_prefix        VARCHAR(30) NOT NULL DEFAULT 'NUALL/26-27/',
  invoice_sequence      INT UNSIGNED NOT NULL DEFAULT 0,
  payment_terms_days    TINYINT UNSIGNED NOT NULL DEFAULT 30,
  registered_address    TEXT NULL,
  is_interstate         TINYINT(1) NOT NULL DEFAULT 0,
  is_active             TINYINT(1) NOT NULL DEFAULT 1,
  master_complete       TINYINT(1) NOT NULL DEFAULT 1,     -- 0 = stub from project setup, needs Udupa to complete
  stub_reason           VARCHAR(200) NULL,                 -- why was this created as stub (e.g. "auto from project WESCH")
  completed_by          INT UNSIGNED NULL,
  completed_at          DATETIME NULL,
  created_by            INT UNSIGNED NOT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gstin (gstin),
  INDEX idx_master_complete (master_complete, is_active),
  FOREIGN KEY (created_by)   REFERENCES users(id),
  FOREIGN KEY (completed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. PROJECTS
-- ============================================================
CREATE TABLE projects (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id       INT UNSIGNED NOT NULL DEFAULT 2,        -- 1=PROP 2=LLP — set at project setup
  billing_account ENUM('primary','secondary') NOT NULL DEFAULT 'primary',
  code            VARCHAR(20) NOT NULL UNIQUE,            -- e.g. PV90, WESCH
  name            VARCHAR(200) NOT NULL,
  client          VARCHAR(200) NOT NULL,                  -- display name (legacy)
  client_id       INT UNSIGNED NULL,                      -- FK to clients.id (preferred)
  location        VARCHAR(200) NOT NULL,
  site_lat        DECIMAL(10,7) NULL,                    -- site GPS coordinates for check-in validation
  site_lng        DECIMAL(10,7) NULL,
  project_type    ENUM('industrial','institutional','residential','commercial','infrastructure','interior') NOT NULL,
  r0_start_date   DATE NOT NULL,                          -- locked at creation
  r0_end_date     DATE NOT NULL,                          -- locked at creation, NEVER changes
  jurisdiction    VARCHAR(100) NULL,                      -- BBMP, KIADB, ELCITA etc.
  contract_value  DECIMAL(14,2) NULL,                     -- contract value at award
  payment_approval_threshold DECIMAL(14,2) NULL,          -- per-project Naveen-approval threshold (v3.1); NULL = use global default
  start_date      DATE NULL,                              -- actual start (may differ from r0_start_date)
  completion_date DATE NULL,                              -- contractual completion
  status          ENUM('initialising','active','on_hold','completed') NOT NULL DEFAULT 'initialising',
  -- Initialisation checklist
  checklist_project_created       TINYINT(1) NOT NULL DEFAULT 0,
  checklist_design_register       TINYINT(1) NOT NULL DEFAULT 0,
  checklist_services_register     TINYINT(1) NOT NULL DEFAULT 0,
  checklist_design_boq            TINYINT(1) NOT NULL DEFAULT 0,
  checklist_services_boq          TINYINT(1) NOT NULL DEFAULT 0,
  checklist_schedule              TINYINT(1) NOT NULL DEFAULT 0,
  checklist_site_manager          TINYINT(1) NOT NULL DEFAULT 0,
  -- Metadata
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id)  REFERENCES company_entities(id),
  FOREIGN KEY (client_id)   REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT chk_proj_dates CHECK (r0_end_date >= r0_start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. PROJECT ASSIGNMENTS
-- Site managers assigned to projects (one active project at a time)
-- Design/Services team can be on multiple projects
-- ============================================================
CREATE TABLE project_assignments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  role        VARCHAR(30) NOT NULL DEFAULT 'member',
  assigned_by INT UNSIGNED NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_project_user (project_id, user_id),
  -- Site managers can be on multiple projects simultaneously
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. SCHEDULE VERSIONS
-- R0 is the baseline — end date never changes
-- Every revision tracked
-- ============================================================
CREATE TABLE schedule_versions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  row_version     INT UNSIGNED NOT NULL DEFAULT 1,        -- optimistic lock
  project_id      INT UNSIGNED NOT NULL,
  version_number  INT UNSIGNED NOT NULL DEFAULT 0,        -- 0=R0, 1=v1, 2=v2...
  label           VARCHAR(10) NOT NULL,                   -- 'R0','v1','v2'
  end_date        DATE NOT NULL,                          -- this version's end date
  drift_days      INT NOT NULL DEFAULT 0,                 -- cumulative drift from R0
  status          ENUM('draft','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft',
  reason          TEXT NULL,
  uploaded_by     INT UNSIGNED NOT NULL,
  approved_by     INT UNSIGNED NULL,
  approved_at     DATETIME NULL,
  rejection_note  TEXT NULL,
  is_current      TINYINT(1) NOT NULL DEFAULT 0,
  -- Drift acknowledge workflow (v3.1)
  drift_acknowledged    TINYINT(1) NOT NULL DEFAULT 0,
  drift_acknowledged_by INT UNSIGNED NULL,
  drift_acknowledged_at DATETIME NULL,
  drift_mitigation      TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (drift_acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. SCHEDULE TASKS
-- Tasks linked to a schedule version
-- ============================================================
CREATE TABLE schedule_tasks (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id          INT UNSIGNED NOT NULL,
  schedule_version_id INT UNSIGNED NOT NULL,
  trade               VARCHAR(50) NOT NULL,               -- Civil, Electrical, HVAC etc
  task_name           VARCHAR(300) NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  depends_on_task_id  INT UNSIGNED NULL,                  -- FK to schedule_tasks.id
  is_milestone        TINYINT(1) NOT NULL DEFAULT 0,
  is_payment_milestone TINYINT(1) NOT NULL DEFAULT 0, -- set by Naveen/Ajay separately
  milestone_type      ENUM('schedule','payment','both','none') NOT NULL DEFAULT 'none',
  milestone_label     VARCHAR(200) NULL,                   -- short name shown in report
  display_order       INT UNSIGNED NOT NULL DEFAULT 0,
  description         TEXT NULL,
  assignee_id         INT UNSIGNED NULL,
  priority            ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (schedule_version_id) REFERENCES schedule_versions(id),
  FOREIGN KEY (depends_on_task_id) REFERENCES schedule_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_st_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. DAILY REPORTS (from WhatsApp bot or manual upload)
-- ============================================================
CREATE TABLE daily_reports (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  report_date     DATE NOT NULL,
  site_manager_id INT UNSIGNED NOT NULL,
  source          ENUM('whatsapp','manual_upload','app') NOT NULL DEFAULT 'app',
  raw_file_path   VARCHAR(500) NULL,                      -- path to original Excel
  overall_notes   TEXT NULL,
  submitted_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at    DATETIME NULL,                          -- when server parsed it
  ai_flag_reason  TEXT NULL,                              -- anomaly description if flagged
  ai_flag_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  ai_flag_ack_at  DATETIME NULL,
  -- PMC approval + manual-flag workflow (v3.1)
  status          ENUM('pending_review','approved','flagged','auto_locked')
                     NOT NULL DEFAULT 'pending_review',
  approved_by     INT UNSIGNED NULL,
  approved_at     DATETIME NULL,
  flag_reason     TEXT NULL,
  flagged_by      INT UNSIGNED NULL,
  flagged_at      DATETIME NULL,
  locked_at       DATETIME NULL,
  UNIQUE KEY uq_project_date_manager (project_id, report_date, site_manager_id),
  KEY idx_daily_reports_lock_scan (status, report_date),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (site_manager_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (flagged_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. TASK UPDATES (% complete entries from site manager)
-- ============================================================
CREATE TABLE task_updates (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id         INT UNSIGNED NOT NULL,
  project_id      INT UNSIGNED NOT NULL,
  report_date     DATE NOT NULL,
  pct_complete    TINYINT UNSIGNED NOT NULL DEFAULT 0,    -- 0-100
  notes           TEXT NULL,
  is_flagged      TINYINT(1) NOT NULL DEFAULT 0,
  flag_note       TEXT NULL,
  updated_by      INT UNSIGNED NOT NULL,                  -- site manager
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Only one update per task per day per reporter
  UNIQUE KEY uq_task_date_user (task_id, report_date, updated_by),
  daily_report_id INT UNSIGNED NULL,            -- link to daily report if submitted via Excel
  FOREIGN KEY (task_id) REFERENCES schedule_tasks(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE SET NULL,
  CONSTRAINT chk_tu_pct CHECK (pct_complete BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. TASK VALIDATIONS (PMC Head confirms/rejects site manager's update)
-- ============================================================
CREATE TABLE task_validations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_update_id  INT UNSIGNED NOT NULL UNIQUE,
  status          ENUM('pending','validated','rejected') NOT NULL DEFAULT 'pending',
  validated_by    INT UNSIGNED NOT NULL,
  rejection_note  TEXT NULL,
  validated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_update_id) REFERENCES task_updates(id),
  FOREIGN KEY (validated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Task-level data from daily report
-- ============================================================
-- 9. PROJECT PHOTOS
-- ============================================================
CREATE TABLE project_photos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  task_id         INT UNSIGNED NULL,                      -- optional link to task
  daily_report_id INT UNSIGNED NULL,                      -- optional link to report
  photo_date      DATE NOT NULL,
  file_path       VARCHAR(500) NOT NULL,                  -- server storage path
  file_size_kb    INT UNSIGNED NOT NULL DEFAULT 0,
  caption         VARCHAR(500) NULL,
  uploaded_by     INT UNSIGNED NOT NULL,
  source          ENUM('app','whatsapp','site_visit') NOT NULL DEFAULT 'app',
  uploaded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- v2: photo lock (set when photo is referenced by an approved/sent weekly report)
  is_locked            TINYINT(1) NOT NULL DEFAULT 0,
  locked_at            DATETIME NULL,
  locked_by_report_id  INT UNSIGNED NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (task_id) REFERENCES schedule_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. PROJECT DOCUMENTS (challans, invoices etc)
-- ============================================================
CREATE TABLE project_documents (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  doc_date        DATE NULL,
  doc_type        ENUM('appointment_letter','contract','po','challan','invoice','other') NOT NULL DEFAULT 'other',
  file_path       VARCHAR(500) NOT NULL,
  file_name       VARCHAR(300) NULL,
  file_size_kb    INT UNSIGNED NOT NULL DEFAULT 0,
  is_classified   TINYINT(1) NOT NULL DEFAULT 0,
  notes           VARCHAR(500) NULL,
  uploaded_by     INT UNSIGNED NOT NULL,
  uploaded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11b. DRAWING REGISTER (master list uploaded at project init)
-- Design team pre-registers every main drawing that will exist.
-- Uploads must match a register entry to be accepted as 'main'.
-- Detail drawings and RFI response drawings bypass this check.
-- ============================================================
CREATE TABLE drawing_register (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  drawing_number  VARCHAR(50) NOT NULL,
  drawing_name    VARCHAR(300) NOT NULL,
  category        ENUM('Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT') NOT NULL,
  stream          ENUM('design','services') NOT NULL,
  expected_revision VARCHAR(10) NULL,                    -- optional, e.g. expected to be issued at R2
  notes           TEXT NULL,
  -- Status: pending = never uploaded; in_progress = uploaded but not issued; issued = current version issued
  status          ENUM('pending','in_progress','issued') NOT NULL DEFAULT 'pending',
  uploaded_by     INT UNSIGNED NOT NULL,                 -- Rajani or Srinath
  uploaded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Audit: sign-off that this register is the agreed master list
  signed_off_by   INT UNSIGNED NULL,                     -- Naveen or Ajay
  signed_off_at   DATETIME NULL,
  UNIQUE KEY uq_reg_project_drawing (project_id, drawing_number),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (signed_off_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. DRAWINGS
-- ============================================================
CREATE TABLE drawings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  drawing_number  VARCHAR(50) NOT NULL,                   -- e.g. A-101
  drawing_name    VARCHAR(300) NOT NULL,
  category        ENUM('Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT') NOT NULL,
  stream          ENUM('design','services') NOT NULL,
  -- Drawing type: main drawings are pre-registered in drawing_register;
  -- detail drawings are created ad-hoc (on-site conditions, client requests);
  -- rfi_response drawings emerge from an RFI, no register check.
  drawing_type    ENUM('main','detail','rfi_response') NOT NULL DEFAULT 'main',
  -- For detail or rfi drawings, optionally link to parent main drawing
  parent_drawing_id   INT UNSIGNED NULL,
  -- For rfi_response drawings, link to the RFI (issues table)
  rfi_issue_id        INT UNSIGNED NULL,
  -- For main drawings, link to the register entry it fulfils
  register_entry_id   INT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_drawing (project_id, drawing_number),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (parent_drawing_id) REFERENCES drawings(id) ON DELETE SET NULL,
  FOREIGN KEY (register_entry_id) REFERENCES drawing_register(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 12. DRAWING VERSIONS (R0, R1, R2...)
-- 3-level approval:
-- Design: detailing pool → detailing head → rajani → issued
-- Services: services engineer → srinath → issued
-- ============================================================
CREATE TABLE drawing_versions (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  drawing_id          INT UNSIGNED NOT NULL,
  revision            VARCHAR(10) NOT NULL,               -- R0, R1, R2
  revision_number     INT UNSIGNED NOT NULL DEFAULT 0,    -- 0,1,2 for sorting
  file_path           VARCHAR(500) NOT NULL,
  file_size_kb        INT UNSIGNED NOT NULL DEFAULT 0,
  notes               TEXT NULL,
  change_notice_id    INT UNSIGNED NULL,                  -- linked CN if applicable
  -- Approval
  approval_level      TINYINT UNSIGNED NOT NULL DEFAULT 1, -- 1=detailing head, 2=stream head
  status              ENUM('pending_l1','pending_l2','issued','rejected','superseded') NOT NULL DEFAULT 'pending_l1',
  -- Level 1 review (Sahana/Sushmitha or Srinath)
  l1_reviewed_by      INT UNSIGNED NULL,
  l1_reviewed_at      DATETIME NULL,
  l1_rejection_note   TEXT NULL,
  -- Level 2 approval (Rajani or Srinath for services)
  l2_approved_by      INT UNSIGNED NULL,
  l2_approved_at      DATETIME NULL,
  l2_rejection_note   TEXT NULL,
  -- Issue
  issued_at           DATETIME NULL,
  is_current          TINYINT(1) NOT NULL DEFAULT 0,      -- only one current per drawing
  -- Flag / hold (Ajay, Naveen, R, S, PMC)
  flag_comment        TEXT NULL,
  flag_by             INT UNSIGNED NULL,
  flag_at             DATETIME NULL,
  -- Hold (orthogonal to approval status — v3.1)
  is_held             TINYINT(1) NOT NULL DEFAULT 0,
  held_at             DATETIME NULL,
  held_by             INT UNSIGNED NULL,
  uploaded_by         INT UNSIGNED NOT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (drawing_id) REFERENCES drawings(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (l1_reviewed_by) REFERENCES users(id),
  FOREIGN KEY (l2_approved_by) REFERENCES users(id),
  FOREIGN KEY (flag_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (held_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 13. DRAWING QUERIES
-- ============================================================
-- ============================================================
-- 14. BOQ VERSIONS
-- ============================================================
CREATE TABLE boq_versions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  stream          ENUM('design','services') NOT NULL,
  version_number  INT UNSIGNED NOT NULL DEFAULT 1,
  label           VARCHAR(10) NOT NULL,                   -- v1, v2
  file_path       VARCHAR(500) NULL,                      -- original uploaded file
  is_current      TINYINT(1) NOT NULL DEFAULT 0,
  uploaded_by     INT UNSIGNED NOT NULL,
  change_notice_id INT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 15. BOQ ITEMS
-- Parsed from uploaded BOQ Excel
-- Drives material request dropdown
-- ============================================================
CREATE TABLE boq_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  boq_version_id  INT UNSIGNED NOT NULL,
  project_id      INT UNSIGNED NOT NULL,
  parent_id       INT UNSIGNED NULL,                      -- NULL = top-level trade/section
  trade           VARCHAR(50) NOT NULL,
  item_code       VARCHAR(50) NULL,
  item_name       VARCHAR(300) NOT NULL,
  display_order   INT UNSIGNED NOT NULL DEFAULT 0,
  is_section      TINYINT(1) NOT NULL DEFAULT 0,          -- 1 = section header, no qty/rate
  unit            VARCHAR(30) NOT NULL,                   -- bags, mtrs, sqft, nos
  quantity        DECIMAL(12,3) NOT NULL DEFAULT 0,
  is_active                TINYINT(1) NOT NULL DEFAULT 1,
  bank_verified            TINYINT(1) NOT NULL DEFAULT 0,
  bank_verification_sent_at DATETIME NULL,
  vendor_confirmed_at      DATETIME NULL,
  payment_eligible         TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (boq_version_id) REFERENCES boq_versions(id),
  FOREIGN KEY (project_id)     REFERENCES projects(id),
  FOREIGN KEY (parent_id)      REFERENCES boq_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 16. MATERIAL REQUESTS
-- ============================================================
CREATE TABLE material_requests (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  boq_item_id     INT UNSIGNED NOT NULL,
  quantity_needed DECIMAL(12,3) NOT NULL,
  needed_by_date  DATE NOT NULL,
  status          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  -- 1=Requested, 2=Ordered, 3=Dispatched, 4=Received, 5=Checked & Validated
  notes           TEXT NULL,
  raised_by       INT UNSIGNED NOT NULL,                  -- site manager
  raised_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Status updates
  ordered_by      INT UNSIGNED NULL,
  ordered_at      DATETIME NULL,
  dispatched_at   DATETIME NULL,
  received_at     DATETIME NULL,
  validated_by    INT UNSIGNED NULL,
  validated_at    DATETIME NULL,
  is_overdue      TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (boq_item_id) REFERENCES boq_items(id),
  FOREIGN KEY (raised_by) REFERENCES users(id),
  FOREIGN KEY (ordered_by) REFERENCES users(id),
  FOREIGN KEY (validated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VENDOR MASTER — registered once, used across all projects
-- ============================================================
CREATE TABLE vendors (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trade           VARCHAR(50) NOT NULL,
  vendor_name     VARCHAR(200) NOT NULL,
  contact_person  VARCHAR(100) NULL,
  phone           VARCHAR(15) NULL,
  gst_number      VARCHAR(20) NULL,
  bank_name       VARCHAR(100) NULL,
  bank_account    VARCHAR(30) NULL,
  bank_ifsc       VARCHAR(15) NULL,
  registered_by   INT UNSIGNED NOT NULL,
  pan_number      VARCHAR(10) NULL,
  pan_validated   TINYINT(1) NOT NULL DEFAULT 0,
  pan_validated_by INT UNSIGNED NULL,
  pan_validated_at DATETIME NULL,
  gstin_validated    TINYINT(1) NOT NULL DEFAULT 0,       -- v3.1: parallel to pan_validated
  gstin_validated_at DATETIME NULL,
  -- M01 audit (v3.1): finance clearance workflow
  clearance_status ENUM('pending','cleared','rejected') NOT NULL DEFAULT 'pending',
  cleared_by       INT UNSIGNED NULL,
  cleared_at       DATETIME NULL,
  rejection_reason TEXT NULL,
  ai_flags         JSON NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  notes           TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- v5.24: bank validation by vendor + Matrix tier tracking
  bank_validated_by_vendor TINYINT(1) NOT NULL DEFAULT 0,
  bank_validated_at        DATETIME NULL,
  bank_validation_method   ENUM('matrix','wa_form','manual_attestation') NULL,
  matrix_user_id           VARCHAR(255) NULL,
  matrix_room_id           VARCHAR(255) NULL,
  matrix_status            ENUM('not_invited','invited_pending','joined','declined') NOT NULL DEFAULT 'not_invited',
  UNIQUE KEY uq_vendors_gst_number (gst_number),
  FOREIGN KEY (registered_by) REFERENCES users(id),
  FOREIGN KEY (cleared_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (pan_validated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ISSUE LOG — five types, type-based routing
-- ============================================================
CREATE TABLE issues (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id          INT UNSIGNED NOT NULL,
  issue_number        VARCHAR(20) NOT NULL,      -- ISS-001, ISS-002
  issue_type          ENUM('safety','quality','design','rfi','compliance') NOT NULL,
  title               VARCHAR(300) NOT NULL,
  description         TEXT NOT NULL,
  raised_by           INT UNSIGNED NOT NULL,
  raised_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_by        INT UNSIGNED NULL,          -- PMC Head confirms before register
  confirmed_at        DATETIME NULL,
  assigned_to         INT UNSIGNED NULL,          -- internal team member
  assigned_vendor_id  INT UNSIGNED NULL,          -- vendor if site issue
  drawing_id          INT UNSIGNED NULL,          -- optional link to drawing
  location            VARCHAR(200) NULL,
  due_date            DATE NULL,
  status              ENUM('draft','open','in_progress','resolved','closed','signed_off','accepted_by_client') NOT NULL DEFAULT 'draft',  -- 'signed_off'/'accepted_by_client' added v5.7 (snags collapse)
  is_overdue          TINYINT(1) NOT NULL DEFAULT 0,
  -- RFI specific
  rfi_response        TEXT NULL,
  rfi_responded_by    INT UNSIGNED NULL,
  rfi_responded_at    DATETIME NULL,
  -- NCR specific (type=quality — NCR folded into issues)
  ncr_number          VARCHAR(20) NULL,          -- NCR-001 etc
  vendor_accountability TINYINT(1) NOT NULL DEFAULT 0,
  vendor_acknowledged   TINYINT(1) NOT NULL DEFAULT 0,    -- v3.1: vendor replied ack'd via WA
  vendor_ack_at         DATETIME NULL,
  vendor_disputed       TINYINT(1) NOT NULL DEFAULT 0,    -- v3.1: vendor disputed via WA
  rectification_date  DATE NULL,
  rectification_note  TEXT NULL,
  -- Drawing query (folded into RFI — drawing query IS an RFI)
  drawing_version_id  INT UNSIGNED NULL,          -- specific drawing version this RFI is about
  query_stream        ENUM('design','services') NULL,
  -- Photo request (folded into RFI)
  response_type       ENUM('text','photo','both') NOT NULL DEFAULT 'text',
  photo_deadline      DATE NULL,                   -- for photo requests
  assigned_to_site    INT UNSIGNED NULL,           -- site manager to photograph
  wa_request_sid      VARCHAR(64) NULL,            -- Twilio SID for WA photo reply matching
  -- Resolution
  resolution_note     TEXT NULL,
  resolved_by         INT UNSIGNED NULL,
  resolved_at         DATETIME NULL,
  -- Escalation
  amber_sent          TINYINT(1) NOT NULL DEFAULT 0,
  red_sent            TINYINT(1) NOT NULL DEFAULT 0,
  file_path           VARCHAR(500) NULL,
  FOREIGN KEY (project_id)       REFERENCES projects(id),
  FOREIGN KEY (raised_by)        REFERENCES users(id),
  FOREIGN KEY (confirmed_by)     REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to)      REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
  FOREIGN KEY (drawing_id)       REFERENCES drawings(id) ON DELETE SET NULL,
  FOREIGN KEY (rfi_responded_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_site) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (drawing_version_id) REFERENCES drawing_versions(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by)      REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_issue_project_number (project_id, issue_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 17. CHANGE NOTICES
-- ============================================================
CREATE TABLE change_notices (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  cn_number       VARCHAR(20) NOT NULL,                   -- CN001, CN002
  title           VARCHAR(300) NOT NULL,
  description     TEXT NOT NULL,
  source          ENUM('client','site','design','statutory') NOT NULL,
  affected_drawings TEXT NULL,                            -- comma-separated drawing numbers
  boq_impact      TINYINT(1) NOT NULL DEFAULT 0,
  schedule_impact_days INT NOT NULL DEFAULT 0,
  raised_by       INT UNSIGNED NOT NULL,
  raised_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 3 mandatory signatories
  sig_design_head      TINYINT(1) NOT NULL DEFAULT 0,
  sig_design_head_at   DATETIME NULL,
  sig_services_head    TINYINT(1) NOT NULL DEFAULT 0,
  sig_services_head_at DATETIME NULL,
  sig_pmc         INT UNSIGNED NULL,                      -- which PMC head signed
  sig_pmc_at      DATETIME NULL,
  -- Final approval
  status          ENUM('collecting_sigs','pending_approval','approved','rejected') NOT NULL DEFAULT 'collecting_sigs',
  approved_by     INT UNSIGNED NULL,
  approved_at     DATETIME NULL,
  rfi_id          INT UNSIGNED NULL,             -- RFI that triggered this CN
  rejection_note  TEXT NULL,
  UNIQUE KEY uq_cn_number (project_id, cn_number),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (raised_by) REFERENCES users(id),
  FOREIGN KEY (sig_pmc) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (rfi_id) REFERENCES issues(id) ON DELETE SET NULL,
  CONSTRAINT chk_cn_self_ref CHECK (approved_by IS NULL OR approved_by <> raised_by)
  -- Removed v3.2: two CHECK constraints referencing `previous_value` and
  -- `revised_value` were copy-pasted from vendor_contract_history where
  -- those columns actually exist. They never applied on this table and
  -- caused the entire schema.sql to fail at line 773 when loaded fresh.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Link CN to signatories table for flexibility
CREATE TABLE change_notice_signatories (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  change_notice_id  INT UNSIGNED NOT NULL,
  user_id           INT UNSIGNED NOT NULL,
  signed_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes             TEXT NULL,
  UNIQUE KEY uq_cn_user (change_notice_id, user_id),
  FOREIGN KEY (change_notice_id) REFERENCES change_notices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 20. WEEKLY REPORTS
-- ============================================================
CREATE TABLE weekly_reports (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  week_ending     DATE NOT NULL,
  week_number     INT UNSIGNED NOT NULL,
  summary         TEXT NULL,
  issues_for_client TEXT NULL,
  status          ENUM('draft','pending_approval','approved','sent') NOT NULL DEFAULT 'draft',
  drafted_by         INT UNSIGNED NOT NULL,
  approved_by        INT UNSIGNED NULL,
  approved_at        DATETIME NULL,
  sent_by            INT UNSIGNED NULL,
  sent_at            DATETIME NULL,
  ai_drag_detected   TINYINT(1) NOT NULL DEFAULT 0,
  ai_drag_summary    TEXT NULL,
  drag_acknowledged  TINYINT(1) NOT NULL DEFAULT 0,
  drag_ack_by        INT UNSIGNED NULL,
  drag_ack_at        DATETIME NULL,
  mitigation_note    TEXT NULL,
  -- v2: 3-way sign-off (PMC + Design + Services)
  sig_pmc_by         INT UNSIGNED NULL,
  sig_pmc_at         DATETIME NULL,
  sig_design_by      INT UNSIGNED NULL,
  sig_design_at      DATETIME NULL,
  sig_services_by    INT UNSIGNED NULL,
  sig_services_at    DATETIME NULL,
  pmc_section        MEDIUMTEXT NULL,
  design_section     MEDIUMTEXT NULL,
  services_section   MEDIUMTEXT NULL,
  pdf_path           VARCHAR(500) NULL,           -- generated on Principal approval
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_week (project_id, week_ending),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (drafted_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (sent_by) REFERENCES users(id),
  FOREIGN KEY (drag_ack_by)     REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (sig_pmc_by)      REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (sig_design_by)   REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (sig_services_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE weekly_report_photos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  weekly_report_id INT UNSIGNED NOT NULL,
  photo_id        INT UNSIGNED NOT NULL,                  -- from project_photos
  FOREIGN KEY (weekly_report_id) REFERENCES weekly_reports(id),
  FOREIGN KEY (photo_id) REFERENCES project_photos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 21. PASSWORD RESET OTPs (WhatsApp)
-- STATUS (2026-04-25): self-service OTP-reset feature removed in v3.1; the
-- /api/auth/request-otp and /verify-otp endpoints now return 410 GONE. Table
-- retained for historical OTP rows. Safe to drop in a future cleanup if no
-- record-retention concern.
-- ============================================================
CREATE TABLE password_reset_otps (
  user_id     INT UNSIGNED NOT NULL PRIMARY KEY,
  otp_hash    VARCHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 22. SEED DATA — All 19 users
-- Passwords are 'changeme123' hashed with bcrypt (rounds=10)
-- Guru must run: UPDATE users SET password_hash = bcrypt(actual_password)
-- ============================================================
INSERT INTO users (username, password_hash, full_name, role, stream, managed_by) VALUES
-- Principals (managed_by = NULL, managed by each other)
('naveen',    '$2b$10$placeholder', 'Principal Admin',   'principal',         'all',      NULL),
('ajay',      '$2b$10$placeholder', 'Design Principal',        'design_principal',  'all',      NULL),
-- PMC Heads (managed by naveen=1)
('murugesan', '$2b$10$placeholder', 'PMC Head One',         'pmc_head',          'pmc',      1),
('praveen',   '$2b$10$placeholder', 'PMC Head Two',       'pmc_head',          'pmc',      1),
-- Design Head (managed by ajay=2)
('rajani',    '$2b$10$placeholder', 'Design Head',      'design_head',       'design',   2),
-- Services Head (managed by ajay=2)
('srinath',   '$2b$10$placeholder', 'Srinath',             'services_head',     'services', 2),
-- Detailing Heads (managed by rajani=5)
('sahana',    '$2b$10$placeholder', 'Sahana R',            'detailing_head',    'design',   5),
('sushmitha', '$2b$10$placeholder', 'Sushmitha H N',       'detailing_head',    'design',   5),
-- Jr Architects (managed by rajani=5)
('preethi',   '$2b$10$placeholder', 'Preethi R',           'jr_architect',      'design',   5),
('satish',    '$2b$10$placeholder', 'Satish Rajakumar',    'jr_architect',      'design',   5),
-- Detailing pool (managed by sahana=7 / sushmitha=8 — set to sahana as primary)
('abhishek',  '$2b$10$placeholder', 'Abhishek K C',        'detailing',         'design',   7),
('bhumika',   '$2b$10$placeholder', 'Bhumika Y M',         'detailing',         'design',   7),
('ajay_a',    '$2b$10$placeholder', 'Ajay Acharya',        'detailing',         'design',   7),
('shreyas',   '$2b$10$placeholder', 'Shreyas Y Acharya',   'detailing',         'design',   7),
-- Services team (managed by srinath=6)
('karthik',   '$2b$10$placeholder', 'Karthik',             'services_engineer', 'services', 6),
-- Site Managers (managed by murugesan=3)
('anjaneya',  '$2b$10$placeholder', 'Anjaneya',            'site_manager',      'site',     3),
('suleman',   '$2b$10$placeholder', 'Suleman Saiyed',      'site_manager',      'site',     3),
('prajwal',   '$2b$10$placeholder', 'Prajwal S Thantry',   'site_manager',      'site',     3),
('arun',      '$2b$10$placeholder', 'Arun Kumar B R',      'site_manager',      'site',     3);

-- ============================================================
-- FEE SCHEDULE (payment milestones from appointment letter)
-- ============================================================
CREATE TABLE fee_schedule (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  milestone_name  VARCHAR(300) NOT NULL,
  amount          DECIMAL(14,2) NOT NULL,
  gst_pct         DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  display_order   INT UNSIGNED NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PROFORMA INVOICES
-- ============================================================
CREATE TABLE proforma_invoices (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id          INT UNSIGNED NOT NULL,
  pi_number           VARCHAR(30) NOT NULL,              -- e.g. PI/WESCH/2026/001
  fee_schedule_id     INT UNSIGNED NOT NULL,
  schedule_task_id    INT UNSIGNED NULL,                 -- linked payment milestone task
  amount_ex_gst       DECIMAL(14,2) NOT NULL,
  gst_pct             DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  amount_gst          DECIMAL(14,2) NOT NULL,
  amount_total        DECIMAL(14,2) NOT NULL,
  status              ENUM('draft','sent','acknowledged','paid') NOT NULL DEFAULT 'draft',
  raised_by           INT UNSIGNED NOT NULL,
  raised_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at             DATETIME NULL,
  acknowledged_at     DATETIME NULL,
  paid_at             DATETIME NULL,
  notes               TEXT NULL,
  UNIQUE KEY uq_pi_number (project_id, pi_number),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedule(id),
  FOREIGN KEY (schedule_task_id) REFERENCES schedule_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (raised_by) REFERENCES users(id),
  CONSTRAINT chk_pi_amount_ex CHECK (amount_ex_gst > 0),
  CONSTRAINT chk_pi_gst CHECK (gst_pct BETWEEN 0 AND 50),
  CONSTRAINT chk_pi_amount_total CHECK (amount_total >= amount_ex_gst)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SITE MANAGER LEAVE
-- ============================================================
CREATE TABLE site_manager_leave (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  project_id  INT UNSIGNED NOT NULL,
  leave_from  DATE NOT NULL,
  leave_to    DATE NOT NULL,
  reason      VARCHAR(300) NULL,
  marked_by   INT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (marked_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VENDOR PAYMENT CYCLES
-- ============================================================
CREATE TABLE vendor_payment_cycles (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  cycle_date      DATE NOT NULL,
  cycle_type      ENUM('weekly','on_demand') NOT NULL DEFAULT 'weekly',
  status          ENUM('draft','icici_generated','icici_uploaded','confirmed','whatsapp_sent') NOT NULL DEFAULT 'draft',
  generated_by    INT UNSIGNED NOT NULL,
  confirmed_by    INT UNSIGNED NULL,
  icici_file_path VARCHAR(500) NULL,
  confirm_file_path VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (generated_by) REFERENCES users(id),
  FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VENDOR ENGAGEMENTS — project-specific contract and status
-- ============================================================
CREATE TABLE vendor_engagements (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id             INT UNSIGNED NOT NULL,
  project_id            INT UNSIGNED NOT NULL,
  scope                 VARCHAR(300) NOT NULL,
  contract_value        DECIMAL(14,2) NULL,
  mobilisation_status   ENUM('not_started','active','partially_complete','complete','off_site') NOT NULL DEFAULT 'not_started',
  mobilisation_date     DATE NULL,
  completion_date       DATE NULL,
  engaged_by            INT UNSIGNED NOT NULL,
  -- Approval workflow (M03, v3.1): heads/PMC initiate engagement; principals sign off.
  -- Payment requests cannot be raised on engagements until approval_status='approved'.
  approval_status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by           INT UNSIGNED NULL,
  approved_at           DATETIME NULL,
  rejection_reason      VARCHAR(500) NULL,
  is_active             TINYINT(1) NOT NULL DEFAULT 1,
  notes                 TEXT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vendor_project (vendor_id, project_id),
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id),
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (engaged_by)  REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_ve_contract CHECK (contract_value IS NULL OR contract_value >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PAYMENT REQUESTS
-- ============================================================
CREATE TABLE payment_requests (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  row_version         INT UNSIGNED NOT NULL DEFAULT 1,        -- optimistic lock — incremented on every UPDATE
  project_id          INT UNSIGNED NOT NULL,
  vendor_id           INT UNSIGNED NOT NULL,
  engagement_id       INT UNSIGNED NULL,         -- FK to vendor_engagements
  requested_by        INT UNSIGNED NOT NULL,
  amount_requested    DECIMAL(14,2) NOT NULL,
  reason              TEXT NOT NULL,
  payment_type        ENUM('labour','site_material','design_material','mep_material','mobilisation_advance','material_advance','advance','running_account_bill','final_bill','retention_release','other') NOT NULL DEFAULT 'other',
  status              ENUM('pending_pmc','pmc_approved','pmc_rejected','pending_principal','principal_approved','principal_rejected','paid') NOT NULL DEFAULT 'pending_pmc',
  -- PMC review
  pmc_reviewed_by     INT UNSIGNED NULL,
  pmc_reviewed_at     DATETIME NULL,
  pmc_amount          DECIMAL(14,2) NULL,       -- PMC can modify amount
  pmc_notes           TEXT NULL,
  -- Principal approval (above threshold only)
  principal_reviewed_by  INT UNSIGNED NULL,
  principal_reviewed_at  DATETIME NULL,
  principal_notes        TEXT NULL,
  -- Payment confirmation
  actual_paid         DECIMAL(14,2) NULL,
  payment_date        DATE NULL,
  utr_number          VARCHAR(50) NULL,
  paid_by             INT UNSIGNED NULL,        -- Udupa
  -- M01 audit (v3.1): governance override markers
  principal_override  TINYINT(1) NOT NULL DEFAULT 0,   -- approved by non-finance role when finance was expected
  rs_override         TINYINT(1) NOT NULL DEFAULT 0,   -- approved without R/S when R/S was required
  -- Urgent payment fields (folded from urgent_payments table)
  is_urgent           TINYINT(1) NOT NULL DEFAULT 0,
  is_adhoc            TINYINT(1) NOT NULL DEFAULT 0,  -- ad hoc shop purchase
  adhoc_name          VARCHAR(100) NULL,
  adhoc_phone         VARCHAR(15) NULL,
  adhoc_gstin         VARCHAR(15) NULL,
  adhoc_pan           VARCHAR(10) NULL,
  adhoc_bank_account  VARCHAR(20) NULL,
  adhoc_bank_ifsc     VARCHAR(11) NULL,
  adhoc_upi_id        VARCHAR(50) NULL,
  adhoc_upi_qr_path   VARCHAR(300) NULL,
  payment_lane        ENUM('bank','upi','icici_bulk') NOT NULL DEFAULT 'icici_bulk',
  -- Metadata
  invoice_override_reason   VARCHAR(300) NULL,
  gst_rate                  DECIMAL(5,2) NOT NULL DEFAULT 18,
  hsn_code                  VARCHAR(20) NULL,
  is_interstate             TINYINT(1) NOT NULL DEFAULT 0,
  schedule_compliant        TINYINT(1) NOT NULL DEFAULT 0,
  compliance_checked_by     INT UNSIGNED NULL,
  compliance_checked_at     DATETIME NULL,
  work_done_pct             DECIMAL(5,2) NULL,                    -- for RA bills; validated by chk_pr_work_pct
  raised_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)         REFERENCES projects(id),
  FOREIGN KEY (vendor_id)          REFERENCES vendors(id),
  FOREIGN KEY (engagement_id)      REFERENCES vendor_engagements(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by)       REFERENCES users(id),
  FOREIGN KEY (compliance_checked_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (pmc_reviewed_by)    REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (principal_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (paid_by)            REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_pr_amount CHECK (amount_requested > 0),
  CONSTRAINT chk_pr_pmc_amount CHECK (pmc_amount IS NULL OR pmc_amount > 0),
  CONSTRAINT chk_pr_actual_paid CHECK (actual_paid IS NULL OR actual_paid >= 0),
  CONSTRAINT chk_pr_gst CHECK (gst_rate BETWEEN 0 AND 50),
  CONSTRAINT chk_pr_work_pct CHECK (work_done_pct IS NULL OR (work_done_pct BETWEEN 0 AND 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PAYMENT REQUEST EVIDENCE
-- ============================================================
CREATE TABLE payment_request_evidence (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_request_id  INT UNSIGNED NOT NULL,
  file_path           VARCHAR(500) NOT NULL,
  file_type           ENUM('photo','ra_bill','measurement_sheet','other') NOT NULL DEFAULT 'other',
  uploaded_by         INT UNSIGNED NOT NULL,
  uploaded_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by)        REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VENDOR CONTRACT HISTORY — track revisions to contract value
-- ============================================================
CREATE TABLE vendor_contract_history (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  engagement_id   INT UNSIGNED NOT NULL,
  previous_value  DECIMAL(14,2) NOT NULL,
  revised_value   DECIMAL(14,2) NOT NULL,
  reason          VARCHAR(300) NOT NULL,
  change_notice_id INT UNSIGNED NULL,        -- linked CN if applicable
  revised_by      INT UNSIGNED NOT NULL,
  revised_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (engagement_id)    REFERENCES vendor_engagements(id),
  FOREIGN KEY (change_notice_id) REFERENCES change_notices(id) ON DELETE SET NULL,
  FOREIGN KEY (revised_by)       REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FEE SCHEDULE HISTORY — track revisions to fee items
-- ============================================================
CREATE TABLE fee_schedule_history (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fee_schedule_id INT UNSIGNED NOT NULL,
  previous_amount DECIMAL(14,2) NOT NULL,
  revised_amount  DECIMAL(14,2) NOT NULL,
  reason          VARCHAR(300) NOT NULL,
  revised_by      INT UNSIGNED NOT NULL,
  revised_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedule(id),
  FOREIGN KEY (revised_by)      REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PROJECT DOCUMENTS (appointment letter, classified)
-- ============================================================

-- ============================================================
-- PROJECT SCOPE
-- ============================================================
CREATE TABLE project_scope (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL UNIQUE,
  scope_type      SET('architecture','structure','mep','interior','pmc','other') NOT NULL,
  sqft_area       DECIMAL(12,2) NULL,
  num_floors      INT UNSIGNED NULL,
  num_blocks      INT UNSIGNED NULL,
  description     TEXT NULL,
  requires_statutory_approvals TINYINT(1) NOT NULL DEFAULT 0,
  dlp_months      INT UNSIGNED NOT NULL DEFAULT 12,
  planned_handover_date DATE NULL,
  retention_amount DECIMAL(14,2) NULL,
  retention_due_date DATE NULL,
  petty_cash_limit DECIMAL(10,2) NULL,
  petty_cash_txn_limit DECIMAL(10,2) NULL,
  updated_by      INT UNSIGNED NOT NULL,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (updated_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PROJECT DATE SANITY CHECKS (AI check results)
-- ============================================================
CREATE TABLE date_sanity_checks (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  check_trigger   ENUM('entry','schedule_upload','revision') NOT NULL,
  dates_checked   JSON NOT NULL,
  issues          JSON NULL,
  warnings        JSON NULL,
  verdict         VARCHAR(500) NULL,
  checked_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by INT UNSIGNED NULL,
  acknowledged_at DATETIME NULL,
  FOREIGN KEY (project_id)      REFERENCES projects(id),
  FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MATERIAL APPROVALS AND MOCK-UPS
-- ============================================================
CREATE TABLE material_approvals (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  trade           VARCHAR(50) NOT NULL,
  material_name   VARCHAR(200) NOT NULL,
  brand_spec      VARCHAR(300) NULL,
  sample_submitted_date DATE NULL,
  submitted_by    INT UNSIGNED NOT NULL,
  approval_status ENUM('pending','approved','rejected','revision_required') NOT NULL DEFAULT 'pending',
  client_response_date DATE NULL,
  client_comments TEXT NULL,
  is_mockup       TINYINT(1) NOT NULL DEFAULT 0,
  file_path       VARCHAR(500) NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- LABOUR COMPLIANCE (per vendor, optional)
-- STATUS (2026-04-25): schema present, not wired into runtime. Deferred to V10.
-- See SHIP_READINESS_REPORT.md "deferred orphan tables" for context.
-- ============================================================
CREATE TABLE labour_compliance (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT UNSIGNED NOT NULL,
  engagement_id   INT UNSIGNED NOT NULL,
  pf_number       VARCHAR(50) NULL,
  esi_number      VARCHAR(50) NULL,
  labour_licence_number VARCHAR(50) NULL,
  labour_licence_expiry DATE NULL,
  alert_sent      TINYINT(1) NOT NULL DEFAULT 0,
  updated_by      INT UNSIGNED NOT NULL,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id)     REFERENCES vendors(id),
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id),
  FOREIGN KEY (updated_by)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VENDOR ACKNOWLEDGEMENTS (WhatsApp YES confirmations)
-- STATUS (2026-04-25): schema present, not wired into runtime. Deferred to V10.
-- See SHIP_READINESS_REPORT.md "deferred orphan tables" for context.
-- ============================================================
CREATE TABLE vendor_acknowledgements (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT UNSIGNED NOT NULL,
  engagement_id   INT UNSIGNED NOT NULL,
  ack_type        ENUM('contract','loi','payment','defect') NOT NULL,
  reference_id    INT UNSIGNED NULL,
  message_sent    TEXT NULL,
  wa_reply        VARCHAR(100) NULL,
  acknowledged    TINYINT(1) NOT NULL DEFAULT 0,
  acknowledged_at DATETIME NULL,
  sent_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id)    REFERENCES vendors(id),
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ADVANCE RECOVERY SCHEDULE
-- ============================================================
CREATE TABLE advance_recovery_schedule (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  engagement_id   INT UNSIGNED NOT NULL,
  advance_type    ENUM('mobilisation','material','other') NOT NULL,
  advance_amount  DECIMAL(14,2) NOT NULL,
  advance_date    DATE NOT NULL,
  recovery_pct_per_bill DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  total_recovered DECIMAL(14,2) NOT NULL DEFAULT 0,
  fully_recovered TINYINT(1) NOT NULL DEFAULT 0,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id),
  FOREIGN KEY (created_by)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 25. VENDOR PAYMENT REQUESTS
-- ============================================================
CREATE TABLE vendor_payments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  vendor_id       INT UNSIGNED NOT NULL,       -- master vendor
  engagement_id   INT UNSIGNED NOT NULL,       -- project-specific engagement
  payment_type    ENUM(
                    'running_account_bill',
                    'advance',
                    'mobilisation_advance',
                    'material_advance',
                    'final_bill',
                    'retention_release',
                    'extra_item',
                    'deduction'
                  ) NOT NULL DEFAULT 'running_account_bill',
  amount_requested  DECIMAL(14,2) NOT NULL,
  work_done_pct     DECIMAL(5,2) NULL,        -- for RA bills
  amount_auto_calc  TINYINT(1) NOT NULL DEFAULT 0, -- 1 if calculated from % complete
  notes             TEXT NULL,
  raised_by         INT UNSIGNED NOT NULL,
  raised_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  week_ending       DATE NOT NULL,
  status            ENUM('pending','approved','processed','paid') NOT NULL DEFAULT 'pending',
  approved_by       INT UNSIGNED NULL,
  approved_at       DATETIME NULL,
  processed_at      DATETIME NULL,
  ai_flag           TINYINT(1) NOT NULL DEFAULT 0,
  ai_flag_note      TEXT NULL,
  recommended_amount DECIMAL(14,2) NULL,
  actual_amount      DECIMAL(14,2) NULL,
  utr_number         VARCHAR(50) NULL,
  payment_date       DATE NULL,
  adjustment_reason  TEXT NULL,
  icici_ref          VARCHAR(100) NULL,
  payment_cycle_id   INT UNSIGNED NULL,
  FOREIGN KEY (project_id)       REFERENCES projects(id),
  FOREIGN KEY (vendor_id)        REFERENCES vendors(id),
  FOREIGN KEY (engagement_id)    REFERENCES vendor_engagements(id),
  FOREIGN KEY (raised_by)       REFERENCES users(id),
  FOREIGN KEY (approved_by)     REFERENCES users(id),
  FOREIGN KEY (payment_cycle_id) REFERENCES vendor_payment_cycles(id) ON DELETE SET NULL,
  CONSTRAINT chk_vp_amount CHECK (actual_amount IS NULL OR actual_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VENDOR PAYMENT EXCEPTIONS (three-strike tracking)
-- ============================================================
CREATE TABLE vendor_payment_exceptions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  engagement_id   INT UNSIGNED NOT NULL,
  payment_id      INT UNSIGNED NULL,
  exception_count INT UNSIGNED NOT NULL DEFAULT 1,
  reason          TEXT NOT NULL,
  approved_by     INT UNSIGNED NOT NULL,
  approved_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id),
  FOREIGN KEY (payment_id)    REFERENCES vendor_payments(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- V8 — VENDOR BANK CHANGE APPROVAL (v5.22)
-- Dual-approval workflow for any change to vendor bank fields.
-- One row per proposed change. Lifecycle: pending → approved/rejected.
-- ============================================================
CREATE TABLE vendor_bank_change_approvals (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  row_version         INT UNSIGNED NOT NULL DEFAULT 1,
  vendor_id           INT UNSIGNED NOT NULL,
  status              ENUM('pending', 'approved', 'rejected', 'cancelled')
                        NOT NULL DEFAULT 'pending',
  proposed_by         INT UNSIGNED NOT NULL,
  proposed_by_role    VARCHAR(40)  NOT NULL,
  proposed_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  proposal_reason     TEXT         NULL,
  before_bank_name    VARCHAR(200) NULL,
  before_bank_account VARCHAR(50)  NULL,
  before_bank_ifsc    VARCHAR(20)  NULL,
  after_bank_name     VARCHAR(200) NULL,
  after_bank_account  VARCHAR(50)  NULL,
  after_bank_ifsc     VARCHAR(20)  NULL,
  approved_by         INT UNSIGNED NULL,
  approved_by_role    VARCHAR(40)  NULL,
  approved_at         DATETIME     NULL,
  rejection_reason    TEXT         NULL,
  committed_at        DATETIME     NULL,
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (proposed_by) REFERENCES users(id)   ON DELETE RESTRICT,
  FOREIGN KEY (approved_by) REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_vbc_status (status),
  INDEX idx_vbc_vendor (vendor_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- V8 alert queue — Matrix-bound, placeholder until bot lives.
CREATE TABLE vendor_alerts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT UNSIGNED NOT NULL,
  alert_type      VARCHAR(60) NOT NULL,
  payload_json    JSON NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  matrix_event_id VARCHAR(255) NULL,
  matrix_room_id  VARCHAR(255) NULL,
  posted_at       DATETIME NULL,
  read_by         INT UNSIGNED NULL,
  read_at         DATETIME NULL,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (read_by)   REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_va_unposted (matrix_event_id, created_at),
  INDEX idx_va_vendor (vendor_id, created_at),
  INDEX idx_va_type (alert_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VENDOR ITERATION 1 (v5.24) — onboarding tokens, contacts, unified approvals
-- See migrations/v5.24-iteration1-vendor-onboarding.sql for column-level docs.
-- ============================================================

CREATE TABLE vendor_contacts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT UNSIGNED NOT NULL,
  role            ENUM('owner','site','accounts') NOT NULL,
  full_name       VARCHAR(100) NULL,
  phone           VARCHAR(15)  NULL,
  email           VARCHAR(100) NULL,
  matrix_user_id  VARCHAR(255) NULL,
  is_primary      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  UNIQUE KEY uq_vendor_role (vendor_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vendor_onboarding_tokens (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id     INT UNSIGNED NOT NULL,
  token         VARCHAR(64)  NOT NULL,
  purpose       ENUM('bank_confirm','onboard','re_validation') NOT NULL,
  status        ENUM('issued','opened','consumed','expired','revoked') NOT NULL DEFAULT 'issued',
  issued_by     INT UNSIGNED NULL,
  issued_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL,
  opened_at     DATETIME NULL,
  consumed_at   DATETIME NULL,
  payload_json  JSON NULL,
  approval_id   INT UNSIGNED NULL,
  open_count    INT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by)   REFERENCES users(id)   ON DELETE SET NULL,
  FOREIGN KEY (approval_id) REFERENCES vendor_bank_change_approvals(id) ON DELETE SET NULL,
  UNIQUE KEY uq_token (token),
  INDEX idx_vendor_status (vendor_id, status, expires_at),
  INDEX idx_status_expires (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE approval_type_config (
  id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_type            VARCHAR(60) NOT NULL UNIQUE,
  signer_roles_json        JSON NOT NULL,
  quorum                   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  scope                    ENUM('project','global') NOT NULL DEFAULT 'project',
  requires_vendor_confirm  TINYINT(1) NOT NULL DEFAULT 0,
  expires_after_hours      INT UNSIGNED NULL,
  label                    VARCHAR(120) NOT NULL,
  description              TEXT NULL,
  sheet_source             VARCHAR(40) NULL,
  active                   TINYINT(1) NOT NULL DEFAULT 1,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE approvals (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_type   VARCHAR(60) NOT NULL,
  ref_table       VARCHAR(50) NOT NULL,
  ref_id          INT UNSIGNED NOT NULL,
  project_id      INT UNSIGNED NULL,
  raised_by       INT UNSIGNED NOT NULL,
  raised_by_role  VARCHAR(40)  NOT NULL,
  raised_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title           VARCHAR(300) NOT NULL,
  details         TEXT NULL,
  status          ENUM('pending','approved','rejected','expired','cancelled')
                    NOT NULL DEFAULT 'pending',
  resolved_at     DATETIME NULL,
  resolved_by     INT UNSIGNED NULL,
  resolution_note TEXT NULL,
  expires_at      DATETIME NULL,
  vendor_id       INT UNSIGNED NULL,
  vendor_confirmed_at DATETIME NULL,
  row_version     INT UNSIGNED NOT NULL DEFAULT 1,
  FOREIGN KEY (raised_by)   REFERENCES users(id)    ON DELETE RESTRICT,
  FOREIGN KEY (resolved_by) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id)  ON DELETE SET NULL,
  INDEX idx_approvals_ref (ref_table, ref_id, status),
  INDEX idx_approvals_status (status, raised_at),
  INDEX idx_approvals_project (project_id, status),
  INDEX idx_approvals_vendor (vendor_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE approval_signoffs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_id     INT UNSIGNED NOT NULL,
  signer_id       INT UNSIGNED NOT NULL,
  signer_role     VARCHAR(40)  NOT NULL,
  vote            ENUM('approve','reject') NOT NULL,
  comment         TEXT NULL,
  voted_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE,
  FOREIGN KEY (signer_id)   REFERENCES users(id)     ON DELETE RESTRICT,
  UNIQUE KEY uq_approval_signer (approval_id, signer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PETTY CASH TRANSACTIONS
-- ============================================================
CREATE TABLE petty_cash_transactions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  txn_date        DATE NOT NULL,
  description     VARCHAR(300) NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  txn_type        ENUM('spend','replenishment') NOT NULL DEFAULT 'spend',
  category        ENUM('labour','material','site_expense','other') NOT NULL DEFAULT 'other',
  bill_available  TINYINT(1) NOT NULL DEFAULT 0,
  file_path       VARCHAR(500) NULL,
  recorded_by     INT UNSIGNED NOT NULL,
  recorded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by     INT UNSIGNED NULL,
  approved_at     DATETIME NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PRINCIPAL DIRECT PAYMENTS (Naveen UPI / cash)
-- ============================================================
CREATE TABLE principal_direct_payments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  payment_date    DATE NOT NULL,
  payment_type    ENUM('upi','cash') NOT NULL,
  amount          DECIMAL(14,2) NOT NULL,
  paid_to         VARCHAR(200) NOT NULL,
  description     VARCHAR(300) NOT NULL,
  upi_ref         VARCHAR(100) NULL,
  file_path       VARCHAR(500) NULL,
  boq_head        VARCHAR(100) NULL,
  tagged_by       INT UNSIGNED NULL,
  recorded_by     INT UNSIGNED NOT NULL,
  recorded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  FOREIGN KEY (tagged_by)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- CLIENT PAYMENT RECEIPTS
-- ============================================================
CREATE TABLE client_receipts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  pi_id           INT UNSIGNED NOT NULL,
  receipt_date    DATE NOT NULL,
  amount_received DECIMAL(14,2) NOT NULL,
  tds_deducted    DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_received    DECIMAL(14,2) NOT NULL,
  utr             VARCHAR(100) NULL,
  bank_ref        VARCHAR(100) NULL,
  notes           VARCHAR(300) NULL,
  recorded_by     INT UNSIGNED NOT NULL,
  recorded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (pi_id)       REFERENCES proforma_invoices(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TDS RECORDS
-- ============================================================
CREATE TABLE tds_records (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  pi_id           INT UNSIGNED NOT NULL,
  receipt_id      INT UNSIGNED NOT NULL,
  tds_amount      DECIMAL(14,2) NOT NULL,
  tds_rate        DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  tds_section     VARCHAR(20) NOT NULL DEFAULT '194J',
  form16a_received TINYINT(1) NOT NULL DEFAULT 0,
  quarter         VARCHAR(10) NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (pi_id)      REFERENCES proforma_invoices(id),
  FOREIGN KEY (receipt_id) REFERENCES client_receipts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PRE-HANDOVER SNAG LIST
-- ============================================================
CREATE TABLE pre_handover_snags (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  trade           VARCHAR(50) NOT NULL,
  location        VARCHAR(200) NULL,
  description     TEXT NOT NULL,
  severity        ENUM('critical','major','minor') NOT NULL DEFAULT 'minor',
  responsible_vendor_id INT UNSIGNED NULL,
  raised_by       INT UNSIGNED NOT NULL,
  raised_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date        DATE NULL,
  status          ENUM('open','in_progress','resolved','accepted_by_client') NOT NULL DEFAULT 'open',
  resolved_by     INT UNSIGNED NULL,
  resolved_at     DATETIME NULL,
  resolution_note TEXT NULL,
  file_path       VARCHAR(500) NULL,
  FOREIGN KEY (project_id)           REFERENCES projects(id),
  FOREIGN KEY (responsible_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
  FOREIGN KEY (raised_by)            REFERENCES users(id),
  FOREIGN KEY (resolved_by)          REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ARCHIVAL LOG
-- STATUS (2026-04-25): schema present, not wired into runtime. Deferred to V10.
-- See SHIP_READINESS_REPORT.md "deferred orphan tables" for context.
-- ============================================================
CREATE TABLE archival_log (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  archived_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_by     INT UNSIGNED NOT NULL,
  retain_until    DATE NOT NULL,
  notes           VARCHAR(300) NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (archived_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- USER PENDING APPROVALS (two-step user creation)
-- ============================================================
CREATE TABLE user_pending (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(50) NOT NULL UNIQUE,
  full_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(15) NULL,
  role            VARCHAR(30) NOT NULL,
  stream          VARCHAR(20) NOT NULL DEFAULT 'all',
  initiated_by    INT UNSIGNED NOT NULL,
  initiated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by     INT UNSIGNED NULL,
  reviewed_at     DATETIME NULL,
  rejection_reason VARCHAR(300) NULL,
  FOREIGN KEY (initiated_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- WEEKLY REPORT DOCUMENTS (versioned draft + final)
-- ============================================================
CREATE TABLE weekly_report_documents (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  week_ending     DATE NOT NULL,
  version         INT UNSIGNED NOT NULL DEFAULT 1,
  doc_type        ENUM('draft','final') NOT NULL DEFAULT 'draft',
  file_path       VARCHAR(500) NULL,
  generated_by    INT UNSIGNED NULL,
  generated_at    DATETIME NULL,
  uploaded_by     INT UNSIGNED NULL,
  uploaded_at     DATETIME NULL,
  notes           VARCHAR(300) NULL,
  FOREIGN KEY (project_id)   REFERENCES projects(id),
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SUBMITTAL LOG
-- ============================================================
CREATE TABLE submittals (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id        INT UNSIGNED NOT NULL,
  submittal_number  VARCHAR(20) NOT NULL,         -- SUB-001
  engagement_id     INT UNSIGNED NOT NULL,
  title             VARCHAR(300) NOT NULL,
  submittal_type    ENUM('shop_drawing','material_sample','product_data','test_report','other') NOT NULL DEFAULT 'shop_drawing',
  submitted_by      INT UNSIGNED NOT NULL,
  submitted_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_path         VARCHAR(500) NULL,
  reviewed_by       INT UNSIGNED NULL,
  reviewed_at       DATETIME NULL,
  status            ENUM('submitted','under_review','approved','approved_with_comments','resubmit_required','rejected') NOT NULL DEFAULT 'submitted',
  review_comments   TEXT NULL,
  resubmit_count    INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_submittals_project_number (project_id, submittal_number),
  FOREIGN KEY (project_id)   REFERENCES projects(id),
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FORM TEMPLATES — custom and standard
-- ============================================================
CREATE TABLE form_templates (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(200) NOT NULL,
  category          ENUM('quality','safety','inspection','handover','custom') NOT NULL DEFAULT 'custom',
  is_standard       TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = ships with app
  version           INT UNSIGNED NOT NULL DEFAULT 1,
  fields_json       JSON NOT NULL,                  -- field definitions
  created_by        INT UNSIGNED NOT NULL,
  approved_by       INT UNSIGNED NULL,
  approved_at       DATETIME NULL,
  status            ENUM('draft','approved','archived') NOT NULL DEFAULT 'draft',
  project_id        INT UNSIGNED NULL,              -- NULL = global template
  file_path         VARCHAR(500) NULL,              -- uploaded Excel version
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by)  REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FORM SUBMISSIONS — filled forms per project
-- ============================================================
CREATE TABLE form_submissions (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id       INT UNSIGNED NOT NULL,
  template_version  INT UNSIGNED NOT NULL DEFAULT 1,
  project_id        INT UNSIGNED NOT NULL,
  submitted_by      INT UNSIGNED NOT NULL,
  submitted_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responses_json    JSON NOT NULL,
  file_path         VARCHAR(500) NULL,
  notes             TEXT NULL,
  FOREIGN KEY (template_id) REFERENCES form_templates(id),
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- LABOUR REGISTER — daily headcount per contractor per trade
-- ============================================================
CREATE TABLE labour_register (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id        INT UNSIGNED NOT NULL,
  engagement_id     INT UNSIGNED NOT NULL,
  register_date     DATE NOT NULL,
  trade             VARCHAR(50) NOT NULL,
  headcount         INT UNSIGNED NOT NULL DEFAULT 0,
  wages_paid        DECIMAL(10,2) NULL,           -- lump sum, PMC calculated
  recorded_by       INT UNSIGNED NOT NULL,
  recorded_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes             VARCHAR(300) NULL,
  validated_by      INT UNSIGNED NULL,
  validated_at      DATETIME NULL,
  validation_notes  VARCHAR(300) NULL,
  UNIQUE KEY uq_labour_date (project_id, engagement_id, register_date, trade),
  FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id)   REFERENCES projects(id),
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id),
  FOREIGN KEY (recorded_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- GOODS RECEIPT NOTES (GRN)
-- ============================================================
CREATE TABLE grns (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id        INT UNSIGNED NOT NULL,
  grn_number        VARCHAR(20) NOT NULL,           -- GRN-001
  engagement_id     INT UNSIGNED NOT NULL,
  material_request_id INT UNSIGNED NULL,            -- optional link
  delivery_date     DATE NOT NULL,
  description       TEXT NOT NULL,
  quantity_received DECIMAL(12,3) NOT NULL,
  unit              VARCHAR(30) NULL,
  delivery_note_ref VARCHAR(100) NULL,
  invoice_ref       VARCHAR(100) NULL,
  delivery_note_path VARCHAR(500) NULL,
  invoice_path      VARCHAR(500) NULL,
  is_unplanned      TINYINT(1) NOT NULL DEFAULT 0,  -- flagged if no material request
  raised_by         INT UNSIGNED NOT NULL,          -- site manager
  raised_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by       INT UNSIGNED NULL,              -- PMC Head
  approved_at       DATETIME NULL,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason  VARCHAR(300) NULL,
  FOREIGN KEY (project_id)          REFERENCES projects(id),
  FOREIGN KEY (engagement_id)       REFERENCES vendor_engagements(id),
  FOREIGN KEY (material_request_id) REFERENCES material_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (raised_by)           REFERENCES users(id),
  FOREIGN KEY (approved_by)         REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_grn_qty CHECK (quantity_received > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PMC HEAD DEPUTY — table dropped in v5.11. Deputisation is now
-- handled via the unified users.deputy_id mechanism (see users
-- table above) plus user_leave_requests for the leave-window data.
-- ============================================================

-- ============================================================
-- SCHEDULE RISK NARRATIVES — AI generated weekly
-- ============================================================
CREATE TABLE schedule_risk_narratives (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id        INT UNSIGNED NOT NULL,
  trade             VARCHAR(50) NOT NULL,
  week_ending       DATE NOT NULL,
  planned_pct       DECIMAL(5,2) NOT NULL,
  actual_pct        DECIMAL(5,2) NOT NULL,
  gap_pct           DECIMAL(5,2) NOT NULL,
  weeks_behind      DECIMAL(4,1) NOT NULL DEFAULT 0,
  forecast_delay    DECIMAL(4,1) NOT NULL DEFAULT 0,
  narrative         TEXT NOT NULL,
  escalation_level  ENUM('amber','red','critical') NOT NULL DEFAULT 'amber',
  notified_pmc      TINYINT(1) NOT NULL DEFAULT 0,
  notified_naveen   TINYINT(1) NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_trade_week (project_id, trade, week_ending),
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- BUDGET COST HEADS — auto-derived from BOQ trades + custom
-- ============================================================
CREATE TABLE budget_cost_heads (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  code            VARCHAR(30) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  stream          ENUM('design','services','common') NOT NULL DEFAULT 'common',
  sanctioned      DECIMAL(14,2) NOT NULL DEFAULT 0,  -- sum of BOQ line items in this trade
  is_custom       TINYINT(1) NOT NULL DEFAULT 0,
  approved_by     INT UNSIGNED NULL,                 -- for custom heads — stream head sign-off
  approved_at     DATETIME NULL,
  status          ENUM('pending','approved') NOT NULL DEFAULT 'approved',
  display_order   INT UNSIGNED NOT NULL DEFAULT 0,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_code (project_id, code),
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (created_by)  REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_bch_sanctioned CHECK (sanctioned >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- BUDGET FLAGS — tracks flag history for 3-strike rule
-- ============================================================
CREATE TABLE budget_flags (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  cost_head_id    INT UNSIGNED NOT NULL,
  boq_item_id     INT UNSIGNED NULL,            -- NULL = trade-level flag
  flag_level      ENUM('line_item','trade','project') NOT NULL,
  pct_over        DECIMAL(6,3) NOT NULL,
  sanctioned      DECIMAL(14,2) NOT NULL,
  committed       DECIMAL(14,2) NOT NULL,
  trigger_stage   ENUM('engagement','po') NOT NULL,
  engagement_id   INT UNSIGNED NULL,
  strike_number   INT UNSIGNED NOT NULL DEFAULT 1,
  signoff_by      INT UNSIGNED NULL,
  signoff_at      DATETIME NULL,
  signoff_note    TEXT NULL,
  escalated       TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)    REFERENCES projects(id),
  FOREIGN KEY (cost_head_id)  REFERENCES budget_cost_heads(id),
  FOREIGN KEY (boq_item_id)   REFERENCES boq_items(id) ON DELETE SET NULL,
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id) ON DELETE SET NULL,
  FOREIGN KEY (signoff_by)    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- WHATSAPP PENDING ACTIONS — reply-to-act state machine
-- ============================================================
CREATE TABLE wa_pending_actions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- App-channel approval fields (schedule changes, CNs, etc.)
  project_id      INT UNSIGNED NULL,
  request_type    VARCHAR(50) NULL,             -- app-channel types: schedule_change, cn_approval, etc.
  title           VARCHAR(300) NULL,
  details         TEXT NULL,
  drift_days      INT NULL,
  rejection_note  TEXT NULL,
  raised_by       INT UNSIGNED NULL,
  raised_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actioned_at     DATETIME NULL,
  -- WhatsApp-channel fields (confirmations, acks, replies)
  action_type     ENUM('anomaly_ack','grn_approve','report_update','issue_confirm',
                       'vendor_defect_ack','urgent_payment_fyi','mom_client_ack',
                       'udupa_excel_request','drawing_query','drawing_approval',
                       'rfi_photo_reply','schedule_change','cn_approval') NULL,
  ref_id          INT UNSIGNED NULL,            -- ID of the thing being acted on
  ref_table       VARCHAR(50) NULL,             -- grns, issues, daily_reports etc
  phone           VARCHAR(20) NULL,             -- who should reply (null for app-channel)
  user_id         INT UNSIGNED NULL,            -- internal user (NULL for vendors/clients)
  message_sent    TEXT NULL,                    -- what was sent
  sent_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reply_received  VARCHAR(500) NULL,
  replied_at      DATETIME NULL,
  channel         ENUM('whatsapp','app','both') NOT NULL DEFAULT 'whatsapp',
  budget_flag_id  INT UNSIGNED NULL,
  rfi_id          INT UNSIGNED NULL,
  status          ENUM('pending','acted','approved','rejected','expired','cancelled') NOT NULL DEFAULT 'pending',
  expires_at      DATETIME NULL,                -- null for app-channel approvals
  auto_accept_at  DATETIME NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (raised_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- WHATSAPP MESSAGE LOG — every inbound/outbound for ISO audit
-- ============================================================
-- VALIDATION RETRY QUEUE — GSTIN / TAN retries on API failure
-- ============================================================
CREATE TABLE validation_retry_queue (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type     VARCHAR(20) NOT NULL,
  entity_id       INT UNSIGNED NOT NULL,
  validation_type ENUM('gstin','tan','pan','ifsc') NOT NULL,
  value           VARCHAR(20) NOT NULL,
  retry_count     INT UNSIGNED NOT NULL DEFAULT 0,
  status          ENUM('pending','resolved','failed') NOT NULL DEFAULT 'pending',
  error           VARCHAR(200) NULL,
  resolved_at     DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entity_type_val (entity_id, validation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- EMAIL LOG — SES delivery tracking for ISO audit
-- ============================================================
-- URGENT PAYMENT REQUESTS — two lanes: known vendor and ad hoc
-- ============================================================

-- ============================================================
-- ISSUE PHOTOS — photos submitted against an RFI photo request
-- ============================================================
CREATE TABLE issue_photos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  issue_id      INT UNSIGNED NOT NULL,
  project_id    INT UNSIGNED NOT NULL,
  submitted_by  INT UNSIGNED NOT NULL,
  file_path     VARCHAR(300) NOT NULL,
  source        ENUM('whatsapp','app') NOT NULL DEFAULT 'app',
  caption       VARCHAR(200) NULL,
  submitted_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id)    REFERENCES issues(id),
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- COMMS LOG — unified ISO audit trail for all outbound communications
-- Replaces email_log and wa_message_log
-- ============================================================
CREATE TABLE comms_log (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel         ENUM('whatsapp','email','sms') NOT NULL,
  direction       ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
  -- Recipient
  user_id         INT UNSIGNED NULL,
  to_address      VARCHAR(200) NOT NULL,       -- phone or email address
  -- Message
  subject         VARCHAR(300) NULL,           -- email subject
  body            TEXT NULL,
  message_type    VARCHAR(50) NULL,
  -- Delivery tracking
  provider_msg_id VARCHAR(100) NULL,           -- Twilio SID or SES message ID
  status          ENUM('queued','sent','delivered','read','failed','bounced','complaint') NOT NULL DEFAULT 'queued',
  error_code      VARCHAR(20) NULL,
  -- Timestamps
  sent_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at    DATETIME NULL,
  read_at         DATETIME NULL,
  bounced_at      DATETIME NULL,
  -- Project context
  project_id      INT UNSIGNED NULL,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SITE CHECKINS — 9:30AM location captures for PMC digest
-- ============================================================
CREATE TABLE site_checkins (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  project_id      INT UNSIGNED NOT NULL,
  checkin_date    DATE NOT NULL,
  checkin_time    TIME NOT NULL,
  latitude        DECIMAL(10,7) NULL,
  longitude       DECIMAL(10,7) NULL,
  accuracy        DECIMAL(8,2) NULL,
  address         VARCHAR(300) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_date (user_id, checkin_date),
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VENDOR BOQ MAPPING — links vendor engagements to client BOQ items
-- Supports all 4 relationship types: 1:1, 1:many, many:1, many:many
-- ============================================================
CREATE TABLE vendor_boq_mapping (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  engagement_id   INT UNSIGNED NOT NULL,   -- vendor engagement
  boq_item_id     INT UNSIGNED NOT NULL,   -- client BOQ item
  split_pct       DECIMAL(5,2) NULL,       -- if one vendor covers partial BOQ item
  notes           VARCHAR(300) NULL,
  mapped_by       INT UNSIGNED NOT NULL,
  ai_suggested    TINYINT(1) NOT NULL DEFAULT 0,
  ai_confidence   DECIMAL(4,3) NULL,
  confirmed_by    INT UNSIGNED NULL,
  confirmed_at    DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_eng_boq (engagement_id, boq_item_id),
  FOREIGN KEY (project_id)   REFERENCES projects(id),
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id),
  FOREIGN KEY (boq_item_id)  REFERENCES boq_items(id),
  FOREIGN KEY (mapped_by)    REFERENCES users(id),
  FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 22. INDEXES for performance
-- ============================================================
CREATE INDEX idx_task_updates_task_date     ON task_updates(task_id, report_date);
CREATE INDEX idx_task_updates_project       ON task_updates(project_id);
CREATE INDEX idx_photos_project_date        ON project_photos(project_id, photo_date);
CREATE INDEX idx_photos_task               ON project_photos(task_id);
CREATE INDEX idx_drawings_project          ON drawings(project_id);
CREATE INDEX idx_drawings_type              ON drawings(project_id, drawing_type);
CREATE INDEX idx_drawing_register_project   ON drawing_register(project_id, stream);
CREATE INDEX idx_drawing_register_status    ON drawing_register(project_id, status);

-- ============================================================
-- v2: PHOTO TAGS — AI + human tagging with audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_tags (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  photo_id        INT UNSIGNED NOT NULL,
  task_id         INT UNSIGNED NULL,
  trade           VARCHAR(50) NULL,
  caption         VARCHAR(500) NULL,
  tagged_by       INT UNSIGNED NULL,       -- NULL means AI-only
  tag_source      ENUM('ai','site_manager','pmc','design','services','principal') NOT NULL DEFAULT 'ai',
  is_current      TINYINT(1) NOT NULL DEFAULT 1,
  ai_confidence   ENUM('low','medium','high') NULL,
  ai_note         TEXT NULL,
  replaces_tag_id INT UNSIGNED NULL,       -- previous tag this one replaced (audit chain)
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES project_photos(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES schedule_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (tagged_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (replaces_tag_id) REFERENCES photo_tags(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_photo_tags_photo   ON photo_tags(photo_id, is_current);
CREATE INDEX idx_photo_tags_source  ON photo_tags(tag_source);

-- ============================================================
-- v2: DRAWING AI ANALYSIS RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS drawing_ai_checks (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  drawing_version_id INT UNSIGNED NOT NULL,
  check_type        ENUM('common_sense','detail_context','rfi_relevance','revision_change') NOT NULL,
  result_json       JSON NULL,              -- full AI response
  ok                TINYINT(1) NULL,
  severity          ENUM('info','warn','error') NULL,
  summary           TEXT NULL,              -- human-readable one-liner
  acknowledged_by   INT UNSIGNED NULL,
  acknowledged_at   DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (drawing_version_id) REFERENCES drawing_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_dwg_ai_checks_version ON drawing_ai_checks(drawing_version_id);

-- ============================================================
-- v2: UNIFIED DELEGATION MODEL
-- One mechanism for every role-to-role delegation. Project-scoped
-- delegations have project_id set; app-wide delegations leave it NULL.
-- Naveen ↔ Ajay permanent interchangeability is seeded at migration time.
-- ============================================================
CREATE TABLE IF NOT EXISTS delegations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  from_user_id    INT UNSIGNED NOT NULL,    -- the person going on leave / delegating
  to_user_id      INT UNSIGNED NOT NULL,    -- the person taking over
  project_id      INT UNSIGNED NULL,        -- NULL = all projects
  scope           ENUM('full','limited_pmc','photo_tags_only') NOT NULL DEFAULT 'full',
  -- limited_pmc = used when delegating PMC → Site Manager on their own project
  -- (operational tasks only, no governance approvals)
  start_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_at          DATETIME NULL,            -- NULL = permanent (principal ↔ principal)
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  revoked_at      DATETIME NULL,
  revoked_by      INT UNSIGNED NULL,
  reason          TEXT NULL,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id)   REFERENCES users(id),
  FOREIGN KEY (project_id)   REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (revoked_by)   REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_delegations_to     ON delegations(to_user_id, is_active);
CREATE INDEX idx_delegations_from   ON delegations(from_user_id, is_active);
CREATE INDEX idx_delegations_window ON delegations(is_active, start_at, end_at);

-- Seed permanent Naveen ↔ Ajay delegation (runs idempotently on migration)
-- Will be inserted by scripts/v2-migration.js after users exist.

CREATE INDEX idx_drawing_versions_drawing  ON drawing_versions(drawing_id);
CREATE INDEX idx_drawing_versions_status   ON drawing_versions(status);
CREATE INDEX idx_material_project_status   ON material_requests(project_id, status);
CREATE INDEX idx_material_overdue          ON material_requests(is_overdue);
CREATE INDEX idx_cn_status                 ON change_notices(status);
CREATE INDEX idx_schedule_tasks_project    ON schedule_tasks(project_id, schedule_version_id);
CREATE INDEX idx_daily_reports_project     ON daily_reports(project_id, report_date);

-- Udupa (finance) — system user for invoice notifications
INSERT INTO users (username, password_hash, full_name, role, stream, managed_by) VALUES
('udupa', '$2b$10$placeholder', 'Udupa', 'principal', 'all', 1);

-- v2: composite indexes for dashboard hot paths
CREATE INDEX IF NOT EXISTS idx_schedule_versions_proj_status ON schedule_versions (project_id, status);
CREATE INDEX IF NOT EXISTS idx_change_notices_proj_status ON change_notices (project_id, status);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_proj_status ON weekly_reports (project_id, status);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_proj_status ON proforma_invoices (project_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_cycles_proj_status ON vendor_payment_cycles (project_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_proj_status ON payment_requests (project_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_proj_status ON issues (project_id, status);
CREATE INDEX IF NOT EXISTS idx_submittals_proj_status ON submittals (project_id, status);
CREATE INDEX IF NOT EXISTS idx_grns_proj_status ON grns (project_id, status);
CREATE INDEX IF NOT EXISTS idx_comms_log_proj_status ON comms_log (project_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_engagements_proj_status ON vendor_engagements (project_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_proj_status ON vendor_payments (project_id, status);
-- idx_measurements_proj_status moved later, see after CREATE TABLE measurements
CREATE INDEX IF NOT EXISTS idx_budget_cost_heads_proj_status ON budget_cost_heads (project_id, status);
CREATE INDEX IF NOT EXISTS idx_pre_handover_snags_proj_status ON pre_handover_snags (project_id, status);
CREATE INDEX IF NOT EXISTS idx_form_templates_proj_status ON form_templates (project_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_pending_actions_proj_status ON wa_pending_actions (project_id, status);

-- ============================================================
-- Done
-- ============================================================

-- ============================================================
-- 23. VENDORS
-- Seed data — both entities
-- Company entity rows are in nu-pmc-seed-example.sql (placeholder data).
-- Load that file after this one, then update your real details via
-- Settings → Account Setup in the app.

-- ============================================================
-- 24. VENDOR BOQ ASSIGNMENTS
-- Links vendor to specific BOQ items with our cost rate
-- ============================================================
CREATE TABLE vendor_boq_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT UNSIGNED NOT NULL,       -- master vendor
  engagement_id   INT UNSIGNED NOT NULL,       -- project-specific engagement
  boq_item_id     INT UNSIGNED NOT NULL,
  our_cost_rate   DECIMAL(12,4) NOT NULL DEFAULT 0,
  our_cost_total  DECIMAL(14,4) NOT NULL DEFAULT 0,  -- updated by app when rate changes
  notes           VARCHAR(300) NULL,
  entered_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vendor_item (vendor_id, boq_item_id),
  FOREIGN KEY (vendor_id)    REFERENCES vendors(id),
  FOREIGN KEY (engagement_id) REFERENCES vendor_engagements(id),
  FOREIGN KEY (boq_item_id)  REFERENCES boq_items(id),
  FOREIGN KEY (entered_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 26. WHATSAPP NOTIFICATIONS LOG
-- ============================================================
CREATE TABLE whatsapp_notifications (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  phone           VARCHAR(15) NULL,
  message_type    VARCHAR(50) NOT NULL,
  message_body    TEXT NOT NULL,
  status          ENUM('pending','sent','failed','queued') NOT NULL DEFAULT 'queued',
  sent_at         DATETIME NULL,
  pdf_path        VARCHAR(500) NULL,
  error_message   TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- whatsapp_notifications preference flag (phone column already defined above)
ALTER TABLE users ADD COLUMN whatsapp_notifications TINYINT(1) NOT NULL DEFAULT 1 AFTER email;

-- ============================================================
-- MATRIX SUBSTRATE (v5.23) — room mapping + send outbox
-- See migrations/v5.23-matrix-substrate.sql for column-level docs.
-- ============================================================
CREATE TABLE matrix_rooms (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id  INT UNSIGNED NULL,
  room_type   ENUM('site','finance','design','general',
                   'internal_naveen','internal_finance','system_health')
                NOT NULL,
  room_id     VARCHAR(255) NOT NULL,
  room_alias  VARCHAR(255) NULL,
  encrypted   TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_project_room (project_id, room_type),
  INDEX idx_room_id (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE matrix_outbox (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id         VARCHAR(255) NOT NULL,
  txn_id          VARCHAR(64)  NOT NULL,
  msg_type        ENUM('text','poll','image','file') NOT NULL DEFAULT 'text',
  body            TEXT NOT NULL,
  mxc_url         VARCHAR(500) NULL,
  recipient_uid   INT UNSIGNED NULL,
  status          ENUM('pending','sending','sent','failed','dry_run')
                    NOT NULL DEFAULT 'pending',
  attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_error      TEXT NULL,
  matrix_event_id VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         DATETIME NULL,
  UNIQUE KEY uq_txn (txn_id),
  INDEX idx_status_created (status, created_at),
  INDEX idx_recipient (recipient_uid, created_at),
  FOREIGN KEY (recipient_uid) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 27. CLIENT BOQ VERSIONS
-- Separate from internal BOQ — has client rates
-- Visible only to: Naveen, Ajay, M/P, Rajani, Srinath
-- ============================================================
CREATE TABLE client_boq_versions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  stream          ENUM('design','services','civil','all') NOT NULL DEFAULT 'all',
  version_number  INT UNSIGNED NOT NULL DEFAULT 1,
  label           VARCHAR(10) NOT NULL,
  file_path       VARCHAR(500) NULL,
  is_current      TINYINT(1) NOT NULL DEFAULT 0,
  uploaded_by     INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 28. CLIENT BOQ ITEMS
-- ============================================================
CREATE TABLE client_boq_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  boq_version_id  INT UNSIGNED NOT NULL,
  project_id      INT UNSIGNED NOT NULL,
  stream          ENUM('design','services','civil','all') NOT NULL DEFAULT 'all',
  trade           VARCHAR(50) NOT NULL,
  item_code       VARCHAR(50) NULL,
  item_name       VARCHAR(300) NOT NULL,
  unit            VARCHAR(30) NOT NULL,
  quantity        DECIMAL(12,3) NOT NULL DEFAULT 0,
  client_rate     DECIMAL(12,4) NOT NULL DEFAULT 0,  -- visible to 5 roles only
  display_order   INT UNSIGNED NOT NULL DEFAULT 0,
  hsn_code        VARCHAR(10) NULL,     -- editable by R/S and Udupa
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (boq_version_id) REFERENCES client_boq_versions(id),
  FOREIGN KEY (project_id)     REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 29. MEASUREMENTS (Joint Measurement Records)
-- ============================================================
CREATE TABLE measurements (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id              INT UNSIGNED NOT NULL,
  ra_bill_number          VARCHAR(20) NOT NULL,
  discipline              VARCHAR(50) NOT NULL,  -- Civil, Electrical, HVAC etc
  measurement_date        DATE NOT NULL,
  notes                   TEXT NULL,
  -- R/S technical sign-off
  checked_by              INT UNSIGNED NULL,
  checked_at              DATETIME NULL,
  rs_notes                TEXT NULL,
  -- Client acceptance
  client_rep_name         VARCHAR(100) NULL,
  client_rep_designation  VARCHAR(100) NULL,
  client_accepted_at      DATE NULL,
  deductions_notes        TEXT NULL,
  signed_certificate_path VARCHAR(500) NULL,
  -- Status flow: draft → rs_signed → client_accepted
  status                  ENUM('draft','rs_signed','client_accepted') NOT NULL DEFAULT 'draft',
  recorded_by             INT UNSIGNED NOT NULL,
  approved_by             INT UNSIGNED NULL,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  FOREIGN KEY (checked_by)  REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
  -- chk_m_sqft removed: referenced sqft_area which is not a column on this table
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index moved here (was at line ~1957 in the early indexes block, where the
-- table didn't yet exist). Same column pair, just correct ordering.
CREATE INDEX IF NOT EXISTS idx_measurements_proj_status ON measurements (project_id, status);

-- ============================================================
-- 30. MEASUREMENT ITEMS (per BOQ line item)
-- ============================================================
CREATE TABLE measurement_items (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  measurement_id        INT UNSIGNED NOT NULL,
  client_boq_item_id    INT UNSIGNED NOT NULL,
  measured_qty          DECIMAL(12,3) NOT NULL DEFAULT 0,
  quality_note          TEXT NULL,
  UNIQUE KEY uq_meas_item (measurement_id, client_boq_item_id),
  FOREIGN KEY (measurement_id)     REFERENCES measurements(id),
  FOREIGN KEY (client_boq_item_id) REFERENCES client_boq_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 31. CLIENT CLAIMS
-- ============================================================
CREATE TABLE client_claims (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  ra_bill_number  VARCHAR(20) NOT NULL,
  discipline      VARCHAR(50) NOT NULL,
  measurement_id  INT UNSIGNED NULL,
  notes           TEXT NULL,
  -- M/P sign-off
  pmc_signoff     INT UNSIGNED NULL,
  pmc_signoff_at  DATETIME NULL,
  -- R/S sign-off
  rs_signoff      INT UNSIGNED NULL,
  rs_signoff_at   DATETIME NULL,
  -- Principal approval
  approved_by     INT UNSIGNED NULL,
  approved_at     DATETIME NULL,
  -- Invoice tracking
  invoice_number  VARCHAR(50) NULL,
  invoice_date    DATE NULL,
  invoice_sequence INT UNSIGNED NULL,          -- per-prefix running sequence (v3.1)
  invoiced_by     INT UNSIGNED NULL,
  invoiced_at     DATETIME NULL,
  raised_by       INT UNSIGNED NOT NULL,
  status          ENUM('draft','pending_approval','approved','invoiced') NOT NULL DEFAULT 'draft',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)    REFERENCES projects(id),
  FOREIGN KEY (measurement_id) REFERENCES measurements(id),
  FOREIGN KEY (pmc_signoff)   REFERENCES users(id),
  FOREIGN KEY (rs_signoff)    REFERENCES users(id),
  FOREIGN KEY (approved_by)   REFERENCES users(id),
  FOREIGN KEY (invoiced_by)   REFERENCES users(id),
  FOREIGN KEY (raised_by)     REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 32. CLAIM ITEMS
-- ============================================================
CREATE TABLE claim_items (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  claim_id              INT UNSIGNED NOT NULL,
  client_boq_item_id    INT UNSIGNED NOT NULL,
  claimed_qty           DECIMAL(12,3) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_claim_item (claim_id, client_boq_item_id),
  FOREIGN KEY (claim_id)            REFERENCES client_claims(id),
  FOREIGN KEY (client_boq_item_id)  REFERENCES client_boq_items(id)
  -- chk_ci_prev / chk_ci_rev removed: previous_amount and revised_amount are not
  -- columns on this table (likely lifted from an earlier draft schema).
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- INDEXES for new tables
-- ============================================================
CREATE INDEX idx_client_boq_project    ON client_boq_items(project_id, stream);
CREATE INDEX idx_measurements_project  ON measurements(project_id, discipline);
CREATE INDEX idx_claims_project_status ON client_claims(project_id, status);
CREATE INDEX idx_claim_items_claim     ON claim_items(claim_id);

-- ============================================================
-- 35. PAYMENT APPROVAL AUTHORITY (project-level config)
-- Currently: principal_only (Naveen). Future: pmc_with_limit
-- ============================================================
ALTER TABLE projects ADD COLUMN payment_approval_authority
  ENUM('principal_only','pmc_with_limit') NOT NULL DEFAULT 'principal_only';
ALTER TABLE projects ADD COLUMN pmc_approval_limit DECIMAL(10,4) NULL DEFAULT NULL;

-- Add invoice_sequence to client_claims for tracking
-- ALTER TABLE client_claims ADD COLUMN invoice_sequence INT UNSIGNED NULL DEFAULT NULL;
--   ↑ already present in client_claims CREATE TABLE (line ~2110); ALTER is redundant
ALTER TABLE client_claims ADD COLUMN IF NOT EXISTS invoice_prefix   VARCHAR(30) NULL DEFAULT NULL;

-- HSN code and NCR register index — both already handled above
-- (hsn_code in client_boq_items CREATE, NCRs folded into issues table)

-- ============================================================
-- 38. SNAG REGISTER
-- ============================================================

-- ============================================================
-- MEETINGS (unified site visits + MOMs — v3 fold)
--   type: any meeting kind
--   visibility: internal / client_draft / sent_to_client
-- ============================================================
DROP TABLE IF EXISTS meeting_photos;
DROP TABLE IF EXISTS meeting_revisions;
DROP TABLE IF EXISTS meeting_actions;
DROP TABLE IF EXISTS meetings;

CREATE TABLE meetings (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  row_version         INT UNSIGNED NOT NULL DEFAULT 1,
  project_id          INT UNSIGNED NOT NULL,
  client_id           INT UNSIGNED NULL,
  meeting_number      VARCHAR(20) NULL,
  type                ENUM('site_visit','internal','client','design_review','principal_visit','statutory','other')
                         NOT NULL DEFAULT 'site_visit',
  visibility          ENUM('internal','client_draft','sent_to_client','acknowledged')
                         NOT NULL DEFAULT 'internal',
  title               VARCHAR(300) NULL,
  meeting_date        DATE NOT NULL,
  time_in             TIME NULL,
  time_out            TIME NULL,
  location            VARCHAR(200) NULL,
  attendees_internal  TEXT NULL,
  attendees_external  TEXT NULL,
  agenda              TEXT NULL,
  notes               TEXT NULL,
  summary             TEXT NULL,
  next_meeting_date   DATE NULL,
  drafted_by          INT UNSIGNED NULL,
  approved_by         INT UNSIGNED NULL,
  approved_at         DATETIME NULL,
  issued_at           DATETIME NULL,
  client_acked_at     DATETIME NULL,
  client_ack_by       VARCHAR(100) NULL,
  client_ack_response VARCHAR(200) NULL,
  status              ENUM('draft','approved','issued','shared','acknowledged','closed')
                         NOT NULL DEFAULT 'draft',
  created_by          INT UNSIGNED NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (client_id)   REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (drafted_by)  REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (created_by)  REFERENCES users(id),
  -- meeting_number is nullable; MySQL UNIQUE treats multiple NULLs as distinct, so
  -- draft meetings without an assigned number coexist safely.
  UNIQUE KEY uq_meeting_project_number (project_id, meeting_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_meetings_proj_status ON meetings(project_id, status);
CREATE INDEX idx_meetings_proj_type   ON meetings(project_id, type);

CREATE TABLE meeting_actions (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meeting_id        INT UNSIGNED NOT NULL,
  action_text       TEXT NOT NULL,
  assigned_to       INT UNSIGNED NULL,
  assignee_name     VARCHAR(200) NULL,
  countersign_by    INT UNSIGNED NULL,
  due_date          DATE NULL,
  status            ENUM('pending','acknowledged','in_progress','completed','overdue') NOT NULL DEFAULT 'pending',
  acknowledged_at   DATETIME NULL,
  countersigned_at  DATETIME NULL,
  completed_at      DATETIME NULL,
  completion_note   TEXT NULL,
  escalated         TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (meeting_id)     REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to)    REFERENCES users(id),
  FOREIGN KEY (countersign_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_meeting_actions_status ON meeting_actions(meeting_id, status);

CREATE TABLE meeting_revisions (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meeting_id        INT UNSIGNED NOT NULL,
  version           INT UNSIGNED NOT NULL DEFAULT 1,
  issued_by         INT UNSIGNED NOT NULL,
  issued_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  window_days       INT UNSIGNED NOT NULL DEFAULT 3,
  lock_deadline     DATETIME NOT NULL,
  locked_at         DATETIME NULL,
  locked            TINYINT(1) NOT NULL DEFAULT 0,
  revision_reason   TEXT NULL,
  file_path         VARCHAR(500) NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE meeting_photos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meeting_id    INT UNSIGNED NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_size_kb  INT UNSIGNED NOT NULL DEFAULT 0,
  caption       VARCHAR(500) NULL,
  doc_type      ENUM('photo','report_draft','report_final','attachment') NOT NULL DEFAULT 'photo',
  uploaded_by   INT UNSIGNED NULL,
  uploaded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id)  REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE snags (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id        INT UNSIGNED NOT NULL,
  snag_number       VARCHAR(20) NOT NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT NULL,
  location          VARCHAR(200) NULL,
  trade             VARCHAR(50) NULL,
  raised_by         INT UNSIGNED NOT NULL,
  raised_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raised_from       ENUM('meeting','ncr','other') NOT NULL DEFAULT 'other',
  meeting_id     INT UNSIGNED NULL,
  ncr_id            INT UNSIGNED NULL,
  assigned_vendor   INT UNSIGNED NULL,
  target_close_date DATE NULL,
  rectified_by      INT UNSIGNED NULL,
  rectified_at      DATETIME NULL,
  verified_by       INT UNSIGNED NULL,
  verified_at       DATETIME NULL,
  status            ENUM('open','rectified','closed') NOT NULL DEFAULT 'open',
  priority          ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  FOREIGN KEY (project_id)    REFERENCES projects(id),
  FOREIGN KEY (raised_by)     REFERENCES users(id),
  FOREIGN KEY (assigned_vendor) REFERENCES vendors(id),
  FOREIGN KEY (rectified_by)  REFERENCES users(id),
  FOREIGN KEY (verified_by)   REFERENCES users(id),
  FOREIGN KEY (meeting_id)       REFERENCES meetings(id) ON DELETE SET NULL,
  FOREIGN KEY (ncr_id)        REFERENCES issues(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_snag_project_status ON snags(project_id, status);

-- ============================================================
-- 43. CLIENT COMMUNICATION LOG
-- ============================================================
CREATE TABLE client_comms (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  comm_date       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  document_type   ENUM('measurement_certificate','mom','weekly_report','drawing',
                        'snag_update','ncr_update','change_notice','invoice',
                        'other') NOT NULL,
  document_ref    VARCHAR(100) NULL,            -- e.g. "RA01 Civil", "MOM001", "CN001"
  document_path   VARCHAR(500) NULL,            -- file path if generated by app
  sent_by         INT UNSIGNED NOT NULL,
  method          ENUM('whatsapp','email','hard_copy','courier','in_person_handover') NOT NULL,
  notes           VARCHAR(500) NULL,
  -- Client response
  client_ack_at   DATETIME NULL,
  client_response TEXT NULL,
  auto_logged     TINYINT(1) NOT NULL DEFAULT 0, -- 1 if auto-populated by app
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (sent_by)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_comms_project ON client_comms(project_id, comm_date);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- AUDIT LOG — append-only log of all sensitive actions
-- ============================================================
CREATE TABLE audit_log (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NULL,
  action          VARCHAR(50) NOT NULL,
  entity_type     VARCHAR(40) NULL,
  entity_id       INT UNSIGNED NULL,
  details         JSON NULL,
  ip_address      VARCHAR(45) NULL,
  user_agent      VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user  (user_id, created_at),
  INDEX idx_audit_action (action, created_at),
  INDEX idx_audit_entity (entity_type, entity_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── MOM ITEMS (carry-forward action tracker)
CREATE TABLE IF NOT EXISTS mom_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id      INT UNSIGNED NOT NULL,
  weekly_report_id INT UNSIGNED NULL,          -- linked report if any
  trade           VARCHAR(50) NULL,
  description     TEXT NOT NULL,
  responsible     VARCHAR(100) NOT NULL DEFAULT 'NU',
  remarks         TEXT NULL,
  status          ENUM('open','closed') NOT NULL DEFAULT 'open',
  resolution_note TEXT NULL,                   -- required when closing
  carried_from    INT UNSIGNED NULL,           -- previous mom_item id if carried forward
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)      REFERENCES projects(id),
  FOREIGN KEY (weekly_report_id) REFERENCES weekly_reports(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)      REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

