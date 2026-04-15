"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SystemBadge } from "@/components/system-badge";
import { Gamepad2, Heart, Star } from "lucide-react";
import { toast } from "sonner";

interface GameCardProps {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  system_slug?: string;
  system_name?: string;
  showSystem?: boolean;
  user_rating?: number | null;
  initialFavorite?: boolean;
}

// Compact icon-only favorite toggle for use inside the card overlay.
// Stops click propagation so activating it doesn't navigate to the detail page.
function CardFavoriteButton({
  gameId,
  initialFavorite = false,
}: {
  gameId: number;
  initialFavorite?: boolean;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const next = !favorite;
    try {
      const res = await fetch("/api/games/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, favorite: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setFavorite(next);
        toast(next ? "Added to favorites" : "Removed from favorites");
      } else {
        toast.error(data.error ?? "Failed to update favorite");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorite}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg border backdrop-blur-sm transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        favorite
          ? "border-pink-500/60 bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
          : "border-border bg-background/70 text-muted-foreground hover:border-pink-500/50 hover:text-pink-400",
        loading && "opacity-50 cursor-not-allowed"
      )}
    >
      <Heart
        className={cn("w-3.5 h-3.5", favorite && "fill-pink-400")}
        aria-hidden="true"
      />
    </button>
  );
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
  initialFavorite = false,
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
        {/* Gradient overlay — always present, fades in on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        {/* Action overlay — hidden at rest, revealed on hover or keyboard focus-within */}
        <div
          className={cn(
            "absolute inset-0 flex items-end justify-end p-2",
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            "transition-opacity duration-200",
            "pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto"
          )}
        >
          <CardFavoriteButton gameId={id} initialFavorite={initialFavorite} />
        </div>
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
