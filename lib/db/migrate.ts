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
      hashed INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Add hashed column to existing games tables
  try {
    sqlite.exec(`ALTER TABLE games ADD COLUMN hashed INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists — ignore
  }

  // Add hidden/trash columns to games table (v1 dedup feature)
  try { sqlite.exec(`ALTER TABLE games ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE games ADD COLUMN hidden_at TEXT`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE games ADD COLUMN hidden_reason TEXT`); } catch { /* already exists */ }

  // Audit log table + indexes (v1 dedup feature)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS file_operations (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id          INTEGER,
      operation        TEXT NOT NULL,
      actor            TEXT NOT NULL DEFAULT 'user',
      timestamp        TEXT NOT NULL DEFAULT (datetime('now')),
      file_path_before TEXT,
      file_path_after  TEXT,
      hash_sha1        TEXT,
      notes            TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_file_ops_game_id   ON file_operations(game_id);
    CREATE INDEX IF NOT EXISTS idx_file_ops_operation ON file_operations(operation);
    CREATE INDEX IF NOT EXISTS idx_games_hidden        ON games(hidden);
    CREATE INDEX IF NOT EXISTS idx_games_hash_sha1     ON games(hash_sha1);
  `);

  // Clean up games incorrectly ingested from .zip files (matched as NES due to extension collision)
  const zipCleanup = sqlite.prepare(`DELETE FROM games WHERE file_path LIKE '%.zip'`).run();
  if (zipCleanup.changes > 0) {
    console.log(`  Cleaned up ${zipCleanup.changes} incorrectly ingested .zip files`);
  }

  // Reset scraped_at for games that were scraped but got no box art (artwork permission bug)
  const artReset = sqlite.prepare(`UPDATE games SET scraped_at = NULL WHERE scraped_at IS NOT NULL AND box_art_path IS NULL`).run();
  if (artReset.changes > 0) {
    console.log(`  Reset ${artReset.changes} games for re-scrape (missing box art)`);
  }

  // Migrate old /artwork/ paths to /api/artwork/ (standalone mode can't serve dynamic public files)
  const artPathFix = sqlite.prepare(`UPDATE games SET box_art_path = '/api' || box_art_path WHERE box_art_path LIKE '/artwork/%'`).run();
  if (artPathFix.changes > 0) {
    console.log(`  Migrated ${artPathFix.changes} artwork paths to /api/artwork/`);
  }

  // v1.1: file_created_at — filesystem ctime captured at ingest time
  try {
    sqlite.exec(`ALTER TABLE games ADD COLUMN file_created_at TEXT`);
    console.log("  Added file_created_at column to games");
  } catch {
    // Column already exists — ignore
  }

  // v1.2.1: scraper-backed region metadata for metadata-first dedup scoring
  const scraperCols: Array<[string, string]> = [
    ["scraper_region", "TEXT"],
    ["scraper_languages", "TEXT"],
    ["scraper_is_primary_release", "INTEGER"],
    ["scraper_source", "TEXT"],
    ["scraper_fetched_at", "TEXT"],
  ];
  for (const [col, type] of scraperCols) {
    try {
      sqlite.exec(`ALTER TABLE games ADD COLUMN ${col} ${type}`);
      console.log(`  Added ${col} column to games`);
    } catch {
      // Column already exists — ignore
    }
  }

  // Seed preferred_region setting if not present
  const existingRegion = sqlite.prepare(`SELECT key FROM settings WHERE key = 'preferred_region'`).get();
  if (!existingRegion) {
    sqlite.prepare(`INSERT INTO settings (key, value) VALUES ('preferred_region', 'USA')`).run();
    console.log("  Seeded preferred_region = USA");
  }

  // v1.3: user library features — favorites, ratings, publisher, series
  const v13GameCols: Array<[string, string]> = [
    ["favorite", "INTEGER NOT NULL DEFAULT 0"],
    ["user_rating", "INTEGER"],
    ["publisher", "TEXT"],
    ["series", "TEXT"],
  ];
  for (const [col, type] of v13GameCols) {
    try {
      sqlite.exec(`ALTER TABLE games ADD COLUMN ${col} ${type}`);
      console.log(`  Added ${col} column to games`);
    } catch {
      // Column already exists — ignore
    }
  }

  // v1.3: kind column on systems (console | handheld)
  try {
    sqlite.exec(`ALTER TABLE systems ADD COLUMN kind TEXT NOT NULL DEFAULT 'console'`);
    console.log("  Added kind column to systems");
  } catch {
    // Column already exists — ignore
  }

  // v1.4: enabled column on systems (soft-disable from browse UI)
  try {
    sqlite.exec(`ALTER TABLE systems ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`);
    console.log("  Added enabled column to systems");
  } catch {
    // Column already exists — ignore
  }

  // ---------------------------------------------------------------------------
  // DAT auditing — Ticket 1: dats, dat_entries, match_results
  // ---------------------------------------------------------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS dats (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      system_id   INTEGER REFERENCES systems(id),
      name        TEXT NOT NULL,
      description TEXT,
      version     TEXT,
      author      TEXT,
      source_kind TEXT NOT NULL DEFAULT 'upload',
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      file_hash   TEXT NOT NULL UNIQUE,
      skipper_ref TEXT
    );

    CREATE TABLE IF NOT EXISTS dat_entries (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      dat_id  INTEGER NOT NULL REFERENCES dats(id) ON DELETE CASCADE,
      name    TEXT NOT NULL,
      size    INTEGER,
      crc32   TEXT,
      md5     TEXT,
      sha1    TEXT,
      status  TEXT NOT NULL DEFAULT 'good',
      cloneof TEXT,
      romof   TEXT,
      serial  TEXT,
      region  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_dat_entries_sha1        ON dat_entries(sha1);
    CREATE INDEX IF NOT EXISTS idx_dat_entries_crc32_size  ON dat_entries(crc32, size);
    CREATE INDEX IF NOT EXISTS idx_dat_entries_dat_id      ON dat_entries(dat_id);

    CREATE TABLE IF NOT EXISTS match_results (
      dat_entry_id INTEGER NOT NULL REFERENCES dat_entries(id) ON DELETE CASCADE,
      dat_id       INTEGER NOT NULL REFERENCES dats(id)        ON DELETE CASCADE,
      game_id      INTEGER          REFERENCES games(id)        ON DELETE SET NULL,
      match_type   TEXT NOT NULL,
      matched_by   TEXT NOT NULL,
      matched_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_match_results_dat_id_match_type ON match_results(dat_id, match_type);
    CREATE INDEX IF NOT EXISTS idx_match_results_dat_entry_id      ON match_results(dat_entry_id);
  `);

  // DAT auditing Ticket 3 — stripped hash columns for headered-ROM systems
  // Additive only — existing rows default to NULL (stripped hashes not yet computed).
  // Run scripts/rehash-headered.ts to backfill existing library entries.
  const strippedHashCols: Array<[string, string]> = [
    ["hash_sha1_stripped", "TEXT"],
    ["hash_crc32_stripped", "TEXT"],
  ];
  for (const [col, type] of strippedHashCols) {
    try {
      sqlite.exec(`ALTER TABLE games ADD COLUMN ${col} ${type}`);
      console.log(`  Added ${col} column to games`);
    } catch {
      // Column already exists — ignore
    }
  }

  // One-time migration: set correct kind for known handheld systems
  const handhelds = ["gb", "gbc", "gba", "psp"];
  for (const slug of handhelds) {
    sqlite.prepare(`UPDATE systems SET kind = 'handheld' WHERE slug = ? AND kind != 'handheld'`).run(slug);
  }
  // Ensure consoles are explicitly set
  const consoles = ["nes", "snes", "n64", "genesis", "mastersystem", "arcade", "psx"];
  for (const slug of consoles) {
    sqlite.prepare(`UPDATE systems SET kind = 'console' WHERE slug = ? AND kind != 'console'`).run(slug);
  }

  // v1.1: fix psx/arcade slug mismatch — reassign games whose file_path starts with the arcade
  // directory to the arcade system (if arcade system is now registered).
  const arcadeSystem = sqlite.prepare(`SELECT id FROM systems WHERE slug = 'arcade'`).get() as { id: number } | undefined;
  if (arcadeSystem) {
    const psx = sqlite.prepare(`SELECT id FROM systems WHERE slug = 'psx'`).get() as { id: number } | undefined;
    if (psx) {
      // Any game assigned to psx whose path contains /arcade/ is actually an arcade ROM
      const fix = sqlite.prepare(
        `UPDATE games SET system_id = ? WHERE system_id = ? AND (file_path LIKE '%/arcade/%' OR file_path LIKE '%\\arcade\\%')`
      ).run(arcadeSystem.id, psx.id);
      if (fix.changes > 0) {
        console.log(`  Reassigned ${fix.changes} arcade CHDs from psx → arcade system`);
      }
    }
  }
}
