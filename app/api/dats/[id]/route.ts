/**
 * DELETE /api/dats/[id] — remove a DAT and its entries (cascade handled by FK)
 * GET    /api/dats/[id] — fetch DAT detail including entry count
 * PATCH  /api/dats/[id] — update system_id (manual DAT→system link)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dats, dat_entries, systems } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  apiError,
  apiErrorWithDetail,
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
// PATCH — update system_id (manual link override)
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const datId = parseInt(id, 10);
    if (isNaN(datId)) return apiError(ApiErrorCode.INVALID_ID);

    const dat = db.select({ id: dats.id }).from(dats).where(eq(dats.id, datId)).get();
    if (!dat) return apiError(ApiErrorCode.DAT_NOT_FOUND);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(ApiErrorCode.INVALID_JSON);
    }

    const { system_id } = body as Record<string, unknown>;

    // null = unlink; a positive integer = link to that system
    if (system_id !== null && system_id !== undefined) {
      const sid = Number(system_id);
      if (!Number.isInteger(sid) || sid < 1) {
        return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "system_id must be a positive integer or null");
      }
      const sys = db.select({ id: systems.id }).from(systems).where(eq(systems.id, sid)).get();
      if (!sys) return apiError(ApiErrorCode.SYSTEM_NOT_FOUND);
    }

    db.update(dats)
      .set({ system_id: system_id === null ? null : Number(system_id) })
      .where(eq(dats.id, datId))
      .run();

    return NextResponse.json({ ok: true, dat_id: datId, system_id: system_id ?? null });
  } catch (err) {
    console.error("[PATCH /api/dats/[id]] error:", err);
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
