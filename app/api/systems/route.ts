import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  try {
    const allSystems = db.select().from(systems).all();

    const result = allSystems.map((system) => {
      const gameCount = db
        .select({ count: count() })
        .from(games)
        .where(eq(games.system_id, system.id))
        .get();

      return {
        ...system,
        game_count: gameCount?.count ?? 0,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[systems] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
