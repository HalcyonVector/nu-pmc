-- migrations/patch-deputy-columns.sql
-- Run this in MySQL Workbench on the nu_pmc database.
--
-- Adds columns missing from local_full.sql that are present in the full install schema.
-- Safe to run multiple times (idempotent).

USE nu_pmc;

-- ── 1. Deputy scheduling columns on users ────────────────────────────────────
-- Without these: CN sign endpoint crashes with ER_BAD_FIELD_ERROR
DROP PROCEDURE IF EXISTS _patch_deputy_cols;
DELIMITER $$
CREATE PROCEDURE _patch_deputy_cols()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'deputy_from'
  ) THEN
    ALTER TABLE users
      ADD COLUMN deputy_from          DATE           NULL DEFAULT NULL AFTER deputy_id,
      ADD COLUMN deputy_until         DATE           NULL DEFAULT NULL AFTER deputy_from,
      ADD COLUMN deputy_reason        VARCHAR(300)   NULL DEFAULT NULL AFTER deputy_until,
      ADD COLUMN deputy_set_by        INT UNSIGNED   NULL DEFAULT NULL AFTER deputy_reason,
      ADD COLUMN deputy_overridden_by INT UNSIGNED   NULL DEFAULT NULL AFTER deputy_set_by;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'fk_users_deputy_set_by'
  ) THEN
    ALTER TABLE users
      ADD KEY fk_users_deputy_set_by        (deputy_set_by),
      ADD KEY fk_users_deputy_overridden_by (deputy_overridden_by);
  END IF;
END$$
DELIMITER ;
CALL _patch_deputy_cols();
DROP PROCEDURE IF EXISTS _patch_deputy_cols;

SELECT '1: deputy columns on users patched' AS status;

-- ── 2. cost_impact and stream columns on change_notices ──────────────────────
-- Without these: CN approve endpoint crashes (SELECT lists these columns explicitly)
DROP PROCEDURE IF EXISTS _patch_cn_cols;
DELIMITER $$
CREATE PROCEDURE _patch_cn_cols()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'change_notices' AND COLUMN_NAME = 'cost_impact'
  ) THEN
    ALTER TABLE change_notices
      ADD COLUMN cost_impact DECIMAL(14,2) NULL DEFAULT NULL AFTER schedule_impact_days,
      ADD COLUMN stream ENUM('design','services','common') NULL DEFAULT NULL AFTER cost_impact;
  END IF;
END$$
DELIMITER ;
CALL _patch_cn_cols();
DROP PROCEDURE IF EXISTS _patch_cn_cols;

SELECT '2: cost_impact + stream on change_notices patched' AS status;

-- ── 3. Make payment_requests.vendor_id nullable ───────────────────────────────
-- Adhoc payments (is_adhoc=1) have no vendor in the master.
-- The app correctly skips vendor_id for adhoc, but the NOT NULL FK blocks the INSERT.
DROP PROCEDURE IF EXISTS _patch_pr_vendor_null;
DELIMITER $$
CREATE PROCEDURE _patch_pr_vendor_null()
BEGIN
  -- Check current nullability; only alter if NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payment_requests'
      AND COLUMN_NAME = 'vendor_id'
      AND IS_NULLABLE = 'NO'
  ) THEN
    ALTER TABLE payment_requests
      MODIFY COLUMN vendor_id INT UNSIGNED NULL DEFAULT NULL;
  END IF;
END$$
DELIMITER ;
CALL _patch_pr_vendor_null();
DROP PROCEDURE IF EXISTS _patch_pr_vendor_null;

SELECT '3: payment_requests.vendor_id made nullable for adhoc payments' AS status;

-- ── 4. Add unit_rate to grns ──────────────────────────────────────────────────
-- Backend schema accepts unit_rate but it was never persisted in the DB.
-- UI computes total value as quantity_received * unit_rate — needs both stored.
DROP PROCEDURE IF EXISTS _patch_grn_unit_rate;
DELIMITER $$
CREATE PROCEDURE _patch_grn_unit_rate()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grns' AND COLUMN_NAME = 'unit_rate'
  ) THEN
    ALTER TABLE grns
      ADD COLUMN unit_rate DECIMAL(14,2) NULL DEFAULT NULL AFTER unit;
  END IF;
END$$
DELIMITER ;
CALL _patch_grn_unit_rate();
DROP PROCEDURE IF EXISTS _patch_grn_unit_rate;

SELECT '4: grns.unit_rate column added' AS status;
