import { db } from "@/lib/db";
import { collections, collection_games, games, systems, export_profiles } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CollectionDetailClient } from "./collection-detail-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ show_hidden?: string }>;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function CollectionDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { show_hidden } = await searchParams;
  const showHidden = show_hidden === "true";
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
    .where(
      showHidden
        ? eq(collection_games.collection_id, collectionId)
        : and(eq(collection_games.collection_id, collectionId), eq(games.hidden, false))
    )
    .all();

  const hiddenCount = showHidden
    ? 0
    : db
        .select({ id: games.id })
        .from(collection_games)
        .innerJoin(games, eq(collection_games.game_id, games.id))
        .where(and(eq(collection_games.collection_id, collectionId), eq(games.hidden, true)))
        .all().length;

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
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Collections
        </Link>

        {!showHidden && hiddenCount > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            {hiddenCount} hidden {hiddenCount === 1 ? "game" : "games"} not shown &mdash;{" "}
            <Link href={`/collections/${collectionId}?show_hidden=true`} className="text-foreground/70 hover:text-foreground underline underline-offset-2">
              show all
            </Link>
          </p>
        )}
        {showHidden && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing hidden games &mdash;{" "}
            <Link href={`/collections/${collectionId}`} className="text-foreground/70 hover:text-foreground underline underline-offset-2">
              hide hidden
            </Link>
          </p>
        )}
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
