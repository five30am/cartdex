/**
 * GET /api/systems/[slug]/completion
 *
 * Returns DAT completion data for a system by joining dats → dat_completion view.
 * Only returns data when at least one DAT is linked to this system.
 *
 * Response shape:
 *   { linked: false }                      — no DAT linked
 *   { linked: true, dat_id, dat_name,
 *     total, have, have_baddump, missing,
 *     nodump, completion_pct }             — DAT linked + matched
 */

import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { db } from "@/lib/db";
import { systems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiError, apiErrorFromUnknown, ApiErrorCode } from "@/lib/api-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const system = db
      .select({ id: systems.id })
      .from(systems)
      .where(eq(systems.slug, slug))
      .get();

    if (!system) return apiError(ApiErrorCode.SYSTEM_NOT_FOUND);

    // Query dat_completion for the first DAT linked to this system.
    // If multiple DATs are linked (future multi-DAT support), this returns the
    // first one ordered by dat_id. Ticket 6 (multi-DAT compare) will expand this.
    const row = sqlite
      .prepare(
        `
        SELECT
          dc.dat_id,
          dc.dat_name,
          dc.total,
          dc.have,
          dc.have_baddump,
          dc.missing,
          dc.nodump,
          dc.completion_pct
        FROM dat_completion dc
        INNER JOIN dats d ON d.id = dc.dat_id
        WHERE d.system_id = ?
        ORDER BY d.id ASC
        LIMIT 1
      `
      )
      .get(system.id) as {
      dat_id: number;
      dat_name: string;
      total: number;
      have: number;
      have_baddump: number;
      missing: number;
      nodump: number;
      completion_pct: number | null;
    } | undefined;

    if (!row) {
      return NextResponse.json({ linked: false });
    }

    return NextResponse.json({
      linked: true,
      ...row,
    });
  } catch (err) {
    console.error("[GET /api/systems/[slug]/completion] error:", err);
    return apiErrorFromUnknown(err);
  }
}
