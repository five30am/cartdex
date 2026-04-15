import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiError, apiErrorFromUnknown, apiErrorWithDetail, ApiErrorCode } from "@/lib/api-error";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "slug must be lowercase alphanumeric with hyphens");
    }

    const body = await req.json() as { enabled: boolean };

    if (typeof body.enabled !== "boolean") {
      return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "enabled must be a boolean");
    }

    const system = db.select().from(systems).where(eq(systems.slug, slug)).get();
    if (!system) {
      return apiError(ApiErrorCode.SYSTEM_NOT_FOUND);
    }

    db.update(systems).set({ enabled: body.enabled }).where(eq(systems.slug, slug)).run();

    return NextResponse.json({ ok: true, slug, enabled: body.enabled });
  } catch (err) {
    console.error("[systems/slug PATCH] error:", err);
    return apiErrorFromUnknown(err);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "slug must be lowercase alphanumeric with hyphens");
    }

    const system = db
      .select()
      .from(systems)
      .where(eq(systems.slug, slug))
      .get();

    if (!system) {
      return apiError(ApiErrorCode.SYSTEM_NOT_FOUND);
    }

    const showHidden = _req.nextUrl.searchParams.get("show_hidden") === "true";

    const systemGames = db
      .select()
      .from(games)
      .where(
        showHidden
          ? eq(games.system_id, system.id)
          : and(eq(games.system_id, system.id), eq(games.hidden, false))
      )
      .all();

    return NextResponse.json({
      system,
      games: systemGames,
    });
  } catch (err) {
    console.error("[systems/slug] error:", err);
    return apiErrorFromUnknown(err);
  }
}
