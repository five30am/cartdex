"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteModal } from "@/components/delete-modal";
import { AddToCollectionModal } from "@/components/add-to-collection-modal";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DuplicateEntry {
  id: number;
  title: string;
  file_path: string;
  file_size: number | null;
  file_created_at: string | null;
  region: string;
  hash_sha1: string | null;
  hashed: boolean;
}

interface DuplicateGroup {
  canonical_title: string;
  system_id: number;
  system_name: string;
  system_slug: string;
  all_files: DuplicateEntry[];
  recommended_keep_id: number;
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
    USA: "bg-blue-900/50 text-blue-300 border-blue-700/50",
    USA_EQUIV: "bg-blue-900/30 text-blue-400 border-blue-800/50",
    World: "bg-green-900/50 text-green-300 border-green-700/50",
    Europe: "bg-purple-900/50 text-purple-300 border-purple-700/50",
    Japan: "bg-red-900/50 text-red-300 border-red-700/50",
    Unknown: "bg-neutral-800 text-neutral-500 border-neutral-700",
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
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border bg-neutral-800 text-neutral-400 border-neutral-700">
        <ShieldCheck className="w-2.5 h-2.5" />
        hashed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border bg-amber-950/40 text-amber-400 border-amber-800/50"
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
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

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

  useEffect(() => { fetchData(); }, [fetchData]);

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
    setBulkMenuOpen(false);
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
            className="bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 h-8 text-sm"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={selectAll}
            className="text-xs text-neutral-400 hover:text-neutral-200 h-8"
          >
            Select All Duplicates
          </Button>

          {/* Bulk Actions */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkMenuOpen((v) => !v)}
              disabled={selected.size === 0}
              className="h-8 text-xs border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
            >
              {selected.size > 0 ? `${selected.size} selected` : "Bulk Actions"}
              <ChevronDown className="w-3 h-3 ml-1.5" />
            </Button>
            {bulkMenuOpen && selected.size > 0 && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg z-20 py-1">
                <button
                  className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                  onClick={() => { setBulkMenuOpen(false); setCollectionModalOpen(true); }}
                >
                  Add to Collection...
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                  onClick={async () => {
                    setBulkMenuOpen(false);
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
                  }}
                >
                  Hide from Library
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-neutral-800"
                  onClick={() => { setBulkMenuOpen(false); setDeleteModalOpen(true); }}
                >
                  Move to Trash
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      {data && !loading && (
        <p className="text-xs text-neutral-600">
          {data.total_groups} duplicate group{data.total_groups === 1 ? "" : "s"} &middot;{" "}
          {data.total_duplicates} duplicate{data.total_duplicates === 1 ? "" : "s"} that can be removed
        </p>
      )}

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-neutral-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="py-8 text-center text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && data?.groups.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-neutral-400 font-medium">No duplicates found</p>
          <p className="text-sm text-neutral-600 mt-1">
            {search ? "Try a different search term." : "Your library looks clean."}
          </p>
        </div>
      )}

      {!loading && !error && data && data.groups.length > 0 && (
        <div className="space-y-3">
          {data.groups.map((group) => (
            <div
              key={`${group.system_id}-${group.canonical_title}`}
              className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-950"
            >
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/60 border-b border-neutral-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-blue-400 shrink-0 uppercase tracking-wide">
                    {group.system_name}
                  </span>
                  <span className="text-neutral-600 shrink-0">&middot;</span>
                  <span className="text-sm font-medium text-neutral-200 capitalize truncate">
                    {group.canonical_title}
                  </span>
                </div>
                <span className="text-xs text-neutral-600 shrink-0 ml-2">
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
                          : "hover:bg-neutral-900 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(file.id)}
                          onChange={() => toggleSelect(file.id)}
                          className="w-3.5 h-3.5 rounded border-neutral-600 accent-blue-500 shrink-0"
                        />
                        <span className="text-sm text-neutral-300 truncate flex-1 min-w-0">
                          {file.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isRecommended && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-950/40 text-green-500 border-green-800/40">
                              recommended
                            </span>
                          )}
                          <RegionBadge region={file.region} />
                          <span className="text-xs text-neutral-600 font-mono">
                            {formatBytes(file.file_size)}
                          </span>
                          <HashBadge hashed={file.hashed} />
                        </div>
                      </div>
                      <div className="pl-6 space-y-0.5">
                        <p className="text-[11px] text-neutral-600 font-mono truncate" title={toUnraidPath(file.file_path)}>
                          {toUnraidPath(file.file_path)}
                        </p>
                        <p className="text-[11px] text-neutral-700">
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
            className="h-7 w-7 p-0 text-neutral-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-neutral-500">
            {page} / {data.pages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages || loading}
            className="h-7 w-7 p-0 text-neutral-400"
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
    </div>
  );
}
