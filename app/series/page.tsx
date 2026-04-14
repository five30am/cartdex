import { db } from "@/lib/db";
import { franchises, game_franchises, games, systems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

interface FranchiseWithMeta {
  id: number;
  name: string;
  slug: string;
  cover_art_path: string | null;
  game_count: number;
  systems: { slug: string; name: string }[];
}

function getFranchisesWithMeta(): FranchiseWithMeta[] {
  const allFranchises = db.select().from(franchises).all();

  return allFranchises.map((franchise) => {
    // Get all non-hidden games in this franchise with their system info
    const franchiseGames = db
      .select({
        id: games.id,
        box_art_path: games.box_art_path,
        system_id: games.system_id,
        system_name: systems.name,
        system_slug: systems.slug,
      })
      .from(game_franchises)
      .innerJoin(games, eq(game_franchises.game_id, games.id))
      .innerJoin(systems, eq(games.system_id, systems.id))
      .where(and(eq(game_franchises.franchise_id, franchise.id), eq(games.hidden, false)))
      .all();

    // Unique systems
    const seenSystems = new Map<string, { slug: string; name: string }>();
    for (const g of franchiseGames) {
      if (!seenSystems.has(g.system_slug)) {
        seenSystems.set(g.system_slug, { slug: g.system_slug, name: g.system_name });
      }
    }

    // Cover art: franchise's own, or first game's box art
    const coverArt =
      franchise.cover_art_path ??
      franchiseGames.find((g) => g.box_art_path != null)?.box_art_path ??
      null;

    return {
      ...franchise,
      cover_art_path: coverArt,
      game_count: franchiseGames.length,
      systems: Array.from(seenSystems.values()),
    };
  }).sort((a, b) => b.game_count - a.game_count || a.name.localeCompare(b.name));
}

export default function SeriesPage() {
  const allFranchises = getFranchisesWithMeta();

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-100">Series</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            <span className="text-white font-medium">{allFranchises.length}</span> franchises
          </p>
        </div>

        {allFranchises.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {allFranchises.map((franchise) => (
              <FranchiseCard key={franchise.id} franchise={franchise} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FranchiseCard({ franchise }: { franchise: FranchiseWithMeta }) {
  return (
    <Link href={`/series/${franchise.slug}`} className="group block">
      <div className="relative aspect-[3/4] w-full bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 group-hover:border-neutral-600 transition-colors">
        {franchise.cover_art_path ? (
          <Image
            src={franchise.cover_art_path}
            alt={`${franchise.name} cover`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
            <div className="text-3xl mb-2 opacity-20">🎮</div>
            <p className="text-xs text-neutral-600 font-medium line-clamp-3">
              {franchise.name}
            </p>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-medium text-neutral-200 group-hover:text-white transition-colors truncate">
          {franchise.name}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">
          {franchise.game_count} {franchise.game_count === 1 ? "game" : "games"}
        </p>
        {franchise.systems.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {franchise.systems.slice(0, 3).map((sys) => (
              <span
                key={sys.slug}
                className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded"
              >
                {sys.slug.toUpperCase()}
              </span>
            ))}
            {franchise.systems.length > 3 && (
              <span className="text-xs text-neutral-600">
                +{franchise.systems.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4 opacity-30">🎯</div>
      <h3 className="text-lg font-medium text-neutral-200 mb-2">No series yet</h3>
      <p className="text-sm text-neutral-500 max-w-sm">
        Franchise groupings will appear here once games are tagged with a series.
      </p>
    </div>
  );
}
