/**
 * DAT match engine — Ticket 4.
 *
 * Performs a per-DAT match pass that links `dat_entries` rows against `games`
 * rows via a three-stage hash lookup chain:
 *
 *   1. Exact SHA-1 match  (raw hash_sha1)
 *   2. CRC-32 + file-size match  (crc32 + size, for entries without SHA-1)
 *   3. Stripped-SHA-1 match  (hash_sha1_stripped from Ticket 3, for headered ROMs)
 *
 * Hit-only storage: only matched rows are written to `match_results`. Misses
 * are computed at query time via LEFT JOIN from `dat_entries`, avoiding the
 * O(DATs × entries) blowup that materialised miss rows would cause.
 *
 * Idempotent: the match pass clears all existing `match_results` rows for the
 * target `dat_id` before inserting fresh results, so re-running produces
 * identical state.
 *
 * Background job: mirrors the `scanJob` / `startScanInBackground` pattern in
 * `ingest.ts`. A module-level lock prevents concurrent match runs for the same
 * or different DATs (single-user app, one job at a time).
 */

import { db, sqlite } from "@/lib/db";
import { games, dat_entries, match_results, dats } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Job status types (mirror ingest.ts conventions)
// ---------------------------------------------------------------------------

export interface MatchResult {
  dat_id: number;
  total: number;
  have: number;
  have_baddump: number;
  nodump: number;
  missing: number;
  hits_by_sha1: number;
  hits_by_crc32_size: number;
  hits_by_stripped_sha1: number;
}

