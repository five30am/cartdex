import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);

    if (isNaN(gameId)) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const game = db.select().from(games).where(eq(games.id, gameId)).get();

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const system = db
      .select()
      .from(systems)
      .where(eq(systems.id, game.system_id))
      .get();

    return NextResponse.json({ ...game, system });
  } catch (err) {
    console.error("[games/id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
