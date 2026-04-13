"use client";

import { useState, useMemo } from "react";
import { SearchBar } from "@/components/search-bar";
import { GameGrid } from "@/components/game-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Game {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  genre?: string | null;
  verified: boolean;
}

interface Props {
  games: Game[];
  systemSlug: string;
}

type SortOption = "title" | "year" | "year_desc" | "recent";

export function SystemGamesClient({ games }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title");

  const filtered = useMemo(() => {
    let result = [...games];

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((g) => g.title.toLowerCase().includes(lower));
    }

    result.sort((a, b) => {
      switch (sort) {
        case "year":
          if (a.year && b.year) return a.year.localeCompare(b.year);
          if (a.year) return -1;
          if (b.year) return 1;
          return a.title.localeCompare(b.title);
        case "year_desc":
          if (a.year && b.year) return b.year.localeCompare(a.year);
          if (b.year) return -1;
          if (a.year) return 1;
          return a.title.localeCompare(b.title);
        case "title":
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [games, search, sort]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search games..."
          className="flex-1 max-w-sm"
        />
        <Select value={sort} onValueChange={(v) => setSort((v ?? "title") as SortOption)}>
          <SelectTrigger className="w-[160px] bg-neutral-900 border-neutral-700 text-neutral-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700">
            <SelectItem value="title" className="text-neutral-200 focus:bg-neutral-800">Title (A–Z)</SelectItem>
            <SelectItem value="year" className="text-neutral-200 focus:bg-neutral-800">Year (oldest)</SelectItem>
            <SelectItem value="year_desc" className="text-neutral-200 focus:bg-neutral-800">Year (newest)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {search && (
        <p className="text-sm text-neutral-500 mb-4">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
        </p>
      )}

      <GameGrid
        games={filtered}
        emptyMessage={search ? `No games matching "${search}"` : "No games in this system"}
      />
    </div>
  );
}
