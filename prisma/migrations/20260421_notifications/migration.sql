-- Phase 6: Notifications
-- Adds notifications table with partial unique index for due_soon dedup.

-- ============================================================================
-- notifications
-- ============================================================================

CREATE TABLE notifications (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                 TEXT        NOT NULL CHECK (kind IN ('assigned', 'due_soon', 'comment_on_assigned')),
  target_todo_id       UUID        NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  triggered_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  read_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching a user's notifications sorted by recency, read status
CREATE INDEX notifications_user_read_created_idx
  ON notifications (user_id, read_at, created_at DESC);

-- Partial unique index: only one due_soon notification per (user, todo)
-- This is the dedup gate for the cron job — ON CONFLICT DO NOTHING targets this index.
CREATE UNIQUE INDEX notifications_due_soon_unique
  ON notifications (user_id, target_todo_id, kind)
  WHERE kind = 'due_soon';
