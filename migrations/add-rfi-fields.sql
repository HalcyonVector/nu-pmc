-- migrations/add-rfi-fields.sql
-- Adds formal RFI-specific columns to the issues table.
-- Safe to run multiple times (uses IF NOT EXISTS pattern via PROCEDURE).
-- Run after all v5 migrations.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_rfi_columns$$
CREATE PROCEDURE add_rfi_columns()
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

CALL add_rfi_columns()$$
DROP PROCEDURE IF EXISTS add_rfi_columns$$

DELIMITER ;
