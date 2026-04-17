-- Phase 4: Comments + Rate Limit Buckets
-- NOTE: set_updated_at() function was created in Phase 1 migration — reused here.

-- ============================================================================
-- comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS "comments" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "todo_id"          UUID        NOT NULL,
  "author_user_id"   UUID        NOT NULL,
  "body"             TEXT        NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at"        TIMESTAMPTZ,

  CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_body_length_check" CHECK (length("body") <= 2000)
);

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "comments_todo_id_created_at_idx"
  ON "comments" ("todo_id", "created_at");

-- ============================================================================
-- rate_limit_buckets
-- ============================================================================

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID        NOT NULL,
  "action_key"  TEXT        NOT NULL,
  "event_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "rate_limit_buckets"
  ADD CONSTRAINT "rate_limit_buckets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "rate_limit_buckets_user_action_event_idx"
  ON "rate_limit_buckets" ("user_id", "action_key", "event_at" DESC);
