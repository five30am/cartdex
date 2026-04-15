import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games, systems, file_operations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import { apiError, apiErrorFromUnknown, apiErrorWithDetail, ApiErrorCode } from "@/lib/api-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);

    if (isNaN(gameId)) {
      return apiError(ApiErrorCode.INVALID_ID);
    }

    const game = db.select().from(games).where(eq(games.id, gameId)).get();

    if (!game) {
      return apiError(ApiErrorCode.GAME_NOT_FOUND);
    }

    const system = db
      .select()
      .from(systems)
      .where(eq(systems.id, game.system_id))
      .get();

    return NextResponse.json({ ...game, system });
  } catch (err) {
    console.error("[games/id] error:", err);
    return apiErrorFromUnknown(err);
  }
}

/** PATCH /api/games/[id] — hide or unhide a single game. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);
    if (isNaN(gameId)) {
      return apiError(ApiErrorCode.INVALID_ID);
    }

    const body: { hidden: boolean; reason?: string } = await req.json();

    if (typeof body.hidden !== "boolean") {
      return apiError(ApiErrorCode.INVALID_INPUT);
    }
    if (
      body.reason !== undefined &&
      (typeof body.reason !== "string" || body.reason.length > 500)
    ) {
      return apiErrorWithDetail(
        ApiErrorCode.INVALID_INPUT,
        "reason must be a string ≤ 500 chars"
      );
    }

    const game = db.select().from(games).where(eq(games.id, gameId)).get();
    if (!game) {
      return apiError(ApiErrorCode.GAME_NOT_FOUND);
    }

    const now = new Date().toISOString();
    const operation = body.hidden ? "hidden" : "unhidden";

    // Write audit row BEFORE the update
    db.insert(file_operations)
      .values({
        game_id: gameId,
        operation,
        actor: "user",
        timestamp: now,
        file_path_before: game.file_path,
        hash_sha1: game.hash_sha1,
        notes: body.reason ?? (body.hidden ? "user_dedup" : null),
      })
      .run();

    const updated = db
      .update(games)
      .set({
        hidden: body.hidden,
        hidden_at: body.hidden ? now : null,
        hidden_reason: body.hidden ? (body.reason ?? "user_dedup") : null,
      })
      .where(eq(games.id, gameId))
      .returning()
      .get();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[games/id PATCH] error:", err);
    return apiErrorFromUnknown(err);
  }
}

/**
 * DELETE /api/games/[id] — permanently purge a file from disk.
 * Game MUST already be in trash (hidden_reason='trashed').
 * Body must contain { confirm: true } to prevent accidental deletes.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);
    if (isNaN(gameId)) {
      return apiError(ApiErrorCode.INVALID_ID);
    }

    const body: { confirm?: boolean } = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return apiError(ApiErrorCode.CONFIRM_REQUIRED);
    }

    const game = db.select().from(games).where(eq(games.id, gameId)).get();
    if (!game) {
      return apiError(ApiErrorCode.GAME_NOT_FOUND);
    }
    if (game.hidden_reason !== "trashed") {
      return apiError(ApiErrorCode.GAME_NOT_IN_TRASH);
    }

    const purgedPath = game.file_path;

    // Write audit row BEFORE filesystem delete
    db.insert(file_operations)
      .values({
        game_id: gameId,
        operation: "purged",
        actor: "user",
        timestamp: new Date().toISOString(),
        file_path_before: purgedPath,
        hash_sha1: game.hash_sha1,
      })
      .run();

    // Delete file from disk
    if (fs.existsSync(purgedPath)) {
      fs.unlinkSync(purgedPath);
    }

    // Hard delete the DB row
    db.delete(games).where(eq(games.id, gameId)).run();

    return NextResponse.json({ success: true, purged_path: purgedPath });
  } catch (err) {
    console.error("[games/id DELETE] error:", err);
    return apiErrorFromUnknown(err);
  }
}
