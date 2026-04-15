import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, EyeOff } from "lucide-react";
import { SystemBadge } from "@/components/system-badge";
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
      user_rating: games.user_rating,
      favorite: games.favorite,
      publisher: games.publisher,
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
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                <span className="text-foreground/80 font-semibold">{visibleGames.length.toLocaleString()}</span> {visibleGames.length === 1 ? "game" : "games"}
                {!showHidden && hiddenCount > 0 && (
                  <> &mdash; <Link href={`/systems/${slug}?show_hidden=true`} className="text-muted-foreground hover:text-foreground underline underline-offset-2">{hiddenCount} hidden</Link></>
                )}
                {showHidden && (
                  <> &mdash; <Link href={`/systems/${slug}`} className="text-muted-foreground hover:text-foreground underline underline-offset-2">hide hidden</Link></>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Client-side search + sort + grid */}
        <SystemGamesClient games={visibleGames} systemSlug={system.slug} />
      </div>
    </div>
  );
}
