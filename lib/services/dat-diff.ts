/**
 * DAT diff computation service — Ticket 9.
 *
 * Computes the set difference between two DAT versions (from → to) and
 * persists summary + per-entry rows in a single transaction.
 *
 * Canonical identity is SHA-1 when present, falling back to CRC-32+size.
 * This matches the match engine's priority order (dat-match.ts) so the
 * diff semantics are consistent with what "have"/"missing" means in the UI.
 *
 * Three change categories:
 *   - added          SHA-1/CRC32+size key present in `to`, absent in `from`
 *   - removed        SHA-1/CRC32+size key present in `from`, absent in `to`
 *   - status_changed Same canonical key in both, but status field differs
 *
 * Idempotency: if a dat_diffs row for (from_dat_id, to_dat_id) already exists,
 * computeDiff() returns its id immediately without re-inserting. This means
 * re-running the cron or re-fetching the same new version twice is safe.
 *
 * Retention (LAST_N_VERSIONS = 3):
 * After persisting a new diff, prune any dats rows for the same dat_name
 * that are older than the 3rd-most-recent. Cascade deletes remove their
 * dat_entries, match_results, and dat_diff_entries automatically.
 * Keeping 3 gives the timeline UI enough history (current / previous / two-back)
 * without unbounded DB growth.
 */

import { db, sqlite } from "@/lib/db";
import { dats, dat_entries, dat_diffs, dat_diff_entries } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of DAT versions to retain per logical name.
 * Versions beyond this threshold (oldest first) are deleted on ingest of a
 * new version. 3 is the recommended default — see module jsdoc above.
 */
export const LAST_N_VERSIONS = 3;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Canonical key for a DAT entry — what we compare between versions. */
type EntryKey = string; // sha1 | `crc32:${crc32}+size:${size}`

interface NormalisedEntry {
  key: EntryKey;
  name: string;
  crc32: string | null;
  sha1: string | null;
  status: "good" | "baddump" | "nodump";
}

// ---------------------------------------------------------------------------
// Diff result shape
// ---------------------------------------------------------------------------

