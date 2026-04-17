-- Phase 1: Auth + Admin allowlist domain models
-- Extends Phase 0 Auth.js adapter tables with full domain fields.

-- ============================================================================
-- Alter users table: add domain columns
-- ============================================================================

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "display_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT,
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Make email NOT NULL (it was nullable in Phase 0)
-- First populate any null emails if any exist
UPDATE "users" SET "email" = 'unknown-' || "id" WHERE "email" IS NULL;
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;

-- CHECK constraint: role must be 'admin' or 'member'
ALTER TABLE "users"
  ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('admin', 'member'));

-- Rename Auth.js 'name' column to keep compatibility (map to display_name via Prisma)
-- Note: 'name' column exists from Phase 0; we keep it for Auth.js adapter compatibility
-- but our domain uses 'display_name'. We populate display_name from name if present.
UPDATE "users" SET "display_name" = "name" WHERE "name" IS NOT NULL AND "display_name" = '';

-- ============================================================================
-- Rename Auth.js column mappings for Phase 1 (sessions & accounts)
-- The Auth.js PrismaAdapter uses camelCase field names but we now use snake_case maps.
-- ============================================================================

-- sessions: rename sessionToken -> session_token, userId -> user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='sessions' AND column_name='sessionToken'
  ) THEN
    ALTER TABLE "sessions" RENAME COLUMN "sessionToken" TO "session_token";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='sessions' AND column_name='userId'
  ) THEN
    ALTER TABLE "sessions" RENAME COLUMN "userId" TO "user_id";
  END IF;
END $$;

-- Drop and recreate the unique index on session_token
DROP INDEX IF EXISTS "sessions_sessionToken_key";
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_session_token_key" ON "sessions"("session_token");

-- Drop and re-add FK on sessions
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_userId_fkey";
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- accounts: rename userId -> user_id, providerAccountId -> provider_account_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='accounts' AND column_name='userId'
  ) THEN
    ALTER TABLE "accounts" RENAME COLUMN "userId" TO "user_id";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='accounts' AND column_name='providerAccountId'
  ) THEN
    ALTER TABLE "accounts" RENAME COLUMN "providerAccountId" TO "provider_account_id";
  END IF;
END $$;

-- Drop and recreate unique index on accounts
DROP INDEX IF EXISTS "accounts_provider_providerAccountId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_provider_account_id_key"
  ON "accounts"("provider", "provider_account_id");

-- Drop and re-add FK on accounts
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_userId_fkey";
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Create allowlist_entries table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "allowlist_entries" (
  "id"               TEXT        NOT NULL,
  "email"            TEXT        NOT NULL,
  "added_by_user_id" TEXT        NOT NULL,
  "added_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "allowlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "allowlist_entries_email_key"
  ON "allowlist_entries"("email");

ALTER TABLE "allowlist_entries"
  ADD CONSTRAINT "allowlist_entries_added_by_user_id_fkey"
  FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Create sessions_log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sessions_log" (
  "id"         TEXT        NOT NULL,
  "user_id"    TEXT        NOT NULL,
  "provider"   TEXT        NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sessions_log_pkey" PRIMARY KEY ("id")
);

-- CHECK constraint: provider must be 'google' or 'github'
ALTER TABLE "sessions_log"
  ADD CONSTRAINT "sessions_log_provider_check"
  CHECK ("provider" IN ('google', 'github'));

CREATE INDEX IF NOT EXISTS "sessions_log_user_id_created_at_idx"
  ON "sessions_log"("user_id", "created_at" DESC);

ALTER TABLE "sessions_log"
  ADD CONSTRAINT "sessions_log_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- updated_at trigger on users
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_users ON "users";
CREATE TRIGGER trg_set_updated_at_users
  BEFORE UPDATE ON "users"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
