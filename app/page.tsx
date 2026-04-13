import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SystemBadge } from "@/components/system-badge";
import Link from "next/link";
import Image from "next/image";
import { hasAnySettingsConfigured } from "@/lib/services/config";

export const dynamic = "force-dynamic";

function getSystemsWithCounts() {
  const allSystems = db.select().from(systems).all();

  return allSystems.map((system) => {
    const gameCount =
      db
        .select({ count: count() })
        .from(games)
        .where(eq(games.system_id, system.id))
        .get()?.count ?? 0;

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
  const hasSettings = hasAnySettingsConfigured();

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {!hasSettings && <FirstRunBanner />}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-100">Systems</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              <span className="text-white font-medium">{totalGames.toLocaleString()}</span> games across{" "}
              <span className="text-white font-medium">{systemsWithGames}</span>/{allSystems.length} systems
            </p>
          </div>
        </div>

        {allSystems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allSystems.map((system) => (
              <SystemCard key={system.id} system={system} />
            ))}
          </div>
        )}
      </div>
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
  return (
    <Link href={`/systems/${system.slug}`}>
      <Card className="bg-neutral-900 border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer group overflow-hidden h-full">
        {system.sample_art && (
          <div className="relative h-28 w-full bg-neutral-800">
            <Image
              src={system.sample_art}
              alt={`${system.name} box art sample`}
              fill
              className="object-contain p-2"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          </div>
        )}
        {!system.sample_art && (
          <div className="h-28 w-full bg-neutral-800/50 flex items-center justify-center">
            <span className="text-3xl opacity-20">🎮</span>
          </div>
        )}
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-medium text-neutral-100 group-hover:text-white transition-colors">
              {system.name}
            </CardTitle>
            {system.dat_source && (
              <Badge
                variant="outline"
                className="text-xs border-neutral-700 text-neutral-500 shrink-0"
              >
                {system.dat_source}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-2xl font-bold text-white tabular-nums">
            {system.game_count.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {system.game_count === 1 ? "game" : "games"}
          </p>
          <div className="mt-3">
            <SystemBadge slug={system.slug} name={system.slug.toUpperCase()} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4 opacity-30">📂</div>
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

function FirstRunBanner() {
  return (
    <div className="mb-6 rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-amber-200">
          Welcome to RomVault!
        </p>
        <p className="text-sm text-amber-400/80 mt-0.5">
          Configure your ROM path and API credentials to get started.
        </p>
      </div>
      <Link
        href="/settings"
        className="shrink-0 text-sm text-amber-300 hover:text-amber-100 underline underline-offset-2 transition-colors"
      >
        Open Settings
      </Link>
    </div>
  );
}
