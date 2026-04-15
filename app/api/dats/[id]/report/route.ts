/**
 * GET /api/dats/[id]/report — per-entry match status report for a DAT.
 *
 * Returns a JSON array with one record per dat_entry. Each record includes the
 * entry metadata plus a derived `entry_status` field:
 *
 *   "have"        — entry matched a game in the library (status=good)
 *   "have_baddump"— entry matched but flagged bad dump
 *   "nodump"      — DAT marks this entry as no-dump (unobtainable)
 *   "missing"     — no match found in the library
 *
 * Missing entries are computed via LEFT JOIN (no miss rows stored) to keep the
 * match_results table hit-only. See schema.ts match_results comments for rationale.
 *
 * If no match pass has been run for this DAT yet, all entries will report as
 * "missing" — the caller should run POST /api/dats/[id]/match first.
 */

import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { db } from "@/lib/db";
import { dats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  apiError,
  apiErrorFromUnknown,
  ApiErrorCode,
} from "@/lib/api-error";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const datId = parseInt(id, 10);
    if (isNaN(datId)) return apiError(ApiErrorCode.INVALID_ID);

    const dat = db.select({ id: dats.id, name: dats.name }).from(dats).where(eq(dats.id, datId)).get();
    if (!dat) return apiError(ApiErrorCode.DAT_NOT_FOUND);

    // Single LEFT JOIN query — no N round-trips.
    // entry_status is derived: prefer match_results.match_type when present;
    // fall back to "missing" when mr.match_type IS NULL (no hit row for this entry).
    const rows = sqlite.prepare(`
      SELECT
        de.id            AS entry_id,
        de.name          AS name,
        de.size          AS size,
        de.crc32         AS crc32,
        de.sha1          AS sha1,
        de.status        AS dat_status,
        de.region        AS region,
        de.cloneof       AS cloneof,
        mr.match_type    AS match_type,
        mr.matched_by    AS matched_by,
        mr.game_id       AS game_id,
        CASE
          WHEN mr.match_type IS NOT NULL THEN mr.match_type
          ELSE 'missing'
        END              AS entry_status
      FROM dat_entries de
      LEFT JOIN match_results mr
        ON mr.dat_entry_id = de.id
        AND mr.dat_id = de.dat_id
      WHERE de.dat_id = ?
      ORDER BY de.name ASC
    `).all(datId);

    return NextResponse.json({
      dat_id: datId,
      dat_name: dat.name,
      entry_count: rows.length,
      entries: rows,
    });
  } catch (err) {
    console.error("[GET /api/dats/[id]/report] error:", err);
    return apiErrorFromUnknown(err);
  }
}
