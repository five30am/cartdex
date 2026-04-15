#!/usr/bin/env tsx
/**
 * scripts/rehash-headered.ts
 *
 * Standalone opt-in CLI script that backfills stripped hashes for existing
 * games on headered-ROM systems.
 *
 * This script does NOT run automatically on startup or during normal ingest.
 * It is designed to be run manually after the DAT auditing feature lands,
 * when you want to enable stripped-hash matching for an existing library.
 *
 * Usage (run from project root):
 *   npx tsx scripts/rehash-headered.ts
 *   npx tsx scripts/rehash-headered.ts --system nes
 *   npx tsx scripts/rehash-headered.ts --system nes --dry-run
 *   npx tsx scripts/rehash-headered.ts --force   # re-hash even if stripped cols already set
 *
 * Flags:
 *   --system <slug>  Only process games on this system slug. Repeatable.
 *   --dry-run        Print what would be processed without writing to DB.
 *   --force          Re-compute even if hash_sha1_stripped is already populated.
 *   --limit <n>      Stop after processing N games (useful for spot-checks).
 *
 * Output:
 *   Logs progress to stdout. Errors are non-fatal and logged inline.
 *   Final summary printed at end.
 *
 * Safety:
 *   - Read-only file access (no writes to ROM files).
 *   - All DB writes are scoped to the single `hash_sha1_stripped` and
 *     `hash_crc32_stripped` columns — no other columns are touched.
 *   - If a file is missing on disk, the row is skipped (not modified).
 *   - If header detection fails or is ambiguous, stripped cols are left null.
 */

import fs from "fs";
import path from "path";
import { eq, isNull, inArray, and } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { skipperSystemSlugs, computeStrippedHashesIfHeadered } from "@/lib/services/skipper";

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

const systemArgs: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--system" && args[i + 1]) {
    systemArgs.push(args[i + 1]);
    i++;
  }
}

const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : Infinity;

// ---------------------------------------------------------------------------
// Determine target system slugs
// ---------------------------------------------------------------------------

const allSkipperSlugs = skipperSystemSlugs();

const targetSlugs: string[] = systemArgs.length > 0
  ? systemArgs.filter((s) => {
      if (!allSkipperSlugs.includes(s)) {
        console.warn(`  WARNING: "${s}" has no registered skipper — skipping`);
        return false;
      }
      return true;
    })
  : allSkipperSlugs;

if (targetSlugs.length === 0) {
  console.error("No valid target systems. Exiting.");
  process.exit(1);
}

console.log(`\nRehash-Headered Script`);
console.log(`======================`);
console.log(`Mode       : ${dryRun ? "DRY RUN (no DB writes)" : "LIVE"}`);
console.log(`Force      : ${force}`);
console.log(`Systems    : ${targetSlugs.join(", ")}`);
console.log(`Limit      : ${isFinite(limit) ? limit : "none"}`);
console.log();

// ---------------------------------------------------------------------------
// Build slug → system_id map
// ---------------------------------------------------------------------------

const allSystems = db.select({ id: systems.id, slug: systems.slug }).from(systems).all();
const slugToId = new Map<string, number>(allSystems.map((s) => [s.slug, s.id]));

const targetSystemIds = targetSlugs
  .map((slug) => slugToId.get(slug))
  .filter((id): id is number => id !== undefined);

if (targetSystemIds.length === 0) {
  console.log("No matching systems found in DB. Have you seeded the systems table?");
  process.exit(0);
}

const idToSlug = new Map<number, string>(
  allSystems
    .filter((s) => targetSystemIds.includes(s.id))
    .map((s) => [s.id, s.slug])
);

// ---------------------------------------------------------------------------
// Query candidate games
// ---------------------------------------------------------------------------

// Fetch games on target systems.
// Unless --force, only fetch rows where hash_sha1_stripped IS NULL.
const systemFilter = inArray(games.system_id, targetSystemIds);
const whereClause = force
  ? systemFilter
  : and(systemFilter, isNull(games.hash_sha1_stripped));

const candidates = db
  .select({
    id: games.id,
    file_path: games.file_path,
    system_id: games.system_id,
    hash_sha1_stripped: games.hash_sha1_stripped,
  })
  .from(games)
  .where(whereClause)
  .all();

const totalCandidates = candidates.length;
const toProcess = isFinite(limit) ? candidates.slice(0, limit) : candidates;

console.log(`Candidates : ${totalCandidates} game rows`);
console.log(`Processing : ${toProcess.length} (${force ? "all on target systems" : "null stripped-hash only"})`);
console.log();

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

let processed = 0;
let updated = 0;
let noHeader = 0;
let missing = 0;
let errors = 0;

for (let i = 0; i < toProcess.length; i++) {
  const row = toProcess[i];
  const systemSlug = idToSlug.get(row.system_id) ?? "";

  const label = `[${i + 1}/${toProcess.length}] ${path.basename(row.file_path)}`;

  processed++;

  if (!fs.existsSync(row.file_path)) {
    if (toProcess.length <= 50) {
      console.log(`  SKIP (missing on disk) ${label}`);
    }
    missing++;
    continue;
  }

  try {
    const stripped = await computeStrippedHashesIfHeadered(row.file_path, systemSlug);

    if (!stripped) {
      // No header detected — leave stripped cols null (raw hash is canonical)
      if (i % 100 === 0 || toProcess.length <= 20) {
        console.log(`  NO HEADER ${label}`);
      }
      noHeader++;
      continue;
    }

    if (!dryRun) {
      sqlite
        .prepare(`UPDATE games SET hash_sha1_stripped = ?, hash_crc32_stripped = ? WHERE id = ?`)
        .run(stripped.sha1, stripped.crc32, row.id);
    } else {
      console.log(`  DRY-RUN ${label} → sha1=${stripped.sha1.slice(0, 8)}... crc32=${stripped.crc32}`);
    }

    updated++;

    if (updated % 500 === 0 && !dryRun) {
      console.log(`  Progress: ${i + 1}/${toProcess.length} processed (${updated} updated)`);
    }
  } catch (err) {
    console.error(`  ERROR ${label}: ${err instanceof Error ? err.message : String(err)}`);
    errors++;
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log();
console.log("Done.");
console.log(`  Processed : ${processed}`);
console.log(`  Updated   : ${updated}${dryRun ? " (dry run — no writes)" : ""}`);
console.log(`  No header : ${noHeader}`);
console.log(`  Missing   : ${missing}`);
console.log(`  Errors    : ${errors}`);
