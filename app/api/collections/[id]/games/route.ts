import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collection_games } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireMutationAuth } from "@/lib/auth";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Props) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    if (isNaN(collectionId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const col = db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .get();

    if (!col) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await req.json();
    const { gameIds } = body as { gameIds: number[] };

    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return NextResponse.json({ error: "gameIds must be a non-empty array" }, { status: 400 });
    }

    let added = 0;
    let skipped = 0;

    for (const gameId of gameIds) {
      const existing = db
        .select()
        .from(collection_games)
        .where(
          and(
            eq(collection_games.collection_id, collectionId),
            eq(collection_games.game_id, gameId)
          )
        )
        .get();

      if (!existing) {
        db.insert(collection_games)
          .values({ collection_id: collectionId, game_id: gameId })
          .run();
        added++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({ ok: true, added, skipped });
  } catch (err) {
    console.error("[collections/id/games] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
