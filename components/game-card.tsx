import Link from "next/link";
import Image from "next/image";
import { SystemBadge } from "@/components/system-badge";

interface GameCardProps {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  system_slug?: string;
  system_name?: string;
  showSystem?: boolean;
}

export function GameCard({
  id,
  title,
  year,
  box_art_path,
  system_slug,
  system_name,
  showSystem = false,
}: GameCardProps) {
  return (
    <Link href={`/games/${id}`} className="group block">
      <div className="relative aspect-[3/4] w-full bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 group-hover:border-neutral-600 transition-colors">
        {box_art_path ? (
          <Image
            src={box_art_path}
            alt={`${title} box art`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
            <div className="text-3xl mb-2 opacity-30">🎮</div>
            <p className="text-xs text-neutral-600 leading-tight font-medium line-clamp-3">
              {title}
            </p>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-medium text-neutral-200 group-hover:text-white transition-colors truncate leading-tight">
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {year && (
            <span className="text-xs text-neutral-500">{year}</span>
          )}
          {showSystem && system_slug && system_name && (
            <SystemBadge slug={system_slug} name={system_name} />
          )}
        </div>
      </div>
    </Link>
  );
}
