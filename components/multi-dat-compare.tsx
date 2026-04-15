"use client";

/**
 * MultiDatCompare — side-by-side DAT completion table.
 *
 * Desktop: sticky first column + horizontal scroll. One row per canonical game
 * (SHA1-union across DATs), one column per DAT.
 *
 * Mobile (<md): collapses to a DAT picker dropdown that proxies to the single-DAT
 * SystemCompletionPanel — we never reimplement that logic here.
 *
 * Cell values:
 *   "have"         — green
 *   "have_baddump" — amber
 *   "missing"      — red (entry exists in this DAT but not matched)
 *   null           — "—" (this canonical game isn't in this DAT at all)
 *
 * Data contract: the parent page does the SHA1-union computation server-side
 * and passes typed props — this component is pure presentation.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SystemCompletionPanel, type ReportEntry } from "@/components/system-completion-panel";
import { type CompletionData } from "@/components/completion-pill";
import { CheckCircle2, XCircle, AlertTriangle, Minus, ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CellStatus = "have" | "have_baddump" | "missing" | null;

/** One canonical game row — one entry per DAT (null = not in that DAT). */
export interface CompareRow {
  /** Stable key: sha1 when present, else "dat_id:entry_id" composite. */
  key: string;
  /** Display name — prefer earliest-imported DAT's name. */
  name: string;
  /** Per-DAT status. Index matches the `dats` array order. */
  cells: CellStatus[];
  /**
   * Per-DAT game_id for "have" navigation. Null when not matched or not in DAT.
   * Index matches the `dats` array order.
   */
  gameIds: (number | null)[];
}

export interface DatMeta {
  dat_id: number;
  dat_name: string;
}

