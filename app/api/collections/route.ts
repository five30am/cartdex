import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collection_games, games } from "@/lib/db/schema";
import { eq, count, sum, sql } from "drizzle-orm";
import { requireMutationAuth } from "@/lib/auth";

export async function GET() {
  try {
    const allCollections = db.select().from(collections).all();

    const result = allCollections.map((col) => {
      const gameCount = db
        .select({ count: count() })
        .from(collection_games)
        .where(eq(collection_games.collection_id, col.id))
        .get();

      const totalSize = db
        .select({ total: sum(games.file_size) })
        .from(collection_games)
        .innerJoin(games, eq(collection_games.game_id, games.id))
        .where(eq(collection_games.collection_id, col.id))
        .get();

      return {
        ...col,
        game_count: gameCount?.count ?? 0,
        total_size: totalSize?.total ?? 0,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[collections] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  try {
    const body = await req.json();
    const { name, description } = body as { name: string; description?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const result = db
      .insert(collections)
      .values({ name: name.trim(), description: description?.trim() ?? null })
      .returning()
      .get();

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[collections] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
