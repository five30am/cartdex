import { NextResponse } from "next/server";
import { getBackfillStatus, startBackfillInBackground } from "@/lib/services/backfill-publisher-series";

export async function POST() {
  const status = getBackfillStatus();
  if (status.state === "running") {
    return NextResponse.json({ ok: true, message: "Backfill already in progress", ...status });
  }

  startBackfillInBackground();
  return NextResponse.json({ ok: true, message: "Backfill started", state: "running" });
}

export async function GET() {
  return NextResponse.json(getBackfillStatus());
}
