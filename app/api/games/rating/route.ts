import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireMutationAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  try {
    const { gameId, rating } = await req.json();

    if (typeof gameId !== "number") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    // rating null clears it; otherwise must be 1-5
    if (rating !== null && (typeof rating !== "number" || rating < 1 || rating > 5)) {
      return NextResponse.json({ ok: false, error: "Rating must be 1-5 or null" }, { status: 400 });
    }

    const game = db.select({ id: games.id }).from(games).where(eq(games.id, gameId)).get();
    if (!game) {
      return NextResponse.json({ ok: false, error: "Game not found" }, { status: 404 });
    }

    db.update(games).set({ user_rating: rating }).where(eq(games.id, gameId)).run();

    return NextResponse.json({ ok: true, rating });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
