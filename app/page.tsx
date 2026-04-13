import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import Image from "next/image";
import { ActionButtons } from "@/components/action-buttons";

export const dynamic = "force-dynamic";

// System slug → display emoji
const SYSTEM_ICON: Record<string, string> = {
  nes: "🎮",
  snes: "🎮",
  n64: "🕹️",
  gb: "🟩",
  gbc: "🌈",
  gba: "📱",
  genesis: "⚡",
  psx: "📀",
  psp: "🎯",
};

function getSystemsWithCounts() {
  const allSystems = db.select().from(systems).all();

  return allSystems.map((system) => {
    const gameCount =
      db
        .select({ count: count() })
        .from(games)
        .where(eq(games.system_id, system.id))
        .get()?.count ?? 0;

    // Grab the first box art available for this system as a preview
    const sampleArt =
      db
        .select({ box_art_path: games.box_art_path })
        .from(games)
        .where(eq(games.system_id, system.id))
        .all()
        .find((g) => g.box_art_path != null)?.box_art_path ?? null;

    return { ...system, game_count: gameCount, sample_art: sampleArt };
  });
}

export default function HomePage() {
  const allSystems = getSystemsWithCounts();
  const totalGames = allSystems.reduce((sum, s) => sum + s.game_count, 0);
  const systemsWithGames = allSystems.filter((s) => s.game_count > 0).length;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              RomVault
            </h1>
            <p className="text-sm text-neutral-400 mt-0.5">
              Self-hosted ROM library manager
            </p>
          </div>
          <div className="flex gap-4 text-sm text-neutral-400">
            <span>
              <span className="text-white font-semibold">{totalGames}</span>{" "}
              games
            </span>
            <span>
              <span className="text-white font-semibold">
                {systemsWithGames}
              </span>
              /{allSystems.length} systems
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-200">Systems</h2>
            <ActionButtons />
          </div>

          {allSystems.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allSystems.map((system) => (
                <SystemCard key={system.id} system={system} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SystemCard({
  system,
}: {
  system: {
    id: number;
    name: string;
    slug: string;
    game_count: number;
    dat_source: string | null;
    sample_art: string | null;
  };
}) {
  const icon = SYSTEM_ICON[system.slug] ?? "🎮";

  return (
    <Link href={`/api/systems/${system.slug}`}>
      <Card className="bg-neutral-900 border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer group overflow-hidden">
        {system.sample_art && (
          <div className="relative h-28 w-full bg-neutral-800">
            <Image
              src={system.sample_art}
              alt={`${system.name} box art sample`}
              fill
              className="object-contain p-2"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            {!system.sample_art && (
              <span className="text-2xl" role="img" aria-label={system.name}>
                {icon}
              </span>
            )}
            {system.dat_source && (
              <Badge
                variant="outline"
                className="text-xs border-neutral-700 text-neutral-400 ml-auto"
              >
                {system.dat_source}
              </Badge>
            )}
          </div>
          <CardTitle className="text-base font-medium text-neutral-100 group-hover:text-white transition-colors mt-2">
            {system.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white tabular-nums">
            {system.game_count.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {system.game_count === 1 ? "game" : "games"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4">📂</div>
      <h3 className="text-lg font-medium text-neutral-200 mb-2">
        No games yet
      </h3>
      <p className="text-sm text-neutral-500 max-w-sm mb-6">
        Point RomVault at your ROM directory and run a scan to populate your
        library.
      </p>
      <code className="text-xs bg-neutral-800 text-neutral-300 px-3 py-2 rounded font-mono">
        POST /api/scan {"{ \"path\": \"/data/roms\" }"}
      </code>
    </div>
  );
}
