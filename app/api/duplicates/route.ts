import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildDuplicateGroups } from "@/lib/utils/dedup";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const systemSlugFilter = url.searchParams.get("system") ?? "";
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));

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

    let groups = buildDuplicateGroups(rows);

    // Filter by system
    if (systemSlugFilter) {
      groups = groups.filter((g) => g.system_slug === systemSlugFilter);
    }

    // Filter by title search
    if (q) {
      groups = groups.filter(
        (g) =>
          g.canonical_title.includes(q) ||
          g.keep.title.toLowerCase().includes(q) ||
          g.duplicates.some((d) => d.title.toLowerCase().includes(q))
      );
    }

    const total_groups = groups.length;
    const total_duplicates = groups.reduce((sum, g) => sum + g.duplicates.length, 0);
    const pages = Math.max(1, Math.ceil(total_groups / limit));
    const offset = (page - 1) * limit;
    const paginated = groups.slice(offset, offset + limit);

    return NextResponse.json({
      groups: paginated,
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
