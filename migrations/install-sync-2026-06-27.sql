-- migrations/install-sync-2026-06-27.sql
-- ============================================================
-- Install SQL sync patch — run AFTER nu-pmc-install-20260502.sql
-- on any environment set up from the 2026-05-02 dump.
--
-- What this covers (grounded in schema.sql + all migration files):
--
--   A. matrix_reader_cursor DROP bug fix (also patched in install SQL directly)
--   B. June-22 soft-delete and planning_note columns (patch-2026-06-22-fixes.sql)
--   C. RFI fields on issues table (add-rfi-fields.sql)
--   D. OIDC SSO tables (create-oidc-tables.sql)
--   E. ai_feature_toggles table + seed (create-ai-feature-toggles.sql)
--   F. New tables present in schema.sql but absent from the May-02 dump:
--        sessions, password_reset_otps, project_photos, issue_photos,
--        meeting_photos, weekly_report_photos, snags, pre_handover_snags
--
-- All statements are idempotent — safe to run on an already-patched DB.
-- MySQL does not support ADD COLUMN IF NOT EXISTS; column additions are
-- wrapped in stored procedures that check information_schema first.
--
-- Audit trail:
--   2026-05-02  nu-pmc-install-20260502.sql baseline (May dump)
--   2026-05-09  seed-config.sql — signoff_workflows payment_batch already
--               seeded as 'pmc,principal,finance' quorum 3 ✓
--   2026-05-xx  v5.42-restore-matrix-reader-cursor.sql — cursor table
--               re-created (v5.39 dropped it; v5.42 restores) — also fixed
--               directly in install SQL (removed errant DROP at cleanup block)
--   2026-05-xx  payment-batch-relay.sql — already reflected in install SQL ✓
--   2026-05-xx  add-submittal-review-permission.sql — already in install SQL ✓
--   2026-05-xx  create-lessons-learned-tables.sql — already in install SQL ✓
--   2026-06-22  patch-2026-06-22-fixes.sql — columns MISSING → added below (B)
--   2026-06-xx  add-rfi-fields.sql — columns MISSING → added below (C)
--   2026-06-xx  create-oidc-tables.sql — tables MISSING → added below (D)
--   2026-06-xx  create-ai-feature-toggles.sql — table MISSING → added below (E)
--   2026-06-27  New schema.sql tables absent from dump → added below (F)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ============================================================
-- A. matrix_reader_cursor guard
--    The install SQL cleanup block (v5.39) drops this table after creating
--    it. That bug is fixed directly in nu-pmc-install-20260502.sql (the DROP
--    line is now commented out). This section is a safety net for installs
--    that ran the old SQL before the fix.
-- ============================================================

CREATE TABLE IF NOT EXISTS matrix_reader_cursor (
  room_id       VARCHAR(255) NOT NULL,
  last_seen_ts  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'A: matrix_reader_cursor ensured' AS patch_status;

-- ============================================================
-- B. June-22 soft-delete columns + planning_note
--    Source: migrations/patch-2026-06-22-fixes.sql
-- ============================================================

DROP PROCEDURE IF EXISTS _patch_june22;
DELIMITER $$
CREATE PROCEDURE _patch_june22()
BEGIN
  -- schedule_tasks.planning_note
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_tasks' AND COLUMN_NAME = 'planning_note'
  ) THEN
    ALTER TABLE schedule_tasks ADD COLUMN planning_note TEXT NULL;
  END IF;

  -- drawing_versions soft-delete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drawing_versions' AND COLUMN_NAME = 'deleted_at'
  ) THEN
    ALTER TABLE drawing_versions
      ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
      ADD COLUMN deleted_by INT UNSIGNED NULL DEFAULT NULL;
  END IF;

  -- drawings soft-delete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drawings' AND COLUMN_NAME = 'deleted_at'
  ) THEN
    ALTER TABLE drawings
      ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
      ADD COLUMN deleted_by INT UNSIGNED NULL DEFAULT NULL;
  END IF;

  -- drawing_register soft-delete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drawing_register' AND COLUMN_NAME = 'deleted_at'
  ) THEN
    ALTER TABLE drawing_register
      ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
      ADD COLUMN deleted_by INT UNSIGNED NULL DEFAULT NULL;
  END IF;

  -- vendor_boq_mapping soft-delete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendor_boq_mapping' AND COLUMN_NAME = 'deleted_at'
  ) THEN
    ALTER TABLE vendor_boq_mapping
      ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
      ADD COLUMN deleted_by INT UNSIGNED NULL DEFAULT NULL;
  END IF;
