import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { Heart, Settings } from "lucide-react";
import { GameCard } from "@/components/game-card";

export const dynamic = "force-dynamic";

interface GameWithSystem {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  user_rating?: number | null;
  system_name: string;
  system_slug: string;
}

export default function FavoritesPage() {
  const favoriteGames = db
    .select({
      id: games.id,
      title: games.title,
      year: games.year,
      box_art_path: games.box_art_path,
      user_rating: games.user_rating,
      system_id: games.system_id,
      system_name: systems.name,
      system_slug: systems.slug,
    })
    .from(games)
    .innerJoin(systems, eq(games.system_id, systems.id))
    .where(and(eq(games.favorite, true), eq(games.hidden, false)))
    .all();

  // Group by system
  const systemOrder: string[] = [];
  const bySystem = new Map<string, { system_name: string; system_slug: string; games: GameWithSystem[] }>();

  for (const game of favoriteGames.sort((a, b) => a.title.localeCompare(b.title))) {
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
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Heart className="h-5 w-5 text-pink-400 fill-pink-400" />
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Favorites</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">{favoriteGames.length.toLocaleString()}</span>{" "}
            {favoriteGames.length === 1 ? "game" : "games"} across{" "}
            <span className="text-foreground font-medium">{systemOrder.length}</span>{" "}
            {systemOrder.length === 1 ? "system" : "systems"}
          </p>
        </div>

        {favoriteGames.length === 0 ? (
          <EmptyState />
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
                        user_rating={game.user_rating}
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-5">
        <Heart className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">No favorites yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        Open any game and tap the star to add it to your favorites.
      </p>
    </div>
  );
}
