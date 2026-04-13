import { NextResponse } from "next/server";
import { getScrapeStatus, startScrapeInBackground } from "@/lib/services/metadata";

export async function POST() {
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
