import {
  index,
  integer,
  sqliteTable,
  text,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const systems = sqliteTable("systems", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  extensions: text("extensions", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  dat_source: text("dat_source"),
  kind: text("kind").$type<"console" | "handheld">().notNull().default("console"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  system_id: integer("system_id")
    .notNull()
    .references(() => systems.id),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  year: text("year"),
  genre: text("genre"),
  box_art_path: text("box_art_path"),
  hash_crc32: text("hash_crc32"),
  hash_md5: text("hash_md5"),
  hash_sha1: text("hash_sha1"),
  file_path: text("file_path").notNull(),
  file_size: integer("file_size"),
  hashed: integer("hashed", { mode: "boolean" }).notNull().default(false),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  hidden_at: text("hidden_at"),
  hidden_reason: text("hidden_reason"),
  scraped_at: text("scraped_at"),
  /** Filesystem creation/birth time (ctime) captured at ingest. ISO-8601 string. */
  file_created_at: text("file_created_at"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  // v1.2.1 — scraper-backed region metadata for dedup scoring
  scraper_region: text("scraper_region"),
  scraper_languages: text("scraper_languages", { mode: "json" }).$type<string[]>(),
  scraper_is_primary_release: integer("scraper_is_primary_release", { mode: "boolean" }),
  scraper_source: text("scraper_source").$type<"screenscraper" | "igdb" | null>(),
  scraper_fetched_at: text("scraper_fetched_at"),
  // v1.3 — user library features
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  user_rating: integer("user_rating"),
  publisher: text("publisher"),
  series: text("series"),
  // DAT auditing Ticket 3 — stripped hashes for headered-ROM systems
  // Null means either: system has no known header format, or the rehash script
  // hasn't run yet.  The match engine falls back to raw hashes when these are null.
  hash_sha1_stripped: text("hash_sha1_stripped"),
  hash_crc32_stripped: text("hash_crc32_stripped"),
});

export const franchises = sqliteTable("franchises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  cover_art_path: text("cover_art_path"),
});

export const game_franchises = sqliteTable(
  "game_franchises",
  {
    game_id: integer("game_id")
      .notNull()
      .references(() => games.id),
    franchise_id: integer("franchise_id")
      .notNull()
      .references(() => franchises.id),
  },
  (t) => [primaryKey({ columns: [t.game_id, t.franchise_id] })]
);

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const collection_games = sqliteTable(
  "collection_games",
  {
    collection_id: integer("collection_id")
      .notNull()
      .references(() => collections.id),
    game_id: integer("game_id")
      .notNull()
      .references(() => games.id),
  },
  (t) => [primaryKey({ columns: [t.collection_id, t.game_id] })]
);

export const export_profiles = sqliteTable("export_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  base_path: text("base_path").notNull(),
  system_mappings: text("system_mappings", { mode: "json" })
    .$type<Record<string, { folder: string }>>()
    .notNull()
    .default(sql`'{}'`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const user_preferences = sqliteTable("user_preferences", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// DAT auditing — Ticket 1 (schema + storage foundation)
// ---------------------------------------------------------------------------

/**
 * A DAT file imported by the user or fetched from a permissive source.
 * `file_hash` is SHA-256 of the raw file — used as a dedupe key so
 * re-uploading the same daily snapshot doesn't create a duplicate row.
 */
export const dats = sqliteTable("dats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Optional FK to systems. NULL = not yet linked to a system. */
  system_id: integer("system_id").references(() => systems.id),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version"),
  author: text("author"),
  /** How the DAT arrived — user upload vs background fetch. */
  source_kind: text("source_kind")
    .$type<"upload" | "fetch">()
    .notNull()
    .default("upload"),
  imported_at: text("imported_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  /** SHA-256 of the raw DAT file. Primary dedupe key for re-uploads. */
  file_hash: text("file_hash").notNull().unique(),
  /**
   * Basename of the skipper XML referenced in the DAT header's
   * `<clrmamepro header="..."/>` element (e.g. "No-Intro_NES.xml").
   * NULL means no header-strip is needed for this system.
   */
  skipper_ref: text("skipper_ref"),
});

/**
 * One row per ROM entry inside a DAT file.
 * CRC32 is stored as a hex string (e.g. "b19ed489") matching DAT format.
 */
export const dat_entries = sqliteTable(
  "dat_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dat_id: integer("dat_id")
      .notNull()
      .references(() => dats.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    size: integer("size"),
    crc32: text("crc32"),
    md5: text("md5"),
    sha1: text("sha1"),
    /** DAT-provided status flag. "good" is the default when absent. */
    status: text("status")
      .$type<"good" | "baddump" | "nodump">()
      .notNull()
      .default("good"),
    /** Parent game name for clone relationships (Parent/Clone DATs). */
    cloneof: text("cloneof"),
    /** Parent set name for MAME merged/split set semantics. */
    romof: text("romof"),
    serial: text("serial"),
    region: text("region"),
  },
  (t) => [
    index("idx_dat_entries_sha1").on(t.sha1),
    index("idx_dat_entries_crc32_size").on(t.crc32, t.size),
    index("idx_dat_entries_dat_id").on(t.dat_id),
  ]
);

/**
 * Hit-only match results — one row per matched DAT entry.
 * Misses are computed at query time via LEFT JOIN from dat_entries,
 * avoiding the O(DATs × entries) blowup that materialised miss rows would cause.
 *
 * `dat_id` is denormalised from dat_entries to make the completion aggregation
 * index (idx_match_results_dat_id_match_type) effective without a join.
 */
export const match_results = sqliteTable(
  "match_results",
  {
    dat_entry_id: integer("dat_entry_id")
      .notNull()
      .references(() => dat_entries.id, { onDelete: "cascade" }),
    /**
     * Denormalised from dat_entries.dat_id — kept in sync by the match engine.
     * Required so the completion aggregation index works without joining
     * through dat_entries on every query.
     */
    dat_id: integer("dat_id")
      .notNull()
      .references(() => dats.id, { onDelete: "cascade" }),
    /** FK to games — nullable because the matched file may not have a games row yet. */
    game_id: integer("game_id").references(() => games.id, {
      onDelete: "set null",
    }),
    match_type: text("match_type")
      .$type<"have" | "have_baddump" | "nodump">()
      .notNull(),
    /** Which hash strategy produced the match. */
    matched_by: text("matched_by")
      .$type<"sha1" | "crc32+size" | "stripped-sha1">()
      .notNull(),
    matched_at: text("matched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("idx_match_results_dat_id_match_type").on(t.dat_id, t.match_type),
    index("idx_match_results_dat_entry_id").on(t.dat_entry_id),
  ]
);

// ---------------------------------------------------------------------------
// DAT auditing — Ticket 9 (scheduled refresh + diff view)
// ---------------------------------------------------------------------------

/**
 * Summary record for one DAT version transition.
 *
 * Retention policy: keep the last 3 versions of each DAT (by imported_at DESC).
 * When a new version is ingested via auto-fetch, any versions older than the
 * 3rd-most-recent for the same dat_name are deleted. This is enforced by
 * dat-diff.ts immediately after computeDiff() persists the new rows.
 *
 * 3 was chosen as the default because:
 *   - It provides enough history to see a trend (current, previous, one before)
 *   - DAT files can be 10k–100k entries; keeping more than 3 full entry sets
 *     in dat_diff_entries would consume significant disk at no practical benefit
 *     for the timeline UI use case (Kit #351 follow-up)
 *   - If the user needs deeper history, they can re-upload historical snapshots
 */
export const dat_diffs = sqliteTable(
  "dat_diffs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /**
     * Logical DAT identifier — the `dats.name` value shared by all versions.
     * Stored denormalised here so timeline queries don't need to join through
     * two DAT rows.
     */
    dat_name: text("dat_name").notNull(),
    /** The earlier DAT version — the "before" snapshot. */
    from_dat_id: integer("from_dat_id")
      .notNull()
      .references(() => dats.id, { onDelete: "cascade" }),
    /** The newer DAT version — the "after" snapshot. */
    to_dat_id: integer("to_dat_id")
      .notNull()
      .references(() => dats.id, { onDelete: "cascade" }),
    computed_at: text("computed_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    added_count: integer("added_count").notNull().default(0),
    removed_count: integer("removed_count").notNull().default(0),
    changed_count: integer("changed_count").notNull().default(0),
  },
  (t) => [
    // Timeline query: all diffs for a logical DAT name, newest-first.
    index("idx_dat_diffs_name_computed").on(t.dat_name, t.computed_at),
    // Lookup by either endpoint — used by cascade-delete guard and idempotency check.
    index("idx_dat_diffs_from_dat_id").on(t.from_dat_id),
    index("idx_dat_diffs_to_dat_id").on(t.to_dat_id),
  ]
);

/**
 * Per-entry detail rows for a diff.
 * Each row represents one ROM entry that was added, removed, or had its status
 * changed between the two DAT versions.
 *
 * We store these separately from the summary because Kit's UI needs a
 * click-through to newly-missing entries (#351 follow-up), and materialising
 * them in a child table is cheaper than recomputing from scratch on demand.
 */
export const dat_diff_entries = sqliteTable(
  "dat_diff_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dat_diff_id: integer("dat_diff_id")
      .notNull()
      .references(() => dat_diffs.id, { onDelete: "cascade" }),
    /**
     * "added"          — hash present in to_dat, absent in from_dat
     * "removed"        — hash present in from_dat, absent in to_dat
     * "status_changed" — same canonical hash in both, but status field differs
     */
    change_type: text("change_type")
      .$type<"added" | "removed" | "status_changed">()
      .notNull(),
    /** ROM/game name from the relevant DAT entry. */
    entry_name: text("entry_name").notNull(),
    crc32: text("crc32"),
    sha1: text("sha1"),
    /** Previous status — null for "added" entries (no prior row). */
    prev_status: text("prev_status").$type<"good" | "baddump" | "nodump" | null>(),
    /** New status — null for "removed" entries (no new row). */
    new_status: text("new_status").$type<"good" | "baddump" | "nodump" | null>(),
  },
  (t) => [
    index("idx_dat_diff_entries_diff_id").on(t.dat_diff_id),
    index("idx_dat_diff_entries_change_type").on(t.change_type),
  ]
);

export const file_operations = sqliteTable("file_operations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  game_id: integer("game_id"),
  operation: text("operation").notNull(),
  actor: text("actor").notNull().default("user"),
  timestamp: text("timestamp")
    .notNull()
    .default(sql`(datetime('now'))`),
  file_path_before: text("file_path_before"),
  file_path_after: text("file_path_after"),
  hash_sha1: text("hash_sha1"),
  notes: text("notes"),
});
