import path from "path";
import { db } from "@/lib/db";
import { games, franchises, game_franchises, systems } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import {
  lookupByHash,
  lookupByFilename,
  downloadBoxArt,
} from "./screenscraper";
import { searchIGDB } from "./igdb";

export interface ScrapeResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ScrapeJobStatus {
  state: "idle" | "running" | "done" | "error";
  progress?: { current: number; total: number };
  result?: ScrapeResult;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

let scrapeJob: ScrapeJobStatus = { state: "idle" };

export function getScrapeStatus(): ScrapeJobStatus {
  return { ...scrapeJob };
}

export function startScrapeInBackground(): void {
  if (scrapeJob.state === "running") return;
  scrapeJob = { state: "running", startedAt: new Date().toISOString() };
  scrapeAllUnscraped()
    .then((result) => {
      scrapeJob = { state: "done", result, startedAt: scrapeJob.startedAt, finishedAt: new Date().toISOString() };
    })
    .catch((err) => {
      scrapeJob = { state: "error", error: err instanceof Error ? err.message : String(err), startedAt: scrapeJob.startedAt, finishedAt: new Date().toISOString() };
    });
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find or create a franchise by name, return its id.
 */
function upsertFranchise(name: string): number {
  const slug = slugify(name);

  const existing = db
    .select({ id: franchises.id })
    .from(franchises)
    .where(eq(franchises.slug, slug))
    .get();

  if (existing) return existing.id;

  const result = db.insert(franchises).values({ name, slug }).returning({ id: franchises.id }).get();
  return result.id;
}

/**
 * Link a game to a franchise (idempotent).
 */
function linkGameFranchise(gameId: number, franchiseId: number): void {
  const existing = db
    .select()
    .from(game_franchises)
    .where(eq(game_franchises.game_id, gameId))
    .get();

  if (!existing) {
    db.insert(game_franchises).values({ game_id: gameId, franchise_id: franchiseId }).run();
  }
}

/**
 * Scrape metadata for a single game.
 */
export async function scrapeGame(
  game: typeof games.$inferSelect,
  systemSlug: string
): Promise<"updated" | "skipped" | "error"> {
  try {
    let ssResult = null;

    // Step 1 — ScreenScraper by hash (if we have at least one hash)
    if (game.hash_crc32 || game.hash_md5 || game.hash_sha1) {
      ssResult = await lookupByHash(
        game.hash_crc32 ?? "",
        game.hash_md5 ?? "",
        game.hash_sha1 ?? "",
        systemSlug
      );
    }

    // Step 2 — ScreenScraper by filename fallback
    if (!ssResult) {
      const filename = path.basename(game.file_path);
      ssResult = await lookupByFilename(filename, systemSlug);
    }

    const updates: Partial<typeof games.$inferInsert> = {
      scraped_at: new Date().toISOString(),
    };

    let effectiveTitle = game.title;

    // Step 3 — Apply ScreenScraper metadata
    if (ssResult) {
      if (ssResult.title) {
        updates.title = ssResult.title;
        effectiveTitle = ssResult.title;
      }
      if (ssResult.description) updates.description = ssResult.description;
      if (ssResult.year) updates.year = ssResult.year;
      if (ssResult.genre) updates.genre = ssResult.genre;

      // Step 4 — Download box art from ScreenScraper
      if (ssResult.box_art_url && !game.box_art_path) {
        const artPath = await downloadBoxArt(ssResult.box_art_url, systemSlug, game.slug);
        if (artPath) updates.box_art_path = artPath;
      }

      // Step 5 — Franchise from famille
      if (ssResult.famille) {
        const franchiseId = upsertFranchise(ssResult.famille);
        linkGameFranchise(game.id, franchiseId);
      }
    }

    // Step 6 — IGDB by title
    const igdbResult = await searchIGDB(effectiveTitle);

    if (igdbResult) {
      // Step 6a — Fill description if still missing
      if (!updates.description && igdbResult.summary) {
        updates.description = igdbResult.summary;
      }

      // Step 6b — Fill genre if still missing
      if (!updates.genre && igdbResult.genre) {
        updates.genre = igdbResult.genre;
      }

      // Step 6c — Download cover from IGDB if still no box art
      if (!updates.box_art_path && !game.box_art_path && igdbResult.cover_url) {
        const artPath = await downloadBoxArt(igdbResult.cover_url, systemSlug, game.slug);
        if (artPath) updates.box_art_path = artPath;
      }

      // Step 6d — Create/link franchises from IGDB
      for (const franchiseName of igdbResult.franchises) {
        const franchiseId = upsertFranchise(franchiseName);
        linkGameFranchise(game.id, franchiseId);
      }
    }

    // Persist all updates
    db.update(games).set(updates).where(eq(games.id, game.id)).run();

    return "updated";
  } catch (err) {
    console.error(`[metadata] error scraping game ${game.id} (${game.title}):`, err);
    return "error";
  }
}

/**
 * Scrape all games that haven't been scraped yet (scraped_at IS NULL).
 */
export async function scrapeAllUnscraped(): Promise<ScrapeResult> {
  const result: ScrapeResult = { processed: 0, updated: 0, skipped: 0, errors: [] };

  // Load system slugs once
  const allSystems = db.select({ id: systems.id, slug: systems.slug }).from(systems).all();
  const systemSlugById = new Map(allSystems.map((s) => [s.id, s.slug]));

  const unscraped = db
    .select()
    .from(games)
    .where(isNull(games.scraped_at))
    .all();

  scrapeJob.progress = { current: 0, total: unscraped.length };

  for (const game of unscraped) {
    result.processed++;
    scrapeJob.progress = { current: result.processed, total: unscraped.length };

    const systemSlug = systemSlugById.get(game.system_id);
    if (!systemSlug) {
      result.skipped++;
      continue;
    }

    const outcome = await scrapeGame(game, systemSlug);
    if (outcome === "updated") result.updated++;
    else if (outcome === "skipped") result.skipped++;
    else {
      result.skipped++;
      result.errors.push(`Game ${game.id} (${game.title}): scrape error`);
    }
  }

  return result;
}
