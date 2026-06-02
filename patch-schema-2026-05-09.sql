-- ============================================================================
-- patch-schema-2026-05-09.sql
-- ----------------------------------------------------------------------------
-- Targeted fix for three errors observed against a nu_pmc database that was
-- bootstrapped from pmc_initial_schema_with_data.sql:
--
--   1. Table 'nu_pmc.setup_checklist_templates' doesn't exist
--      → also missing setup_checklist_items + project_setup_tracking
--      (project-setup checklist endpoint at modules/onboarding/routes/project-setup.js)
--
--   2. Access denied for user 'nu_app' when reading current_pmc_assignments
--      → the view exists but was dumped with DEFINER=`` (empty), which MySQL
--        rejects at query time. Recreated with SQL SECURITY INVOKER so the
--        calling user's privileges apply (no DEFINER required).
--
--   3. Unknown column 'v.bank_validated_by_vendor' on vendors
--      → vendors table predates the v5 Matrix-tier + bank-validation migration.
--        Adds the six columns + two indexes from that migration.
--
-- Idempotent: every CREATE / ALTER is gated on information_schema so reruns
-- are no-ops. Preserves all existing data.
--
-- Apply:
--   mysql -u nu_app -p nu_pmc < scripts/patch-schema-2026-05-09.sql
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. setup_checklist_templates / setup_checklist_items / project_setup_tracking
-- ----------------------------------------------------------------------------
-- Definitions copied verbatim from nu-pmc-install-20260502.sql. CREATE TABLE
-- IF NOT EXISTS makes this safe to rerun.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `setup_checklist_templates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `template_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `template_name` (`template_name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `setup_checklist_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `setup_checklist_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int(10) unsigned NOT NULL,
  `task_name` varchar(200) NOT NULL,
  `task_description` text DEFAULT NULL,
  `task_category` varchar(50) DEFAULT NULL,
  `owner_role` varchar(50) NOT NULL,
  `is_mandatory` tinyint(1) DEFAULT 1,
  `blocks_operations` tinyint(1) DEFAULT 0,
  `validation_type` varchar(50) DEFAULT NULL,
  `validation_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`validation_config`)),
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_template` (`template_id`),
  KEY `idx_category` (`task_category`),
  KEY `idx_owner` (`owner_role`),
  CONSTRAINT `setup_checklist_items_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `setup_checklist_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `project_setup_tracking` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `checklist_item_id` int(10) unsigned NOT NULL,
  `is_complete` tinyint(1) DEFAULT 0,
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by` int(10) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_project_item` (`project_id`,`checklist_item_id`),
  KEY `checklist_item_id` (`checklist_item_id`),
  KEY `completed_by` (`completed_by`),
  KEY `idx_project` (`project_id`),
  KEY `idx_incomplete` (`project_id`,`is_complete`),
  CONSTRAINT `project_setup_tracking_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_setup_tracking_ibfk_2` FOREIGN KEY (`checklist_item_id`) REFERENCES `setup_checklist_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_setup_tracking_ibfk_3` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================================
-- 2. vendors columns (v5 Matrix tier + bank validation tracking)
-- ----------------------------------------------------------------------------
-- Each ADD COLUMN is gated on information_schema.columns so reruns are no-ops.
-- Same goes for the two indexes.
-- ============================================================================

-- bank_validated_by_vendor (the column the failing query referenced)
SET @c := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vendors' AND column_name = 'bank_validated_by_vendor');
SET @s := IF(@c = 0,
  'ALTER TABLE vendors ADD COLUMN bank_validated_by_vendor TINYINT(1) NOT NULL DEFAULT 0',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bank_validated_at
SET @c := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vendors' AND column_name = 'bank_validated_at');
SET @s := IF(@c = 0,
  'ALTER TABLE vendors ADD COLUMN bank_validated_at DATETIME NULL',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bank_validation_method
SET @c := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vendors' AND column_name = 'bank_validation_method');
SET @s := IF(@c = 0,
  "ALTER TABLE vendors ADD COLUMN bank_validation_method ENUM('matrix','wa_form','manual_attestation') NULL",
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- matrix_user_id
SET @c := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vendors' AND column_name = 'matrix_user_id');
SET @s := IF(@c = 0,
  'ALTER TABLE vendors ADD COLUMN matrix_user_id VARCHAR(255) NULL',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- matrix_room_id
SET @c := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vendors' AND column_name = 'matrix_room_id');
SET @s := IF(@c = 0,
  'ALTER TABLE vendors ADD COLUMN matrix_room_id VARCHAR(255) NULL',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- matrix_status
SET @c := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vendors' AND column_name = 'matrix_status');
SET @s := IF(@c = 0,
  "ALTER TABLE vendors ADD COLUMN matrix_status ENUM('not_invited','invited_pending','joined','declined') NOT NULL DEFAULT 'not_invited'",
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_vendors_matrix_status
SET @i := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'vendors' AND index_name = 'idx_vendors_matrix_status');
SET @s := IF(@i = 0,
  'ALTER TABLE vendors ADD INDEX idx_vendors_matrix_status (matrix_status)',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_vendors_bank_validated
SET @i := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'vendors' AND index_name = 'idx_vendors_bank_validated');
SET @s := IF(@i = 0,
  'ALTER TABLE vendors ADD INDEX idx_vendors_bank_validated (bank_validated_by_vendor)',
  'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 3. current_pmc_assignments view — recreate without broken DEFINER
-- ----------------------------------------------------------------------------
-- The dump in pmc_initial_schema_with_data.sql defined this with
-- "DEFINER=`` SQL SECURITY DEFINER", which MySQL rejects at query time with
-- a misleading "Access denied" error. SQL SECURITY INVOKER means the view
-- runs as the user that queries it, so no DEFINER is required.
-- ============================================================================

DROP VIEW IF EXISTS `current_pmc_assignments`;

CREATE SQL SECURITY INVOKER VIEW `current_pmc_assignments` AS
SELECT
  `p`.`id`   AS `project_id`,
  `p`.`code` AS `project_code`,
  MAX(CASE WHEN `a`.`kind` = 'primary' THEN `a`.`user_id` END) AS `primary_pmc_id`,
  MAX(CASE WHEN `a`.`kind` = 'primary' THEN `a`.`id`      END) AS `primary_assignment_id`,
  MAX(CASE WHEN `a`.`kind` = 'backup'  THEN `a`.`user_id` END) AS `backup_pmc_id`,
  MAX(CASE WHEN `a`.`kind` = 'backup'  THEN `a`.`id`      END) AS `backup_assignment_id`
FROM `projects` `p`
LEFT JOIN `project_pmc_assignments` `a`
  ON `a`.`project_id` = `p`.`id`
 AND `a`.`effective_to` IS NULL
GROUP BY `p`.`id`, `p`.`code`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Verification — every value should be 1.
-- ============================================================================
SELECT
  'patch complete' AS status,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'setup_checklist_templates') AS has_setup_checklist_templates,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'setup_checklist_items')     AS has_setup_checklist_items,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'project_setup_tracking')    AS has_project_setup_tracking,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'vendors'
       AND column_name = 'bank_validated_by_vendor')                               AS has_bank_validated_col,
  (SELECT COUNT(*) FROM information_schema.views
     WHERE table_schema = DATABASE() AND table_name = 'current_pmc_assignments')   AS has_current_pmc_view;
