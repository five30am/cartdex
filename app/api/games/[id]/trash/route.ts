import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, systems, file_operations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

/** POST /api/games/[id]/trash — move a single game file to .trash/ */
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

    const game = db
      .select({ id: games.id, file_path: games.file_path, hash_sha1: games.hash_sha1, system_id: games.system_id })
      .from(games)
      .where(eq(games.id, gameId))
      .get();

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Graceful missing-file handling: if the file was deleted externally, mark it
    // hidden with reason='missing-on-disk' instead of returning an error.
    if (!fs.existsSync(game.file_path)) {
      const now = new Date().toISOString();
      db.insert(file_operations)
        .values({
          game_id: gameId,
          operation: "auto_hidden_missing",
          actor: "user",
          timestamp: now,
          file_path_before: game.file_path,
          hash_sha1: game.hash_sha1,
          notes: "file not found on disk when trash was requested",
        })
        .run();
      db.update(games)
        .set({ hidden: true, hidden_at: now, hidden_reason: "missing-on-disk" })
        .where(eq(games.id, gameId))
        .run();
      return NextResponse.json({
        ok: true,
        moved: 0,
        already_gone: 1,
        note: "File was already removed from disk and has been cleaned from the library.",
      });
    }

    // Look up system slug for the trash path
    const system = db
      .select({ slug: systems.slug })
      .from(systems)
      .where(eq(systems.id, game.system_id))
      .get();
    const systemSlug = system?.slug ?? "unknown";

    const now = new Date().toISOString();
    const filename = path.basename(game.file_path);
    const trashDir = path.join("/roms/.trash", now.replace(/[:.]/g, "-"), systemSlug);
    const trashPath = path.join(trashDir, filename);

    // Validate destination is under /roms/.trash to prevent path traversal
    const resolvedTrash = path.resolve(trashPath);
    if (!resolvedTrash.startsWith(path.resolve("/roms/.trash"))) {
      return NextResponse.json({ error: "Destination path escapes trash directory" }, { status: 400 });
    }

    // Write audit row BEFORE filesystem move
    const opResult = db
      .insert(file_operations)
      .values({
        game_id: gameId,
        operation: "trashed",
        actor: "user",
        timestamp: now,
        file_path_before: game.file_path,
        file_path_after: trashPath,
        hash_sha1: game.hash_sha1,
      })
      .run();

    try {
      fs.mkdirSync(trashDir, { recursive: true });
      fs.renameSync(game.file_path, trashPath);
    } catch (fsErr) {
      const msg = fsErr instanceof Error ? fsErr.message : String(fsErr);
      // Roll back the audit row since the move failed
      db.delete(file_operations)
        .where(eq(file_operations.id, opResult.lastInsertRowid as number))
        .run();

      if (msg.includes("EROFS") || msg.includes("read-only")) {
        return NextResponse.json(
          { error: "ROM directory is not writable — check container mount (needs :rw)" },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Update the game row to reflect new path + hidden status
    db.update(games)
      .set({ hidden: true, hidden_at: now, hidden_reason: "trashed", file_path: trashPath })
      .where(eq(games.id, gameId))
      .run();

    return NextResponse.json({
      id: gameId,
      file_path_after: trashPath,
      operation_id: opResult.lastInsertRowid,
    });
  } catch (err) {
    console.error("[games/id/trash] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
