"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SystemBadge } from "@/components/system-badge";
import { Gamepad2, Star } from "lucide-react";

interface GameCardProps {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  system_slug?: string;
  system_name?: string;
  showSystem?: boolean;
  user_rating?: number | null;
}

export function GameCard({
  id,
  title,
  year,
  box_art_path,
  system_slug,
  system_name,
  showSystem = false,
  user_rating,
}: GameCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Link href={`/games/${id}`} className="group block">
      <div
        className={cn(
          "relative aspect-[3/4] w-full bg-card rounded-lg overflow-hidden border border-border group-hover:border-blue-500/30 transition-all duration-200 shadow-none",
          box_art_path && !imageLoaded && "cover-shimmer"
        )}
      >
        {box_art_path ? (
          <Image
            src={box_art_path}
            alt={`${title} box art`}
            fill
            loading="lazy"
            className={cn(
              "object-cover group-hover:scale-105 transition-all duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-muted/40">
            <Gamepad2 className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <p className="text-[11px] text-muted-foreground/50 leading-tight font-medium line-clamp-3">
              {title}
            </p>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate leading-tight">
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {year && (
            <span className="text-[11px] text-muted-foreground/50 font-mono">{year}</span>
          )}
          {user_rating != null && (
            <span className="inline-flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span className="text-[11px] text-amber-500 font-mono">{user_rating}</span>
            </span>
          )}
          {showSystem && system_slug && system_name && (
            <SystemBadge slug={system_slug} name={system_name} />
          )}
        </div>
      </div>
    </Link>
  );
}
