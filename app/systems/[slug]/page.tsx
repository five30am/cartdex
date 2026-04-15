import { db, sqlite } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, EyeOff } from "lucide-react";
import { SystemBadge } from "@/components/system-badge";
import { CompletionPill, type CompletionData } from "@/components/completion-pill";
import { SystemCompletionPanel, type ReportEntry } from "@/components/system-completion-panel";
import {
  MultiDatCompare,
  type CompareRow,
  type DatMeta,
  type CellStatus,
} from "@/components/multi-dat-compare";
import { SystemGamesClient } from "./system-games-client";
import { SystemCompareToggle } from "./system-compare-toggle";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ show_hidden?: string; compare?: string }>;
}

// ---------------------------------------------------------------------------
// DAT completion row — returned from dat_completion view
// ---------------------------------------------------------------------------
interface DatCompletionRow {
  dat_id: number;
  dat_name: string;
  total: number;
  have: number;
  have_baddump: number;
  missing: number;
  nodump: number;
  completion_pct: number | null;
}

// ---------------------------------------------------------------------------
// Entry row from the per-DAT report query
// ---------------------------------------------------------------------------
interface DatEntryRow {
  entry_id: number;
  name: string;
  size: number | null;
  crc32: string | null;
  sha1: string | null;
  dat_status: "good" | "baddump" | "nodump";
  region: string | null;
  cloneof: string | null;
  match_type: "have" | "have_baddump" | "nodump" | null;
  matched_by: string | null;
  game_id: number | null;
  entry_status: "have" | "have_baddump" | "nodump" | "missing";
  dat_id: number;
}

// ---------------------------------------------------------------------------
// SHA1-union compare computation
// ---------------------------------------------------------------------------

/**
 * Given per-DAT entry rows, compute:
 *   - CompareRow[]  — one row per canonical game (SHA1-union), sorted by name
 *   - DatMeta[]     — ordered list of DATs (column headers), sorted by dat_id ascending
 *
 * Canonical identity:
 *   - Entries with sha1  → keyed by that sha1 (same physical ROM across DATs)
 *   - Entries without sha1 → keyed by "dat_{dat_id}:entry_{entry_id}" (DAT-exclusive)
 *
 * For entries that appear across multiple DATs with the same sha1, we use the
 * name from the earliest-imported DAT (lowest dat_id encountered).
 */
