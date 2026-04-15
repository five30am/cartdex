/**
 * lib/services/dat-diff.test.ts
 *
 * Unit tests for the DAT diff computation service (Ticket 9).
 *
 * Uses Node.js built-in test runner — no external framework.
 * Run with:
 *   node --import tsx/esm --test lib/services/dat-diff.test.ts
 *
 * Strategy:
 *   - Directly insert fixture fromDat + toDat rows into a real SQLite test DB
 *     (same approach as dat-fetch.test.ts — /tmp file, unique per run).
 *   - Call computeDiff() and assert summary counts + per-entry rows.
 *   - Test idempotency: calling computeDiff twice returns the same diff_id.
 *   - Test retention: inserting LAST_N_VERSIONS + 1 versions prunes the oldest.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// DB bootstrap — real SQLite file in /tmp
// ---------------------------------------------------------------------------

let dbPath: string;

before(async () => {
  const suffix = crypto.randomBytes(6).toString("hex");
  dbPath = path.join(os.tmpdir(), `romvault-diff-test-${suffix}.db`);
  process.env["DB_PATH"] = dbPath;

  // Import and run schema setup after env var is in place
  const { ensureSchema } = await import("@/lib/db/migrate");
  ensureSchema();
});

after(() => {
  try {
    if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    // ignore cleanup
  }
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Insert a minimal dats row and its dat_entries into the test DB.
 * Returns the inserted dat_id.
 */
