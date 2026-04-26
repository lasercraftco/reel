/**
 * Drizzle schema — source of truth for the Postgres database.
 *
 * Mirrored to SQLAlchemy in reel-engine/app/models.py. If this drifts,
 * Drizzle wins.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Auth + users                                                                */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 200 }),
    avatarUrl: varchar("avatar_url", { length: 800 }),
    role: varchar("role", { length: 20 }).notNull().default("friend"), // owner | trusted | friend | guest
    blocked: boolean("blocked").notNull().default(false),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    dailyRequestQuota: integer("daily_request_quota").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    settings: jsonb("settings").$type<UserSettings>().notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    emailIdx: uniqueIndex("uq_users_email").on(t.email),
  }),
);

export type UserSettings = {
  familyFriendly?: boolean;
  excludeWatched?: boolean;
  blockedActors?: string[];
  blockedDirectors?: string[];
  blockedGenres?: string[];
  preferredQualityProfile?: number;
  weights?: Record<string, number>;
  surpriseRatio?: number;
};

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("uq_magic_links_token").on(t.tokenHash),
    emailIdx: index("ix_magic_links_email").on(t.email),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("uq_sessions_token").on(t.tokenHash),
    userIdx: index("ix_sessions_user").on(t.userId),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 40 }).notNull(),
    target: varchar("target", { length: 200 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("ix_audit_user").on(t.userId),
    createdIdx: index("ix_audit_created").on(t.createdAt),
  }),
);

/* -------------------------------------------------------------------------- */
/* Movie catalog (global, shared)                                              */
/* -------------------------------------------------------------------------- */

export const movies = pgTable(
  "movies",
  {
    id: integer("id").primaryKey(), // TMDB id
    imdbId: varchar("imdb_id", { length: 20 }),
    title: varchar("title", { length: 400 }).notNull(),
    originalTitle: varchar("original_title", { length: 400 }),
    overview: text("overview"),
    tagline: text("tagline"),
    releaseDate: varchar("release_date", { length: 10 }),
    runtime: integer("runtime"),
    posterPath: varchar("poster_path", { length: 200 }),
    backdropPath: varchar("backdrop_path", { length: 200 }),
    originalLanguage: varchar("original_language", { length: 10 }),
    spokenLanguages: jsonb("spoken_languages").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    productionCountries: jsonb("production_countries").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    genres: jsonb("genres").$type<{ id: number; name: string }[]>().notNull().default(sql`'[]'::jsonb`),
    keywords: jsonb("keywords").$type<{ id: number; name: string }[]>().notNull().default(sql`'[]'::jsonb`),
    certification: varchar("certification", { length: 12 }),
    voteAverage: doublePrecision("vote_average"),
    voteCount: integer("vote_count"),
    popularity: doublePrecision("popularity"),
    budget: integer("budget"),
    revenue: integer("revenue"),
    status: varchar("status", { length: 30 }),
    homepage: varchar("homepage", { length: 800 }),
    collectionId: integer("collection_id"),
    collectionName: varchar("collection_name", { length: 300 }),
    cast: jsonb("cast").$type<MovieCastMember[]>().notNull().default(sql`'[]'::jsonb`),
    crew: jsonb("crew").$type<MovieCrewMember[]>().notNull().default(sql`'[]'::jsonb`),
    ratingsExternal: jsonb("ratings_external")
      .$type<{ rt?: number; mc?: number; imdb?: number; letterboxd?: number }>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    watchProviders: jsonb("watch_providers").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    awards: jsonb("awards").$type<MovieAward[]>().notNull().default(sql`'[]'::jsonb`),
    moodTags: jsonb("mood_tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    eraTag: varchar("era_tag", { length: 60 }),
    embedding: jsonb("embedding").$type<number[] | null>(),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    titleIdx: index("ix_movies_title").on(t.title),
    imdbIdx: index("ix_movies_imdb").on(t.imdbId),
    releaseIdx: index("ix_movies_release").on(t.releaseDate),
  }),
);

export type MovieCastMember = {
  id: number;
  name: string;
  character?: string;
  profilePath?: string | null;
  order?: number;
};

