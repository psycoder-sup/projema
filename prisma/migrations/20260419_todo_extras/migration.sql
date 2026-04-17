-- Phase 3: Todo extras — todo_links + todo_documents tables.
-- NOTE: set_updated_at() function was created in Phase 1 migration — reused here.

-- ============================================================================
-- todo_links
-- ============================================================================

CREATE TABLE IF NOT EXISTS "todo_links" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "todo_id"    UUID        NOT NULL,
  "url"        TEXT        NOT NULL,
  "label"      TEXT,
  "position"   INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "todo_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "todo_links_url_length_check"  CHECK (length("url") <= 2048),
  CONSTRAINT "todo_links_url_scheme_check"  CHECK ("url" ~* '^(https?|mailto):'),
  CONSTRAINT "todo_links_label_length_check" CHECK ("label" IS NULL OR length("label") <= 140)
);

ALTER TABLE "todo_links"
  ADD CONSTRAINT "todo_links_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "todo_links_todo_id_position_idx"
  ON "todo_links" ("todo_id", "position");

-- ============================================================================
-- todo_documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS "todo_documents" (
  "todo_id"              UUID        NOT NULL,
  "content_markdown"     TEXT        NOT NULL,
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_user_id"   UUID        NOT NULL,

  CONSTRAINT "todo_documents_pkey" PRIMARY KEY ("todo_id"),
  CONSTRAINT "todo_documents_size_check"
    CHECK (octet_length("content_markdown") <= 102400)
);

ALTER TABLE "todo_documents"
  ADD CONSTRAINT "todo_documents_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "todo_documents"
  ADD CONSTRAINT "todo_documents_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_set_updated_at_todo_documents ON "todo_documents";
CREATE TRIGGER trg_set_updated_at_todo_documents
  BEFORE UPDATE ON "todo_documents"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
