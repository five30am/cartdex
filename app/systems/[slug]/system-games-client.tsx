"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search-bar";
import { GameGrid } from "@/components/game-grid";
import { SelectableGameGrid } from "@/components/selectable-game-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square, FolderPlus, X } from "lucide-react";
import { AddToCollectionModal } from "@/components/add-to-collection-modal";
import { toast } from "sonner";
import Link from "next/link";

interface Game {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  genre?: string | null;
  verified: boolean;
  user_rating?: number | null;
  favorite?: boolean | null;
  publisher?: string | null;
  created_at: string;
}

interface Props {
  games: Game[];
  systemSlug: string;
}

type SortOption = "title" | "title_desc" | "year" | "year_desc" | "publisher" | "rating_desc" | "recent";

export function SystemGamesClient({ games, systemSlug }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialSort = (searchParams.get("sort") as SortOption) || "title";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  function handleSortChange(value: string | null) {
    const newSort = (value || "title") as SortOption;
    setSort(newSort);
    const params = new URLSearchParams(searchParams.toString());
    if (newSort === "title") {
      params.delete("sort");
    } else {
      params.set("sort", newSort);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    let result = [...games];

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((g) => g.title.toLowerCase().includes(lower));
    }

    result.sort((a, b) => {
      switch (sort) {
        case "title_desc":
          return b.title.localeCompare(a.title);
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
        case "publisher":
          if (a.publisher && b.publisher) return a.publisher.localeCompare(b.publisher) || a.title.localeCompare(b.title);
          if (a.publisher) return -1;
          if (b.publisher) return 1;
          return a.title.localeCompare(b.title);
        case "rating_desc":
          if (a.user_rating != null && b.user_rating != null) return b.user_rating - a.user_rating || a.title.localeCompare(b.title);
          if (a.user_rating != null) return -1;
          if (b.user_rating != null) return 1;
          return a.title.localeCompare(b.title);
        case "recent":
          return b.created_at.localeCompare(a.created_at);
        case "title":
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [games, search, sort]);

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
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search games..."
          className="flex-1 max-w-sm"
        />
        <Select value={sort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px] bg-neutral-900 border-neutral-700 text-neutral-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700">
            <SelectItem value="title" className="text-neutral-200 focus:bg-neutral-800">Name (A–Z)</SelectItem>
            <SelectItem value="title_desc" className="text-neutral-200 focus:bg-neutral-800">Name (Z–A)</SelectItem>
            <SelectItem value="year_desc" className="text-neutral-200 focus:bg-neutral-800">Release date (newest)</SelectItem>
            <SelectItem value="year" className="text-neutral-200 focus:bg-neutral-800">Release date (oldest)</SelectItem>
            <SelectItem value="publisher" className="text-neutral-200 focus:bg-neutral-800">Publisher (A–Z)</SelectItem>
            <SelectItem value="rating_desc" className="text-neutral-200 focus:bg-neutral-800">Highest rated</SelectItem>
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">
              {selected.size} selected
            </span>
            <button onClick={selectAll} className="text-xs text-indigo-400 hover:text-indigo-300">
              Select all
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

      {search && (
        <p className="text-sm text-neutral-500 mb-4">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
        </p>
      )}

      {selectMode ? (
        <SelectableGameGrid
          games={filtered}
          selected={selected}
          onToggle={toggleSelect}
          emptyMessage={search ? `No games matching "${search}"` : "No games in this system"}
        />
      ) : (
        <GameGrid
          games={filtered}
          emptyMessage={search ? `No games matching "${search}"` : "No games in this system"}
        />
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
