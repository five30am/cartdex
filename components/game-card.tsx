"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SystemBadge } from "@/components/system-badge";
import { Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { mutationHeaders } from "@/lib/api-token";

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
        headers: { ...(await mutationHeaders()), "Content-Type": "application/json" },
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
        "flex items-center justify-center w-8 h-8 rounded-md border backdrop-blur-sm transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        loading && "opacity-50 cursor-not-allowed"
      )}
      style={{
        borderColor: favorite ? "var(--cd-border-active)" : "var(--panel-border)",
        background: favorite ? "var(--cd-accent-tint-15)" : "var(--cd-bg-70)",
        color: favorite ? "var(--sand)" : "var(--text-dim)",
      }}
    >
      <Heart
        className={cn("w-3.5 h-3.5")}
        style={{ fill: favorite ? "var(--sand)" : "transparent" }}
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
    <Link href={`/games/${id}`} className="group block game-card-animated">
      {/* Thumbnail */}
      <div
        className={cn(
          "relative w-full rounded-md overflow-hidden border transition-all duration-200 game-thumb-hologram",
          box_art_path && !imageLoaded && "cover-shimmer"
        )}
        style={{
          aspectRatio: "0.72",
          borderColor: "var(--panel-border)",
          background: "var(--card-bg)",
        }}
      >

        {box_art_path ? (
          <Image
            src={box_art_path}
            alt={`${title} box art`}
            fill
            loading="lazy"
            className={cn(
              "object-cover transition-all duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center"
            style={{
              background: "linear-gradient(145deg, var(--card-bg) 0%, var(--cd-card-deep) 100%)",
            }}
          >
            {/* Decorative background radials */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 30% 40%, var(--cd-ochre-tint-08) 0%, transparent 60%), radial-gradient(circle at 70% 70%, var(--cd-info-tint-05) 0%, transparent 50%)",
              }}
            />
            <p
              className="relative z-10 leading-tight line-clamp-3"
              style={{
                fontFamily: "var(--cd-font-heading)",
                fontSize: "0.8125rem",
                letterSpacing: "3px",
                color: "var(--text-dim)",
                opacity: 0.5,
                textTransform: "uppercase",
              }}
            >
              {title.slice(0, 2)}
            </p>
          </div>
        )}

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Favorite button overlay */}
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

      {/* Card info below thumbnail */}
      <div className="mt-2 px-0.5">
        <p
          className="truncate leading-tight"
          style={{
            fontFamily: "var(--cd-font-body)",
            fontWeight: 600,
            fontSize: "0.9375rem",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {year && (
            <span
              style={{
                fontFamily: "var(--cd-font-mono)",
                fontSize: "0.8125rem",
                color: "var(--text-dim)",
              }}
            >
              {year}
            </span>
          )}
          {user_rating != null && (
            <span className="inline-flex items-center gap-0.5">
              <Star
                className="w-2.5 h-2.5"
                style={{ fill: "var(--sand)", color: "var(--sand)" }}
              />
              <span
                style={{
                  fontFamily: "var(--cd-font-mono)",
                  fontSize: "0.6875rem",
                  color: "var(--sand-dim)",
                }}
              >
                {user_rating}
              </span>
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
