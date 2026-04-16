"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search-bar";
import { GameGrid } from "@/components/game-grid";
import { GameTable } from "@/components/game-table";
import { SelectableGameGrid } from "@/components/selectable-game-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckSquare, FolderPlus, LayoutGrid, List, X } from "lucide-react";
import { AddToCollectionModal } from "@/components/add-to-collection-modal";
import { FacetFilterSidebar, type FacetGroup } from "@/components/facet-filter-sidebar";
import { toast } from "sonner";
import Link from "next/link";

interface Game {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  genre?: string | null;
  verified: boolean;
  hashed?: boolean | null;
  file_size?: number | null;
  hash_crc32?: string | null;
  hash_md5?: string | null;
  hash_sha1?: string | null;
  hash_sha1_stripped?: string | null;
  user_rating?: number | null;
  favorite?: boolean | null;
  publisher?: string | null;
  scraper_region?: string | null;
  created_at: string;
  /** True when this game has a 'have' match in match_results for the system's linked DAT */
  dat_verified?: boolean | null;
}

interface Props {
  games: Game[];
  systemSlug: string;
}

type SortOption =
  | "title"
  | "title_desc"
  | "year"
  | "year_desc"
  | "publisher"
  | "rating_desc"
  | "recent";

interface FacetFilters {
  genre: string;
  publisher: string;
  year: string;
  region: string;
}

// Apply all filters except the one named by `excludeKey`.
function applyFiltersExcept(
  games: Game[],
  search: string,
  facets: FacetFilters,
  excludeKey: keyof FacetFilters | null
): Game[] {
  let result = games;

  if (search) {
    const lower = search.toLowerCase();
    result = result.filter((g) => g.title.toLowerCase().includes(lower));
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

function countBy<T>(
  arr: T[],
  key: (item: T) => string | null | undefined
): Map<string, number> {
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

export function SystemGamesClient({ games, systemSlug }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialSort = (searchParams.get("sort") as SortOption) || "title";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [facetFilters, setFacetFilters] = useState<FacetFilters>({
    genre: "all",
    publisher: "all",
    year: "all",
    region: "all",
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  // View mode — "grid" (default) or "table", persisted in localStorage.
  // Initialise from storage on mount; default to "grid" so SSR and first render match.
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    const stored = localStorage.getItem("system-view-mode");
    if (stored === "table" || stored === "grid") {
      setViewMode(stored);
    }
  }, []);

  function handleViewModeChange(mode: "grid" | "table") {
    setViewMode(mode);
    localStorage.setItem("system-view-mode", mode);
    // Exit select mode when switching to table — SelectableGameGrid is grid-only.
    if (mode === "table") {
      exitSelectMode();
    }
  }

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

  function handleFacetChange(key: keyof FacetFilters, value: string) {
    setFacetFilters((prev) => ({ ...prev, [key]: value }));
  }

  // Fully filtered result
  const filtered = useMemo(() => {
    let result = applyFiltersExcept(games, search, facetFilters, null);

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
            return (
              b.user_rating - a.user_rating || a.title.localeCompare(b.title)
            );
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
  }, [games, search, facetFilters, sort]);

  // Per-group facet counts
  const facetGroups = useMemo<FacetGroup[]>(() => {
    const forGenre = applyFiltersExcept(games, search, facetFilters, "genre");
    const forPublisher = applyFiltersExcept(games, search, facetFilters, "publisher");
    const forYear = applyFiltersExcept(games, search, facetFilters, "year");
    const forRegion = applyFiltersExcept(games, search, facetFilters, "region");

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
        ).sort((a, b) => b.value.localeCompare(a.value)),
      },
      {
        key: "region",
        label: "Region",
        poolCount: forRegion.length,
        options: topOptions(countBy(forRegion, (g) => g.scraper_region)),
      },
    ].filter((group) => group.options.length > 0);
  }, [games, search, facetFilters]);

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
    <div className="flex gap-6 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search the archives..."
            className="flex-1 max-w-sm"
          />
          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger
              className="w-[180px]"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "0.875rem",
                letterSpacing: "1px",
                color: "var(--text-primary)",
                background: "var(--card-bg)",
                border: "1px solid var(--panel-border)",
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              style={{
                background: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
              }}
            >
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
              <SelectItem value="rating_desc" className="text-foreground focus:bg-accent">
                Highest rated
              </SelectItem>
              <SelectItem value="recent" className="text-foreground focus:bg-accent">
                Recently added
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Grid / table view toggle */}
          <div
            role="group"
            aria-label="View mode"
            className="flex items-center overflow-hidden shrink-0 rounded"
            style={{ border: "1px solid var(--panel-border)" }}
          >
            <button
              onClick={() => handleViewModeChange("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className="flex items-center justify-center px-2.5 py-1.5 transition-colors"
              style={{
                background: viewMode === "grid" ? "rgba(196,164,108,0.12)" : "transparent",
                color: viewMode === "grid" ? "var(--sand)" : "var(--text-dim)",
              }}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => handleViewModeChange("table")}
              aria-label="Table view"
              aria-pressed={viewMode === "table"}
              className="flex items-center justify-center px-2.5 py-1.5 transition-colors"
              style={{
                borderLeft: "1px solid var(--panel-border)",
                background: viewMode === "table" ? "rgba(196,164,108,0.12)" : "transparent",
                color: viewMode === "table" ? "var(--sand)" : "var(--text-dim)",
              }}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {!selectMode && viewMode !== "table" ? (
            <button
              onClick={() => setSelectMode(true)}
              className="sw-nav-btn"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "0.8125rem",
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                background: "transparent",
                border: "1px solid var(--panel-border)",
                padding: "6px 14px",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CheckSquare className="h-4 w-4" />
              Select
            </button>
          ) : !selectMode ? null : (
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "0.8125rem",
                  color: "var(--text-dim)",
                }}
              >
                {selected.size} selected
              </span>
              <button
                onClick={selectAll}
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "0.75rem",
                  color: "var(--accent-blue)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Select all
              </button>
              <button
                onClick={deselectAll}
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "0.75rem",
                  color: "var(--text-dim)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Deselect all
              </button>
              {selected.size > 0 && (
                <Button
                  size="sm"
                  onClick={() => setShowCollectionModal(true)}
                  style={{
                    background: "var(--ochre)",
                    color: "var(--dark-bg)",
                    height: 28,
                    fontSize: "0.75rem",
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                  Add to Collection
                </Button>
              )}
              <button
                onClick={exitSelectMode}
                style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {search && (
          <p
            className="mb-4"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: "0.8125rem",
              color: "var(--text-dim)",
            }}
          >
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for
            &ldquo;{search}&rdquo;
          </p>
        )}

        {selectMode ? (
          <SelectableGameGrid
            games={filtered}
            selected={selected}
            onToggle={toggleSelect}
            emptyMessage={
              search ? `No games matching "${search}"` : "No games in this system"
            }
          />
        ) : viewMode === "table" ? (
          <GameTable
            games={filtered}
            emptyMessage={
              search ? `No games matching "${search}"` : "No games in this system"
            }
          />
        ) : (
          <GameGrid
            games={filtered}
            emptyMessage={
              search ? `No games matching "${search}"` : "No games in this system"
            }
          />
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