END$$
DELIMITER ;
CALL _patch_june22();
DROP PROCEDURE IF EXISTS _patch_june22;

SELECT 'B: June-22 soft-delete columns + planning_note applied' AS patch_status;

-- ============================================================
-- C. RFI fields on issues table
--    Source: migrations/add-rfi-fields.sql
-- ============================================================

DROP PROCEDURE IF EXISTS _patch_rfi;
DELIMITER $$
CREATE PROCEDURE _patch_rfi()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'issues' AND COLUMN_NAME = 'rfi_number'
  ) THEN
    ALTER TABLE issues
      ADD COLUMN rfi_number        VARCHAR(20)  NULL AFTER issue_number,
      ADD COLUMN rfi_direction     VARCHAR(30)  NULL COMMENT 'contractor_to_pmc | pmc_to_contractor',
      ADD COLUMN response_deadline DATE         NULL,
      ADD COLUMN contractor_ref    VARCHAR(100) NULL COMMENT 'Contractor own reference number',
      ADD COLUMN rfi_discipline    VARCHAR(50)  NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'issues' AND INDEX_NAME = 'idx_rfi_number'
  ) THEN
    ALTER TABLE issues
      ADD UNIQUE INDEX idx_rfi_number (project_id, rfi_number);
  END IF;
END$$
DELIMITER ;
CALL _patch_rfi();
DROP PROCEDURE IF EXISTS _patch_rfi;

SELECT 'C: RFI fields on issues applied' AS patch_status;

-- ============================================================
-- D. OIDC SSO tables
--    Source: migrations/create-oidc-tables.sql
--    Required for SSO / Element X sign-in via nu Associates OIDC provider.
-- ============================================================