function buildCompareRows(
  allEntries: DatEntryRow[],
  orderedDats: DatMeta[]
): CompareRow[] {
  const datIndexMap = new Map<number, number>();
  orderedDats.forEach((d, i) => datIndexMap.set(d.dat_id, i));

  // Map<canonicalKey, RowAccumulator>
  interface RowAccum {
    key: string;
    name: string;
    nameDatId: number; // the dat_id that provided the name (prefer smallest)
    cells: CellStatus[];
    gameIds: (number | null)[];
  }

  const rowMap = new Map<string, RowAccum>();

  for (const entry of allEntries) {
    const colIdx = datIndexMap.get(entry.dat_id);
    if (colIdx === undefined) continue; // safety guard

    // Canonical key
    const canonKey =
      entry.sha1 ? entry.sha1 : `dat_${entry.dat_id}:entry_${entry.entry_id}`;

    let accum = rowMap.get(canonKey);
    if (!accum) {
      accum = {
        key: canonKey,
        name: entry.name,
        nameDatId: entry.dat_id,
        cells: new Array<CellStatus>(orderedDats.length).fill(null),
        gameIds: new Array<number | null>(orderedDats.length).fill(null),
      };
      rowMap.set(canonKey, accum);
    }

    // Use name from earliest-imported DAT
    if (entry.dat_id < accum.nameDatId) {
      accum.name = entry.name;
      accum.nameDatId = entry.dat_id;
    }

    // Map entry_status to CellStatus (null = not in DAT, already initialised above)
    let cell: CellStatus;
    switch (entry.entry_status) {
      case "have":
        cell = "have";
        break;
      case "have_baddump":
        cell = "have_baddump";
        break;
      default:
        // "missing" or "nodump" → show as missing in compare view
        cell = "missing";
    }
    accum.cells[colIdx] = cell;
    accum.gameIds[colIdx] = entry.game_id ?? null;
  }

  // Sort alphabetically by canonical name (locale-aware, stable)
  const rows = Array.from(rowMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return rows.map(({ key, name, cells, gameIds }) => ({
    key,
    name,
    cells,
    gameIds,
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SystemDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { show_hidden, compare } = await searchParams;
  const showHidden = show_hidden === "true";
  const showCompare = compare === "1";

  const system = db.select().from(systems).where(eq(systems.slug, slug)).get();
  if (!system) notFound();

  const whereClause = showHidden
    ? eq(games.system_id, system.id)
    : and(eq(games.system_id, system.id), eq(games.hidden, false));

  const visibleGames = db
    .select({
      id: games.id,
      title: games.title,
      year: games.year,
      genre: games.genre,
      box_art_path: games.box_art_path,
      verified: games.verified,
      hashed: games.hashed,
      file_size: games.file_size,
      hash_crc32: games.hash_crc32,
      hash_md5: games.hash_md5,
      hash_sha1: games.hash_sha1,
      hash_sha1_stripped: games.hash_sha1_stripped,
      user_rating: games.user_rating,
      favorite: games.favorite,
      publisher: games.publisher,
      scraper_region: games.scraper_region,
      created_at: games.created_at,
    })
    .from(games)
    .where(whereClause)
    .all();

  // Count hidden games so the UI can show a toggle hint
  const hiddenCount = showHidden
    ? 0
    : db
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.system_id, system.id), eq(games.hidden, true)))
        .all().length;

  // Sort by title by default (client will re-sort)
  visibleGames.sort((a, b) => a.title.localeCompare(b.title));

  // ---------------------------------------------------------------------------
  // DAT completion data — pre-aggregate from dat_completion view
  // ---------------------------------------------------------------------------
  let completionData: CompletionData | null = null;
  let reportEntries: ReportEntry[] = [];
  let datVerifiedGameIds: Set<number> = new Set();

  // Multi-DAT compare data
  let allLinkedDats: DatCompletionRow[] = [];
  let compareRows: CompareRow[] = [];
  let completionByDat: Record<number, CompletionData> = {};
  let entriesByDat: Record<number, ReportEntry[]> = {};

  try {
    // Fetch ALL DATs linked to this system (ordered by id asc = import order)
    allLinkedDats = sqlite
      .prepare(
        `SELECT dc.dat_id, dc.dat_name, dc.total, dc.have, dc.have_baddump,
                dc.missing, dc.nodump, dc.completion_pct
         FROM dat_completion dc
         INNER JOIN dats d ON d.id = dc.dat_id
         WHERE d.system_id = ?
         ORDER BY d.id ASC`
      )
      .all(system.id) as DatCompletionRow[];

    if (allLinkedDats.length > 0) {
      // Primary DAT (first, for the single-panel mode)
      const primaryDat = allLinkedDats[0];
      const denominator = primaryDat.total - primaryDat.nodump;

      if (denominator > 0 && primaryDat.completion_pct !== null) {
        completionData = { linked: true, ...primaryDat };

        // Fetch per-entry report for the single-panel
        reportEntries = sqlite
          .prepare(
            `SELECT
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
               ON mr.dat_entry_id = de.id AND mr.dat_id = de.dat_id
             WHERE de.dat_id = ?
             ORDER BY de.name ASC`
          )
          .all(primaryDat.dat_id) as ReportEntry[];

        // Build set of game_ids that are DAT-verified (have a 'have' match result)
        datVerifiedGameIds = new Set(
          reportEntries
            .filter((e) => e.entry_status === "have" && e.game_id != null)
            .map((e) => e.game_id as number)
        );
      }

      // Multi-DAT compare — only when 2+ DATs are linked
      if (allLinkedDats.length >= 2) {
        const datIds = allLinkedDats.map((d) => d.dat_id);

        // Fetch all entries across all linked DATs in a single query.
        // Adds dat_id to the projection so we can fan out into per-DAT maps.
        const placeholders = datIds.map(() => "?").join(", ");
        const allEntries = sqlite
          .prepare(
            `SELECT
               de.id            AS entry_id,
               de.dat_id        AS dat_id,
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
               ON mr.dat_entry_id = de.id AND mr.dat_id = de.dat_id
             WHERE de.dat_id IN (${placeholders})
             ORDER BY de.dat_id ASC, de.name ASC`
          )
          .all(...datIds) as DatEntryRow[];

        // Build the SHA1-union compare rows
        const orderedDatMeta: DatMeta[] = allLinkedDats.map((d) => ({
          dat_id: d.dat_id,
          dat_name: d.dat_name,
        }));
        compareRows = buildCompareRows(allEntries, orderedDatMeta);

        // Build per-DAT completion + entries maps for mobile fallback
        for (const dat of allLinkedDats) {
          const denom = dat.total - dat.nodump;
          if (denom > 0 && dat.completion_pct !== null) {
            completionByDat[dat.dat_id] = { linked: true, ...dat };
          }
          entriesByDat[dat.dat_id] = allEntries
            .filter((e) => e.dat_id === dat.dat_id)
            .map((e) => ({
              entry_id: e.entry_id,
              name: e.name,
              size: e.size,
              crc32: e.crc32,
              sha1: e.sha1,
              dat_status: e.dat_status,
              region: e.region,
              cloneof: e.cloneof,
              match_type: e.match_type,
              matched_by: e.matched_by,
              game_id: e.game_id,
              entry_status: e.entry_status,
            }));
        }
      }
    }
  } catch {
    // dat_completion view not yet created (fresh DB) — safe to degrade
    completionData = null;
  }

  const hasMultipleDats = allLinkedDats.length >= 2;

  // Annotate games with dat_verified flag
  const annotatedGames = visibleGames.map((g) => ({
    ...g,
    dat_verified: datVerifiedGameIds.has(g.id),
  }));

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium uppercase tracking-wider"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Systems
        </Link>

        {/* Disabled system banner */}
        {!system.enabled && (
          <div className="mb-6 rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center gap-3">
            <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              This system is disabled — it is hidden from browse views.{" "}
              <Link href="/settings" className="text-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors">
                Re-enable in Settings
              </Link>
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center">
              <SystemBadge slug={system.slug} name={system.slug.toUpperCase()} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{system.name}</h1>
              <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                <p className="text-sm text-muted-foreground font-mono">
                  <span className="text-foreground/80 font-semibold">{visibleGames.length.toLocaleString()}</span> {visibleGames.length === 1 ? "game" : "games"}
                  {!showHidden && hiddenCount > 0 && (
                    <> &mdash; <Link href={`/systems/${slug}?show_hidden=true`} className="text-muted-foreground hover:text-foreground underline underline-offset-2">{hiddenCount} hidden</Link></>
                  )}
                  {showHidden && (
                    <> &mdash; <Link href={`/systems/${slug}`} className="text-muted-foreground hover:text-foreground underline underline-offset-2">hide hidden</Link></>
                  )}
                </p>
                <CompletionPill data={completionData} size="md" />
              </div>
            </div>
          </div>
        </div>

        {/* Set Completion / Compare DATs section */}
        {(completionData || hasMultipleDats) && (
          <div className="mb-8 space-y-4">
            {/* Toggle control — only rendered when multiple DATs are linked */}
            {hasMultipleDats && (
              <SystemCompareToggle
                showCompare={showCompare}
                slug={slug}
                showHidden={showHidden}
                datCount={allLinkedDats.length}
              />
            )}

            {/* Single-DAT panel — hidden when compare mode is active */}
            {!showCompare && completionData && (
              <SystemCompletionPanel
                completion={completionData}
                entries={reportEntries}
              />
            )}

            {/* Multi-DAT compare — only when toggle is active */}
            {showCompare && hasMultipleDats && (
              <MultiDatCompare
                dats={allLinkedDats.map((d) => ({
                  dat_id: d.dat_id,
                  dat_name: d.dat_name,
                }))}
                rows={compareRows}
                completionByDat={completionByDat}
                entriesByDat={entriesByDat}
              />
            )}
          </div>
        )}

        {/* Client-side search + sort + grid */}
        <SystemGamesClient games={annotatedGames} systemSlug={system.slug} />
      </div>
    </div>
  );
}
