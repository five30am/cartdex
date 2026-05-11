import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireMutationAuth } from "@/lib/auth";

// Keys that should be masked in GET responses
const SENSITIVE_KEYS = new Set([
  "screenscraper_password",
  "twitch_client_secret",
]);

// All valid setting keys
const VALID_KEYS = new Set([
  "screenscraper_username",
  "screenscraper_password",
  "twitch_client_id",
  "twitch_client_secret",
  "rom_path",
]);

function maskValue(key: string, value: string): string {
  if (!SENSITIVE_KEYS.has(key)) return value;
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

export async function GET() {
  const rows = db.select().from(settings).all();

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = maskValue(row.key, row.value);
  }

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Body must be an object of key/value pairs" },
      { status: 400 }
    );
  }

  const updated: string[] = [];
  const invalid: string[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!VALID_KEYS.has(key)) {
      invalid.push(key);
      continue;
    }
    if (typeof value !== "string") {
      invalid.push(key);
      continue;
    }

    // Upsert — insert or replace on conflict
    db.insert(settings)
      .values({ key, value, updated_at: new Date().toISOString() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updated_at: new Date().toISOString() },
      })
      .run();

    updated.push(key);
  }

  if (invalid.length > 0 && updated.length === 0) {
    return NextResponse.json(
      { error: `Invalid setting keys: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, updated, invalid });
}
