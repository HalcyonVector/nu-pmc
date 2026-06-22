-- Migration: 2026-06-22 bug fixes
-- Run once on production: mysql -u <user> -p nu_pmc < migrations/patch-2026-06-22-fixes.sql

-- 1. Add planning_note column to schedule_tasks (lookahead planning workspace)
ALTER TABLE schedule_tasks
  ADD COLUMN IF NOT EXISTS planning_note TEXT NULL AFTER description;

-- 2. Add soft-delete columns to drawing_versions
ALTER TABLE drawing_versions
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL AFTER l2_approved_at,
  ADD COLUMN IF NOT EXISTS deleted_by INT UNSIGNED NULL DEFAULT NULL AFTER deleted_at;

-- 3. Add soft-delete columns to drawings
ALTER TABLE drawings
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by INT UNSIGNED NULL DEFAULT NULL;
