import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AllGamesClient } from "./all-games-client";

export const dynamic = "force-dynamic";

export default function AllGamesPage() {
  const allGames = db
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
    })
    .from(games)
    .innerJoin(systems, eq(games.system_id, systems.id))
    .all();

  // Sort alphabetically server-side as default
  allGames.sort((a, b) => a.title.localeCompare(b.title));

  const allSystems = db.select({ id: systems.id, name: systems.name, slug: systems.slug }).from(systems).all();
  const genres = [...new Set(allGames.map((g) => g.genre).filter(Boolean))] as string[];
  genres.sort();

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-100">All Games</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            <span className="text-white font-medium">{allGames.length.toLocaleString()}</span> games in library
          </p>
        </div>
        <AllGamesClient games={allGames} systems={allSystems} genres={genres} />
      </div>
    </div>
  );
}
