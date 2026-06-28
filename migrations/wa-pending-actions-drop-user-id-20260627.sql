-- Migration: wa_pending_actions — drop legacy user_id column
-- Date: 2026-06-27
--
-- Background:
--   wa_pending_actions had two FK columns pointing to users.id:
--     raised_by  — used by the approval-surface write path (now retired)
--     user_id    — used by wa-reply-actions.js as the WA recipient
--   These have been consolidated. wa-reply-actions.js now writes the
--   WA recipient into raised_by. user_id is no longer written or read.
--
-- Safe to run on live DB: no application code reads user_id after this deploy.
-- Backfill: existing rows with user_id set and raised_by NULL are updated first.

-- 1. Backfill: carry user_id into raised_by where raised_by is empty
UPDATE wa_pending_actions
SET raised_by = user_id
WHERE raised_by IS NULL AND user_id IS NOT NULL;

-- 2. Drop FK constraint on user_id
ALTER TABLE wa_pending_actions
  DROP FOREIGN KEY wa_pending_actions_ibfk_4;

-- 3. Drop index on user_id
ALTER TABLE wa_pending_actions
  DROP KEY user_id;

-- 4. Drop the column
ALTER TABLE wa_pending_actions
  DROP COLUMN user_id;
