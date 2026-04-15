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
import { FacetFilterSidebar, type FacetGroup } from "@/components/facet-filter-sidebar";
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
  user_rating?: number | null;
  publisher?: string | null;
  scraper_region?: string | null;
}

interface SystemOption {
  id: number;
  name: string;
  slug: string;
}

interface Props {
  games: Game[];
  systems: SystemOption[];
}

type SortOption =
  | "title"
  | "title_desc"
  | "year"
  | "year_desc"
  | "system"
  | "publisher"
  | "rating_desc"
  | "recent";

interface FacetFilters {
  genre: string;
  publisher: string;
  year: string;
  region: string;
}

const PAGE_SIZE = 60;

// Apply all filters except the one named by `excludeKey`.
// This gives per-group facet counts that reflect the current state of all
// other active filters — the reactive facet stream pattern.
function applyFiltersExcept(
  games: Game[],
  search: string,
  systemFilter: string,
  facets: FacetFilters,
  excludeKey: keyof FacetFilters | null
): Game[] {
  let result = games;

  if (search) {
    const lower = search.toLowerCase();
    result = result.filter((g) => g.title.toLowerCase().includes(lower));
  }
  if (systemFilter !== "all") {
    result = result.filter((g) => g.system_slug === systemFilter);
  }
  if (excludeKey !== "genre" && facets.genre !== "all") {
    result = result.filter((g) => g.genre === facets.genre);
  }
  if (excludeKey !== "publisher" && facets.publisher !== "all") {
    result = result.filter((g) => g.publisher === facets.publisher);
  }
  if (excludeKey !== "year" && facets.year !== "all") {
    result = result.filter((g) => (g.year?.slice(0, 4) ?? "") === facets.year);
  }
  if (excludeKey !== "region" && facets.region !== "all") {
    result = result.filter((g) => g.scraper_region === facets.region);
  }

  return result;
}

function countBy<T>(arr: T[], key: (item: T) => string | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of arr) {
    const k = key(item);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function topOptions(
  countMap: Map<string, number>,
  limit = 30
): Array<{ value: string; label: string; count: number }> {
  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, label: value, count }));
}

