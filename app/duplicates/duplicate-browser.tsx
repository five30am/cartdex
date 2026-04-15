"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteModal } from "@/components/delete-modal";
import { AddToCollectionModal } from "@/components/add-to-collection-modal";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Trash2,
  FolderPlus,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSelectActionBar } from "@/components/multi-select-action-bar";

interface DuplicateEntry {
  id: number;
  title: string;
  file_path: string;
  file_size: number | null;
  file_created_at: string | null;
  region: string;
  hash_sha1: string | null;
  hashed: boolean;
  scraper_region: string | null;
  scraper_languages: string[];
  scraper_is_primary_release: boolean;
  scraper_source: "screenscraper" | "igdb" | null;
}

interface DuplicateGroup {
  canonical_title: string;
  system_id: number;
  system_name: string;
  system_slug: string;
  all_files: DuplicateEntry[];
  recommended_keep_id: number;
  recommended_source: "screenscraper" | "filename";
  recommended_reason: string;
  enrichment_pending: boolean;
}

interface ApiResponse {
  groups: DuplicateGroup[];
  total_groups: number;
  total_duplicates: number;
  page: number;
  pages: number;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Translate container-internal path to the Unraid host path Aaron sees in Finder/SMB.
 * Container: /roms/<platform>/... → Unraid: /mnt/user/data/media/roms/<platform>/...
 */
function toUnraidPath(containerPath: string): string {
  if (containerPath.startsWith("/roms/")) {
    return "/mnt/user/data/media/roms/" + containerPath.slice("/roms/".length);
  }
  return containerPath;
}

function formatFileDate(isoString: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function RegionBadge({ region }: { region: string }) {
  const colors: Record<string, string> = {
    USA: "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700/50",
    USA_EQUIV: "bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 border-blue-200 dark:border-blue-800/50",
    World: "bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-300 border-green-200 dark:border-green-700/50",
    Europe: "bg-purple-50 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-700/50",
    Japan: "bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 border-red-200 dark:border-red-700/50",
    Unknown: "bg-muted text-muted-foreground border-border",
  };
  const label = region === "USA_EQUIV" ? "Americas" : region;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
        colors[region] ?? colors.Unknown
      )}
    >
      {label}
    </span>
  );
}

function HashBadge({ hashed }: { hashed: boolean }) {
  if (hashed) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border bg-muted text-muted-foreground border-border">
        <ShieldCheck className="w-2.5 h-2.5" />
        hashed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
      title="Not yet hashed — hide protection inactive until next scan"
    >
      <AlertTriangle className="w-2.5 h-2.5" />
      not hashed
    </span>
  );
}

