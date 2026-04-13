import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { franchises, game_franchises, games, systems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const franchise = db
      .select()
      .from(franchises)
      .where(eq(franchises.slug, slug))
      .get();

    if (!franchise) {
      return NextResponse.json({ error: "Franchise not found" }, { status: 404 });
    }

    // Get all games in this franchise, joined with their system
    const franchiseGames = db
      .select({
        id: games.id,
        title: games.title,
        slug: games.slug,
        description: games.description,
        year: games.year,
        genre: games.genre,
        box_art_path: games.box_art_path,
        verified: games.verified,
        system_id: games.system_id,
        system_name: systems.name,
        system_slug: systems.slug,
      })
      .from(game_franchises)
      .innerJoin(games, eq(game_franchises.game_id, games.id))
      .innerJoin(systems, eq(games.system_id, systems.id))
      .where(eq(game_franchises.franchise_id, franchise.id))
      .all();

    // Sort by year then title
    franchiseGames.sort((a, b) => {
      if (a.year && b.year) return a.year.localeCompare(b.year);
      if (a.year) return -1;
      if (b.year) return 1;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({
      franchise,
      games: franchiseGames,
    });
  } catch (err) {
    console.error("[franchises/slug] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
