import { NextRequest, NextResponse } from "next/server";
import { ingestDirectory } from "@/lib/services/ingest";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const romRoot =
      body.path ?? process.env.ROM_ROOT ?? "/data/roms";

    if (!romRoot) {
      return NextResponse.json(
        { error: "rom_root path is required. Pass { path: '/your/roms' } or set ROM_ROOT env var." },
        { status: 400 }
      );
    }

    const result = await ingestDirectory(romRoot);

    return NextResponse.json({
      ok: true,
      rom_root: romRoot,
      ...result,
    });
  } catch (err) {
    console.error("[scan] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
