/**
 * GET /api/dats/[id]/diffs
 *
 * Returns the DAT diff timeline for the logical DAT name that `[id]` belongs to.
 *
 * All diffs for the same logical DAT (same `dats.name`) are returned, ordered
 * newest-first. The timeline is by name — not by dat_id — so the caller gets
 * a full history regardless of which version ID they query.
 *
 * Optional query parameters:
 *   ?diff_id=<id>         Include per-entry detail for this specific diff
 *   ?limit=<n>            Entry page size (default 100, max 500)
 *   ?offset=<n>           Entry page offset (default 0)
 *   ?change_type=<type>   Filter entries by "added" | "removed" | "status_changed"
 *
 * Response shape:
 * {
 *   dat_id: number,
 *   dat_name: string,
 *   timeline: Array<{
 *     id: number,
 *     from_dat_id: number,
 *     to_dat_id: number,
 *     computed_at: string,
 *     added_count: number,
 *     removed_count: number,
 *     changed_count: number,
 *   }>,
 *   // only present when ?diff_id is provided
 *   entries?: {
 *     diff_id: number,
 *     total: number,
 *     limit: number,
 *     offset: number,
 *     change_type: string | null,
 *     items: Array<{...}>
 *   }
 * }
 *
 * Designed for Kit's timeline UI follow-up (#351) — returns everything the
 * component needs in one request.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getDiffTimeline,
  getDiffEntries,
  getDiffEntryCount,
} from "@/lib/services/dat-diff";
import {
  apiError,
  apiErrorWithDetail,
  apiErrorFromUnknown,
  ApiErrorCode,
} from "@/lib/api-error";

const MAX_ENTRY_LIMIT = 500;
const DEFAULT_ENTRY_LIMIT = 100;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const datId = parseInt(id, 10);
    if (isNaN(datId) || datId < 1) return apiError(ApiErrorCode.INVALID_ID);

    // Verify DAT exists
    const dat = db.select({ id: dats.id, name: dats.name }).from(dats).where(eq(dats.id, datId)).get();
    if (!dat) return apiError(ApiErrorCode.DAT_NOT_FOUND);

    // --- Parse query params ---
    const searchParams = req.nextUrl.searchParams;

    const rawDiffId = searchParams.get("diff_id");
    const diffId = rawDiffId !== null ? parseInt(rawDiffId, 10) : null;
    if (rawDiffId !== null && (isNaN(diffId!) || diffId! < 1)) {
      return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "diff_id must be a positive integer");
    }

    const rawLimit = searchParams.get("limit");
    const limit = rawLimit !== null
      ? Math.min(Math.max(1, parseInt(rawLimit, 10) || DEFAULT_ENTRY_LIMIT), MAX_ENTRY_LIMIT)
      : DEFAULT_ENTRY_LIMIT;

    const rawOffset = searchParams.get("offset");
    const offset = rawOffset !== null ? Math.max(0, parseInt(rawOffset, 10) || 0) : 0;

    const rawChangeType = searchParams.get("change_type");
    let changeType: "added" | "removed" | "status_changed" | undefined;
    if (rawChangeType !== null) {
      if (!["added", "removed", "status_changed"].includes(rawChangeType)) {
        return apiErrorWithDetail(
          ApiErrorCode.INVALID_INPUT,
          "change_type must be one of: added, removed, status_changed"
        );
      }
      changeType = rawChangeType as "added" | "removed" | "status_changed";
    }

    // --- Build response ---
    const timeline = getDiffTimeline(datId);

    const response: Record<string, unknown> = {
      dat_id: dat.id,
      dat_name: dat.name,
      timeline,
    };

    // Optional: per-entry detail for a specific diff
    if (diffId !== null) {
      // Verify the requested diff_id belongs to the same logical DAT as [id].
      // getDiffTimeline returns all diffs for the DAT name that `datId` maps to,
      // so any diff_id not in that set either doesn't exist or belongs to a
      // different DAT entirely. Accepting an unvalidated diff_id would let any
      // authenticated caller read another DAT's change history by guessing IDs —
      // a no-op risk in single-user mode but a real authz gap under multi-user.
      const diffBelongsToDat = timeline.some((entry) => entry.id === diffId);
      if (!diffBelongsToDat) {
        return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "diff_id does not belong to this DAT");
      }

      const total = getDiffEntryCount(diffId, changeType);
      const items = getDiffEntries(diffId, limit, offset, changeType);

      response.entries = {
        diff_id: diffId,
        total,
        limit,
        offset,
        change_type: changeType ?? null,
        items,
      };
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/dats/[id]/diffs] error:", err);
    return apiErrorFromUnknown(err);
  }
}
