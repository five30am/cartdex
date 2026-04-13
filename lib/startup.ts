/**
 * Called once at server startup (from layout or instrumentation).
 * Ensures the SQLite schema exists and seeds baseline data.
 */
import { ensureSchema } from "@/lib/db/migrate";
import { seed } from "@/lib/db/seed";

let initialized = false;

export function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  try {
    ensureSchema();
    seed();
  } catch (err) {
    console.error("[startup] initialization error:", err);
    // Don't crash — partial init is better than no init
  }
}
