import { NextRequest, NextResponse } from "next/server";
import { getScrapeStatus, startScrapeInBackground } from "@/lib/services/metadata";
import { requireMutationAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  const status = getScrapeStatus();
  if (status.state === "running") {
    return NextResponse.json({ ok: true, message: "Scrape already in progress", ...status });
  }

  startScrapeInBackground();
  return NextResponse.json({ ok: true, message: "Scrape started", state: "running" });
}

export async function GET() {
  return NextResponse.json(getScrapeStatus());
}
