/**
 * DELETE /api/dats/[id] — remove a DAT and its entries (cascade handled by FK)
 * GET    /api/dats/[id] — fetch DAT detail including entry count
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dats, dat_entries } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
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

    const dat = db.select().from(dats).where(eq(dats.id, datId)).get();
    if (!dat) return apiError(ApiErrorCode.DAT_NOT_FOUND);

    const entryRow = db
      .select({ count: sql<number>`count(*)` })
      .from(dat_entries)
      .where(eq(dat_entries.dat_id, datId))
      .get();

    return NextResponse.json({
      ...dat,
      entry_count: entryRow?.count ?? 0,
    });
  } catch (err) {
    console.error("[GET /api/dats/[id]] error:", err);
    return apiErrorFromUnknown(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const datId = parseInt(id, 10);
    if (isNaN(datId)) return apiError(ApiErrorCode.INVALID_ID);

    const dat = db.select({ id: dats.id }).from(dats).where(eq(dats.id, datId)).get();
    if (!dat) return apiError(ApiErrorCode.DAT_NOT_FOUND);

    // dat_entries and match_results cascade-delete via FK onDelete: "cascade"
    db.delete(dats).where(eq(dats.id, datId)).run();

    return NextResponse.json({ ok: true, deleted_id: datId });
  } catch (err) {
    console.error("[DELETE /api/dats/[id]] error:", err);
    return apiErrorFromUnknown(err);
  }
}
