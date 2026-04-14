import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Building2 } from "lucide-react";
import { GameCard } from "@/components/game-card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function PublisherDetailPage({ params }: Props) {
  const { slug } = await params;

  // Find the canonical publisher name that matches this slug
  const allPublishers = db
    .select({ publisher: games.publisher })
    .from(games)
    .where(and(eq(games.hidden, false)))
    .all()
    .map((r) => r.publisher)
    .filter((p): p is string => p !== null);

  const canonicalName = [...new Set(allPublishers)].find((p) => slugify(p) === slug);
  if (!canonicalName) notFound();

  const publisherGames = db
    .select({
      id: games.id,
      title: games.title,
      year: games.year,
      box_art_path: games.box_art_path,
      user_rating: games.user_rating,
      system_name: systems.name,
      system_slug: systems.slug,
    })
    .from(games)
    .innerJoin(systems, eq(games.system_id, systems.id))
    .where(and(eq(games.publisher, canonicalName), eq(games.hidden, false)))
    .all()
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/publishers"
          className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-300 transition-colors mb-6 font-medium uppercase tracking-wider"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Publishers
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-[#111111] border border-white/[0.06] flex items-center justify-center">
            <Building2 className="w-4 h-4 text-neutral-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{canonicalName}</h1>
            <p className="text-sm text-neutral-600 mt-0.5 font-mono">
              <span className="text-neutral-400 font-semibold">{publisherGames.length.toLocaleString()}</span>{" "}
              {publisherGames.length === 1 ? "game" : "games"}
            </p>
          </div>
        </div>

        {publisherGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-neutral-500 text-sm">No games found for this publisher</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {publisherGames.map((game) => (
              <GameCard
                key={game.id}
                id={game.id}
                title={game.title}
                year={game.year}
                box_art_path={game.box_art_path}
                user_rating={game.user_rating}
                system_slug={game.system_slug}
                system_name={game.system_name}
                showSystem
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
