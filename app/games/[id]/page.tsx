import { db } from "@/lib/db";
import { games, systems, franchises, game_franchises } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, CheckCircle2, FileText, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SystemBadge } from "@/components/system-badge";
import { AddToCollectionButton } from "./add-to-collection-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) notFound();

  const game = db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) notFound();

  const system = db.select().from(systems).where(eq(systems.id, game.system_id)).get();

  // Get franchises this game belongs to
  const gameFranchises = db
    .select({ id: franchises.id, name: franchises.name, slug: franchises.slug })
    .from(game_franchises)
    .innerJoin(franchises, eq(game_franchises.franchise_id, franchises.id))
    .where(eq(game_franchises.game_id, gameId))
    .all();

  return (
    <div className="px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
          <Link href="/games" className="hover:text-neutral-300 transition-colors">
            All Games
          </Link>
          {system && (
            <>
              <span>/</span>
              <Link
                href={`/systems/${system.slug}`}
                className="hover:text-neutral-300 transition-colors"
              >
                {system.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-neutral-400 truncate max-w-[200px]">{game.title}</span>
        </div>

        {game.hidden && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-sm text-amber-300">
            <EyeOff className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              This game is currently hidden
              {game.hidden_reason ? ` (${game.hidden_reason})` : ""}.
              It will not appear in library list views.
            </span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Box art */}
          <div className="shrink-0">
            <div className="relative w-52 aspect-[3/4] bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl">
              {game.box_art_path ? (
                <Image
                  src={game.box_art_path}
                  alt={`${game.title} box art`}
                  fill
                  className="object-cover"
                  sizes="208px"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <div className="text-5xl mb-3 opacity-20">🎮</div>
                  <p className="text-xs text-neutral-600">No art</p>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-2">
              {system && (
                <SystemBadge slug={system.slug} name={system.slug.toUpperCase()} />
              )}
              {game.verified && (
                <Badge
                  variant="outline"
                  className="text-xs border-green-800 text-green-400 bg-green-900/20 flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold text-white mt-2 mb-1">{game.title}</h1>

            {system && (
              <p className="text-sm text-neutral-400 mb-4">{system.name}</p>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
              {game.year && (
                <MetaItem label="Year" value={game.year} />
              )}
              {game.genre && (
                <MetaItem label="Genre" value={game.genre} />
              )}
            </div>

            {/* Description */}
            {game.description && (
              <p className="text-sm text-neutral-300 leading-relaxed mb-6 max-w-prose">
                {game.description}
              </p>
            )}

            {/* Franchises */}
            {gameFranchises.length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">Series</p>
                <div className="flex flex-wrap gap-2">
                  {gameFranchises.map((f) => (
                    <Link
                      key={f.id}
                      href={`/series/${f.slug}`}
                      className="text-sm px-3 py-1 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded-full transition-colors"
                    >
                      {f.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* File info */}
            <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-neutral-500" />
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest">File Info</p>
              </div>
              <div className="space-y-2">
                <FileRow label="Path" value={game.file_path} mono />
                <FileRow label="Size" value={formatBytes(game.file_size)} />
                {game.hash_crc32 && <FileRow label="CRC32" value={game.hash_crc32} mono />}
                {game.hash_md5 && <FileRow label="MD5" value={game.hash_md5} mono />}
                {game.hash_sha1 && <FileRow label="SHA1" value={game.hash_sha1} mono />}
              </div>
            </div>

            {/* Add to Collection */}
            <div className="mt-6">
              <AddToCollectionButton gameId={gameId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm text-neutral-200">{value}</p>
    </div>
  );
}

function FileRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <p className="text-xs text-neutral-500 w-12 shrink-0 pt-0.5">{label}</p>
      <p className={`text-xs text-neutral-300 break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
