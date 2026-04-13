import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collection_games } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

interface Props {
  params: Promise<{ id: string; gameId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const { id, gameId } = await params;
    const collectionId = parseInt(id, 10);
    const gId = parseInt(gameId, 10);

    if (isNaN(collectionId) || isNaN(gId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const deleted = db
      .delete(collection_games)
      .where(
        and(
          eq(collection_games.collection_id, collectionId),
          eq(collection_games.game_id, gId)
        )
      )
      .returning()
      .get();

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[collections/id/games/gameId] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
