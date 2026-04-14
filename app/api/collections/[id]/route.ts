import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collection_games, games, systems } from "@/lib/db/schema";
import { and, eq, sum } from "drizzle-orm";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    if (isNaN(collectionId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const col = db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .get();

    if (!col) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const collectionGames = db
      .select({
        id: games.id,
        title: games.title,
        slug: games.slug,
        year: games.year,
        genre: games.genre,
        box_art_path: games.box_art_path,
        file_path: games.file_path,
        file_size: games.file_size,
        verified: games.verified,
        system_id: games.system_id,
        system_name: systems.name,
        system_slug: systems.slug,
      })
      .from(collection_games)
      .innerJoin(games, eq(collection_games.game_id, games.id))
      .innerJoin(systems, eq(games.system_id, systems.id))
      .where(and(eq(collection_games.collection_id, collectionId), eq(games.hidden, false)))
      .all();

    collectionGames.sort((a, b) =>
      a.system_name.localeCompare(b.system_name) || a.title.localeCompare(b.title)
    );

    const totalSize = collectionGames.reduce((acc, g) => acc + (g.file_size ?? 0), 0);

    // Unique system badges
    const systemsInCollection = [
      ...new Map(
        collectionGames.map((g) => [g.system_slug, { slug: g.system_slug, name: g.system_name }])
      ).values(),
    ];

    return NextResponse.json({
      ...col,
      games: collectionGames,
      total_size: totalSize,
      game_count: collectionGames.length,
      systems: systemsInCollection,
    });
  } catch (err) {
    console.error("[collections/id] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    if (isNaN(collectionId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const { name, description } = body as { name?: string; description?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const updated = db
      .update(collections)
      .set({
        name: name.trim(),
        description: description?.trim() ?? null,
        updated_at: new Date().toISOString(),
      })
      .where(eq(collections.id, collectionId))
      .returning()
      .get();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[collections/id] PUT error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    if (isNaN(collectionId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // Delete associations first
    db.delete(collection_games)
      .where(eq(collection_games.collection_id, collectionId))
      .run();

    const deleted = db
      .delete(collections)
      .where(eq(collections.id, collectionId))
      .returning()
      .get();

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[collections/id] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
