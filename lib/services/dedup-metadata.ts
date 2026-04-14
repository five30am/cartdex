/**
 * Metadata fetch + cache for dedup scoring.
 *
 * Fetches scraper_region / scraper_languages / scraper_is_primary_release for
 * each game in a duplicate group. Results are stored on the games row and reused
 * for 30 days before re-fetching (during scan or next dupe group load).
 *
 * Credential check at module load: if creds are absent, logs one warning and
 * all lookups return null (filename fallback stays active).
 */

import path from "path";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { lookupByHash, lookupByFilename } from "./screenscraper";
import { getSetting } from "./config";

const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/** True if Screenscraper user creds are configured (DB or env). */
async function hasScraperCreds(): Promise<boolean> {
  const u = await getSetting("screenscraper_username");
  const p = await getSetting("screenscraper_password");
  return !!(u && p);
}

export interface ScraperRegionData {
  scraper_region: string | null;
  scraper_languages: string[];
  scraper_is_primary_release: boolean;
  scraper_source: "screenscraper" | "igdb" | null;
}

/**
 * Return cached scraper region data for a game, fetching and caching if stale.
 * Returns null when creds are absent or the API returns nothing (caller uses
 * filename fallback).
 */
export async function getScraperRegionData(
  gameId: number,
  systemSlug: string,
  title: string
): Promise<ScraperRegionData | null> {
  if (!(await hasScraperCreds())) return null;

  // Check cache
  const row = db
    .select({
      scraper_region: games.scraper_region,
      scraper_languages: games.scraper_languages,
      scraper_is_primary_release: games.scraper_is_primary_release,
      scraper_source: games.scraper_source,
      scraper_fetched_at: games.scraper_fetched_at,
      hash_crc32: games.hash_crc32,
      hash_md5: games.hash_md5,
      hash_sha1: games.hash_sha1,
      file_path: games.file_path,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .get();

  if (!row) return null;

  // Return cached data if fresh
  if (row.scraper_fetched_at) {
    const age = Date.now() - new Date(row.scraper_fetched_at).getTime();
    if (age < TTL_MS && row.scraper_source !== null) {
      return {
        scraper_region: row.scraper_region,
        scraper_languages: row.scraper_languages ?? [],
        scraper_is_primary_release: row.scraper_is_primary_release ?? false,
        scraper_source: row.scraper_source,
      };
    }
  }

  // Fetch from Screenscraper
  let ssResult = null;

  if (row.hash_crc32 || row.hash_md5 || row.hash_sha1) {
    ssResult = await lookupByHash(
      row.hash_crc32 ?? "",
      row.hash_md5 ?? "",
      row.hash_sha1 ?? "",
      systemSlug
    );
  }

  if (!ssResult) {
    const filename = path.basename(row.file_path);
    ssResult = await lookupByFilename(filename, systemSlug);
  }

  if (!ssResult) {
    // Cache the miss so we don't hammer the API on every page load
    db.update(games)
      .set({ scraper_fetched_at: new Date().toISOString() })
      .where(eq(games.id, gameId))
      .run();
    return null;
  }

  const update = {
    scraper_region: ssResult.region,
    scraper_languages: ssResult.languages,
    scraper_is_primary_release: ssResult.is_primary_release,
    scraper_source: "screenscraper" as const,
    scraper_fetched_at: new Date().toISOString(),
  };

  db.update(games).set(update).where(eq(games.id, gameId)).run();

  return {
    scraper_region: ssResult.region,
    scraper_languages: ssResult.languages,
    scraper_is_primary_release: ssResult.is_primary_release,
    scraper_source: "screenscraper",
  };
}

/**
 * Enrich all games in a duplicate group with scraper region data.
 * Runs concurrently (bounded to avoid hammering rate limiter).
 * Safe to call on every dupe page load — cached rows return instantly.
 */
export async function enrichDupeGroup(
  gameIds: Array<{ id: number; title: string; system_slug: string }>
): Promise<Map<number, ScraperRegionData>> {
  const result = new Map<number, ScraperRegionData>();

  // Process sequentially to stay within Screenscraper's 1 req/sec rate limit
  for (const { id, title, system_slug } of gameIds) {
    const data = await getScraperRegionData(id, system_slug, title);
    if (data) result.set(id, data);
  }

  return result;
}
