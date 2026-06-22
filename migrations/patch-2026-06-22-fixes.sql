-- Migration: 2026-06-22 bug fixes
-- Run once on production: mysql -u <user> -p nu_pmc < migrations/patch-2026-06-22-fixes.sql
-- NOTE: MySQL (not MariaDB) does not support ADD COLUMN IF NOT EXISTS.
--       These statements are safe to run once on a fresh schema.

-- 1. Add planning_note column to schedule_tasks (lookahead planning workspace)
ALTER TABLE schedule_tasks
  ADD COLUMN planning_note TEXT NULL;

-- 2. Add soft-delete columns to drawing_versions
ALTER TABLE drawing_versions
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN deleted_by INT UNSIGNED NULL DEFAULT NULL;

-- 3. Add soft-delete columns to drawings
ALTER TABLE drawings
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN deleted_by INT UNSIGNED NULL DEFAULT NULL;

-- 4. Add soft-delete columns to drawing_register
ALTER TABLE drawing_register
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN deleted_by INT UNSIGNED NULL DEFAULT NULL;

-- 5. Add soft-delete columns to vendor_boq_mapping
ALTER TABLE vendor_boq_mapping
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN deleted_by INT UNSIGNED NULL DEFAULT NULL;