export interface MatchJobStatus {
  state: "idle" | "running" | "done" | "error";
  dat_id?: number;
  result?: MatchResult;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

// Global single-lock job state — same pattern as ingest.ts scanJob.
// One match pass at a time; callers poll via getMatchStatus().
let matchJob: MatchJobStatus = { state: "idle" };

export function getMatchStatus(): MatchJobStatus {
  return { ...matchJob };
}

/**
 * Fire-and-forget: start a match pass for `datId` in the background.
 * Returns immediately — the caller must poll `getMatchStatus()` for results.
 *
 * If a match pass is already running for any DAT, this is a no-op.
 * The caller can detect this by checking `state === "running"` before calling.
 */
export function startMatchJob(datId: number): void {
  if (matchJob.state === "running") return;

  matchJob = {
    state: "running",
    dat_id: datId,
    startedAt: new Date().toISOString(),
  };

  runMatchPass(datId)
    .then((result) => {
      matchJob = {
        state: "done",
        dat_id: datId,
        result,
        startedAt: matchJob.startedAt,
        finishedAt: new Date().toISOString(),
      };
    })
    .catch((err) => {
      matchJob = {
        state: "error",
        dat_id: datId,
        error: err instanceof Error ? err.message : String(err),
        startedAt: matchJob.startedAt,
        finishedAt: new Date().toISOString(),
      };
    });
}

// ---------------------------------------------------------------------------
// Core match pass
// ---------------------------------------------------------------------------

/**
 * Run a full match pass for the given DAT.
 *
 * Strategy: build in-memory lookup Maps from the `games` table once, then
 * iterate `dat_entries` rows in memory. A single JOIN per lookup direction
 * rather than N round-trips — same pattern as dat-parser.ts used for in-process
 * matching.
 *
 * Transaction contract: clears existing match_results for this dat_id, then
 * bulk-inserts all hits in the same transaction. This makes the pass atomic and
 * idempotent — a partial failure leaves the old results in place.
 */
async function runMatchPass(datId: number): Promise<MatchResult> {
  // Verify the DAT exists first — fail fast with a clear message.
  const dat = db.select({ id: dats.id }).from(dats).where(eq(dats.id, datId)).get();
  if (!dat) {
    throw new Error(`DAT ${datId} not found`);
  }

  // ------------------------------------------------------------------
  // Build lookup Maps from games table — single pass, no N round-trips.
  // Keys are normalised to lower-case so hash case differences don't
  // produce false misses (DATs use upper-case CRC, we store lower-case).
  // ------------------------------------------------------------------

  type GameRow = {
    id: number;
    hash_sha1: string | null;
    hash_crc32: string | null;
    file_size: number | null;
    hash_sha1_stripped: string | null;
  };

  const allGames: GameRow[] = db
    .select({
      id: games.id,
      hash_sha1: games.hash_sha1,
      hash_crc32: games.hash_crc32,
      file_size: games.file_size,
      hash_sha1_stripped: games.hash_sha1_stripped,
    })
    .from(games)
    .where(eq(games.hashed, true))
    .all();

  // sha1 → game_id  (first game wins if duplicate SHA-1 — shouldn't happen in practice)
  const sha1Map = new Map<string, number>();
  // "crc32:size" → game_id
  const crc32SizeMap = new Map<string, number>();
  // stripped sha1 → game_id
  const strippedSha1Map = new Map<string, number>();

  for (const g of allGames) {
    if (g.hash_sha1) {
      const key = g.hash_sha1.toLowerCase();
      if (!sha1Map.has(key)) sha1Map.set(key, g.id);
    }
    if (g.hash_crc32 && g.file_size !== null) {
      const key = `${g.hash_crc32.toLowerCase()}:${g.file_size}`;
      if (!crc32SizeMap.has(key)) crc32SizeMap.set(key, g.id);
    }
    if (g.hash_sha1_stripped) {
      const key = g.hash_sha1_stripped.toLowerCase();
      if (!strippedSha1Map.has(key)) strippedSha1Map.set(key, g.id);
    }
  }

  // ------------------------------------------------------------------
  // Load all dat_entries for this DAT
  // ------------------------------------------------------------------

  type EntryRow = {
    id: number;
    sha1: string | null;
    crc32: string | null;
    size: number | null;
    status: "good" | "baddump" | "nodump";
  };

  const entries: EntryRow[] = db
    .select({
      id: dat_entries.id,
      sha1: dat_entries.sha1,
      crc32: dat_entries.crc32,
      size: dat_entries.size,
      status: dat_entries.status,
    })
    .from(dat_entries)
    .where(eq(dat_entries.dat_id, datId))
    .all();

  // ------------------------------------------------------------------
  // Match pass — classify each entry
  // ------------------------------------------------------------------

  interface HitRow {
    dat_entry_id: number;
    // INVARIANT: dat_id is always written alongside dat_entry_id in the same
    // transaction to keep the denormalised FK in sync. Never insert one without
    // the other. See schema.ts match_results for the rationale.
    dat_id: number;
    game_id: number | null;
    match_type: "have" | "have_baddump" | "nodump";
    matched_by: "sha1" | "crc32+size" | "stripped-sha1";
  }

  const hits: HitRow[] = [];
  let hitsBySha1 = 0;
  let hitsByCrc32Size = 0;
  let hitsByStrippedSha1 = 0;
  let nodumpCount = 0;

  for (const entry of entries) {
    // nodump entries are always recorded — they can never be "have" by definition.
    if (entry.status === "nodump") {
      nodumpCount++;
      hits.push({
        dat_entry_id: entry.id,
        dat_id: datId,
        game_id: null,
        match_type: "nodump",
        matched_by: "sha1", // placeholder — nodump has no real match
      });
      continue;
    }

    const matchType: "have" | "have_baddump" =
      entry.status === "baddump" ? "have_baddump" : "have";

    // --- Stage 1: exact SHA-1 ---
    if (entry.sha1) {
      const gameId = sha1Map.get(entry.sha1.toLowerCase());
      if (gameId !== undefined) {
        hits.push({
          dat_entry_id: entry.id,
          dat_id: datId,
          game_id: gameId,
          match_type: matchType,
          matched_by: "sha1",
        });
        hitsBySha1++;
        continue;
      }
    }

    // --- Stage 2: CRC-32 + size ---
    if (entry.crc32 && entry.size !== null) {
      const key = `${entry.crc32.toLowerCase()}:${entry.size}`;
      const gameId = crc32SizeMap.get(key);
      if (gameId !== undefined) {
        hits.push({
          dat_entry_id: entry.id,
          dat_id: datId,
          game_id: gameId,
          match_type: matchType,
          matched_by: "crc32+size",
        });
        hitsByCrc32Size++;
        continue;
      }
    }

    // --- Stage 3: stripped SHA-1 (headered ROMs — Ticket 3 columns) ---
    if (entry.sha1) {
      const gameId = strippedSha1Map.get(entry.sha1.toLowerCase());
      if (gameId !== undefined) {
        hits.push({
          dat_entry_id: entry.id,
          dat_id: datId,
          game_id: gameId,
          match_type: matchType,
          matched_by: "stripped-sha1",
        });
        hitsByStrippedSha1++;
        continue;
      }
    }

    // No match → miss. Not stored; computed via LEFT JOIN in report queries.
  }

  // ------------------------------------------------------------------
  // Write results in a single atomic transaction.
  //
  // INVARIANT (enforced here): every INSERT writes BOTH dat_entry_id AND
  // dat_id together in the same transaction. The dat_id column is
  // denormalised from dat_entries to avoid joining through dat_entries on
  // every completion aggregation query. Never write one without the other.
  // ------------------------------------------------------------------
  const BATCH_SIZE = 500;

  sqlite.transaction(() => {
    // Clear existing match_results for this dat — makes the pass idempotent.
    sqlite.prepare("DELETE FROM match_results WHERE dat_id = ?").run(datId);

    if (hits.length === 0) return;

    // Bulk-insert hits in batches to stay under SQLite variable limit.
    // We use raw sqlite here because Drizzle's insert().values() with
    // dynamic batches requires explicit type casting that gets verbose.
    // The schema constraint (dat_entry_id, dat_id) is enforced by the
    // UNIQUE index added in the migration below.
    const stmt = sqlite.prepare(`
      INSERT INTO match_results
        (dat_entry_id, dat_id, game_id, match_type, matched_by, matched_at)
      VALUES
        (?, ?, ?, ?, ?, datetime('now'))
    `);

    for (let i = 0; i < hits.length; i += BATCH_SIZE) {
      const batch = hits.slice(i, i + BATCH_SIZE);
      for (const h of batch) {
        stmt.run(h.dat_entry_id, h.dat_id, h.game_id ?? null, h.match_type, h.matched_by);
      }
    }
  })();

  // ------------------------------------------------------------------
  // Compute summary counts from the hits array (avoid a second DB round-trip)
  // ------------------------------------------------------------------

  const total = entries.length;
  const have = hits.filter((h) => h.match_type === "have").length;
  const haveBaddump = hits.filter((h) => h.match_type === "have_baddump").length;
  const missing = total - have - haveBaddump - nodumpCount;

  return {
    dat_id: datId,
    total,
    have,
    have_baddump: haveBaddump,
    nodump: nodumpCount,
    missing,
    hits_by_sha1: hitsBySha1,
    hits_by_crc32_size: hitsByCrc32Size,
    hits_by_stripped_sha1: hitsByStrippedSha1,
  };
}
