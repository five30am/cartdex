import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const system = db
      .select()
      .from(systems)
      .where(eq(systems.slug, slug))
      .get();

    if (!system) {
      return NextResponse.json({ error: "System not found" }, { status: 404 });
    }

    const systemGames = db
      .select()
      .from(games)
      .where(eq(games.system_id, system.id))
      .all();

    return NextResponse.json({
      system,
      games: systemGames,
    });
  } catch (err) {
    console.error("[systems/slug] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
