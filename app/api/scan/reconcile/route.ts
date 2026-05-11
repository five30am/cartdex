import { NextRequest, NextResponse } from "next/server";
import { reconcileMissingFiles, getScanStatus } from "@/lib/services/ingest";
import { requireMutationAuth } from "@/lib/auth";

/**
 * POST /api/scan/reconcile
 *
 * Runs a one-shot reconciliation pass against all game rows, marking any whose
 * file is missing on disk as hidden with hidden_reason='missing-on-disk'.
 * Safe to call while a full scan is not running.
 *
 * This endpoint is the manual trigger for the same logic that runs automatically
 * as Phase 3 of a full scan. Use it after bulk external deletions (CLI, SMB, etc.)
 * to clean phantom rows from the duplicates view without waiting for a full rescan.
 */
export async function POST(req: NextRequest) {
  const authFailure = requireMutationAuth(req);
  if (authFailure) return authFailure;

  try {
    const status = getScanStatus();
    if (status.state === "running") {
      return NextResponse.json(
        { error: "A full scan is in progress — reconcile runs automatically as Phase 3. Wait for it to finish." },
        { status: 409 }
      );
    }

    const reconciled = await reconcileMissingFiles();

    return NextResponse.json({
      ok: true,
      reconciled,
      message:
        reconciled === 0
          ? "All tracked files are present on disk — nothing to reconcile."
          : `${reconciled} file${reconciled === 1 ? "" : "s"} marked hidden (missing-on-disk).`,
    });
  } catch (err) {
    console.error("[scan/reconcile] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