export type MovieCrewMember = {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath?: string | null;
};

export type MovieAward = {
  ceremony: string;
  year: number;
  category: string;
  result: "won" | "nominated";
};

/* -------------------------------------------------------------------------- */
/* Library state (Tyler's owned movies — single global truth from Radarr)     */
/* -------------------------------------------------------------------------- */

export const library = pgTable(
  "library",
  {
    movieId: integer("movie_id")
      .primaryKey()
      .references(() => movies.id, { onDelete: "cascade" }),
    radarrId: integer("radarr_id"),
    qualityProfileId: integer("quality_profile_id"),
    status: varchar("status", { length: 30 }).notNull(), // wanted | downloading | downloaded | imported | missing
    progressPercent: doublePrecision("progress_percent"),
    sizeOnDisk: integer("size_on_disk"),
    monitored: boolean("monitored").notNull().default(true),
    plexKey: varchar("plex_key", { length: 80 }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("ix_library_status").on(t.status),
  }),
);

/* -------------------------------------------------------------------------- */
/* Per-user behavior tables                                                    */
/* -------------------------------------------------------------------------- */

export const watchlist = pgTable(
  "watchlist",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.movieId] }),
    userIdx: index("ix_watchlist_user").on(t.userId),
  }),
);

export const feedback = pgTable(
  "feedback",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    signal: varchar("signal", { length: 20 }).notNull(), // up | down | block | seed | not_interested
    weight: doublePrecision("weight").notNull().default(1.0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userMovieIdx: index("ix_feedback_user_movie").on(t.userId, t.movieId),
    movieIdx: index("ix_feedback_movie").on(t.movieId),
  }),
);

export const libraryAdds = pgTable(
  "library_adds",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull(), // requested | approved | rejected | submitted | downloaded | imported
    qualityProfileId: integer("quality_profile_id"),
    note: text("note"),
    decisionBy: uuid("decision_by").references(() => users.id, { onDelete: "set null" }),
    decisionAt: timestamp("decision_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("ix_library_adds_user").on(t.userId),
    movieIdx: index("ix_library_adds_movie").on(t.movieId),
    statusIdx: index("ix_library_adds_status").on(t.status),
  }),
);

export const searchHistory = pgTable("search_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  query: varchar("query", { length: 400 }).notNull(),
  resultCount: integer("result_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const viewHistory = pgTable(
  "view_history",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    surface: varchar("surface", { length: 30 }).notNull(), // foryou | search | detail | similar | watchlist
    sessionId: varchar("session_id", { length: 60 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userMovieIdx: index("ix_view_history_user_movie").on(t.userId, t.movieId),
    sessionIdx: index("ix_view_history_session").on(t.sessionId),
  }),
);

/* -------------------------------------------------------------------------- */
/* Recommendation cache (per-user)                                             */
/* -------------------------------------------------------------------------- */

export const recommendations = pgTable(
  "recommendations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    mode: varchar("mode", { length: 30 }).notNull(), // foryou | seed | watchparty | hidden_gems | comfort | discovery_weekly
    seedKey: varchar("seed_key", { length: 200 }), // movie_id or label for the seed
    score: doublePrecision("score").notNull(),
    perScorer: jsonb("per_scorer").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    explanation: jsonb("explanation").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    rank: integer("rank").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    userModeIdx: index("ix_recs_user_mode").on(t.userId, t.mode),
    seedIdx: index("ix_recs_seed").on(t.seedKey),
  }),
);

/* -------------------------------------------------------------------------- */
/* Source caches (TMDB similar / Letterboxd / Reddit / Trakt) — global         */
/* -------------------------------------------------------------------------- */

export const sourceCache = pgTable(
  "source_cache",
  {
    source: varchar("source", { length: 30 }).notNull(),
    key: varchar("key", { length: 400 }).notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.source, t.key] }),
  }),
);

export const plexHistory = pgTable(
  "plex_history",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    plexKey: varchar("plex_key", { length: 80 }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    rating: doublePrecision("rating"),
  },
  (t) => ({
    movieIdx: index("ix_plex_history_movie").on(t.movieId),
  }),
);
