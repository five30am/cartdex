import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { AllGamesClient } from "./all-games-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ show_hidden?: string }>;
}

export default async function AllGamesPage({ searchParams }: Props) {
  const { show_hidden } = await searchParams;
  const showHidden = show_hidden === "true";

  const visibleGames = db
    .select({
      id: games.id,
      title: games.title,
      year: games.year,
      genre: games.genre,
      box_art_path: games.box_art_path,
      verified: games.verified,
      created_at: games.created_at,
      system_id: games.system_id,
      system_name: systems.name,
      system_slug: systems.slug,
      user_rating: games.user_rating,
      publisher: games.publisher,
    })
    .from(games)
    .innerJoin(systems, eq(games.system_id, systems.id))
    .where(
      showHidden
        ? eq(systems.enabled, true)
        : and(eq(games.hidden, false), eq(systems.enabled, true))
    )
    .all();

  // Sort alphabetically server-side as default
  visibleGames.sort((a, b) => a.title.localeCompare(b.title));

  const hiddenCount = showHidden
    ? 0
    : db.select({ id: games.id }).from(games).where(eq(games.hidden, true)).all().length;

  // Only show enabled systems in filter dropdown
  const allSystems = db.select({ id: systems.id, name: systems.name, slug: systems.slug }).from(systems).where(eq(systems.enabled, true)).all();
  const genres = [...new Set(visibleGames.map((g) => g.genre).filter(Boolean))] as string[];
  genres.sort();

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">All Games</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-foreground font-medium">{visibleGames.length.toLocaleString()}</span> games in library
            {!showHidden && hiddenCount > 0 && (
              <> &mdash; <Link href="/games?show_hidden=true" className="text-muted-foreground hover:text-foreground underline underline-offset-2">{hiddenCount} hidden</Link></>
            )}
            {showHidden && (
              <> &mdash; <Link href="/games" className="text-muted-foreground hover:text-foreground underline underline-offset-2">hide hidden</Link></>
            )}
          </p>
        </div>
        <AllGamesClient games={visibleGames} systems={allSystems} genres={genres} />
      </div>
    </div>
  );
}
