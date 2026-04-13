import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Mapping from settings key → env var fallback
const ENV_FALLBACKS: Record<string, string> = {
  screenscraper_username: "SCREENSCRAPER_USERNAME",
  screenscraper_password: "SCREENSCRAPER_PASSWORD",
  twitch_client_id: "TWITCH_CLIENT_ID",
  twitch_client_secret: "TWITCH_CLIENT_SECRET",
  rom_path: "ROM_ROOT",
};

/**
 * Read a setting from the DB, falling back to the corresponding env var.
 * Priority: DB value > env var > null
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    if (row?.value) return row.value;
  } catch {
    // DB not yet initialized — fall through to env
  }

  const envKey = ENV_FALLBACKS[key];
  if (envKey && process.env[envKey]) {
    return process.env[envKey]!;
  }

  return null;
}

/**
 * Read a setting synchronously (for use in sync contexts like better-sqlite3 functions).
 */
export function getSettingSync(key: string): string | null {
  try {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    if (row?.value) return row.value;
  } catch {
    // DB not yet initialized — fall through to env
  }

  const envKey = ENV_FALLBACKS[key];
  if (envKey && process.env[envKey]) {
    return process.env[envKey]!;
  }

  return null;
}

/**
 * Check whether any API credentials or rom_path are configured (DB or env).
 * Used to decide whether to show the first-run banner.
 */
export function hasAnySettingsConfigured(): boolean {
  const keys = [
    "screenscraper_username",
    "twitch_client_id",
    "rom_path",
  ];
  for (const key of keys) {
    try {
      const row = db.select().from(settings).where(eq(settings.key, key)).get();
      if (row?.value) return true;
    } catch {
      // ignore
    }
    const envKey = ENV_FALLBACKS[key];
    if (envKey && process.env[envKey]) return true;
  }
  return false;
}
