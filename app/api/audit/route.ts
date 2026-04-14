import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/lib/db";

/**
 * GET /api/audit
 *
 * Paginated audit log of all file operations.
 * Optional filters: game_id, operation.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10)));
    const offset = (page - 1) * limit;
    const gameIdFilter = url.searchParams.get("game_id");
    const operationFilter = url.searchParams.get("operation") ?? "";

    let whereClauses: string[] = [];
    const bindParams: (string | number)[] = [];

    if (gameIdFilter) {
      const gid = parseInt(gameIdFilter, 10);
      if (!isNaN(gid)) {
        whereClauses.push("fo.game_id = ?");
        bindParams.push(gid);
      }
    }
    if (operationFilter) {
      whereClauses.push("fo.operation = ?");
      bindParams.push(operationFilter);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRow = sqlite
      .prepare(
        `SELECT COUNT(*) AS total FROM file_operations fo ${whereSQL}`
      )
      .get(...bindParams) as { total: number };

    const total = countRow.total;
    const pages = Math.max(1, Math.ceil(total / limit));

    const rows = sqlite
      .prepare(
        `
        SELECT
          fo.id,
          fo.game_id,
          fo.operation,
          fo.actor,
          fo.timestamp,
          fo.file_path_before,
          fo.file_path_after,
          fo.hash_sha1,
          fo.notes,
          g.title AS game_title
        FROM file_operations fo
        LEFT JOIN games g ON g.id = fo.game_id
        ${whereSQL}
        ORDER BY fo.id DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(...bindParams, limit, offset);

    return NextResponse.json({ entries: rows, total, page, pages });
  } catch (err) {
    console.error("[audit] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