CREATE TABLE IF NOT EXISTS oidc_auth_codes (
  code                   VARCHAR(86)  NOT NULL PRIMARY KEY,
  user_id                INT UNSIGNED NOT NULL,
  client_id              VARCHAR(255) NOT NULL,
  redirect_uri           TEXT         NOT NULL,
  scope                  VARCHAR(500) NOT NULL DEFAULT 'openid profile',
  code_challenge         VARCHAR(256) NULL,
  code_challenge_method  VARCHAR(10)  NULL,
  nonce                  VARCHAR(255) NULL,
  expires_at             DATETIME     NOT NULL,
  used_at                DATETIME     NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_codes (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oidc_tokens (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  access_token  VARCHAR(86)  NOT NULL UNIQUE,
  user_id       INT UNSIGNED NOT NULL,
  client_id     VARCHAR(255) NOT NULL,
  scope         VARCHAR(500) NOT NULL,
  expires_at    DATETIME     NOT NULL,
  revoked_at    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_tokens (user_id, revoked_at),
  INDEX idx_expires     (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'D: OIDC tables ensured' AS patch_status;

-- ============================================================
-- E. AI feature toggles table + seed
--    Source: migrations/create-ai-feature-toggles.sql
--    Note: seed-config.sql has the INSERT data but the CREATE TABLE
--    was never added to the install SQL.
-- ============================================================

CREATE TABLE IF NOT EXISTS `ai_feature_toggles` (
  `feature_key`  varchar(60)   COLLATE utf8mb4_general_ci NOT NULL,
  `enabled`      tinyint(1)    NOT NULL DEFAULT '0',
  `label`        varchar(120)  COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `description`  varchar(300)  COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_by`   int unsigned  DEFAULT NULL,
  `updated_at`   datetime      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO ai_feature_toggles (feature_key, enabled, label, description) VALUES
  ('drawing_sanity_check',       0, 'Auto Drawing Sanity Check',      'Drawing upload metadata validation'),
  ('detail_drawing_analysis',    0, 'Auto Detail Drawing Analysis',    'Extracts trade/reference info from detail uploads'),
  ('rfi_response_check',         0, 'Auto RFI Response Check',         'Checks if uploaded drawing answers the RFI'),
  ('revision_change_analysis',   0, 'Auto Revision Change Analysis',   'Compares old vs new drawing, flags impacts'),
  ('photo_auto_tagging',         0, 'Photo Auto-Tagging',              'Suggests task association for uploaded site photos'),
  ('hsn_code_suggestion',        0, 'HSN Code Suggestion',             'Auto-suggests HSN code on BOQ item edit'),
  ('similar_query_search',       0, 'Similar Query Search',            'Shows past matching queries while raising a new one'),
  ('material_approval_check',    0, 'Material Approval Check',         'Flags BOQ items needing client material approval'),
  ('autofill_boq_hsn',           0, 'Auto-fill BOQ HSN',               'Wires suggestHSN button in BOQ edit modal'),
  ('similar_query_dedup',        0, 'Similar Query Dedup',             'Wires checkSimilarQueries button in Raise Query modal');

SELECT 'E: ai_feature_toggles table + seed ensured' AS patch_status;

-- ============================================================
-- F. New tables in schema.sql absent from May-02 dump
--    These tables were added directly to schema.sql without standalone
--    migrations. Ground truth: schema.sql as of 2026-06-27.
-- ============================================================

-- F1. sessions (express-mysql-session store)
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires`    int unsigned NOT NULL,
  `data`       mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- F2. password_reset_otps
CREATE TABLE IF NOT EXISTS `password_reset_otps` (
  `user_id`    int unsigned NOT NULL,
  `otp_hash`   varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `password_reset_otps_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- F3. project_photos (site photo uploads)
CREATE TABLE IF NOT EXISTS `project_photos` (
  `id`                  int unsigned NOT NULL AUTO_INCREMENT,
  `project_id`          int unsigned NOT NULL,
  `task_id`             int unsigned DEFAULT NULL,
  `daily_report_id`     int unsigned DEFAULT NULL,
  `photo_date`          date NOT NULL,
  `file_path`           varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `file_size_kb`        int unsigned NOT NULL DEFAULT '0',
  `caption`             varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `uploaded_by`         int unsigned NOT NULL,
  `source`              enum('app','whatsapp','site_visit') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'app',
  `uploaded_at`         datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_locked`           tinyint(1) NOT NULL DEFAULT '0',
  `locked_at`           datetime DEFAULT NULL,
  `locked_by_report_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `daily_report_id` (`daily_report_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_photos_project_date` (`project_id`, `photo_date`),
  KEY `idx_photos_task` (`task_id`),
  CONSTRAINT `project_photos_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_photos_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_photos_ibfk_3` FOREIGN KEY (`daily_report_id`) REFERENCES `daily_reports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_photos_ibfk_4` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- F4. issue_photos
CREATE TABLE IF NOT EXISTS `issue_photos` (
  `id`           int unsigned NOT NULL AUTO_INCREMENT,
  `issue_id`     int unsigned NOT NULL,
  `project_id`   int unsigned NOT NULL,
  `submitted_by` int unsigned NOT NULL,
  `file_path`    varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `source`       enum('whatsapp','app') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'app',
  `caption`      varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `issue_id` (`issue_id`),
  KEY `project_id` (`project_id`),
  KEY `submitted_by` (`submitted_by`),
  CONSTRAINT `issue_photos_ibfk_1` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`),
  CONSTRAINT `issue_photos_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `issue_photos_ibfk_3` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- F5. meeting_photos
CREATE TABLE IF NOT EXISTS `meeting_photos` (
  `id`          int unsigned NOT NULL AUTO_INCREMENT,
  `meeting_id`  int unsigned NOT NULL,
  `file_path`   varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `file_size_kb` int unsigned NOT NULL DEFAULT '0',
  `caption`     varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `doc_type`    enum('photo','report_draft','report_final','attachment') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'photo',
  `uploaded_by` int unsigned DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `meeting_id` (`meeting_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `meeting_photos_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_photos_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- F6. weekly_report_photos (depends on project_photos existing — F3 above)
CREATE TABLE IF NOT EXISTS `weekly_report_photos` (
  `id`               int unsigned NOT NULL AUTO_INCREMENT,
  `weekly_report_id` int unsigned NOT NULL,
  `photo_id`         int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `weekly_report_id` (`weekly_report_id`),
  KEY `photo_id` (`photo_id`),
  CONSTRAINT `weekly_report_photos_ibfk_1` FOREIGN KEY (`weekly_report_id`) REFERENCES `weekly_reports` (`id`),
  CONSTRAINT `weekly_report_photos_ibfk_2` FOREIGN KEY (`photo_id`) REFERENCES `project_photos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- F7. snags (DLP defect tracking)
CREATE TABLE IF NOT EXISTS `snags` (
  `id`                int unsigned NOT NULL AUTO_INCREMENT,
  `project_id`        int unsigned NOT NULL,
  `snag_number`       varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `title`             varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description`       text COLLATE utf8mb4_general_ci,
  `location`          varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `trade`             varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `raised_by`         int unsigned NOT NULL,
  `raised_at`         datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `raised_from`       enum('meeting','ncr','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'other',
  `meeting_id`        int unsigned DEFAULT NULL,
  `ncr_id`            int unsigned DEFAULT NULL,
  `assigned_vendor`   int unsigned DEFAULT NULL,
  `target_close_date` date DEFAULT NULL,
  `rectified_by`      int unsigned DEFAULT NULL,
  `rectified_at`      datetime DEFAULT NULL,
  `verified_by`       int unsigned DEFAULT NULL,
  `verified_at`       datetime DEFAULT NULL,
  `status`            enum('open','rectified','closed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'open',
  `priority`          enum('low','medium','high','urgent') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'medium',
  PRIMARY KEY (`id`),
  KEY `raised_by` (`raised_by`),
  KEY `assigned_vendor` (`assigned_vendor`),
  KEY `rectified_by` (`rectified_by`),
  KEY `verified_by` (`verified_by`),
  KEY `meeting_id` (`meeting_id`),
  KEY `ncr_id` (`ncr_id`),
  KEY `idx_snag_project_status` (`project_id`, `status`),
  CONSTRAINT `snags_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `snags_ibfk_2` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `snags_ibfk_3` FOREIGN KEY (`assigned_vendor`) REFERENCES `vendors` (`id`),
  CONSTRAINT `snags_ibfk_4` FOREIGN KEY (`rectified_by`) REFERENCES `users` (`id`),
  CONSTRAINT `snags_ibfk_5` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`),
  CONSTRAINT `snags_ibfk_6` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `snags_ibfk_7` FOREIGN KEY (`ncr_id`) REFERENCES `issues` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- F8. pre_handover_snags (pre-handover defect punch list)
CREATE TABLE IF NOT EXISTS `pre_handover_snags` (
  `id`                   int unsigned NOT NULL AUTO_INCREMENT,
  `project_id`           int unsigned NOT NULL,
  `trade`                varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `location`             varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description`          text COLLATE utf8mb4_general_ci NOT NULL,
  `severity`             enum('critical','major','minor') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'minor',
  `responsible_vendor_id` int unsigned DEFAULT NULL,
  `raised_by`            int unsigned NOT NULL,
  `raised_at`            datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date`             date DEFAULT NULL,
  `status`               enum('open','in_progress','resolved','accepted_by_client') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'open',
  `resolved_by`          int unsigned DEFAULT NULL,
  `resolved_at`          datetime DEFAULT NULL,
  `resolution_note`      text COLLATE utf8mb4_general_ci,
  `file_path`            varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `responsible_vendor_id` (`responsible_vendor_id`),
  KEY `raised_by` (`raised_by`),
  KEY `resolved_by` (`resolved_by`),
  KEY `idx_pre_handover_snags_proj_status` (`project_id`, `status`),
  CONSTRAINT `pre_handover_snags_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `pre_handover_snags_ibfk_2` FOREIGN KEY (`responsible_vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `pre_handover_snags_ibfk_3` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `pre_handover_snags_ibfk_4` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SELECT 'F: New schema.sql tables ensured (sessions, otps, photos, snags)' AS patch_status;

-- ============================================================
-- Final verification — run after applying this patch
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN (
     'matrix_reader_cursor','ai_feature_toggles','oidc_auth_codes','oidc_tokens',
     'project_photos','issue_photos','meeting_photos','weekly_report_photos',
     'snags','pre_handover_snags','sessions','password_reset_otps'
   )) AS tables_present_count,
  12 AS tables_expected,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_tasks' AND COLUMN_NAME = 'planning_note'
  ) AS schedule_tasks_planning_note,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drawing_versions' AND COLUMN_NAME = 'deleted_at'
  ) AS drawing_versions_soft_delete,
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'issues' AND COLUMN_NAME = 'rfi_number'
  ) AS issues_rfi_fields;

SET FOREIGN_KEY_CHECKS=1;
