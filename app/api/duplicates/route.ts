import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildDuplicateGroups } from "@/lib/utils/dedup";
import { getScraperRegionData } from "@/lib/services/dedup-metadata";
import { getSetting } from "@/lib/services/config";

/**
 * Module-level in-flight set — keyed by game id.
 * Prevents concurrent requests from double-enqueueing the same game
 * for Screenscraper enrichment.
 */
const enrichInFlight = new Set<number>();

/**
 * Fire-and-forget background enrichment for a page of games.
 * Processes sequentially (1 req/sec rate limit compliance).
 * Does NOT block the request path.
 */
function kickEnrichment(
  pageGameIds: Array<{ id: number; title: string; system_slug: string }>
): void {
  const toFetch = pageGameIds.filter((g) => !enrichInFlight.has(g.id));
  if (toFetch.length === 0) return;

  for (const { id } of toFetch) enrichInFlight.add(id);

  // Intentionally not awaited — fire-and-forget
  (async () => {
    for (const { id, title, system_slug } of toFetch) {
      try {
        await getScraperRegionData(id, system_slug, title);
      } catch (err) {
        console.error(`[duplicates] enrichment failed for game ${id}:`, err);
      } finally {
        enrichInFlight.delete(id);
      }
    }
  })();
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const systemSlugFilter = url.searchParams.get("system") ?? "";
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));

    // Preferred region from settings (default USA)
    const preferredRegion = (await getSetting("preferred_region")) ?? "USA";

    // Fetch all non-hidden games with their system info
    const rows = db
      .select({
        id: games.id,
        title: games.title,
        file_path: games.file_path,
        file_size: games.file_size,
        file_created_at: games.file_created_at,
        hash_sha1: games.hash_sha1,
        hashed: games.hashed,
        system_id: games.system_id,
        system_name: systems.name,
        system_slug: systems.slug,
        scraper_fetched_at: games.scraper_fetched_at,
      })
      .from(games)
      .innerJoin(systems, eq(games.system_id, systems.id))
      .where(eq(games.hidden, false))
      .all();

    // First pass: build groups using filename scoring (fast, no I/O)
    let groups = buildDuplicateGroups(rows, undefined, preferredRegion);

    // Apply filters
    if (systemSlugFilter) {
      groups = groups.filter((g) => g.system_slug === systemSlugFilter);
    }
    if (q) {
      groups = groups.filter(
        (g) =>
          g.canonical_title.includes(q) ||
          g.all_files.some((f) => f.title.toLowerCase().includes(q))
      );
    }

    const total_groups = groups.length;
    const total_duplicates = groups.reduce((sum, g) => sum + g.all_files.length - 1, 0);
    const pages = Math.max(1, Math.ceil(total_groups / limit));
    const offset = (page - 1) * limit;
    const pageGroups = groups.slice(offset, offset + limit);

    // Build a map of scraper_fetched_at for all games on this page
    const pageGameIdSet = new Set(pageGroups.flatMap((g) => g.all_files.map((f) => f.id)));
    const scraperFetchedAt = new Map<number, string | null>(
      rows
        .filter((r) => pageGameIdSet.has(r.id))
        .map((r) => [r.id, r.scraper_fetched_at ?? null])
    );

    // Determine enrichment_pending per group:
    // pending = any game in the group has no scraper_fetched_at yet
    const pageGroupsWithPending = pageGroups.map((g) => {
      const enrichment_pending = g.all_files.some(
        (f) => scraperFetchedAt.get(f.id) === null
      );
      return { ...g, enrichment_pending };
    });

    // Kick off background enrichment for games that haven't been fetched yet
    const unfetchedGames = pageGroups
      .flatMap((g) =>
        g.all_files
          .filter((f) => scraperFetchedAt.get(f.id) === null)
          .map((f) => ({ id: f.id, title: f.title, system_slug: g.system_slug }))
      );
    kickEnrichment(unfetchedGames);

    return NextResponse.json({
      groups: pageGroupsWithPending,
      total_groups,
      total_duplicates,
      page,
      pages,
    });
  } catch (err) {
    console.error("[duplicates] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
