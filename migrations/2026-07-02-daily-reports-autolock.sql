-- Fix the daily-report auto-lock cron (overdue-checker.js
-- autoLockOverdueDailyReports). It runs nightly:
--   UPDATE daily_reports SET status='auto_locked', locked_at=NOW() ...
-- but `daily_reports` had no `locked_at` column and its status enum lacked
-- 'auto_locked', so the job failed every night with
--   [auto-lock] error: Unknown column 'locked_at' in 'field list'
--
-- Add the column and extend the enum so the feature works as designed.
-- Safe to re-run: the MODIFY is idempotent; the ADD COLUMN errors harmlessly
-- ("Duplicate column") if already present when run via `mysql --force`.

ALTER TABLE `daily_reports`
  ADD COLUMN `locked_at` datetime DEFAULT NULL;

ALTER TABLE `daily_reports`
  MODIFY `status` enum('pending_review','approved','flagged','auto_locked')
  COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending_review';
