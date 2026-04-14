/**
 * Backfill publisher + series for games that have been scraped (scraped_at IS NOT NULL)
 * but don't yet have publisher or series data.
 *
 * Re-fetches from ScreenScraper at 1 req/sec. Does NOT auto-run on upgrade — must be
 * triggered explicitly from the /settings UI.
 */

import path from "path";
import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { and, isNotNull, isNull, or, eq } from "drizzle-orm";
import { lookupByHash, lookupByFilename } from "./screenscraper";

export interface BackfillStatus {
  state: "idle" | "running" | "done" | "error";
  progress?: { current: number; total: number };
  updated: number;
  skipped: number;
  errors: number;
  startedAt?: string;
  finishedAt?: string;
}

let backfillJob: BackfillStatus = {
  state: "idle",
  updated: 0,
  skipped: 0,
  errors: 0,
};

export function getBackfillStatus(): BackfillStatus {
  return { ...backfillJob };
}

export function startBackfillInBackground(): void {
  if (backfillJob.state === "running") return;
  backfillJob = {
    state: "running",
    updated: 0,
    skipped: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };
  runBackfill()
    .then((result) => {
      backfillJob = {
        ...result,
        state: "done",
        startedAt: backfillJob.startedAt,
        finishedAt: new Date().toISOString(),
      };
    })
    .catch((err) => {
      backfillJob = {
        ...backfillJob,
        state: "error",
        finishedAt: new Date().toISOString(),
        errors: backfillJob.errors + 1,
      };
      console.error("[backfill-publisher-series] fatal:", err);
    });
}

async function runBackfill(): Promise<Omit<BackfillStatus, "state" | "startedAt" | "finishedAt">> {
  const allSystems = db.select({ id: systems.id, slug: systems.slug }).from(systems).all();
  const systemSlugById = new Map(allSystems.map((s) => [s.id, s.slug]));

  // Target: scraped games missing publisher OR series
  const targets = db
    .select()
    .from(games)
    .where(
      and(
        isNotNull(games.scraped_at),
        eq(games.hidden, false),
        or(isNull(games.publisher), isNull(games.series))
      )
    )
    .all();

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  backfillJob.progress = { current: 0, total: targets.length };

  for (let i = 0; i < targets.length; i++) {
    const game = targets[i];
    backfillJob.progress = { current: i + 1, total: targets.length };

    const systemSlug = systemSlugById.get(game.system_id);
    if (!systemSlug) {
      skipped++;
      continue;
    }

    try {
      let result = null;

      if (game.hash_crc32 || game.hash_md5 || game.hash_sha1) {
        result = await lookupByHash(
          game.hash_crc32 ?? "",
          game.hash_md5 ?? "",
          game.hash_sha1 ?? "",
          systemSlug
        );
      }

      if (!result) {
        const filename = path.basename(game.file_path);
        result = await lookupByFilename(filename, systemSlug);
      }

      if (!result) {
        skipped++;
        continue;
      }

      const patchFields: Partial<typeof games.$inferInsert> = {};
      if (result.publisher && !game.publisher) patchFields.publisher = result.publisher;
      if (result.series && !game.series) patchFields.series = result.series;

      if (Object.keys(patchFields).length === 0) {
        skipped++;
        continue;
      }

      db.update(games).set(patchFields).where(eq(games.id, game.id)).run();
      updated++;
    } catch (err) {
      console.error(`[backfill-publisher-series] error for game ${game.id}:`, err);
      errors++;
    }
  }

  return { updated, skipped, errors };
}
