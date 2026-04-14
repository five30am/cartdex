import {
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
