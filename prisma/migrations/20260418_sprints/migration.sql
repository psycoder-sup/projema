-- Phase 2: Sprints CRUD — FR-05..FR-10, FR-21, FR-22
-- Adds: sprints, sprint_goals, todos, activity_events tables.
-- NOTE: set_updated_at() function was created in Phase 1 migration — reused here.

-- ============================================================================
-- sprints
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sprints" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"                TEXT        NOT NULL,
  "start_date"          DATE        NOT NULL,
  "end_date"            DATE        NOT NULL,
  "status"              TEXT        NOT NULL DEFAULT 'planned',
  "created_by_user_id"  UUID        NOT NULL,
  "completed_at"        TIMESTAMPTZ,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sprints_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sprints_end_date_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "sprints_status_check" CHECK ("status" IN ('planned', 'active', 'completed')),
  CONSTRAINT "sprints_name_length_check" CHECK (length("name") <= 140)
);

ALTER TABLE "sprints"
  ADD CONSTRAINT "sprints_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index: at most one active sprint at any time (FR-07)
CREATE UNIQUE INDEX IF NOT EXISTS "sprints_one_active_idx"
  ON "sprints" ("status") WHERE "status" = 'active';

-- Compound index for list queries grouped by status (FR-21)
CREATE INDEX IF NOT EXISTS "sprints_status_start_date_idx"
  ON "sprints" ("status", "start_date" DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_set_updated_at_sprints ON "sprints";
CREATE TRIGGER trg_set_updated_at_sprints
  BEFORE UPDATE ON "sprints"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- sprint_goals
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sprint_goals" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "sprint_id"  UUID        NOT NULL,
  "name"       TEXT        NOT NULL,
  "position"   INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sprint_goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sprint_goals_name_length_check" CHECK (length("name") <= 140)
);

ALTER TABLE "sprint_goals"
  ADD CONSTRAINT "sprint_goals_sprint_id_fkey"
  FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UNIQUE(sprint_id, lower(name)) — case-insensitive unique goal names per sprint (FR-05)
CREATE UNIQUE INDEX IF NOT EXISTS "sprint_goals_sprint_name_idx"
  ON "sprint_goals" ("sprint_id", lower("name"));

-- Ordering index
CREATE INDEX IF NOT EXISTS "sprint_goals_sprint_id_position_idx"
  ON "sprint_goals" ("sprint_id", "position");

-- ============================================================================
-- todos
-- ============================================================================

CREATE TABLE IF NOT EXISTS "todos" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "title"               TEXT        NOT NULL,
  "description"         TEXT,
  "status"              TEXT        NOT NULL DEFAULT 'todo',
  "priority"            TEXT        NOT NULL DEFAULT 'medium',
  "assignee_user_id"    UUID,
  "due_date"            DATE,
  "sprint_id"           UUID,
  "sprint_goal_id"      UUID,
  "created_by_user_id"  UUID        NOT NULL,
  "completed_at"        TIMESTAMPTZ,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "todos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "todos_status_check" CHECK ("status" IN ('todo', 'in_progress', 'done')),
  CONSTRAINT "todos_priority_check" CHECK ("priority" IN ('low', 'medium', 'high')),
  CONSTRAINT "todos_title_desc_length_check"
    CHECK (length("title") <= 140 AND ("description" IS NULL OR length("description") <= 4000))
);

-- FKs on todos
ALTER TABLE "todos"
  ADD CONSTRAINT "todos_assignee_user_id_fkey"
  FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "todos"
  ADD CONSTRAINT "todos_sprint_id_fkey"
  FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "todos"
  ADD CONSTRAINT "todos_sprint_goal_id_fkey"
  FOREIGN KEY ("sprint_goal_id") REFERENCES "sprint_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "todos"
  ADD CONSTRAINT "todos_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes on todos per SPEC §2
CREATE INDEX IF NOT EXISTS "todos_assignee_status_due_date_idx"
  ON "todos" ("assignee_user_id", "status", "due_date" ASC);

CREATE INDEX IF NOT EXISTS "todos_sprint_id_sprint_goal_id_idx"
  ON "todos" ("sprint_id", "sprint_goal_id");

CREATE INDEX IF NOT EXISTS "todos_due_date_not_done_idx"
  ON "todos" ("due_date") WHERE "status" != 'done';

CREATE INDEX IF NOT EXISTS "todos_no_sprint_idx"
  ON "todos" ("sprint_id") WHERE "sprint_id" IS NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_set_updated_at_todos ON "todos";
CREATE TRIGGER trg_set_updated_at_todos
  BEFORE UPDATE ON "todos"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Trigger: trg_todo_goal_in_sprint
-- Ensures sprint_goal_id's sprint matches the todo's sprint_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_todo_goal_in_sprint()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sprint_goal_id IS NOT NULL THEN
    IF NEW.sprint_id IS NULL THEN
      RAISE EXCEPTION 'todo cannot have sprint_goal_id without sprint_id';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM sprint_goals
      WHERE id = NEW.sprint_goal_id AND sprint_id = NEW.sprint_id
    ) THEN
      RAISE EXCEPTION 'sprint_goal_id % does not belong to sprint_id %',
        NEW.sprint_goal_id, NEW.sprint_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_todo_goal_in_sprint ON "todos";
CREATE TRIGGER trg_todo_goal_in_sprint
  BEFORE INSERT OR UPDATE OF sprint_goal_id, sprint_id
  ON "todos"
  FOR EACH ROW
  EXECUTE FUNCTION check_todo_goal_in_sprint();

-- ============================================================================
-- activity_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS "activity_events" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id"    UUID        NOT NULL,
  "kind"             TEXT        NOT NULL,
  "target_todo_id"   UUID,
  "target_sprint_id" UUID,
  "payload_json"     JSONB,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_events_kind_check" CHECK ("kind" IN (
    'todo_created', 'todo_status_changed', 'todo_assigned',
    'comment_posted', 'sprint_created', 'sprint_activated', 'sprint_completed'
  ))
);

-- FKs on activity_events
ALTER TABLE "activity_events"
  ADD CONSTRAINT "activity_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_events"
  ADD CONSTRAINT "activity_events_target_todo_id_fkey"
  FOREIGN KEY ("target_todo_id") REFERENCES "todos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activity_events"
  ADD CONSTRAINT "activity_events_target_sprint_id_fkey"
  FOREIGN KEY ("target_sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "activity_events_created_at_idx"
  ON "activity_events" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "activity_events_target_todo_id_created_at_idx"
  ON "activity_events" ("target_todo_id", "created_at" DESC);
