import { db, sqlite } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { and, eq, count } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SystemBadge } from "@/components/system-badge";
import { CompletionPill, type CompletionData } from "@/components/completion-pill";
import Link from "next/link";
import Image from "next/image";
import { hasAnySettingsConfigured } from "@/lib/services/config";
import { FolderOpen, Gamepad2, Layers, AlertTriangle, ArrowRight, Monitor } from "lucide-react";

export const dynamic = "force-dynamic";

function getSystemsWithCounts() {
  // Only fetch enabled systems for browse UI
  const allSystems = db.select().from(systems).where(eq(systems.enabled, true)).all() as (typeof systems.$inferSelect)[];

  // Pre-fetch DAT completion for all systems in one query — keyed by system_id.
  // Avoids N+1 round-trips per card. Uses the dat_completion VIEW + dats table.
  interface CompletionRow {
    system_id: number;
    dat_id: number;
    dat_name: string;
    total: number;
    have: number;
    have_baddump: number;
    missing: number;
    nodump: number;
    completion_pct: number | null;
  }
  let completionBySystemId: Map<number, CompletionData> = new Map();
  try {
    const completionRows = sqlite.prepare(`
      SELECT
        d.system_id,
        dc.dat_id,
        dc.dat_name,
        dc.total,
        dc.have,
        dc.have_baddump,
        dc.missing,
        dc.nodump,
        dc.completion_pct
      FROM dat_completion dc
      INNER JOIN dats d ON d.id = dc.dat_id
      WHERE d.system_id IS NOT NULL
      ORDER BY d.system_id, d.id ASC
    `).all() as CompletionRow[];

    // One row per system — first DAT wins (lowest id)
    for (const { system_id, ...rest } of completionRows) {
      if (!completionBySystemId.has(system_id)) {
        completionBySystemId.set(system_id, { linked: true, ...rest });
      }
    }
  } catch {
    // dat_completion view not yet created (fresh DB without migration) — safe to ignore
    completionBySystemId = new Map();
  }

  return allSystems.map((system) => {
    const gameCount =
      db
        .select({ count: count() })
        .from(games)
        .where(and(eq(games.system_id, system.id), eq(games.hidden, false)))
        .get()?.count ?? 0;

    const sampleArt =
      db
        .select({ box_art_path: games.box_art_path })
        .from(games)
        .where(and(eq(games.system_id, system.id), eq(games.hidden, false)))
        .all()
        .find((g) => g.box_art_path != null)?.box_art_path ?? null;

    const completion = completionBySystemId.get(system.id) ?? null;

    return { ...system, game_count: gameCount, sample_art: sampleArt, completion };
  });
}

type SystemWithCount = ReturnType<typeof getSystemsWithCounts>[number];

export default function HomePage() {
  const allSystems = getSystemsWithCounts();
  const totalGames = allSystems.reduce((sum, s) => sum + s.game_count, 0);
  // Only show systems that have at least one non-hidden game on the landing page
  const activeSystems = allSystems.filter((s) => s.game_count > 0);
  const hasSettings = hasAnySettingsConfigured();

  const consoles = activeSystems.filter((s) => s.kind !== "handheld");
  const handhelds = activeSystems.filter((s) => s.kind === "handheld");

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {!hasSettings && <FirstRunBanner />}

        {/* Stats header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Library</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your ROM collection across all platforms
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <StatPill icon={<Gamepad2 className="w-3.5 h-3.5" />} value={totalGames.toLocaleString()} label="games" />
            <StatPill icon={<Layers className="w-3.5 h-3.5" />} value={`${activeSystems.length}/${allSystems.length}`} label="systems" />
          </div>
        </div>

        {activeSystems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            {consoles.length > 0 && (
              <SystemGroup
                label="Consoles"
                href="/kind/console"
                icon={<Monitor className="w-4 h-4" />}
                systems={consoles}
              />
            )}
            {handhelds.length > 0 && (
              <SystemGroup
                label="Handhelds"
                href="/kind/handheld"
                icon={<Gamepad2 className="w-4 h-4" />}
                systems={handhelds}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemGroup({
  label,
  href,
  icon,
  systems,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  systems: SystemWithCount[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-muted-foreground">{icon}</span>
        <Link
          href={href}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
        >
          {label}
        </Link>
        <span className="text-xs text-muted-foreground/40 font-mono ml-1">{systems.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {systems.map((system) => (
          <SystemCard key={system.id} system={system} />
        ))}
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
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-mono text-sm font-semibold text-foreground tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function SystemCard({
  system,
}: {
  system: SystemWithCount;
}) {
  const hasGames = system.game_count > 0;

  return (
    <Link href={`/systems/${system.slug}`}>
      <Card className="bg-card border-border hover:border-blue-500/40 hover:bg-accent/30 transition-all duration-200 cursor-pointer group overflow-hidden h-full shadow-none">
        {/* Console image area */}
        <div className="relative h-32 w-full bg-muted/40 overflow-hidden">
          <Image
            src={`/images/systems/${system.slug}.png`}
            alt={system.name}
            fill
            className="object-contain p-5 opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          {/* Subtle bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
          {system.dat_source && (
            <div className="absolute top-2.5 right-2.5">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-border bg-background/60 text-muted-foreground backdrop-blur-sm"
              >
                {system.dat_source}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="px-4 pt-3 pb-4">
          {/* System name */}
          <p className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors leading-tight mb-2.5">
            {system.name}
          </p>

          {/* Count + badge row */}
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className={`font-mono text-xl font-bold tabular-nums leading-none ${hasGames ? "text-foreground" : "text-muted-foreground/40"}`}>
                {system.game_count.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {system.game_count === 1 ? "game" : "games"}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-blue-400">Browse</span>
              <ArrowRight className="w-3 h-3 text-blue-400" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <SystemBadge slug={system.slug} name={system.slug.toUpperCase()} />
            <CompletionPill data={system.completion} size="sm" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-5">
        <FolderOpen className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">
        No games yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
        Point RomVault at your ROM directory and run a scan to populate your library.
      </p>
      <code className="text-xs bg-muted border border-border text-blue-500 dark:text-blue-400 px-4 py-2.5 rounded-lg font-mono tracking-tight">
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
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">
            Setup required
          </p>
          <p className="text-sm text-amber-700/70 dark:text-amber-400/70 mt-0.5 leading-relaxed">
            Configure your ROM path and API credentials to get started.
          </p>
        </div>
      </div>
      <Link
        href="/settings"
        className="shrink-0 flex items-center gap-1 text-sm text-amber-600 hover:text-amber-500 dark:text-amber-300 dark:hover:text-amber-100 transition-colors font-medium mt-0.5"
      >
        Open Settings
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
