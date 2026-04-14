import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { and, eq, like, count, asc, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "60", 10)));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("q") ?? "";
    const systemSlug = url.searchParams.get("system") ?? "";
    const genre = url.searchParams.get("genre") ?? "";
    const sort = url.searchParams.get("sort") ?? "title";

    // Build base query with system join
    let systemId: number | null = null;
    if (systemSlug) {
      const sys = db.select({ id: systems.id }).from(systems).where(eq(systems.slug, systemSlug)).get();
      systemId = sys?.id ?? null;
    }

    const showHidden = url.searchParams.get("show_hidden") === "true";

    const allGames = db
      .select({
        id: games.id,
        title: games.title,
        year: games.year,
        genre: games.genre,
        box_art_path: games.box_art_path,
        verified: games.verified,
        created_at: games.created_at,
        system_id: games.system_id,
        system_name: systems.name,
        system_slug: systems.slug,
      })
      .from(games)
      .innerJoin(systems, eq(games.system_id, systems.id))
      .where(showHidden ? undefined : eq(games.hidden, false))
      .all();

    // Filter in JS (sqlite doesn't support complex joins + filters easily with drizzle)
    let filtered = allGames;

    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter((g) => g.title.toLowerCase().includes(lower));
    }
    if (systemId) {
      filtered = filtered.filter((g) => g.system_id === systemId);
    }
    if (genre) {
      filtered = filtered.filter((g) => g.genre?.toLowerCase() === genre.toLowerCase());
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sort) {
        case "year":
          if (a.year && b.year) return a.year.localeCompare(b.year);
          if (a.year) return -1;
          if (b.year) return 1;
          return a.title.localeCompare(b.title);
        case "year_desc":
          if (a.year && b.year) return b.year.localeCompare(a.year);
          if (b.year) return -1;
          if (a.year) return 1;
          return a.title.localeCompare(b.title);
        case "system":
          return a.system_name.localeCompare(b.system_name) || a.title.localeCompare(b.title);
        case "recent":
          return b.created_at.localeCompare(a.created_at);
        case "title":
        default:
          return a.title.localeCompare(b.title);
      }
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    // Get unique genres for filter options
    const genres = [...new Set(allGames.map((g) => g.genre).filter(Boolean))] as string[];
    genres.sort();

    return NextResponse.json({
      games: paginated,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      genres,
    });
  } catch (err) {
    console.error("[games] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
