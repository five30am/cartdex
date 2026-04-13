import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./index";
import path from "path";

export function runMigrations() {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

export function ensureSchema() {
  // Create tables directly if they don't exist (used in dev without running migrate)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS systems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      extensions TEXT NOT NULL DEFAULT '[]',
      dat_source TEXT
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_id INTEGER NOT NULL REFERENCES systems(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      year TEXT,
      genre TEXT,
      box_art_path TEXT,
      hash_crc32 TEXT,
      hash_md5 TEXT,
      hash_sha1 TEXT,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      verified INTEGER NOT NULL DEFAULT 0,
      scraped_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS franchises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      cover_art_path TEXT
    );

    CREATE TABLE IF NOT EXISTS game_franchises (
      game_id INTEGER NOT NULL REFERENCES games(id),
      franchise_id INTEGER NOT NULL REFERENCES franchises(id),
      PRIMARY KEY (game_id, franchise_id)
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collection_games (
      collection_id INTEGER NOT NULL REFERENCES collections(id),
      game_id INTEGER NOT NULL REFERENCES games(id),
      PRIMARY KEY (collection_id, game_id)
    );

    CREATE TABLE IF NOT EXISTS export_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_path TEXT NOT NULL,
      system_mappings TEXT NOT NULL DEFAULT '{}'
    );
  `);
}
