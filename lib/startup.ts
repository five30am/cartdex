/**
 * Called once at server startup (from layout or instrumentation).
 * Ensures the SQLite schema exists and seeds baseline data.
 */
import { ensureSchema } from "@/lib/db/migrate";
import { seed } from "@/lib/db/seed";
import { reconcileMissingFiles } from "@/lib/services/ingest";

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

  // One-shot startup backfill: reconcile any rows whose files were deleted
  // externally since the last scan (e.g. via CLI or SMB). Runs async so it
  // doesn't block the server from coming up.
  reconcileMissingFiles()
    .then((count) => {
      if (count > 0) {
        console.log(`[startup] Reconciled ${count} missing-on-disk file${count === 1 ? "" : "s"}`);
      }
    })
    .catch((err) => {
      console.error("[startup] reconcile error:", err);
    });
}
