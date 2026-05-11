/**
 * POST /api/dats/[id]/match — start a background match pass for the given DAT.
 * GET  /api/dats/[id]/match — return current match job status.
 *
 * The match pass is fire-and-forget: POST returns 202 Accepted immediately and
 * the client polls GET until state transitions from "running" to "done"|"error".
 *
 * Only one match pass runs at a time (global single-lock in dat-match.ts,
 * mirroring the ingest.ts scanJob pattern). If a pass is already running for
 * any DAT, POST returns 409 Conflict so the caller knows to wait.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { startMatchJob, getMatchStatus } from "@/lib/services/dat-match";
import {
  apiError,
  apiErrorFromUnknown,
  ApiErrorCode,
} from "@/lib/api-error";
import { requireMutationAuth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST — start match pass
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  try {
    const { id } = await params;
    const datId = parseInt(id, 10);
    if (isNaN(datId)) return apiError(ApiErrorCode.INVALID_ID);

    const dat = db.select({ id: dats.id }).from(dats).where(eq(dats.id, datId)).get();
    if (!dat) return apiError(ApiErrorCode.DAT_NOT_FOUND);

    const current = getMatchStatus();
    if (current.state === "running") {
      return NextResponse.json(
        {
          error: "A match pass is already running",
          code: "DAT_MATCH_BUSY",
          running_dat_id: current.dat_id,
        },
        { status: 409 }
      );
    }

    startMatchJob(datId);

    return NextResponse.json(
      { ok: true, dat_id: datId, state: "running" },
      { status: 202 }
    );
  } catch (err) {
    console.error("[POST /api/dats/[id]/match] error:", err);
    return apiErrorFromUnknown(err);
  }
}

// ---------------------------------------------------------------------------
// GET — return current job status
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const datId = parseInt(id, 10);
    if (isNaN(datId)) return apiError(ApiErrorCode.INVALID_ID);

    const dat = db.select({ id: dats.id }).from(dats).where(eq(dats.id, datId)).get();
    if (!dat) return apiError(ApiErrorCode.DAT_NOT_FOUND);

    const status = getMatchStatus();

    // If the job is for a different DAT or idle, clarify that.
    // The client should re-start if needed.
    return NextResponse.json({
      dat_id: datId,
      job: status,
    });
  } catch (err) {
    console.error("[GET /api/dats/[id]/match] error:", err);
    return apiErrorFromUnknown(err);
  }
}