export interface DatDiffSummary {
  dat_diff_id: number;
  dat_name: string;
  from_dat_id: number;
  to_dat_id: number;
  added_count: number;
  removed_count: number;
  changed_count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a canonical identity key for a dat_entries row. */
function entryKey(sha1: string | null, crc32: string | null, size: number | null): EntryKey {
  if (sha1) return `sha1:${sha1.toLowerCase()}`;
  // Fall back to CRC-32 + size — neither alone is a reliable canonical key
  const c = crc32 ? crc32.toLowerCase() : "null";
  const s = size != null ? String(size) : "null";
  return `crc32:${c}+size:${s}`;
}

/** Load all entries for a dat_id, normalised by canonical key. */
function loadEntries(datId: number): Map<EntryKey, NormalisedEntry> {
  const rows = db
    .select({
      name: dat_entries.name,
      size: dat_entries.size,
      crc32: dat_entries.crc32,
      sha1: dat_entries.sha1,
      status: dat_entries.status,
    })
    .from(dat_entries)
    .where(eq(dat_entries.dat_id, datId))
    .all();

  const map = new Map<EntryKey, NormalisedEntry>();
  for (const row of rows) {
    const key = entryKey(row.sha1, row.crc32, row.size);
    // If two entries share the same canonical key (duplicate ROMs in a DAT),
    // keep the first occurrence. Duplicates are a data quality issue in the
    // source DAT — we don't want them to inflate change counts.
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: row.name,
        crc32: row.crc32,
        sha1: row.sha1,
        status: row.status,
      });
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the diff between two DAT versions and persist the results.
 *
 * Idempotent: calling with the same (fromDatId, toDatId) pair twice returns
 * the existing dat_diffs.id without re-computing or re-inserting.
 *
 * After persisting, enforces the LAST_N_VERSIONS retention policy on the
 * logical DAT name. Old versions are hard-deleted; cascade FKs clean up
 * dat_entries, match_results, and dat_diff_entries.
 *
 * @param fromDatId  The older DAT version (must exist in `dats`)
 * @param toDatId    The newer DAT version (must exist in `dats`)
 * @returns          Summary including the new dat_diffs.id
 */
export function computeDiff(fromDatId: number, toDatId: number): DatDiffSummary {
  // --- Idempotency check ---
  const existing = db
    .select({ id: dat_diffs.id })
    .from(dat_diffs)
    .where(
      and(
        eq(dat_diffs.from_dat_id, fromDatId),
        eq(dat_diffs.to_dat_id, toDatId)
      )
    )
    .get();

  if (existing) {
    // Already computed — reload the summary and return it
    const summary = db
      .select()
      .from(dat_diffs)
      .where(eq(dat_diffs.id, existing.id))
      .get()!;
    return {
      dat_diff_id: summary.id,
      dat_name: summary.dat_name,
      from_dat_id: summary.from_dat_id,
      to_dat_id: summary.to_dat_id,
      added_count: summary.added_count,
      removed_count: summary.removed_count,
      changed_count: summary.changed_count,
    };
  }

  // --- Load both DATs ---
  const fromDat = db.select({ name: dats.name }).from(dats).where(eq(dats.id, fromDatId)).get();
  const toDat = db.select({ name: dats.name }).from(dats).where(eq(dats.id, toDatId)).get();

  if (!fromDat) throw new Error(`computeDiff: fromDatId ${fromDatId} not found in dats`);
  if (!toDat) throw new Error(`computeDiff: toDatId ${toDatId} not found in dats`);

  // Use the newer DAT's name as canonical (should be identical to fromDat.name,
  // but if the provider changes the DAT header name on a version bump we take
  // the newer value — it's what the user will see going forward).
  const datName = toDat.name;

  // --- Load entries ---
  const fromEntries = loadEntries(fromDatId);
  const toEntries = loadEntries(toDatId);

  // --- Compute changes ---
  const added: NormalisedEntry[] = [];
  const removed: NormalisedEntry[] = [];
  const changed: Array<{ entry: NormalisedEntry; prevStatus: string }> = [];

  // Pass 1: entries in `to` — added or status-changed
  for (const [key, toEntry] of toEntries) {
    const fromEntry = fromEntries.get(key);
    if (!fromEntry) {
      added.push(toEntry);
    } else if (fromEntry.status !== toEntry.status) {
      changed.push({ entry: toEntry, prevStatus: fromEntry.status });
    }
  }

  // Pass 2: entries in `from` but not in `to` — removed
  for (const [key, fromEntry] of fromEntries) {
    if (!toEntries.has(key)) {
      removed.push(fromEntry);
    }
  }

  // --- Persist in a transaction ---
  const diffId = db.transaction((): number => {
    const inserted = db
      .insert(dat_diffs)
      .values({
        dat_name: datName,
        from_dat_id: fromDatId,
        to_dat_id: toDatId,
        computed_at: new Date().toISOString(),
        added_count: added.length,
        removed_count: removed.length,
        changed_count: changed.length,
      })
      .returning({ id: dat_diffs.id })
      .get();

    const newDiffId = inserted.id;

    // Batch-insert per-entry rows (batches of 500 to respect SQLite variable limits)
    const allDetailRows: Array<{
      dat_diff_id: number;
      change_type: "added" | "removed" | "status_changed";
      entry_name: string;
      crc32: string | null;
      sha1: string | null;
      prev_status: "good" | "baddump" | "nodump" | null;
      new_status: "good" | "baddump" | "nodump" | null;
    }> = [
      ...added.map((e) => ({
        dat_diff_id: newDiffId,
        change_type: "added" as const,
        entry_name: e.name,
        crc32: e.crc32,
        sha1: e.sha1,
        prev_status: null,
        new_status: e.status,
      })),
      ...removed.map((e) => ({
        dat_diff_id: newDiffId,
        change_type: "removed" as const,
        entry_name: e.name,
        crc32: e.crc32,
        sha1: e.sha1,
        prev_status: e.status,
        new_status: null,
      })),
      ...changed.map(({ entry, prevStatus }) => ({
        dat_diff_id: newDiffId,
        change_type: "status_changed" as const,
        entry_name: entry.name,
        crc32: entry.crc32,
        sha1: entry.sha1,
        prev_status: prevStatus as "good" | "baddump" | "nodump",
        new_status: entry.status,
      })),
    ];

    const BATCH_SIZE = 500;
    for (let i = 0; i < allDetailRows.length; i += BATCH_SIZE) {
      const batch = allDetailRows.slice(i, i + BATCH_SIZE);
      if (batch.length > 0) {
        db.insert(dat_diff_entries).values(batch).run();
      }
    }

    return newDiffId;
  });

  // --- Retention: prune old versions beyond LAST_N_VERSIONS ---
  // We only prune by dat_name so manual-upload versions for a different source
  // don't accidentally clobber each other. This is intentionally run OUTSIDE
  // the diff transaction — a retention failure should not roll back the diff.
  pruneOldVersions(datName);

  return {
    dat_diff_id: diffId,
    dat_name: datName,
    from_dat_id: fromDatId,
    to_dat_id: toDatId,
    added_count: added.length,
    removed_count: removed.length,
    changed_count: changed.length,
  };
}

// ---------------------------------------------------------------------------
// Retention enforcement
// ---------------------------------------------------------------------------

/**
 * Delete DAT versions beyond the LAST_N_VERSIONS threshold for a given name.
 *
 * Strategy: query all dats for this name ordered by imported_at DESC, take
 * the IDs beyond the Nth position, and hard-delete them. Cascade FKs handle
 * dat_entries, match_results, dat_diffs (via from_dat_id/to_dat_id), and
 * dat_diff_entries automatically.
 *
 * This function is intentionally synchronous and runs immediately after
 * computeDiff() persists a new diff. It is idempotent.
 */
function pruneOldVersions(datName: string): void {
  const allVersions = db
    .select({ id: dats.id })
    .from(dats)
    .where(eq(dats.name, datName))
    .orderBy(desc(dats.imported_at))
    .all();

  if (allVersions.length <= LAST_N_VERSIONS) return;

  const toDelete = allVersions.slice(LAST_N_VERSIONS).map((r) => r.id);

  // SQLite doesn't support IN with arrays natively via Drizzle without `inArray`,
  // but we can use a raw prepare statement for the variable-length list.
  // This is safe because all values are integer IDs from a previous SELECT.
  for (const id of toDelete) {
    sqlite.prepare(`DELETE FROM dats WHERE id = ?`).run(id);
    console.log(`[dat-diff] Pruned old DAT version id=${id} (name="${datName}", retention=${LAST_N_VERSIONS})`);
  }
}

// ---------------------------------------------------------------------------
// Query helpers (used by the /api/dats/[id]/diffs route)
// ---------------------------------------------------------------------------

/**
 * Returns all diff summaries for the logical DAT name that `datId` belongs to,
 * ordered by computed_at DESC (newest first).
 */
export function getDiffTimeline(
  datId: number
): Array<{
  id: number;
  dat_name: string;
  from_dat_id: number;
  to_dat_id: number;
  computed_at: string;
  added_count: number;
  removed_count: number;
  changed_count: number;
}> {
  const dat = db.select({ name: dats.name }).from(dats).where(eq(dats.id, datId)).get();
  if (!dat) return [];

  return db
    .select()
    .from(dat_diffs)
    .where(eq(dat_diffs.dat_name, dat.name))
    .orderBy(desc(dat_diffs.computed_at))
    .all();
}

/**
 * Returns paginated per-entry change rows for a given dat_diff_id.
 *
 * @param diffId   The dat_diffs.id to fetch entries for
 * @param limit    Max rows to return (default 100)
 * @param offset   Skip this many rows (for pagination)
 * @param changeType  Optional filter: "added" | "removed" | "status_changed"
 */
export function getDiffEntries(
  diffId: number,
  limit = 100,
  offset = 0,
  changeType?: "added" | "removed" | "status_changed"
): Array<{
  id: number;
  change_type: "added" | "removed" | "status_changed";
  entry_name: string;
  crc32: string | null;
  sha1: string | null;
  prev_status: "good" | "baddump" | "nodump" | null;
  new_status: "good" | "baddump" | "nodump" | null;
}> {
  const whereClause = changeType
    ? and(
        eq(dat_diff_entries.dat_diff_id, diffId),
        eq(dat_diff_entries.change_type, changeType)
      )
    : eq(dat_diff_entries.dat_diff_id, diffId);

  return db
    .select()
    .from(dat_diff_entries)
    .where(whereClause)
    .orderBy(dat_diff_entries.change_type, dat_diff_entries.entry_name)
    .limit(limit)
    .offset(offset)
    .all() as Array<{
      id: number;
      change_type: "added" | "removed" | "status_changed";
      entry_name: string;
      crc32: string | null;
      sha1: string | null;
      prev_status: "good" | "baddump" | "nodump" | null;
      new_status: "good" | "baddump" | "nodump" | null;
    }>;
}

/**
 * Total entry count for a diff (optionally filtered by change_type).
 * Used to build pagination metadata for the API response.
 */
export function getDiffEntryCount(
  diffId: number,
  changeType?: "added" | "removed" | "status_changed"
): number {
  const whereClause = changeType
    ? and(
        eq(dat_diff_entries.dat_diff_id, diffId),
        eq(dat_diff_entries.change_type, changeType)
      )
    : eq(dat_diff_entries.dat_diff_id, diffId);

  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(dat_diff_entries)
    .where(whereClause)
    .get();
  return row?.count ?? 0;
}
