import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/lib/db";
import { games, collections, collection_games, file_operations } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { requireMutationAuth } from "@/lib/auth";

type BulkAction = "add_to_collection" | "hide" | "trash";

interface BulkBody {
  ids: number[];
  action: BulkAction;
  collection_id?: number;
}

export async function POST(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  try {
    const body: BulkBody = await req.json();
    const { ids, action, collection_id } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    const errors: Array<{ id: number; message: string }> = [];
    let processed = 0;
    const now = new Date().toISOString();

    if (action === "add_to_collection") {
      if (!collection_id) {
        return NextResponse.json({ error: "collection_id required for add_to_collection" }, { status: 400 });
      }
      const col = db.select({ id: collections.id }).from(collections).where(eq(collections.id, collection_id)).get();
      if (!col) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
      for (const id of ids) {
        try {
          db.insert(collection_games)
            .values({ collection_id, game_id: id })
            .onConflictDoNothing()
            .run();
          processed++;
        } catch (err) {
          errors.push({ id, message: err instanceof Error ? err.message : String(err) });
        }
      }
    } else if (action === "hide") {
      for (const id of ids) {
        try {
          const game = db.select().from(games).where(eq(games.id, id)).get();
          if (!game) {
            errors.push({ id, message: "Game not found" });
            continue;
          }
          // Write audit row BEFORE the update (design requirement)
          db.insert(file_operations)
            .values({
              game_id: id,
              operation: "hidden",
              actor: "user",
              timestamp: now,
              file_path_before: game.file_path,
              hash_sha1: game.hash_sha1,
              notes: "user_dedup",
            })
            .run();
          db.update(games)
            .set({ hidden: true, hidden_at: now, hidden_reason: "user_dedup" })
            .where(eq(games.id, id))
            .run();
          processed++;
        } catch (err) {
          errors.push({ id, message: err instanceof Error ? err.message : String(err) });
        }
      }
    } else if (action === "trash") {
      let alreadyGone = 0;
      for (const id of ids) {
        try {
          const game = db.select().from(games).where(eq(games.id, id)).get();
          if (!game) {
            errors.push({ id, message: "Game not found" });
            continue;
          }
          // Graceful missing-file handling: auto-hide rather than error
          if (!fs.existsSync(game.file_path)) {
            db.insert(file_operations)
              .values({
                game_id: id,
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
              .where(eq(games.id, id))
              .run();
            alreadyGone++;
            processed++;
            continue;
          }

          const systemSlug = path.basename(path.dirname(path.dirname(game.file_path)));
          const filename = path.basename(game.file_path);
          const trashDir = path.join("/roms/.trash", now.replace(/[:.]/g, "-"), systemSlug);
          const trashPath = path.join(trashDir, filename);

          // Validate destination is under .trash/ to prevent path traversal
          const resolvedTrash = path.resolve(trashPath);
          if (!resolvedTrash.startsWith(path.resolve("/roms/.trash"))) {
            errors.push({ id, message: "Destination path escapes trash directory" });
            continue;
          }

          // Write audit BEFORE filesystem move (design requirement)
          const opResult = db.insert(file_operations)
            .values({
              game_id: id,
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
            if (msg.includes("EROFS") || msg.includes("read-only")) {
              // Clean up the audit row we just wrote since the move failed
              db.delete(file_operations).where(eq(file_operations.id, opResult.lastInsertRowid as number)).run();
              errors.push({ id, message: "ROM directory is not writable — check container mount (needs :rw)" });
              continue;
            }
            db.delete(file_operations).where(eq(file_operations.id, opResult.lastInsertRowid as number)).run();
            errors.push({ id, message: msg });
            continue;
          }

          db.update(games)
            .set({ hidden: true, hidden_at: now, hidden_reason: "trashed", file_path: trashPath })
            .where(eq(games.id, id))
            .run();
          processed++;
        } catch (err) {
          errors.push({ id, message: err instanceof Error ? err.message : String(err) });
        }
      }
      // Surface already_gone count so the UI can display a quiet success message
      if (alreadyGone > 0) {
        return NextResponse.json({ processed, errors, already_gone: alreadyGone });
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ processed, errors });
  } catch (err) {
    console.error("[games/bulk] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
