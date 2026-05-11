import { NextRequest, NextResponse } from "next/server";
import { getBackfillStatus, startBackfillInBackground } from "@/lib/services/backfill-publisher-series";
import { requireMutationAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

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
