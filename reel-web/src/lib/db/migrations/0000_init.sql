-- Reel — initial schema. Generated to match src/lib/db/schema.ts.
-- Subsequent edits should be produced by `pnpm drizzle:generate`.

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(320) NOT NULL,
  "name" varchar(200),
  "avatar_url" varchar(800),
  "role" varchar(20) NOT NULL DEFAULT 'friend',
  "blocked" boolean NOT NULL DEFAULT false,
  "onboarded_at" timestamptz,
  "daily_request_quota" integer NOT NULL DEFAULT 5,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email" ON "users" ("email");

CREATE TABLE IF NOT EXISTS "magic_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(320) NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_magic_links_token" ON "magic_links" ("token_hash");
CREATE INDEX IF NOT EXISTS "ix_magic_links_email" ON "magic_links" ("email");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(128) NOT NULL,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sessions_token" ON "sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "ix_sessions_user" ON "sessions" ("user_id");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(40) NOT NULL,
  "target" varchar(200),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_audit_user" ON "audit_log" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_audit_created" ON "audit_log" ("created_at");

CREATE TABLE IF NOT EXISTS "movies" (
  "id" integer PRIMARY KEY,
  "imdb_id" varchar(20),
  "title" varchar(400) NOT NULL,
  "original_title" varchar(400),
  "overview" text,
  "tagline" text,
  "release_date" varchar(10),
  "runtime" integer,
  "poster_path" varchar(200),
  "backdrop_path" varchar(200),
  "original_language" varchar(10),
  "spoken_languages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "production_countries" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "genres" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "keywords" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "certification" varchar(12),
  "vote_average" double precision,
  "vote_count" integer,
  "popularity" double precision,
  "budget" bigint,
  "revenue" bigint,
  "status" varchar(30),
  "homepage" varchar(800),
  "collection_id" integer,
  "collection_name" varchar(300),
  "cast" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "crew" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "ratings_external" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "watch_providers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "awards" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "mood_tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "era_tag" varchar(60),
  "embedding" jsonb,
  "enriched_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_movies_title" ON "movies" ("title");
CREATE INDEX IF NOT EXISTS "ix_movies_imdb" ON "movies" ("imdb_id");
CREATE INDEX IF NOT EXISTS "ix_movies_release" ON "movies" ("release_date");

CREATE TABLE IF NOT EXISTS "library" (
  "movie_id" integer PRIMARY KEY REFERENCES "movies"("id") ON DELETE CASCADE,
  "radarr_id" integer,
  "quality_profile_id" integer,
  "status" varchar(30) NOT NULL,
  "progress_percent" double precision,
  "size_on_disk" bigint,
  "monitored" boolean NOT NULL DEFAULT true,
  "plex_key" varchar(80),
  "added_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_library_status" ON "library" ("status");

CREATE TABLE IF NOT EXISTS "watchlist" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "movie_id" integer NOT NULL REFERENCES "movies"("id") ON DELETE CASCADE,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  "note" text,
  PRIMARY KEY ("user_id", "movie_id")
);
CREATE INDEX IF NOT EXISTS "ix_watchlist_user" ON "watchlist" ("user_id");

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "movie_id" integer NOT NULL REFERENCES "movies"("id") ON DELETE CASCADE,
  "signal" varchar(20) NOT NULL,
  "weight" double precision NOT NULL DEFAULT 1.0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_feedback_user_movie" ON "feedback" ("user_id", "movie_id");
CREATE INDEX IF NOT EXISTS "ix_feedback_movie" ON "feedback" ("movie_id");

CREATE TABLE IF NOT EXISTS "library_adds" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "movie_id" integer NOT NULL REFERENCES "movies"("id") ON DELETE CASCADE,
  "status" varchar(20) NOT NULL,
  "quality_profile_id" integer,
  "note" text,
  "decision_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "decision_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_library_adds_user" ON "library_adds" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_library_adds_movie" ON "library_adds" ("movie_id");
CREATE INDEX IF NOT EXISTS "ix_library_adds_status" ON "library_adds" ("status");

CREATE TABLE IF NOT EXISTS "search_history" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "query" varchar(400) NOT NULL,
  "result_count" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "view_history" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "movie_id" integer NOT NULL REFERENCES "movies"("id") ON DELETE CASCADE,
  "surface" varchar(30) NOT NULL,
  "session_id" varchar(60),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_view_history_user_movie" ON "view_history" ("user_id", "movie_id");
CREATE INDEX IF NOT EXISTS "ix_view_history_session" ON "view_history" ("session_id");

CREATE TABLE IF NOT EXISTS "recommendations" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "movie_id" integer NOT NULL REFERENCES "movies"("id") ON DELETE CASCADE,
  "mode" varchar(30) NOT NULL,
  "seed_key" varchar(200),
  "score" double precision NOT NULL,
  "per_scorer" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "explanation" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "rank" integer NOT NULL,
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "ix_recs_user_mode" ON "recommendations" ("user_id", "mode");
CREATE INDEX IF NOT EXISTS "ix_recs_seed" ON "recommendations" ("seed_key");

CREATE TABLE IF NOT EXISTS "source_cache" (
  "source" varchar(30) NOT NULL,
  "key" varchar(400) NOT NULL,
  "payload" jsonb NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz,
  PRIMARY KEY ("source", "key")
);

CREATE TABLE IF NOT EXISTS "plex_history" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "movie_id" integer NOT NULL REFERENCES "movies"("id") ON DELETE CASCADE,
  "plex_key" varchar(80),
  "viewed_at" timestamptz,
  "view_count" integer NOT NULL DEFAULT 0,
  "rating" double precision
);
CREATE INDEX IF NOT EXISTS "ix_plex_history_movie" ON "plex_history" ("movie_id");
