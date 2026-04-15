"use client";

import Image from "next/image";
import { Check } from "lucide-react";

interface Game {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  system_slug?: string;
  system_name?: string;
}

interface Props {
  games: Game[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  emptyMessage?: string;
}

export function SelectableGameGrid({
  games,
  selected,
  onToggle,
  emptyMessage = "No games found",
}: Props) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4 opacity-30">🎮</div>
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {games.map((game) => {
        const isSelected = selected.has(game.id);
        return (
          <button
            key={game.id}
            onClick={() => onToggle(game.id)}
            className="group block text-left"
          >
            <div
              className={`relative aspect-[3/4] w-full bg-muted rounded-lg overflow-hidden border-2 transition-all ${
                isSelected
                  ? "border-indigo-500 ring-2 ring-indigo-500/30"
                  : "border-border hover:border-border/60"
              }`}
            >
              {game.box_art_path ? (
                <Image
                  src={game.box_art_path}
                  alt={`${game.title} box art`}
                  fill
                  className={`object-cover transition-all duration-200 ${isSelected ? "brightness-75" : "group-hover:scale-105"}`}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                  <div className="text-3xl mb-2 opacity-30">🎮</div>
                  <p className="text-xs text-muted-foreground leading-tight font-medium line-clamp-3">
                    {game.title}
                  </p>
                </div>
              )}

              {/* Selection overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-indigo-500/15 dark:bg-indigo-900/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center shadow-lg">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}

              {/* Hover indicator when not selected */}
              {!isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full border-2 border-border bg-muted/60 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            <p className="text-xs font-medium text-foreground/80 truncate leading-tight mt-2 px-0.5">
              {game.title}
            </p>
          </button>
        );
      })}
    </div>
  );
}