export interface MultiDatCompareProps {
  /** Ordered list of DATs — column order. */
  dats: DatMeta[];
  /** Rows, sorted alphabetically by name (server-computed). */
  rows: CompareRow[];
  /**
   * Per-DAT completion data + report entries — used by the mobile fallback
   * to render the existing SystemCompletionPanel for the selected DAT.
   */
  completionByDat: Record<number, CompletionData>;
  entriesByDat: Record<number, ReportEntry[]>;
}

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function StatusCell({
  status,
  gameId,
}: {
  status: CellStatus;
  gameId: number | null;
}) {
  if (status === null) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Minus className="w-3 h-3 text-muted-foreground/30" aria-label="Not in this DAT" />
      </div>
    );
  }

  if (status === "have") {
    const inner = (
      <div className="flex items-center justify-center w-full h-full group">
        <CheckCircle2
          className={cn(
            "w-3.5 h-3.5 text-emerald-500",
            gameId != null && "group-hover:text-emerald-400 transition-colors"
          )}
          aria-label="Have"
        />
      </div>
    );
    if (gameId != null) {
      return (
        <Link href={`/games/${gameId}`} className="block w-full h-full" title="View game">
          {inner}
        </Link>
      );
    }
    return inner;
  }

  if (status === "have_baddump") {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" aria-label="Have (bad dump)" />
      </div>
    );
  }

  // missing
  return (
    <div className="flex items-center justify-center w-full h-full">
      <XCircle className="w-3.5 h-3.5 text-red-400" aria-label="Missing" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        Have
      </span>
      <span className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 text-yellow-500" />
        Have (bad dump)
      </span>
      <span className="flex items-center gap-1">
        <XCircle className="w-3 h-3 text-red-400" />
        Missing
      </span>
      <span className="flex items-center gap-1">
        <Minus className="w-3 h-3 text-muted-foreground/40" />
        Not in DAT
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop compare table
// ---------------------------------------------------------------------------

function CompareTable({ dats, rows }: Pick<MultiDatCompareProps, "dats" | "rows">) {
  // Minimum column widths (px) — first col is wider for game names
  const FIRST_COL_W = 220;
  const DAT_COL_W = 100;

  const totalW = FIRST_COL_W + dats.length * DAT_COL_W;

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-card shadow-none"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <table
        className="text-sm border-collapse"
        style={{ width: Math.max(totalW, 480), tableLayout: "fixed" }}
        aria-label="DAT comparison table"
      >
        {/* Column definitions */}
        <colgroup>
          <col style={{ width: FIRST_COL_W }} />
          {dats.map((d) => (
            <col key={d.dat_id} style={{ width: DAT_COL_W }} />
          ))}
        </colgroup>

        {/* Sticky header row */}
        <thead>
          <tr className="border-b border-border">
            {/* Sticky first header cell */}
            <th
              className="sticky left-0 z-20 bg-card border-r border-border px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              style={{ minWidth: FIRST_COL_W }}
            >
              Game
            </th>
            {dats.map((d) => (
              <th
                key={d.dat_id}
                className="px-2 py-3 text-center text-xs font-semibold text-foreground"
                title={d.dat_name}
              >
                <span className="block truncate max-w-[88px] mx-auto" aria-label={d.dat_name}>
                  {d.dat_name}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-border/50">
          {rows.map((row, idx) => (
            <tr
              key={row.key}
              className={cn(
                "transition-colors hover:bg-muted/30",
                idx % 2 === 0 ? "bg-transparent" : "bg-muted/10"
              )}
            >
              {/* Sticky first column — game name */}
              <td
                className={cn(
                  "sticky left-0 z-10 border-r border-border bg-card px-4 py-2 text-sm font-medium text-foreground truncate"
                )}
                style={{ minWidth: FIRST_COL_W }}
                title={row.name}
              >
                {row.name}
              </td>

              {/* Per-DAT status cells */}
              {row.cells.map((status, colIdx) => (
                <td
                  key={dats[colIdx].dat_id}
                  className="px-2 py-2 text-center h-10"
                >
                  <StatusCell status={status} gameId={row.gameIds[colIdx]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No entries found across linked DATs.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile DAT picker + single-DAT panel
// ---------------------------------------------------------------------------

function MobileFallback({
  dats,
  completionByDat,
  entriesByDat,
}: Pick<MultiDatCompareProps, "dats" | "completionByDat" | "entriesByDat">) {
  const [selectedDatId, setSelectedDatId] = useState<number>(dats[0]?.dat_id ?? 0);

  const completion = completionByDat[selectedDatId] ?? null;
  const entries = entriesByDat[selectedDatId] ?? [];

  return (
    <div className="space-y-4">
      {/* DAT picker */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
          DAT
        </span>
        <Select
          value={String(selectedDatId)}
          onValueChange={(v) => setSelectedDatId(Number(v))}
        >
          <SelectTrigger className="h-8 text-sm flex-1">
            <SelectValue placeholder="Select a DAT" />
          </SelectTrigger>
          <SelectContent>
            {dats.map((d) => (
              <SelectItem key={d.dat_id} value={String(d.dat_id)}>
                {d.dat_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reuse existing single-DAT panel */}
      {completion ? (
        <SystemCompletionPanel completion={completion} entries={entries} />
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          No completion data for this DAT. Run a match pass first.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function MultiDatCompare({
  dats,
  rows,
  completionByDat,
  entriesByDat,
}: MultiDatCompareProps) {
  // Summary stats for the panel header
  const totalCanonical = rows.length;
  const missingInAll = useMemo(
    () =>
      rows.filter((r) =>
        r.cells.every((c) => c === "missing" || c === null)
      ).length,
    [rows]
  );

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Compare DATs
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dats.length} DATs &mdash; {totalCanonical.toLocaleString()} canonical{" "}
            {totalCanonical === 1 ? "entry" : "entries"} (SHA1 union)
            {missingInAll > 0 && (
              <span className="text-red-500 dark:text-red-400">
                {" "}&mdash; {missingInAll.toLocaleString()} missing across all DATs
              </span>
            )}
          </p>
        </div>
        <Legend />
      </div>

      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block">
        <CompareTable dats={dats} rows={rows} />
      </div>

      {/* Mobile fallback — hidden on md+ */}
      <div className="block md:hidden">
        <MobileFallback
          dats={dats}
          completionByDat={completionByDat}
          entriesByDat={entriesByDat}
        />
      </div>
    </div>
  );
}
