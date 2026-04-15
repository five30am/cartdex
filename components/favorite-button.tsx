"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  gameId: number;
  initialFavorite: boolean;
}

export function FavoriteButton({ gameId, initialFavorite }: Props) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [loading, setLoading] = useState(false);

  async function toggle() {
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
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-150",
        favorite
          ? "border-pink-500/40 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20"
          : "border-border bg-transparent text-muted-foreground hover:text-pink-400 hover:border-pink-500/30",
        loading && "opacity-60 cursor-not-allowed"
      )}
    >
      <Heart
        className={cn("h-4 w-4", favorite && "fill-pink-400")}
      />
      {favorite ? "Favorited" : "Add to Favorites"}
    </button>
  );
}
