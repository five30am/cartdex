import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, file_operations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";

/** POST /api/games/[id]/restore — move a trashed file back to its original location */
export async function POST(
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

    // Find most recent 'trashed' operation to get the original path
    const trashOp = db
      .select()
      .from(file_operations)
      .where(
        and(
          eq(file_operations.game_id, gameId),
          eq(file_operations.operation, "trashed")
        )
      )
      .orderBy(desc(file_operations.id))
      .limit(1)
      .get();

    if (!trashOp || !trashOp.file_path_before) {
      return NextResponse.json(
        { error: "No trash record found for this game — cannot determine restore path" },
        { status: 404 }
      );
    }

    const currentPath = game.file_path;
    const restorePath = trashOp.file_path_before;

    if (!fs.existsSync(currentPath)) {
      return NextResponse.json(
        { error: "File not found in trash directory — may have been manually deleted" },
        { status: 404 }
      );
    }

    // Ensure restore destination directory exists
    fs.mkdirSync(path.dirname(restorePath), { recursive: true });

    const now = new Date().toISOString();

    // Write audit row BEFORE filesystem move
    db.insert(file_operations)
      .values({
        game_id: gameId,
        operation: "restored",
        actor: "user",
        timestamp: now,
        file_path_before: currentPath,
        file_path_after: restorePath,
        hash_sha1: game.hash_sha1,
      })
      .run();

    fs.renameSync(currentPath, restorePath);

    const updated = db
      .update(games)
      .set({ hidden: false, hidden_at: null, hidden_reason: null, file_path: restorePath })
      .where(eq(games.id, gameId))
      .returning()
      .get();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[games/id/restore] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
