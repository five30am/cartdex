import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/lib/db";
import { file_operations, games, systems } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * GET /api/trash
 *
 * Returns active trash entries: trashed operations that have no matching
 * restore or purge operation for the same game_id / file_path_before.
 */
export async function GET(_req: NextRequest) {
  try {
    // Query via raw SQL for the subquery anti-join — Drizzle's filter helpers
    // don't make this easy and the design doc says JS-side filtering is acceptable.
    const rows = sqlite
      .prepare(
        `
        SELECT
          fo.id            AS operation_id,
          fo.game_id,
          fo.file_path_after  AS file_path_current,
          fo.file_path_before AS file_path_original,
          fo.timestamp     AS trashed_at,
          fo.hash_sha1,
          g.title          AS game_title,
          s.slug           AS system_slug
        FROM file_operations fo
        LEFT JOIN games g ON g.id = fo.game_id
        LEFT JOIN systems s ON s.id = g.system_id
        WHERE fo.operation = 'trashed'
          AND NOT EXISTS (
            SELECT 1 FROM file_operations fo2
            WHERE fo2.game_id = fo.game_id
              AND fo2.file_path_before = fo.file_path_after
              AND fo2.operation IN ('restored', 'purged')
              AND fo2.id > fo.id
          )
        ORDER BY fo.timestamp DESC
        `
      )
      .all() as Array<{
        operation_id: number;
        game_id: number | null;
        file_path_current: string;
        file_path_original: string;
        trashed_at: string;
        hash_sha1: string | null;
        game_title: string | null;
        system_slug: string | null;
      }>;

    const now = Date.now();
    const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

    const entries = rows.map((r) => {
      const trashedMs = new Date(r.trashed_at).getTime();
      const ageDays = Math.floor((now - trashedMs) / (24 * 60 * 60 * 1000));
      const days_remaining = Math.max(0, 30 - ageDays);
      return { ...r, days_remaining };
    });

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("[trash] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