export function AllGamesClient({ games, systems }: Props) {
  const [search, setSearch] = useState("");
  const [systemFilter, setSystemFilter] = useState("all");
  const [facetFilters, setFacetFilters] = useState<FacetFilters>({
    genre: "all",
    publisher: "all",
    year: "all",
    region: "all",
  });
  const [sort, setSort] = useState<SortOption>("title");
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  // Fully filtered result — used for the grid and pagination
  const filtered = useMemo(() => {
    let result = applyFiltersExcept(games, search, systemFilter, facetFilters, null);

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
        case "system":
          return (
            a.system_name.localeCompare(b.system_name) ||
            a.title.localeCompare(b.title)
          );
        case "publisher":
          if (a.publisher && b.publisher)
            return (
              a.publisher.localeCompare(b.publisher) ||
              a.title.localeCompare(b.title)
            );
          if (a.publisher) return -1;
          if (b.publisher) return 1;
          return a.title.localeCompare(b.title);
        case "rating_desc":
          if (a.user_rating != null && b.user_rating != null)
            return b.user_rating - a.user_rating || a.title.localeCompare(b.title);
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
  }, [games, search, systemFilter, facetFilters, sort]);

  // Per-group facet counts: each group sees counts from all filters except itself
  const facetGroups = useMemo<FacetGroup[]>(() => {
    const forGenre = applyFiltersExcept(games, search, systemFilter, facetFilters, "genre");
    const forPublisher = applyFiltersExcept(games, search, systemFilter, facetFilters, "publisher");
    const forYear = applyFiltersExcept(games, search, systemFilter, facetFilters, "year");
    const forRegion = applyFiltersExcept(games, search, systemFilter, facetFilters, "region");

    return [
      {
        key: "genre",
        label: "Genre",
        poolCount: forGenre.length,
        options: topOptions(countBy(forGenre, (g) => g.genre)),
      },
      {
        key: "publisher",
        label: "Publisher",
        poolCount: forPublisher.length,
        options: topOptions(countBy(forPublisher, (g) => g.publisher)),
      },
      {
        key: "year",
        label: "Year",
        poolCount: forYear.length,
        options: topOptions(
          countBy(forYear, (g) => g.year?.slice(0, 4) ?? null)
        ).sort((a, b) => b.value.localeCompare(a.value)), // newest first
      },
      {
        key: "region",
        label: "Region",
        poolCount: forRegion.length,
        options: topOptions(countBy(forRegion, (g) => g.scraper_region)),
      },
    ].filter((group) => group.options.length > 0);
  }, [games, search, systemFilter, facetFilters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice(
    (clampedPage - 1) * PAGE_SIZE,
    clampedPage * PAGE_SIZE
  );

  function handleFacetChange(key: keyof FacetFilters, value: string) {
    setFacetFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleSystemFilterChange(v: string | null) {
    setSystemFilter(v ?? "all");
    setPage(1);
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

  const isFiltered =
    search ||
    systemFilter !== "all" ||
    facetFilters.genre !== "all" ||
    facetFilters.publisher !== "all" ||
    facetFilters.year !== "all" ||
    facetFilters.region !== "all";

  return (
    <div className="flex gap-6 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder="Search games..."
            className="flex-1 min-w-[200px] max-w-sm"
          />
          <Select
            value={systemFilter}
            onValueChange={handleSystemFilterChange}
          >
            <SelectTrigger className="w-[160px] bg-background border-border text-foreground">
              <SelectValue placeholder="All systems" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all" className="text-foreground focus:bg-accent">
                All systems
              </SelectItem>
              {systems.map((sys) => (
                <SelectItem
                  key={sys.slug}
                  value={sys.slug}
                  className="text-foreground focus:bg-accent"
                >
                  {sys.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(v) => setSort((v ?? "title") as SortOption)}
          >
            <SelectTrigger className="w-[160px] bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="title" className="text-foreground focus:bg-accent">
                Name (A–Z)
              </SelectItem>
              <SelectItem value="title_desc" className="text-foreground focus:bg-accent">
                Name (Z–A)
              </SelectItem>
              <SelectItem value="year_desc" className="text-foreground focus:bg-accent">
                Release date (newest)
              </SelectItem>
              <SelectItem value="year" className="text-foreground focus:bg-accent">
                Release date (oldest)
              </SelectItem>
              <SelectItem value="publisher" className="text-foreground focus:bg-accent">
                Publisher (A–Z)
              </SelectItem>
              <SelectItem value="system" className="text-foreground focus:bg-accent">
                System
              </SelectItem>
              <SelectItem value="rating_desc" className="text-foreground focus:bg-accent">
                Highest rated
              </SelectItem>
              <SelectItem value="recent" className="text-foreground focus:bg-accent">
                Recently added
              </SelectItem>
            </SelectContent>
          </Select>

          {!selectMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectMode(true)}
              className="border-border text-muted-foreground hover:text-foreground hover:border-border"
            >
              <CheckSquare className="h-4 w-4 mr-1.5" />
              Select
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {selected.size} selected
              </span>
              <button
                onClick={selectAll}
                className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300"
              >
                Select all ({filtered.length})
              </button>
              <button
                onClick={deselectAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
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
              <button
                onClick={exitSelectMode}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Result count */}
        {isFiltered && (
          <p className="text-sm text-muted-foreground mb-4">
            {filtered.length.toLocaleString()} result
            {filtered.length !== 1 ? "s" : ""}
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
            <p className="text-muted-foreground text-sm">
              No games match your filters
            </p>
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
                user_rating={game.user_rating}
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
              className="px-3 py-1.5 text-sm rounded-md bg-muted text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground px-2">
              Page {clampedPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={clampedPage >= totalPages}
              className="px-3 py-1.5 text-sm rounded-md bg-muted text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Facet filter sidebar */}
      {facetGroups.length > 0 && (
        <FacetFilterSidebar
          facets={facetGroups}
          activeFilters={facetFilters}
          onFilterChange={handleFacetChange}
          totalCount={games.length}
          filteredCount={filtered.length}
          className="hidden lg:block sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto"
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
