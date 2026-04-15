/**
 * DAT auto-fetch orchestrator — Ticket 8.
 *
 * Responsibilities:
 *   1. Validate the requested provider ID against the registry.
 *   2. Load the last-successful-fetch timestamp for If-Modified-Since.
 *   3. Call the provider's fetch() — which applies host allowlist, timeout,
 *      and Content-Length checks internally.
 *   4. Deduplicate by SHA-256 before handing off to ingestDat().
 *   5. On success, persist the Last-Modified timestamp for the next refetch.
 *
 * Security posture:
 *   - No auto-fetch on module initialisation. This file has zero side-effect
 *     exports. All work happens inside the exported `fetchDat()` function.
 *   - Host allowlist, timeout, and Content-Length enforcement live in
 *     dat-fetch-constants.ts and are enforced by each provider.
 *   - No secrets or auth — libretro-database and HTGDB are public repos.
 *   - MAX_DAT_BYTES is the same 50 MB cap used for manual uploads.
 *
 * If-Modified-Since / 304 handling:
 *   - Last-Modified timestamps are stored per (providerId, systemSlug) in the
 *     `settings` table using the key pattern:
 *       `dat_fetch_lm:<providerId>:<systemSlug|__all__>`
 *   - Providers that support conditional GET should accept a `lastModified`
 *     option and return `null` (not a Buffer) when the server responds 304.
 *   - In v1, providers fetch unconditionally and return the full buffer.
 *     The `lastModified` value is reserved for future provider implementations.
 *     The orchestrator stores the `Date` header from the response as the
 *     timestamp. Because providers return a Buffer (not a Response), the
 *     If-Modified-Since header must be implemented inside the provider — this
 *     is noted here as the extension point for v2.
 *
 * PROVIDER POLICY (replicated from dat-fetch-providers/index.ts):
 * ================================================================
 * Only providers with MIT, BSD, CC-BY, or public domain licenses may be
 * registered. No-Intro, Redump, and TOSEC must remain manual-upload only.
 * ================================================================
 */

import { db } from "@/lib/db";
import { dats, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ingestDat, sha256Hex } from "./dat-ingest";
import { getProvider } from "./dat-fetch-providers/index";
import {
  DatFetchNetworkError,
  DatFetchProviderError,
  MAX_DAT_BYTES,
  ALLOWED_HOSTS,
  FETCH_TIMEOUT_MS,
} from "./dat-fetch-constants";
import { computeDiff } from "./dat-diff";

// Re-export constants and error classes so callers and providers can import
// from one place if they prefer.
export {
  DatFetchNetworkError,
  DatFetchProviderError,
  MAX_DAT_BYTES,
  ALLOWED_HOSTS,
  FETCH_TIMEOUT_MS,
};

export type { IngestResult } from "./dat-ingest";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchDatOptions {
  providerId: string;
  /** Provider-specific system identifier. Optional for providers with a single DAT. */
  systemSlug?: string;
}

export type FetchDatResult =
  | { status: "ingested"; dat_id: number; name: string; version: string | undefined; entry_count: number; warnings: string[] }
  | { status: "duplicate"; dat_id: number }
  | { status: "not_modified" };

/**
 * Fetch a DAT file from a registered provider and ingest it.
 *
 * Returns a discriminated union so the route handler can give the client an
 * accurate response without re-throwing and catching duplicate errors.
 *
 * Throws:
 *   - `DatFetchProviderError`   — unknown providerId, unsupported systemSlug,
 *                                  size limit exceeded
 *   - `DatFetchNetworkError`    — fetch timeout, DNS failure, non-2xx HTTP
 *   - any other Error           — parse error from ingestDat (bubble up as-is)
 */