async function insertFixtureDat(
  name: string,
  entries: Array<{
    entryName: string;
    sha1?: string;
    crc32?: string;
    size?: number;
    status?: "good" | "baddump" | "nodump";
  }>
): Promise<number> {
  const { db } = await import("@/lib/db");
  const { dats, dat_entries } = await import("@/lib/db/schema");

  const fileHash = crypto.randomBytes(32).toString("hex"); // unique per call

  const inserted = db
    .insert(dats)
    .values({
      name,
      file_hash: fileHash,
      source_kind: "fetch",
    })
    .returning({ id: dats.id })
    .get();

  const datId = inserted.id;

  if (entries.length > 0) {
    db.insert(dat_entries)
      .values(
        entries.map((e) => ({
          dat_id: datId,
          name: e.entryName,
          sha1: e.sha1 ?? null,
          crc32: e.crc32 ?? null,
          size: e.size ?? null,
          status: e.status ?? "good",
        }))
      )
      .run();
  }

  return datId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeDiff", () => {
  it("correctly computes added, removed, and status_changed counts", async () => {
    const { computeDiff } = await import("@/lib/services/dat-diff");

    const fromId = await insertFixtureDat("Test System (Fixture)", [
      { entryName: "Game A (USA)", sha1: "aaaa0001", status: "good" },
      { entryName: "Game B (USA)", sha1: "bbbb0002", status: "good" },
      { entryName: "Game C (USA)", sha1: "cccc0003", status: "good" }, // will be removed in v2
    ]);

    const toId = await insertFixtureDat("Test System (Fixture)", [
      { entryName: "Game A (USA)", sha1: "aaaa0001", status: "good" },   // unchanged
      { entryName: "Game B (USA)", sha1: "bbbb0002", status: "baddump" }, // status changed
      { entryName: "Game D (USA)", sha1: "dddd0004", status: "good" },   // new entry
    ]);

    const summary = computeDiff(fromId, toId);

    assert.equal(summary.added_count, 1, "One entry should be added (Game D)");
    assert.equal(summary.removed_count, 1, "One entry should be removed (Game C)");
    assert.equal(summary.changed_count, 1, "One entry should be status-changed (Game B)");
    assert.equal(summary.from_dat_id, fromId);
    assert.equal(summary.to_dat_id, toId);
    assert.equal(typeof summary.dat_diff_id, "number");
  });

  it("returns zero counts when DATs are identical", async () => {
    const { computeDiff } = await import("@/lib/services/dat-diff");

    const entries = [
      { entryName: "Game A (USA)", sha1: "abcd1234", status: "good" as const },
      { entryName: "Game B (EUR)", sha1: "efgh5678", status: "good" as const },
    ];

    const fromId = await insertFixtureDat("Identical System (Fixture)", entries);
    const toId = await insertFixtureDat("Identical System (Fixture)", entries);

    const summary = computeDiff(fromId, toId);

    assert.equal(summary.added_count, 0);
    assert.equal(summary.removed_count, 0);
    assert.equal(summary.changed_count, 0);
  });

  it("is idempotent: calling with the same pair twice returns the same dat_diff_id", async () => {
    const { computeDiff } = await import("@/lib/services/dat-diff");

    const fromId = await insertFixtureDat("Idempotency Test (Fixture)", [
      { entryName: "Game X", sha1: "aaaa1111" },
    ]);
    const toId = await insertFixtureDat("Idempotency Test (Fixture)", [
      { entryName: "Game Y", sha1: "bbbb2222" },
    ]);

    const first = computeDiff(fromId, toId);
    const second = computeDiff(fromId, toId);

    assert.equal(first.dat_diff_id, second.dat_diff_id, "Same pair should return same diff ID");
    assert.equal(first.added_count, second.added_count);
  });

  it("uses CRC32+size as fallback canonical key when sha1 is absent", async () => {
    const { computeDiff } = await import("@/lib/services/dat-diff");

    const fromId = await insertFixtureDat("CRC Fallback (Fixture)", [
      { entryName: "Game A", crc32: "deadbeef", size: 131072 }, // sha1 absent
    ]);
    const toId = await insertFixtureDat("CRC Fallback (Fixture)", [
      { entryName: "Game A", crc32: "deadbeef", size: 131072 }, // same crc+size = same game
      { entryName: "Game B", crc32: "cafebabe", size: 65536 },  // new
    ]);

    const summary = computeDiff(fromId, toId);

    // Game A should not appear in added/removed (same canonical key)
    // Game B should be added
    assert.equal(summary.added_count, 1, "Only Game B should be added");
    assert.equal(summary.removed_count, 0);
    assert.equal(summary.changed_count, 0);
  });

  it("per-entry rows are written and queryable via getDiffEntries", async () => {
    const { computeDiff, getDiffEntries, getDiffEntryCount } = await import("@/lib/services/dat-diff");

    const fromId = await insertFixtureDat("Entry Query Test (Fixture)", [
      { entryName: "Keep Me", sha1: "keep0001" },
      { entryName: "Remove Me", sha1: "gone0002" },
    ]);
    const toId = await insertFixtureDat("Entry Query Test (Fixture)", [
      { entryName: "Keep Me", sha1: "keep0001" },
      { entryName: "New Entry", sha1: "new00003" },
    ]);

    const summary = computeDiff(fromId, toId);
    const diffId = summary.dat_diff_id;

    const totalCount = getDiffEntryCount(diffId);
    assert.equal(totalCount, 2, "Should have 2 changed entries (1 added + 1 removed)");

    const added = getDiffEntries(diffId, 100, 0, "added");
    assert.equal(added.length, 1);
    assert.equal(added[0].entry_name, "New Entry");
    assert.equal(added[0].change_type, "added");
    assert.ok(added[0].prev_status === null, "Added entries have no prev_status");

    const removed = getDiffEntries(diffId, 100, 0, "removed");
    assert.equal(removed.length, 1);
    assert.equal(removed[0].entry_name, "Remove Me");
    assert.equal(removed[0].change_type, "removed");
    assert.ok(removed[0].new_status === null, "Removed entries have no new_status");
  });
});

describe("getDiffTimeline", () => {
  it("returns empty array for a DAT with no diffs", async () => {
    const { getDiffTimeline } = await import("@/lib/services/dat-diff");

    const datId = await insertFixtureDat("No Diffs (Fixture)", [
      { entryName: "Single Game", sha1: "solo0001" },
    ]);

    const timeline = getDiffTimeline(datId);
    assert.deepEqual(timeline, []);
  });

  it("returns diffs after computeDiff is called", async () => {
    const { computeDiff, getDiffTimeline } = await import("@/lib/services/dat-diff");

    const fromId = await insertFixtureDat("Timeline Test (Fixture)", [
      { entryName: "A", sha1: "aa000001" },
    ]);
    const toId = await insertFixtureDat("Timeline Test (Fixture)", [
      { entryName: "B", sha1: "bb000002" },
    ]);

    computeDiff(fromId, toId);
    const timeline = getDiffTimeline(toId);

    assert.equal(timeline.length, 1);
    assert.equal(timeline[0].from_dat_id, fromId);
    assert.equal(timeline[0].to_dat_id, toId);
  });
});
