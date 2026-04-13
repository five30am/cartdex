"use client";

import { useState, useMemo } from "react";
import { SearchBar } from "@/components/search-bar";
import { GameCard } from "@/components/game-card";
import { SelectableGameGrid } from "@/components/selectable-game-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckSquare, FolderPlus, X } from "lucide-react";
import { AddToCollectionModal } from "@/components/add-to-collection-modal";
import { toast } from "sonner";
import Link from "next/link";

interface Game {
  id: number;
  title: string;
  year?: string | null;
  genre?: string | null;
  box_art_path?: string | null;
  verified: boolean;
  created_at: string;
  system_id: number;
  system_name: string;
  system_slug: string;
}

interface SystemOption {
  id: number;
  name: string;
  slug: string;
}

interface Props {
  games: Game[];
  systems: SystemOption[];
  genres: string[];
}

type SortOption = "title" | "year" | "year_desc" | "system" | "recent";

const PAGE_SIZE = 60;

export function AllGamesClient({ games, systems, genres }: Props) {
  const [search, setSearch] = useState("");
  const [systemFilter, setSystemFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [sort, setSort] = useState<SortOption>("title");
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  const filtered = useMemo(() => {
    let result = [...games];

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((g) => g.title.toLowerCase().includes(lower));
    }
    if (systemFilter !== "all") {
      result = result.filter((g) => g.system_slug === systemFilter);
    }
    if (genreFilter !== "all") {
      result = result.filter((g) => g.genre === genreFilter);
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
        case "system":
          return a.system_name.localeCompare(b.system_name) || a.title.localeCompare(b.title);
        case "recent":
          return b.created_at.localeCompare(a.created_at);
        case "title":
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [games, search, systemFilter, genreFilter, sort]);

  // Reset to page 1 when filters change
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string | null) => {
      setter(v ?? "all");
      setPage(1);
    };
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((g) => g.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function handleCollectionSuccess(collectionId: number, collectionName: string) {
    toast.success(
      <span>
        Added {selected.size} {selected.size === 1 ? "game" : "games"} to{" "}
        <Link href={`/collections/${collectionId}`} className="underline">
          {collectionName}
        </Link>
      </span>
    );
    exitSelectMode();
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <SearchBar
          value={search}
          onChange={handleSearch}
          placeholder="Search games..."
          className="flex-1 min-w-[200px] max-w-sm"
        />
        <Select value={systemFilter} onValueChange={handleFilterChange(setSystemFilter)}>
          <SelectTrigger className="w-[160px] bg-neutral-900 border-neutral-700 text-neutral-200">
            <SelectValue placeholder="All systems" />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700">
            <SelectItem value="all" className="text-neutral-200 focus:bg-neutral-800">All systems</SelectItem>
            {systems.map((sys) => (
              <SelectItem key={sys.slug} value={sys.slug} className="text-neutral-200 focus:bg-neutral-800">
                {sys.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {genres.length > 0 && (
          <Select value={genreFilter} onValueChange={handleFilterChange(setGenreFilter)}>
            <SelectTrigger className="w-[140px] bg-neutral-900 border-neutral-700 text-neutral-200">
              <SelectValue placeholder="All genres" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-neutral-700">
              <SelectItem value="all" className="text-neutral-200 focus:bg-neutral-800">All genres</SelectItem>
              {genres.map((g) => (
                <SelectItem key={g} value={g} className="text-neutral-200 focus:bg-neutral-800">
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={sort} onValueChange={(v) => setSort((v ?? "title") as SortOption)}>
          <SelectTrigger className="w-[160px] bg-neutral-900 border-neutral-700 text-neutral-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700">
            <SelectItem value="title" className="text-neutral-200 focus:bg-neutral-800">Title (A–Z)</SelectItem>
            <SelectItem value="year" className="text-neutral-200 focus:bg-neutral-800">Year (oldest)</SelectItem>
            <SelectItem value="year_desc" className="text-neutral-200 focus:bg-neutral-800">Year (newest)</SelectItem>
            <SelectItem value="system" className="text-neutral-200 focus:bg-neutral-800">System</SelectItem>
            <SelectItem value="recent" className="text-neutral-200 focus:bg-neutral-800">Recently added</SelectItem>
          </SelectContent>
        </Select>

        {!selectMode ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectMode(true)}
            className="border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500"
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            Select
          </Button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-neutral-400">{selected.size} selected</span>
            <button onClick={selectAll} className="text-xs text-indigo-400 hover:text-indigo-300">
              Select all ({filtered.length})
            </button>
            <button onClick={deselectAll} className="text-xs text-neutral-500 hover:text-neutral-300">
              Deselect all
            </button>
            {selected.size > 0 && (
              <Button
                size="sm"
                onClick={() => setShowCollectionModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-7 text-xs"
              >
                <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                Add to Collection
              </Button>
            )}
            <button onClick={exitSelectMode} className="text-neutral-500 hover:text-neutral-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Result count */}
      {(search || systemFilter !== "all" || genreFilter !== "all") && (
        <p className="text-sm text-neutral-500 mb-4">
          {filtered.length.toLocaleString()} result{filtered.length !== 1 ? "s" : ""}
          {search && <> for &ldquo;{search}&rdquo;</>}
        </p>
      )}

      {/* Grid */}
      {selectMode ? (
        <SelectableGameGrid
          games={paginated}
          selected={selected}
          onToggle={toggleSelect}
          emptyMessage="No games match your filters"
        />
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4 opacity-30">🎮</div>
          <p className="text-neutral-500 text-sm">No games match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {paginated.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              title={game.title}
              year={game.year}
              box_art_path={game.box_art_path}
              system_slug={game.system_slug}
              system_name={game.system_name}
              showSystem
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!selectMode && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={clampedPage <= 1}
            className="px-3 py-1.5 text-sm rounded-md bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-500 px-2">
            Page {clampedPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={clampedPage >= totalPages}
            className="px-3 py-1.5 text-sm rounded-md bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      <AddToCollectionModal
        open={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        gameIds={Array.from(selected)}
        onSuccess={handleCollectionSuccess}
      />
    </div>
  );
}
