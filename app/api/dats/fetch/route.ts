/**
 * POST /api/dats/fetch — trigger an auto-fetch from a registered DAT provider.
 *
 * Request body (JSON):
 *   {
 *     providerId: string,   // e.g. "libretro-database"
 *     systems?: string[]    // optional list of system slugs; omit = provider default
 *   }
 *
 * Response shapes:
 *   201  { ok: true, results: FetchSummary[] }
 *   400  { error: string, code: "DAT_FETCH_UNKNOWN_PROVIDER" | "INVALID_INPUT" }
 *   409  { ok: true, status: "duplicate", dat_id: number }   (already have this exact DAT)
 *   422  { error: string, code: "DAT_FETCH_PROVIDER_ERROR" }
 *   502  { error: string, code: "DAT_FETCH_NETWORK_ERROR" }
 *
 * When `systems` is an array, each slug is fetched sequentially (not parallel) to
 * avoid hammering the upstream repo and to stay within rate-limit headroom.
 * Results are collected and returned in a single response — partial success is
 * possible (some ingested, some duplicate, some errored).
 *
 * Security:
 *   - Rate limited: 5 fetch requests per 10 minutes per IP.
 *   - Outbound HTTP constraints (host allowlist, 30s timeout, size cap) are
 *     enforced inside the provider implementations via dat-fetch-constants.ts.
 *   - No auto-trigger from module init — this endpoint must be called explicitly.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchDat, DatFetchNetworkError, DatFetchProviderError } from "@/lib/services/dat-fetch";
import { getAllProviders } from "@/lib/services/dat-fetch-providers/index";
import {
  apiError,
  apiErrorWithDetail,
  apiErrorFromUnknown,
  ApiErrorCode,
} from "@/lib/api-error";
import { RateLimiter, getClientIp } from "@/lib/rate-limiter";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Rate limit: 5 fetch operations per 10 minutes per IP.
 * Each fetch is a real outbound HTTP request — we don't want a mis-configured
 * script hammering upstream repos.
 */
const fetchLimiter = new RateLimiter({ windowMs: 10 * 60_000, maxRequests: 5 });

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

interface FetchRequestBody {
  providerId: string;
  systems?: string[];
}

function parseBody(raw: unknown): FetchRequestBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const obj = raw as Record<string, unknown>;

  if (typeof obj.providerId !== "string" || obj.providerId.trim() === "") return null;

  if (obj.systems !== undefined) {
    if (
      !Array.isArray(obj.systems) ||
      !obj.systems.every((s) => typeof s === "string" && s.trim() !== "")
    ) {
      return null;
    }
  }

  return {
    providerId: obj.providerId.trim(),
    systems: Array.isArray(obj.systems)
      ? (obj.systems as string[]).map((s) => s.trim())
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

interface FetchSummary {
  systemSlug: string | null;
  status: "ingested" | "duplicate" | "error";
  dat_id?: number;
  name?: string;
  version?: string;
  entry_count?: number;
  warnings?: string[];
  error?: string;
}

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req);
  if (!fetchLimiter.check(ip)) {
    return apiError(ApiErrorCode.DAT_RATE_LIMITED);
  }

  // Parse body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(ApiErrorCode.INVALID_JSON);
  }

  const body = parseBody(raw);
  if (!body) {
    return apiErrorWithDetail(
      ApiErrorCode.INVALID_INPUT,
      "Request body must be JSON with a non-empty string 'providerId' " +
        "and an optional 'systems' array of non-empty strings"
    );
  }

  // Validate provider exists before starting any fetches
  const registeredProviders = getAllProviders();
  const provider = registeredProviders.find((p) => p.id === body.providerId);
  if (!provider) {
    return apiErrorWithDetail(
      ApiErrorCode.DAT_FETCH_UNKNOWN_PROVIDER,
      `Unknown provider "${body.providerId}". Available providers: ` +
        registeredProviders.map((p) => p.id).join(", ")
    );
  }

  // Build the list of (providerId, systemSlug?) pairs to fetch
  const jobs: Array<{ providerId: string; systemSlug?: string }> =
    body.systems && body.systems.length > 0
      ? body.systems.map((slug) => ({ providerId: body.providerId, systemSlug: slug }))
      : [{ providerId: body.providerId }];

  // Execute sequentially — respect upstream repos, avoid thundering herd
  const results: FetchSummary[] = [];
  let hadNetworkError = false;
  let hadProviderError = false;

  for (const job of jobs) {
    const systemSlug = job.systemSlug ?? null;
    try {
      const result = await fetchDat(job);

      if (result.status === "ingested") {
        results.push({
          systemSlug,
          status: "ingested",
          dat_id: result.dat_id,
          name: result.name,
          version: result.version,
          entry_count: result.entry_count,
          warnings: result.warnings.length > 0 ? result.warnings : undefined,
        });
      } else if (result.status === "duplicate") {
        results.push({ systemSlug, status: "duplicate", dat_id: result.dat_id });
      } else {
        // "not_modified" — provider returned 304 equivalent
        results.push({ systemSlug, status: "duplicate" });
      }
    } catch (err) {
      if (err instanceof DatFetchNetworkError) {
        hadNetworkError = true;
        results.push({
          systemSlug,
          status: "error",
          error: err.message,
        });
      } else if (err instanceof DatFetchProviderError) {
        hadProviderError = true;
        results.push({
          systemSlug,
          status: "error",
          error: err.message,
        });
      } else {
        // Parse error or unknown — log and surface
        console.error(`[POST /api/dats/fetch] unexpected error for job ${JSON.stringify(job)}:`, err);
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ systemSlug, status: "error", error: message });
      }
    }
  }

  // If every job failed with a network error and there was only one job, return
  // a proper 502 rather than a 201 with an error result — makes single-job callers
  // easier to handle.
  if (jobs.length === 1 && results.length === 1 && results[0].status === "error") {
    if (hadNetworkError) {
      return apiErrorWithDetail(ApiErrorCode.DAT_FETCH_NETWORK_ERROR, results[0].error ?? "Network error");
    }
    if (hadProviderError) {
      return apiErrorWithDetail(ApiErrorCode.DAT_FETCH_PROVIDER_ERROR, results[0].error ?? "Provider error");
    }
    return apiErrorFromUnknown(new Error(results[0].error ?? "Unknown error"));
  }

  const anyIngested = results.some((r) => r.status === "ingested");
  return NextResponse.json({ ok: true, results }, { status: anyIngested ? 201 : 200 });
}
