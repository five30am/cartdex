"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  gameId: number;
  initialRating: number | null;
}

export function StarRating({ gameId, initialRating }: Props) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function setGameRating(newRating: number | null) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/games/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, rating: newRating }),
      });
      const data = await res.json();
      if (data.ok) {
        setRating(newRating);
        if (newRating === null) {
          toast("Rating cleared");
        } else {
          toast(`Rated ${newRating}/5`);
        }
      } else {
        toast.error(data.error ?? "Failed to update rating");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleStarClick(star: number) {
    if (loading) return;
    // Click same star to clear
    if (rating === star) {
      setGameRating(null);
    } else {
      setGameRating(star);
    }
  }

  const displayRating = hovered ?? rating ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">Your Rating</p>
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={loading}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`Rate ${star} out of 5`}
            className={cn(
              "p-0.5 transition-transform hover:scale-110",
              loading && "cursor-not-allowed opacity-60"
            )}
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors",
                star <= displayRating
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/30 hover:text-amber-400/50"
              )}
            />
          </button>
        ))}
        {rating !== null && (
          <span className="ml-2 text-xs text-muted-foreground font-mono">{rating}/5</span>
        )}
      </div>
    </div>
  );
}