export function DuplicateBrowser() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("q", search);
      const res = await fetch(`/api/duplicates?${params}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load duplicates");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  // Silent background refetch — does not set loading state, used for enrichment polling
  const silentRefetch = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("q", search);
      const res = await fetch(`/api/duplicates?${params}`);
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // swallow — polling is best-effort
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Polling effect: while any visible group has enrichment_pending, refetch every 10s
  useEffect(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const anyPending = data?.groups.some((g) => g.enrichment_pending) ?? false;
    if (!anyPending || loading) return;

    pollTimerRef.current = setTimeout(() => {
      silentRefetch();
    }, 10_000);

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [data, loading, silentRefetch]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!data) return;
    // Select all files except the recommended keep in each group
    const ids = data.groups.flatMap((g) =>
      g.all_files.filter((f) => f.id !== g.recommended_keep_id).map((f) => f.id)
    );
    setSelected(new Set(ids));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleHideSelected() {
    const res = await fetch("/api/games/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action: "hide" }),
    });
    const d = await res.json();
    if (res.ok) {
      toast.success(`${d.processed} file${d.processed === 1 ? "" : "s"} hidden`);
      clearSelection();
      fetchData();
    } else {
      toast.error(d.error ?? "Hide failed");
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const selectedGames = data
    ? data.groups
        .flatMap((g) => g.all_files)
        .filter((f) => selected.has(f.id))
        .map((f) => ({ id: f.id, title: f.title }))
    : [];

  function handleRemoveSuccess(ids: number[]) {
    clearSelection();
    toast.success(`${ids.length} file${ids.length === 1 ? "" : "s"} removed from library`);
    fetchData();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-0 max-w-xs">
          <Input
            placeholder="Search games..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50 h-8 text-sm"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={selectAll}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            Select All Duplicates
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {data && !loading && (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {data.total_groups} duplicate group{data.total_groups === 1 ? "" : "s"} &middot;{" "}
            {data.total_duplicates} duplicate{data.total_duplicates === 1 ? "" : "s"} that can be removed
          </p>
          {data.groups.some((g) => g.enrichment_pending) && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Enriching metadata&hellip;
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="py-8 text-center text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && data?.groups.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-muted-foreground font-medium">No duplicates found</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search ? "Try a different search term." : "Your library looks clean."}
          </p>
        </div>
      )}

      {!loading && !error && data && data.groups.length > 0 && (
        <div className="space-y-3">
          {data.groups.map((group) => (
            <div
              key={`${group.system_id}-${group.canonical_title}`}
              className="border border-border rounded-lg overflow-hidden bg-card"
            >
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0 uppercase tracking-wide">
                    {group.system_name}
                  </span>
                  <span className="text-muted-foreground/40 shrink-0">&middot;</span>
                  <span className="text-sm font-medium text-foreground capitalize truncate">
                    {group.canonical_title}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {group.all_files.length} copies
                </span>
              </div>

              <div className="p-3 space-y-2">
                {group.all_files.map((file) => {
                  const isRecommended = file.id === group.recommended_keep_id;
                  return (
                    <label
                      key={file.id}
                      className={cn(
                        "flex flex-col gap-1.5 px-3 py-2 rounded-md cursor-pointer transition-colors",
                        selected.has(file.id)
                          ? "bg-blue-950/30 border border-blue-800/40"
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(file.id)}
                          onChange={() => toggleSelect(file.id)}
                          className="w-3.5 h-3.5 rounded border-border accent-blue-500 shrink-0"
                        />
                        <span className="text-sm text-foreground/80 truncate flex-1 min-w-0">
                          {file.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isRecommended && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-950/40 text-green-500 border-green-800/40 cursor-help"
                              title={group.recommended_reason}
                            >
                              {group.recommended_source === "screenscraper" ? "recommended \u2605" : "recommended"}
                            </span>
                          )}
                          <RegionBadge region={file.region} />
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatBytes(file.file_size)}
                          </span>
                          <HashBadge hashed={file.hashed} />
                        </div>
                      </div>
                      <div className="pl-6 space-y-0.5">
                        <p className="text-[11px] text-muted-foreground font-mono truncate" title={toUnraidPath(file.file_path)}>
                          {toUnraidPath(file.file_path)}
                        </p>
                        <p className="text-[11px] text-muted-foreground/50">
                          Created {formatFileDate(file.file_created_at)}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {data.pages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages || loading}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Modals */}
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        games={selectedGames}
        onHideSuccess={handleRemoveSuccess}
        onTrashSuccess={handleRemoveSuccess}
      />

      <AddToCollectionModal
        open={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        gameIds={[...selected]}
        onSuccess={() => {
          toast.success("Added to collection");
          clearSelection();
        }}
      />

      {/* Floating multi-select action bar — slides in when selection > 0 */}
      <MultiSelectActionBar
        selectedCount={selected.size}
        noun="file"
        onClear={clearSelection}
        actions={[
          {
            label: "Add to Collection",
            icon: <FolderPlus />,
            onClick: () => setCollectionModalOpen(true),
          },
          {
            label: "Hide from Library",
            icon: <EyeOff />,
            onClick: handleHideSelected,
          },
          {
            label: "Move to Trash",
            icon: <Trash2 />,
            variant: "destructive",
            onClick: () => setDeleteModalOpen(true),
          },
        ]}
      />
    </div>
  );
}
