import { NextRequest, NextResponse } from "next/server";
import { startScanInBackground, getScanStatus } from "@/lib/services/ingest";
import { getSetting } from "@/lib/services/config";
import { requireMutationAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  try {
    const status = getScanStatus();
    if (status.state === "running") {
      return NextResponse.json({ ok: true, message: "Scan already in progress", ...status });
    }

    const body = await req.json().catch(() => ({}));
    const romRoot =
      body.path ?? (await getSetting("rom_path")) ?? "/roms";

    startScanInBackground(romRoot);

    return NextResponse.json({ ok: true, message: "Scan started", state: "running" });
  } catch (err) {
    console.error("[scan] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(getScanStatus());
}
