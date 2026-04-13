import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SystemBadge } from "@/components/system-badge";
import Link from "next/link";
import Image from "next/image";
import { hasAnySettingsConfigured } from "@/lib/services/config";
import { FolderOpen, Gamepad2, Layers, AlertTriangle, ArrowRight } from "lucide-react";

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

        {/* Stats header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Library</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Your ROM collection across all platforms
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <StatPill icon={<Gamepad2 className="w-3.5 h-3.5" />} value={totalGames.toLocaleString()} label="games" />
            <StatPill icon={<Layers className="w-3.5 h-3.5" />} value={`${systemsWithGames}/${allSystems.length}`} label="systems" />
          </div>
        </div>

        {allSystems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {allSystems.map((system) => (
              <SystemCard key={system.id} system={system} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-600">{icon}</span>
      <span className="font-mono text-sm font-semibold text-white tabular-nums">{value}</span>
      <span className="text-xs text-neutral-600">{label}</span>
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
  const hasGames = system.game_count > 0;

  return (
    <Link href={`/systems/${system.slug}`}>
      <Card className="bg-[#111111] border-white/[0.06] hover:border-blue-500/40 hover:bg-[#141414] transition-all duration-200 cursor-pointer group overflow-hidden h-full shadow-none">
        {/* Console image area */}
        <div className="relative h-32 w-full bg-[#0d0d0d] overflow-hidden">
          <Image
            src={`/images/systems/${system.slug}.png`}
            alt={system.name}
            fill
            className="object-contain p-5 opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          {/* Subtle bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#111111] to-transparent" />
          {system.dat_source && (
            <div className="absolute top-2.5 right-2.5">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-white/10 bg-black/60 text-neutral-500 backdrop-blur-sm"
              >
                {system.dat_source}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="px-4 pt-3 pb-4">
          {/* System name */}
          <p className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors leading-tight mb-2.5">
            {system.name}
          </p>

          {/* Count + badge row */}
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className={`font-mono text-xl font-bold tabular-nums leading-none ${hasGames ? "text-white" : "text-neutral-700"}`}>
                {system.game_count.toLocaleString()}
              </p>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                {system.game_count === 1 ? "game" : "games"}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-blue-400">Browse</span>
              <ArrowRight className="w-3 h-3 text-blue-400" />
            </div>
          </div>

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
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-white/[0.06] flex items-center justify-center mb-5">
        <FolderOpen className="w-7 h-7 text-neutral-700" />
      </div>
      <h3 className="text-base font-semibold text-neutral-200 mb-2">
        No games yet
      </h3>
      <p className="text-sm text-neutral-500 max-w-xs mb-6 leading-relaxed">
        Point RomVault at your ROM directory and run a scan to populate your library.
      </p>
      <code className="text-xs bg-[#111111] border border-white/[0.06] text-blue-400 px-4 py-2.5 rounded-lg font-mono tracking-tight">
        POST /api/scan {"{ \"path\": \"/data/roms\" }"}
      </code>
    </div>
  );
}

function FirstRunBanner() {
  return (
    <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-5 py-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-200">
            Setup required
          </p>
          <p className="text-sm text-amber-400/70 mt-0.5 leading-relaxed">
            Configure your ROM path and API credentials to get started.
          </p>
        </div>
      </div>
      <Link
        href="/settings"
        className="shrink-0 flex items-center gap-1 text-sm text-amber-300 hover:text-amber-100 transition-colors font-medium mt-0.5"
      >
        Open Settings
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
