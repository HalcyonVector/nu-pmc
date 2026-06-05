-- Migration Script: Simplify wa_pending_actions user-tracking columns
-- 1. Preserve historical data: copy actioned_by to user_id for completed actions where user_id was null
UPDATE wa_pending_actions 
SET user_id = actioned_by 
WHERE actioned_by IS NOT NULL AND user_id IS NULL;

-- 2. Drop the foreign key constraint on actioned_by
ALTER TABLE wa_pending_actions DROP FOREIGN KEY wa_pending_actions_ibfk_3;

-- 3. Drop the redundant actioned_by column
ALTER TABLE wa_pending_actions DROP COLUMN actioned_by;
