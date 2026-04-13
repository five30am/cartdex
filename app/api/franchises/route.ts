import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { franchises, game_franchises } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  try {
    const allFranchises = db.select().from(franchises).all();

    const result = allFranchises.map((franchise) => {
      const gameCount =
        db
          .select({ count: count() })
          .from(game_franchises)
          .where(eq(game_franchises.franchise_id, franchise.id))
          .get()?.count ?? 0;

      return {
        ...franchise,
        game_count: gameCount,
      };
    });

    // Sort by game count descending, then alphabetically
    result.sort((a, b) => b.game_count - a.game_count || a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[franchises] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
