-- migrations/v5.42-restore-matrix-reader-cursor.sql
-- ============================================================
-- Restore matrix_reader_cursor.
--
-- v5.39-phase4-cleanup.sql dropped this table alongside
-- matrix_pending_polls. However, services/matrix-reply-actions.js
-- processVotesForRoom() still uses it for per-room read-position
-- tracking so the poll reader doesn't reprocess already-seen events.
--
-- This re-adds the table. The code was not updated to remove the
-- cursor dependency when v5.39 dropped the table — this is the
-- corresponding schema fix.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS is safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS matrix_reader_cursor (
  room_id       VARCHAR(255) NOT NULL,
  last_seen_ts  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 1 AS v5_42_matrix_reader_cursor_restored;
