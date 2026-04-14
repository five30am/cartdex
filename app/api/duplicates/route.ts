import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildDuplicateGroups } from "@/lib/utils/dedup";
import { enrichDupeGroup } from "@/lib/services/dedup-metadata";
import { getSetting } from "@/lib/services/config";

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
      })
      .from(games)
      .innerJoin(systems, eq(games.system_id, systems.id))
      .where(eq(games.hidden, false))
      .all();

    // First pass: build groups using filename scoring (fast, no I/O)
    let groups = buildDuplicateGroups(rows, undefined, preferredRegion);

    // Apply filters early so we only enrich the page we're about to serve
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

    // Second pass: enrich only this page's games with scraper metadata (cached after first hit)
    const pageGameIds = pageGroups.flatMap((g) =>
      g.all_files.map((f) => ({
        id: f.id,
        title: f.title,
        system_slug: g.system_slug,
      }))
    );

    const scraperData = await enrichDupeGroup(pageGameIds);

    // Rebuild only the page groups with metadata-enriched scoring
    // We need the source rows for these games
    const pageGameIdSet = new Set(pageGameIds.map((g) => g.id));
    const pageRows = rows.filter((r) => pageGameIdSet.has(r.id));
    const enrichedGroups = buildDuplicateGroups(pageRows, scraperData, preferredRegion);

    // Re-filter enriched groups (same filters, subset of rows)
    const filteredEnriched = enrichedGroups.filter((g) => {
      if (systemSlugFilter && g.system_slug !== systemSlugFilter) return false;
      if (q && !g.canonical_title.includes(q) && !g.all_files.some((f) => f.title.toLowerCase().includes(q))) return false;
      return true;
    });

    // Sort to match original ordering (alphabetical is stable, but reapply to be sure)
    filteredEnriched.sort((a, b) =>
      a.canonical_title.localeCompare(b.canonical_title) ||
      a.system_name.localeCompare(b.system_name)
    );

    return NextResponse.json({
      groups: filteredEnriched,
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
