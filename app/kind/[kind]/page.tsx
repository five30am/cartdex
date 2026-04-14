import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Monitor, Gamepad2 } from "lucide-react";
import { GameCard } from "@/components/game-card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ kind: string }>;
}

export default async function KindPage({ params }: Props) {
  const { kind } = await params;

  if (kind !== "console" && kind !== "handheld") notFound();

  const kindLabel = kind === "console" ? "Consoles" : "Handhelds";
  const KindIcon = kind === "console" ? Monitor : Gamepad2;

  const kindGames = db
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
    .where(
      and(
        eq(games.hidden, false),
        eq(systems.kind, kind as "console" | "handheld")
      )
    )
    .all()
    .sort((a, b) => a.title.localeCompare(b.title));

  // Group by system
  const systemOrder: string[] = [];
  const bySystem = new Map<string, { system_name: string; system_slug: string; games: typeof kindGames }>();

  for (const game of kindGames) {
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

  // Sort systems alphabetically
  systemOrder.sort((a, b) => {
    const sA = bySystem.get(a)!.system_name;
    const sB = bySystem.get(b)!.system_name;
    return sA.localeCompare(sB);
  });

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-300 transition-colors mb-6 font-medium uppercase tracking-wider"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Systems
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-[#111111] border border-white/[0.06] flex items-center justify-center">
            <KindIcon className="w-4 h-4 text-neutral-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{kindLabel}</h1>
            <p className="text-sm text-neutral-600 mt-0.5 font-mono">
              <span className="text-neutral-400 font-semibold">{kindGames.length.toLocaleString()}</span>{" "}
              {kindGames.length === 1 ? "game" : "games"} across{" "}
              <span className="text-neutral-400 font-semibold">{systemOrder.length}</span>{" "}
              {systemOrder.length === 1 ? "system" : "systems"}
            </p>
          </div>
        </div>

        {kindGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <KindIcon className="w-10 h-10 text-neutral-700 mb-4" />
            <p className="text-neutral-500 text-sm">No {kind} games in your library</p>
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
                      className="text-base font-semibold text-neutral-200 hover:text-white transition-colors"
                    >
                      {section.system_name}
                    </Link>
                    <span className="text-xs text-neutral-600">
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
