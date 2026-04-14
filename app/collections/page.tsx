import { db } from "@/lib/db";
import { collections, collection_games, games, systems } from "@/lib/db/schema";
import { and, eq, count, sum } from "drizzle-orm";
import Link from "next/link";
import { CollectionsClient } from "./collections-client";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function CollectionsPage() {
  const allCollections = db.select().from(collections).all();

  const collectionData = allCollections.map((col) => {
    const gameCount = db
      .select({ count: count() })
      .from(collection_games)
      .innerJoin(games, eq(collection_games.game_id, games.id))
      .where(and(eq(collection_games.collection_id, col.id), eq(games.hidden, false)))
      .get();

    const totalSize = db
      .select({ total: sum(games.file_size) })
      .from(collection_games)
      .innerJoin(games, eq(collection_games.game_id, games.id))
      .where(and(eq(collection_games.collection_id, col.id), eq(games.hidden, false)))
      .get();

    // Systems represented in this collection (non-hidden games only)
    const systemsInCol = db
      .select({ slug: systems.slug, name: systems.name })
      .from(collection_games)
      .innerJoin(games, eq(collection_games.game_id, games.id))
      .innerJoin(systems, eq(games.system_id, systems.id))
      .where(and(eq(collection_games.collection_id, col.id), eq(games.hidden, false)))
      .all();

    const uniqueSystems = [
      ...new Map(systemsInCol.map((s) => [s.slug, s])).values(),
    ];

    const totalSizeNum = Number(totalSize?.total ?? 0);
    return {
      ...col,
      game_count: gameCount?.count ?? 0,
      total_size: totalSizeNum,
      total_size_formatted: formatBytes(totalSizeNum),
      systems: uniqueSystems,
    };
  });

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Collections</h1>
            <p className="text-sm text-neutral-500 mt-1">
              {collectionData.length} collection{collectionData.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <CollectionsClient initialCollections={collectionData} />
      </div>
    </div>
  );
}
