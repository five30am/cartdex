import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SystemBadge } from "@/components/system-badge";
import { SystemGamesClient } from "./system-games-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function SystemDetailPage({ params }: Props) {
  const { slug } = await params;

  const system = db.select().from(systems).where(eq(systems.slug, slug)).get();
  if (!system) notFound();

  const allGames = db
    .select({
      id: games.id,
      title: games.title,
      year: games.year,
      genre: games.genre,
      box_art_path: games.box_art_path,
      verified: games.verified,
    })
    .from(games)
    .where(eq(games.system_id, system.id))
    .all();

  // Sort by title by default (client will re-sort)
  allGames.sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Systems
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <SystemBadge slug={system.slug} name={system.slug.toUpperCase()} />
            <div>
              <h1 className="text-2xl font-bold text-white">{system.name}</h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                {allGames.length.toLocaleString()} {allGames.length === 1 ? "game" : "games"}
              </p>
            </div>
          </div>
        </div>

        {/* Client-side search + sort + grid */}
        <SystemGamesClient games={allGames} systemSlug={system.slug} />
      </div>
    </div>
  );
}
