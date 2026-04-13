import { db } from "@/lib/db";
import { collections, collection_games, games, systems, export_profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CollectionDetailClient } from "./collection-detail-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function CollectionDetailPage({ params }: Props) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  if (isNaN(collectionId)) notFound();

  const col = db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .get();

  if (!col) notFound();

  const collectionGames = db
    .select({
      id: games.id,
      title: games.title,
      year: games.year,
      box_art_path: games.box_art_path,
      file_size: games.file_size,
      verified: games.verified,
      system_id: games.system_id,
      system_name: systems.name,
      system_slug: systems.slug,
    })
    .from(collection_games)
    .innerJoin(games, eq(collection_games.game_id, games.id))
    .innerJoin(systems, eq(games.system_id, systems.id))
    .where(eq(collection_games.collection_id, collectionId))
    .all();

  collectionGames.sort(
    (a, b) => a.system_name.localeCompare(b.system_name) || a.title.localeCompare(b.title)
  );

  const totalSize = collectionGames.reduce((acc, g) => acc + (g.file_size ?? 0), 0);

  const profiles = db.select().from(export_profiles).all();

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/collections"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Collections
        </Link>

        <CollectionDetailClient
          collection={col}
          initialGames={collectionGames}
          totalSize={totalSize}
          totalSizeFormatted={formatBytes(totalSize)}
          exportProfiles={profiles}
        />
      </div>
    </div>
  );
}
