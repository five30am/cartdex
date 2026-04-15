import { db } from "@/lib/db";
import { franchises, game_franchises, games, systems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { GameCard } from "@/components/game-card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ show_hidden?: string }>;
}

interface GameWithSystem {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  system_id: number;
  system_name: string;
  system_slug: string;
}

export default async function FranchiseDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { show_hidden } = await searchParams;
  const showHidden = show_hidden === "true";

  const franchise = db.select().from(franchises).where(eq(franchises.slug, slug)).get();
  if (!franchise) notFound();

  const franchiseGames = db
    .select({
      id: games.id,
      title: games.title,
      year: games.year,
      box_art_path: games.box_art_path,
      system_id: games.system_id,
      system_name: systems.name,
      system_slug: systems.slug,
    })
    .from(game_franchises)
    .innerJoin(games, eq(game_franchises.game_id, games.id))
    .innerJoin(systems, eq(games.system_id, systems.id))
    .where(
      showHidden
        ? and(eq(game_franchises.franchise_id, franchise.id), eq(systems.enabled, true))
        : and(eq(game_franchises.franchise_id, franchise.id), eq(games.hidden, false), eq(systems.enabled, true))
    )
    .all();

  const hiddenCount = showHidden
    ? 0
    : db
        .select({ id: games.id })
        .from(game_franchises)
        .innerJoin(games, eq(game_franchises.game_id, games.id))
        .where(and(eq(game_franchises.franchise_id, franchise.id), eq(games.hidden, true)))
        .all().length;

  // Sort games: by year then title
  franchiseGames.sort((a, b) => {
    if (a.year && b.year) return a.year.localeCompare(b.year);
    if (a.year) return -1;
    if (b.year) return 1;
    return a.title.localeCompare(b.title);
  });

  // Group by system (maintaining order of first appearance)
  const systemOrder: string[] = [];
  const bySystem = new Map<string, { system_name: string; system_slug: string; games: GameWithSystem[] }>();

  for (const game of franchiseGames) {
    if (!bySystem.has(game.system_slug)) {
      systemOrder.push(game.system_slug);
      bySystem.set(game.system_slug, {
        system_name: game.system_name,
        system_slug: game.system_slug,
        games: [],
      });
    }
    bySystem.get(game.system_slug)!.games.push(game);
  }

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <Link
          href="/series"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Series
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">{franchise.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {franchiseGames.length} {franchiseGames.length === 1 ? "game" : "games"} across{" "}
            {systemOrder.length} {systemOrder.length === 1 ? "system" : "systems"}
            {!showHidden && hiddenCount > 0 && (
              <> &mdash; <Link href={`/series/${slug}?show_hidden=true`} className="text-muted-foreground hover:text-foreground underline underline-offset-2">{hiddenCount} hidden</Link></>
            )}
            {showHidden && (
              <> &mdash; <Link href={`/series/${slug}`} className="text-muted-foreground hover:text-foreground underline underline-offset-2">hide hidden</Link></>
            )}
          </p>
        </div>

        {franchiseGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4 opacity-30">🎮</div>
            <p className="text-muted-foreground text-sm">No games in this franchise yet</p>
          </div>
        ) : (
          <div className="space-y-12">
            {systemOrder.map((systemSlug) => {
              const section = bySystem.get(systemSlug)!;
              return (
                <div key={systemSlug}>
                  <div className="flex items-center gap-3 mb-4">
                    <Link
                      href={`/systems/${section.system_slug}`}
                      className="text-base font-semibold text-foreground/80 hover:text-foreground transition-colors"
                    >
                      {section.system_name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {section.games.length} {section.games.length === 1 ? "game" : "games"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {section.games.map((game) => (
                      <GameCard
                        key={game.id}
                        id={game.id}
                        title={game.title}
                        year={game.year}
                        box_art_path={game.box_art_path}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
