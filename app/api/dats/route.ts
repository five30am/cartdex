/**
 * POST /api/dats — multipart upload, parse, and persist a DAT file
 * GET  /api/dats — list all imported DATs
 *
 * Upload contract:
 *   Content-Type: multipart/form-data
 *   Field name: "file"
 *   Max size: 50 MB
 *
 * Next.js App Router reads the body via request.formData() which uses the
 * built-in web Streams API — no additional multipart library needed.
 * We disable Next's default body size parser via route segment config.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dats, dat_entries } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { ingestDat, sha256Hex } from "@/lib/services/dat-ingest";
import {
  apiError,
  apiErrorWithDetail,
  apiErrorFromUnknown,
  ApiErrorCode,
} from "@/lib/api-error";
import { RateLimiter, getClientIp } from "@/lib/rate-limiter";
import { requireMutationAuth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** 50 MB in bytes — enforced before we touch the buffer. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Rate limit: 10 uploads per 5 minutes per IP.
 * This is a LAN tool, but a mis-configured script could still hammer the parser.
 */
const uploadLimiter = new RateLimiter({ windowMs: 5 * 60_000, maxRequests: 10 });

// ---------------------------------------------------------------------------
// POST — upload + ingest
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  // Rate limit check
  const ip = getClientIp(req);
  if (!uploadLimiter.check(ip)) {
    return apiError(ApiErrorCode.DAT_RATE_LIMITED);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "Could not parse multipart body");
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "Missing 'file' field in multipart body");
  }

  // Size guard — check before buffering so we don't OOM on huge payloads
  if (file.size > MAX_UPLOAD_BYTES) {
    return apiError(ApiErrorCode.DAT_TOO_LARGE);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "Could not read uploaded file");
  }

  const fileHash = sha256Hex(buffer);

  try {
    const result = ingestDat(buffer, fileHash);

    const response: Record<string, unknown> = {
      ok: true,
      dat_id: result.dat_id,
      name: result.name,
      version: result.version,
      entry_count: result.entry_count,
      format: result.format,
    };
    if (result.warnings.length > 0) {
      response.warnings = result.warnings;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const e = err as Error & { code?: string };

    if (e.code === "DAT_DUPLICATE") {
      return apiError(ApiErrorCode.DAT_DUPLICATE);
    }
    if (e.code === "DAT_FORMAT_UNSUPPORTED") {
      return apiErrorWithDetail(ApiErrorCode.DAT_FORMAT_UNSUPPORTED, e.message);
    }

    // Parse errors and MAME detection produce plain Error objects
    if (e.message) {
      return apiErrorWithDetail(ApiErrorCode.DAT_PARSE_ERROR, e.message);
    }

    console.error("[POST /api/dats] unexpected error:", err);
    return apiErrorFromUnknown(err);
  }
}

// ---------------------------------------------------------------------------
// GET — list all DATs
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // Aggregate entry count per DAT in a single query
    const entryCounts = db
      .select({
        dat_id: dat_entries.dat_id,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(dat_entries)
      .groupBy(dat_entries.dat_id)
      .all();

    const countMap = new Map(entryCounts.map((r) => [r.dat_id, r.count]));

    const allDats = db
      .select({
        id: dats.id,
        name: dats.name,
        description: dats.description,
        version: dats.version,
        author: dats.author,
        source_kind: dats.source_kind,
        imported_at: dats.imported_at,
        system_id: dats.system_id,
        skipper_ref: dats.skipper_ref,
      })
      .from(dats)
      .orderBy(dats.imported_at)
      .all();

    const result = allDats.map((d) => ({
      ...d,
      entry_count: countMap.get(d.id) ?? 0,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/dats] error:", err);
    return apiErrorFromUnknown(err);
  }
}
