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
}
