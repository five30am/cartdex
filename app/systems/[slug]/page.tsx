import { db, sqlite } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, EyeOff } from "lucide-react";
import { SystemBadge } from "@/components/system-badge";
import { CompletionPill, type CompletionData } from "@/components/completion-pill";
import { SystemCompletionPanel, type ReportEntry } from "@/components/system-completion-panel";
import { SystemGamesClient } from "./system-games-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ show_hidden?: string }>;
}

export default async function SystemDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { show_hidden } = await searchParams;
  const showHidden = show_hidden === "true";

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

  try {
    // Find the first DAT linked to this system
    const linkedDat = sqlite
      .prepare(
        `SELECT dc.dat_id, dc.dat_name, dc.total, dc.have, dc.have_baddump,
                dc.missing, dc.nodump, dc.completion_pct
         FROM dat_completion dc
         INNER JOIN dats d ON d.id = dc.dat_id
         WHERE d.system_id = ?
         ORDER BY d.id ASC LIMIT 1`
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

    if (linkedDat) {
      const denominator = linkedDat.total - linkedDat.nodump;
      if (denominator > 0 && linkedDat.completion_pct !== null) {
        completionData = { linked: true, ...linkedDat };

        // Fetch per-entry report for the completion panel
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
          .all(linkedDat.dat_id) as ReportEntry[];

        // Build set of game_ids that are DAT-verified (have a 'have' match result)
        datVerifiedGameIds = new Set(
          reportEntries
            .filter((e) => e.entry_status === "have" && e.game_id != null)
            .map((e) => e.game_id as number)
        );
      }
    }
  } catch {
    // dat_completion view not yet created (fresh DB) — safe to degrade
    completionData = null;
  }

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

        {/* Set Completion panel — only when a DAT is linked + matched */}
        {completionData && (
          <div className="mb-8">
            <SystemCompletionPanel
              completion={completionData}
              entries={reportEntries}
            />
          </div>
        )}

        {/* Client-side search + sort + grid */}
        <SystemGamesClient games={annotatedGames} systemSlug={system.slug} />
      </div>
    </div>
  );
}