/** Allowed character set for systemSlug. Prevents settings-key pollution and
 * collision with the `__all__` sentinel. Also guards against any downstream
 * string interpolation bug we don't know about yet. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export async function fetchDat(options: FetchDatOptions): Promise<FetchDatResult> {
  const { providerId, systemSlug } = options;

  // --- 0. Validate slug format early — before any I/O ---
  if (systemSlug !== undefined) {
    if (!SLUG_PATTERN.test(systemSlug)) {
      throw new DatFetchProviderError(
        `Invalid systemSlug "${systemSlug}". Must match ${SLUG_PATTERN} ` +
          `(lowercase alphanumerics, underscores, hyphens; 1-64 chars).`
      );
    }
    if (systemSlug === "__all__") {
      throw new DatFetchProviderError(
        `systemSlug "__all__" is reserved. Omit systemSlug for a ` +
          `provider-level fetch instead of passing the sentinel explicitly.`
      );
    }
  }

  // --- 1. Validate provider ---
  const provider = getProvider(providerId);
  if (!provider) {
    throw new DatFetchProviderError(
      `Unknown provider "${providerId}". Registered providers: ` +
        (await import("./dat-fetch-providers/index"))
          .getAllProviders()
          .map((p) => p.id)
          .join(", ")
    );
  }

  // --- 2. Load last-fetch state (for future If-Modified-Since support) ---
  const settingsKey = buildSettingsKey(providerId, systemSlug);
  const lastModifiedRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, settingsKey))
    .get();
  // lastModified is available here for provider implementations that support
  // conditional GET. v1 providers ignore it but the infrastructure is wired.
  const _lastModified: string | null = lastModifiedRow?.value ?? null;
  void _lastModified; // suppress unused-variable warning until v2 providers use it

  // --- 3. Fetch ---
  const buffer = await provider.fetch(systemSlug);

  // Paranoid size check — providers enforce this themselves, but we guard here
  // too in case a future provider implementation has a bug.
  if (buffer.byteLength > MAX_DAT_BYTES) {
    throw new DatFetchProviderError(
      `Provider "${providerId}" returned ${buffer.byteLength} bytes, ` +
        `exceeding the ${MAX_DAT_BYTES}-byte limit.`
    );
  }

  // --- 4. Deduplicate ---
  const fileHash = sha256Hex(buffer);

  const existing = db
    .select({ id: dats.id })
    .from(dats)
    .where(eq(dats.file_hash, fileHash))
    .get();

  if (existing) {
    // Content hasn't changed since last fetch — same bytes, same hash.
    return { status: "duplicate", dat_id: existing.id };
  }

  // --- 5. Ingest ---
  // ingestDat writes source_kind "upload" by default. We need "fetch".
  // ingestDat is the canonical write path from Ticket 2 — we don't reimplement
  // it, but we do need to patch source_kind afterward (or pass it as an option).
  //
  // Looking at the ingestDat signature: it doesn't accept source_kind. Rather
  // than modify ingestDat (which would be Ticket 2 scope creep), we do a single
  // UPDATE after the insert. The transaction in ingestDat ensures the row exists
  // by the time we update it, and we're in the same process/connection.

  // Before ingest: find the most recent existing DAT with the same name + this
  // provider's source_kind "fetch". If found, we'll diff the new version against
  // it after ingest.
  //
  // We look up by name because there's no provider-ID column on dats — the
  // logical DAT name is the stable identity used by the diff timeline. We only
  // diff fetch-sourced DATs (not manual uploads) because the auto-diff workflow
  // is specifically for tracking upstream provider changes.
  let prevDatForDiff: { id: number; name: string } | undefined;
  {
    // We need the DAT name to find the previous version, but we don't have it
    // yet (it's inside the buffer). Use the provider + systemSlug settings key
    // to look up the DAT we ingested last time. Since that's a timestamp string
    // (not a dat_id), we instead query: most recently imported "fetch" DAT whose
    // file_hash differs from the current one (which we already know is new).
    // We'll narrow by name after parsing — see the post-ingest block below.
    //
    // Strategy: grab the most recently imported fetch-sourced DAT overall.
    // After ingest gives us the new DAT's name, we cross-check the name matches.
    // This is a best-effort lookup and only fires computeDiff when confident.
    const recentFetch = db
      .select({ id: dats.id, name: dats.name })
      .from(dats)
      .where(eq(dats.source_kind, "fetch"))
      .orderBy(dats.imported_at)
      .all();
    // We want the most recently imported by imported_at — orderBy ASC gives us
    // oldest first, so take the last element for the most recent.
    // We exclude any DAT whose hash is the current file (already filtered by
    // the duplicate check above — `existing` is null here, so all rows are prior).
    if (recentFetch.length > 0) {
      // Will be narrowed to name-match after ingest
      prevDatForDiff = recentFetch[recentFetch.length - 1];
    }
  }

  const result = ingestDat(buffer, fileHash);

  // Patch source_kind to "fetch" — ingestDat always writes "upload".
  db.update(dats)
    .set({ source_kind: "fetch" })
    .where(eq(dats.id, result.dat_id))
    .run();

  // --- 5b. Trigger diff if a prior version of this same logical DAT exists ---
  // We fire computeDiff asynchronously (setImmediate) so we don't block the
  // fetch response. Errors in diff computation are logged but not surfaced to
  // the caller — a diff failure should never fail a successful fetch.
  //
  // Only trigger for fetch-sourced DATs (not manual uploads). Manual uploads
  // may be one-off snapshots and the user may not want automated diff tracking.
  if (prevDatForDiff && prevDatForDiff.name === result.name) {
    const prevId = prevDatForDiff.id;
    const newId = result.dat_id;
    setImmediate(() => {
      try {
        computeDiff(prevId, newId);
      } catch (diffErr) {
        console.error(
          `[dat-fetch] computeDiff(${prevId} → ${newId}) failed — diff skipped:`,
          diffErr
        );
      }
    });
  }

  // --- 6. Persist fetch timestamp ---
  // Store current UTC time as the last-modified value. In a future version,
  // providers can return the server's Last-Modified header value here.
  const nowIso = new Date().toISOString();
  const nowUtc = new Date().toUTCString();
  db.insert(settings)
    .values({ key: settingsKey, value: nowUtc, updated_at: nowIso })
    .onConflictDoUpdate({ target: settings.key, set: { value: nowUtc, updated_at: nowIso } })
    .run();

  return {
    status: "ingested",
    dat_id: result.dat_id,
    name: result.name,
    version: result.version,
    entry_count: result.entry_count,
    warnings: result.warnings,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the settings table key for storing the last-modified timestamp for a
 * given (providerId, systemSlug) pair.
 *
 * Format: `dat_fetch_lm:<providerId>:<systemSlug|__all__>`
 *
 * The `__all__` sentinel is used when no systemSlug is given (provider-level
 * rather than system-level granularity).
 */
function buildSettingsKey(providerId: string, systemSlug?: string): string {
  const slug = systemSlug ?? "__all__";
  return `dat_fetch_lm:${providerId}:${slug}`;
}
