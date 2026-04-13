import { NextResponse } from "next/server";
import { scrapeAllUnscraped } from "@/lib/services/metadata";

export async function POST() {
  try {
    const result = await scrapeAllUnscraped();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[scrape] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
