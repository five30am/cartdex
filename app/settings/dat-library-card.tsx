"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Database,
  Trash2,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  Link2,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mutationHeaders } from "@/lib/api-token";

interface DatRow {
  id: number;
  name: string;
  version: string | null;
  description: string | null;
  source_kind: "upload" | "fetch";
  imported_at: string;
  entry_count: number;
  skipper_ref: string | null;
  system_id: number | null;
}

interface SystemOption {
  id: number;
  name: string;
  slug: string;
}

interface UploadState {
  state: "idle" | "uploading" | "done" | "error";
  message: string | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Provider configuration — kept in sync with dat-fetch-providers/index.ts.
// The UI does not import the server-side provider registry directly (that
// module uses Node-only APIs). This minimal descriptor is duplicated here.
// ---------------------------------------------------------------------------

interface ProviderDescriptor {
  id: string;
  name: string;
  license: string;
  sourceUrl: string;
}

const FETCH_PROVIDERS: ProviderDescriptor[] = [
  {
    id: "libretro-database",
    name: "libretro-database",
    license: "MIT",
    sourceUrl: "https://github.com/libretro/libretro-database",
  },
];

interface FetchState {
  state: "idle" | "fetching" | "done" | "error";
  message: string | null;
  warnings: string[];
}

// Known systems for the libretro-database provider — subset shown in the
// dropdown. Full list lives in libretro-database.ts on the server.
const LIBRETRO_SYSTEMS: Array<{ slug: string; label: string }> = [
  { slug: "nes", label: "NES" },
  { slug: "snes", label: "SNES" },
  { slug: "gb", label: "Game Boy" },
  { slug: "gbc", label: "Game Boy Color" },
  { slug: "gba", label: "Game Boy Advance" },
  { slug: "n64", label: "Nintendo 64" },
  { slug: "nds", label: "Nintendo DS" },
  { slug: "genesis", label: "Sega Genesis" },
  { slug: "sms", label: "Sega Master System" },
  { slug: "gamegear", label: "Game Gear" },
  { slug: "saturn", label: "Saturn" },
  { slug: "dreamcast", label: "Dreamcast" },
  { slug: "ps1", label: "PlayStation" },
  { slug: "psp", label: "PSP" },
  { slug: "atari2600", label: "Atari 2600" },
  { slug: "atari7800", label: "Atari 7800" },
  { slug: "atarilynx", label: "Atari Lynx" },
  { slug: "pce", label: "PC Engine / TurboGrafx-16" },
];

// ---------------------------------------------------------------------------
// DAT diff types — mirror the GET /api/dats/[id]/diffs response shape
// ---------------------------------------------------------------------------

interface DiffTimelineEntry {
  id: number;
  dat_name: string;
  from_dat_id: number;
  to_dat_id: number;
  computed_at: string;
  added_count: number;
  removed_count: number;
  changed_count: number;
}

interface DiffDetailEntry {
  id: number;
  change_type: "added" | "removed" | "status_changed";
  entry_name: string;
  crc32: string | null;
  sha1: string | null;
  prev_status: "good" | "baddump" | "nodump" | null;
  new_status: "good" | "baddump" | "nodump" | null;
}

interface DiffEntriesPage {
  diff_id: number;
  total: number;
  limit: number;
  offset: number;
  change_type: string | null;
  items: DiffDetailEntry[];
}

interface DiffApiResponse {
  dat_id: number;
  dat_name: string;
  timeline: DiffTimelineEntry[];
  entries?: DiffEntriesPage;
}

// ---------------------------------------------------------------------------
// Diff detail state — keyed by diffId, stores accumulated pages
// ---------------------------------------------------------------------------

interface DiffDetailState {
  items: DiffDetailEntry[];
  total: number;
  loading: boolean;
  activeTab: "added" | "removed" | "status_changed";
}

// ---------------------------------------------------------------------------
// Utility: relative time ("2 days ago")
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// DiffSummaryChip — "+12 / -0 / Δ3" with color coding
// ---------------------------------------------------------------------------

function DiffSummaryChip({
  added,
  removed,
  changed,
}: {
  added: number;
  removed: number;
  changed: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums">
      <span
        className={cn(
          "px-1.5 py-0.5 rounded border",
          added > 0
            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25 dark:border-emerald-500/30"
            : "text-muted-foreground/50 bg-muted/30 border-border"
        )}
      >
        +{added}
      </span>
      <span
        className={cn(
          "px-1.5 py-0.5 rounded border",
          removed > 0
            ? "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/25 dark:border-red-500/30"
            : "text-muted-foreground/50 bg-muted/30 border-border"
        )}
      >
        -{removed}
      </span>
      {changed > 0 && (
        <span className="px-1.5 py-0.5 rounded border text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/25 dark:border-amber-500/30">
          Δ{changed}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusPill — shows a ROM status label
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: "good" | "baddump" | "nodump" | null }) {
  if (!status) return null;
  const styles: Record<string, string> = {
    good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/30",
    baddump:
      "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25 dark:border-red-500/30",
    nodump:
      "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/25 dark:border-zinc-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium",
        styles[status] ?? "bg-muted text-muted-foreground border-border"
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DatDiffTimeline — collapsible history panel for a single DAT row
// ---------------------------------------------------------------------------

const DETAIL_PAGE_SIZE = 50;

function DatDiffTimeline({ datId }: { datId: number }) {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState<DiffTimelineEntry[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Which diff event is expanded to show per-entry details
  const [expandedDiffId, setExpandedDiffId] = useState<number | null>(null);
  // Per-diff detail state — each diffId gets its own page accumulator
  const [diffDetails, setDiffDetails] = useState<Record<number, DiffDetailState>>({});

  // Lazy-load timeline on first open
  useEffect(() => {
    if (!open || timeline !== null) return;
    let cancelled = false;
    setTimelineLoading(true);
    setTimelineError(null);

    fetch(`/api/dats/${datId}/diffs`)
      .then((r) => r.json() as Promise<DiffApiResponse>)
      .then((data) => {
        if (cancelled) return;
        setTimeline(data.timeline ?? []);
      })
      .catch(() => {
        if (!cancelled) setTimelineError("Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, datId, timeline]);

  // Load the first page of entries when a diff is expanded
  const loadDiffDetail = useCallback(
    (diffId: number, tab: "added" | "removed" | "status_changed", offset = 0) => {
      setDiffDetails((prev) => {
        const current = prev[diffId];
        // If same tab + same page already loading/loaded, skip
        if (current?.loading) return prev;
        return {
          ...prev,
          [diffId]: {
            items: offset === 0 ? [] : current?.items ?? [],
            total: current?.total ?? 0,
            loading: true,
            activeTab: tab,
          },
        };
      });

      const url = `/api/dats/${datId}/diffs?diff_id=${diffId}&change_type=${tab}&limit=${DETAIL_PAGE_SIZE}&offset=${offset}`;

      fetch(url)
        .then((r) => r.json() as Promise<DiffApiResponse>)
        .then((data) => {
          const page = data.entries;
          if (!page) return;
          setDiffDetails((prev) => {
            const current = prev[diffId];
            const existingItems = offset === 0 ? [] : current?.items ?? [];
            return {
              ...prev,
              [diffId]: {
                items: [...existingItems, ...page.items],
                total: page.total,
                loading: false,
                activeTab: tab,
              },
            };
          });
        })
        .catch(() => {
          setDiffDetails((prev) => ({
            ...prev,
            [diffId]: { ...prev[diffId], loading: false },
          }));
        });
    },
    [datId]
  );

  const handleToggleDiff = useCallback(
    (diffId: number, added: number, removed: number, changed: number) => {
      if (expandedDiffId === diffId) {
        setExpandedDiffId(null);
        return;
      }
      setExpandedDiffId(diffId);
      // Determine initial tab: prefer the first non-zero bucket
      const initialTab: "added" | "removed" | "status_changed" =
        added > 0 ? "added" : removed > 0 ? "removed" : changed > 0 ? "status_changed" : "added";
      loadDiffDetail(diffId, initialTab, 0);
    },
    [expandedDiffId, loadDiffDetail]
  );

  const handleTabChange = useCallback(
    (diffId: number, tab: "added" | "removed" | "status_changed") => {
      loadDiffDetail(diffId, tab, 0);
    },
    [loadDiffDetail]
  );

  const handleLoadMore = useCallback(
    (diffId: number) => {
      const detail = diffDetails[diffId];
      if (!detail || detail.loading) return;
      loadDiffDetail(diffId, detail.activeTab, detail.items.length);
    },
    [diffDetails, loadDiffDetail]
  );

  // Only show the toggle once we know there's history (or it's open and loading)
  // Before first open, we don't know — render a lightweight "History" button
  // that triggers the load. After load, if timeline is empty, we hide it entirely.
  if (timeline !== null && timeline.length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors",
          open && "text-muted-foreground"
        )}
        aria-expanded={open}
      >
        <History className="w-3 h-3" />
        <span>History</span>
        <ChevronDown
          className={cn(
            "w-2.5 h-2.5 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-2 pl-4 border-l border-border space-y-1">
          {timelineLoading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 py-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading history…</span>
            </div>
          )}

          {timelineError && (
            <p className="text-xs text-red-400 py-1">{timelineError}</p>
          )}

          {timeline !== null && timeline.length > 0 && (
            <div className="space-y-1.5">
              {timeline.map((entry) => {
                const isExpanded = expandedDiffId === entry.id;
                const detail = diffDetails[entry.id];
                return (
                  <div key={entry.id} className="space-y-1.5">
                    {/* Diff event row */}
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleDiff(
                          entry.id,
                          entry.added_count,
                          entry.removed_count,
                          entry.changed_count
                        )
                      }
                      className={cn(
                        "w-full flex items-center gap-2.5 text-left px-2 py-1.5 rounded-md transition-colors",
                        isExpanded
                          ? "bg-muted/60"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          "w-3 h-3 text-muted-foreground/50 shrink-0 transition-transform duration-150",
                          isExpanded && "rotate-90"
                        )}
                      />
                      <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0 w-16">
                        {relativeTime(entry.computed_at)}
                      </span>
                      <DiffSummaryChip
                        added={entry.added_count}
                        removed={entry.removed_count}
                        changed={entry.changed_count}
                      />
                    </button>

                    {/* Per-entry detail panel */}
                    {isExpanded && (
                      <div className="ml-5 space-y-2">
                        {/* Sub-tabs */}
                        <div className="flex gap-1">
                          {(
                            [
                              { key: "added", label: "Added", count: entry.added_count },
                              { key: "removed", label: "Removed", count: entry.removed_count },
                              {
                                key: "status_changed",
                                label: "Status changed",
                                count: entry.changed_count,
                              },
                            ] as const
                          )
                            .filter((t) => t.count > 0)
                            .map((tab) => (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => handleTabChange(entry.id, tab.key)}
                                className={cn(
                                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                                  detail?.activeTab === tab.key
                                    ? "bg-muted text-foreground border-border"
                                    : "text-muted-foreground border-transparent hover:border-border hover:bg-muted/40"
                                )}
                              >
                                {tab.label}
                                <span className="ml-1 text-muted-foreground/60 font-mono">
                                  {tab.count}
                                </span>
                              </button>
                            ))}
                        </div>

                        {/* Entry list */}
                        {detail?.loading && detail.items.length === 0 ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 py-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Loading entries…</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {(detail?.items ?? []).map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start gap-2 px-2 py-1 rounded text-xs bg-muted/20 hover:bg-muted/40 transition-colors"
                              >
                                <span className="font-mono text-foreground/80 truncate flex-1 min-w-0">
                                  {item.entry_name}
                                </span>
                                {/* Hash — prefer sha1, fall back to crc32 */}
                                {(item.sha1 || item.crc32) && (
                                  <span
                                    className="font-mono text-[10px] text-muted-foreground/50 shrink-0"
                                    title={item.sha1 ? `SHA1: ${item.sha1}` : `CRC32: ${item.crc32}`}
                                  >
                                    {(item.sha1 ?? item.crc32 ?? "").slice(0, 8)}
                                  </span>
                                )}
                                {/* Status transition for status_changed */}
                                {item.change_type === "status_changed" &&
                                  item.prev_status &&
                                  item.new_status && (
                                    <span className="flex items-center gap-1 shrink-0">
                                      <StatusPill status={item.prev_status} />
                                      <span className="text-muted-foreground/40 text-[10px]">→</span>
                                      <StatusPill status={item.new_status} />
                                    </span>
                                  )}
                                {/* new_status for added */}
                                {item.change_type === "added" && item.new_status && (
                                  <StatusPill status={item.new_status} />
                                )}
                                {/* prev_status for removed */}
                                {item.change_type === "removed" && item.prev_status && (
                                  <StatusPill status={item.prev_status} />
                                )}
                              </div>
                            ))}

                            {/* Empty state when a tab has no entries */}
                            {!detail?.loading &&
                              detail?.items.length === 0 && (
                                <p className="text-xs text-muted-foreground/50 py-1 px-2">
                                  No entries in this category.
                                </p>
                              )}

                            {/* Load more */}
                            {detail &&
                              !detail.loading &&
                              detail.items.length < detail.total && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleLoadMore(entry.id)}
                                  className="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-muted-foreground mt-1 w-full justify-start gap-1"
                                >
                                  Load more ({detail.total - detail.items.length} remaining)
                                </Button>
                              )}

                            {detail?.loading && detail.items.length > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 py-1 px-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Loading…</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DatLibraryCard() {
  const [dats, setDats] = useState<DatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [upload, setUpload] = useState<UploadState>({
    state: "idle",
    message: null,
    warnings: [],
  });
  const [fetchState, setFetchState] = useState<FetchState>({
    state: "idle",
    message: null,
    warnings: [],
  });
  const [fetchDropdownOpen, setFetchDropdownOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderDescriptor>(FETCH_PROVIDERS[0]);
  const [selectedSystem, setSelectedSystem] = useState<string>("");
  const fetchDropdownRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchDats() {
    try {
      const data: DatRow[] = await fetch("/api/dats").then((r) => r.json());
      setDats(Array.isArray(data) ? data : []);
    } catch {
      setDats([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSystems() {
    try {
      const data: SystemOption[] = await fetch("/api/systems").then((r) => r.json());
      setSystems(Array.isArray(data) ? data : []);
    } catch {
      setSystems([]);
    }
  }

  useEffect(() => {
    fetchDats();
    fetchSystems();
  }, []);

  async function handleLinkSystem(datId: number, systemId: number | null) {
    if (linkingId !== null) return;
    setLinkingId(datId);
    try {
      const res = await fetch(`/api/dats/${datId}`, {
        method: "PATCH",
        headers: { ...(await mutationHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ system_id: systemId }),
      });
      if (res.ok) {
        setDats((prev) =>
          prev.map((d) => (d.id === datId ? { ...d, system_id: systemId } : d))
        );
      }
    } catch {
      // ignore
    } finally {
      setLinkingId(null);
    }
  }

  // Close fetch dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        fetchDropdownRef.current &&
        !fetchDropdownRef.current.contains(e.target as Node)
      ) {
        setFetchDropdownOpen(false);
      }
    }
    if (fetchDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [fetchDropdownOpen]);

  async function handleUpload(file: File) {
    setUpload({ state: "uploading", message: null, warnings: [] });

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/dats", { method: "POST", headers: await mutationHeaders(), body: form });
      const data = await res.json();

      if (res.ok) {
        setUpload({
          state: "done",
          message: `Imported "${data.name}" — ${(data.entry_count as number).toLocaleString()} entries`,
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
        });
        await fetchDats();
        setTimeout(() => setUpload({ state: "idle", message: null, warnings: [] }), 6000);
      } else {
        setUpload({
          state: "error",
          message: data.error ?? "Upload failed",
          warnings: [],
        });
      }
    } catch (err) {
      setUpload({
        state: "error",
        message: err instanceof Error ? err.message : "Upload failed",
        warnings: [],
      });
    }

    // Reset file input so the same file can be re-selected after an error
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFetch() {
    if (!selectedSystem) {
      setFetchState({
        state: "error",
        message: "Select a system before fetching",
        warnings: [],
      });
      return;
    }

    setFetchDropdownOpen(false);
    setFetchState({ state: "fetching", message: null, warnings: [] });

    try {
      const res = await fetch("/api/dats/fetch", {
        method: "POST",
        headers: { ...(await mutationHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProvider.id,
          systems: [selectedSystem],
        }),
      });

      const data = await res.json();

      if (res.ok && Array.isArray(data.results) && data.results.length > 0) {
        const result = data.results[0] as {
          status: string;
          name?: string;
          entry_count?: number;
          dat_id?: number;
          warnings?: string[];
          error?: string;
        };

        if (result.status === "ingested") {
          setFetchState({
            state: "done",
            message: `Fetched "${result.name}" — ${(result.entry_count ?? 0).toLocaleString()} entries`,
            warnings: Array.isArray(result.warnings) ? result.warnings : [],
          });
          await fetchDats();
          setTimeout(() => setFetchState({ state: "idle", message: null, warnings: [] }), 6000);
        } else if (result.status === "duplicate") {
          setFetchState({
            state: "done",
            message: "Already up to date — this DAT version is already in the library",
            warnings: [],
          });
          setTimeout(() => setFetchState({ state: "idle", message: null, warnings: [] }), 5000);
        } else {
          setFetchState({
            state: "error",
            message: result.error ?? "Fetch failed",
            warnings: [],
          });
        }
      } else {
        setFetchState({
          state: "error",
          message: data.error ?? "Fetch failed",
          warnings: [],
        });
      }
    } catch (err) {
      setFetchState({
        state: "error",
        message: err instanceof Error ? err.message : "Fetch failed",
        warnings: [],
      });
    }
  }

  async function handleDelete(id: number) {
    if (deletingId !== null) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/dats/${id}`, { method: "DELETE", headers: await mutationHeaders() });
      if (res.ok) {
        setDats((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // ignore — user can retry
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="bg-card border-border shadow-none rounded-xl overflow-hidden">
      <CardHeader className="px-5 pt-4 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="text-muted-foreground">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">DAT Library</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Logiqx XML and ClrMamePro DAT files for ROM set auditing
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Import DAT (manual upload) */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dat,.xml,.txt"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={upload.state === "uploading" || fetchState.state === "fetching"}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 text-xs gap-1.5 text-muted-foreground border border-border hover:text-foreground hover:bg-accent"
              >
                {upload.state === "uploading" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                {upload.state === "uploading" ? "Importing…" : "Import DAT"}
              </Button>
            </div>

            {/* Fetch from provider — permissive sources only */}
            <div className="relative" ref={fetchDropdownRef}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={fetchState.state === "fetching" || upload.state === "uploading"}
                onClick={() => setFetchDropdownOpen((prev) => !prev)}
                className="h-8 px-3 text-xs gap-1.5 text-muted-foreground border border-border hover:text-foreground hover:bg-accent"
              >
                {fetchState.state === "fetching" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                {fetchState.state === "fetching" ? "Fetching…" : "Fetch from…"}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>

              {fetchDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-card shadow-lg p-3 space-y-3">
                  {/* Licensing disclaimer */}
                  <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                    <Info className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300/80 leading-relaxed">
                      <span className="font-medium text-blue-300">libretro-database</span> is
                      MIT-licensed. DAT contents are redistributed per that license.{" "}
                      <a
                        href="https://github.com/libretro/libretro-database"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-blue-200"
                      >
                        Source
                      </a>
                    </p>
                  </div>

                  {/* Provider selector — single provider in v1 */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Provider</label>
                    <select
                      value={selectedProvider.id}
                      onChange={(e) => {
                        const p = FETCH_PROVIDERS.find((p) => p.id === e.target.value);
                        if (p) setSelectedProvider(p);
                      }}
                      className="w-full h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    >
                      {FETCH_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.license})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* System selector */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">System</label>
                    <select
                      value={selectedSystem}
                      onChange={(e) => setSelectedSystem(e.target.value)}
                      className="w-full h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    >
                      <option value="">— select a system —</option>
                      {LIBRETRO_SYSTEMS.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedSystem}
                    onClick={handleFetch}
                    className="w-full h-7 text-xs"
                  >
                    Fetch DAT
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pt-4 pb-5">
        <div className="border-t border-border pt-4 space-y-3">
          {/* Upload status */}
          {upload.state === "done" && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                <span>{upload.message}</span>
              </div>
              {upload.warnings.length > 0 && (
                <div className="pl-4 space-y-0.5">
                  {upload.warnings.slice(0, 5).map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400/80">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span className="font-mono break-all">{w}</span>
                    </div>
                  ))}
                  {upload.warnings.length > 5 && (
                    <p className="text-xs text-muted-foreground pl-4.5">
                      +{upload.warnings.length - 5} more warnings
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {upload.state === "error" && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="w-3 h-3 flex-shrink-0" />
              <span>{upload.message}</span>
            </div>
          )}

          {/* Fetch status */}
          {fetchState.state === "done" && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                <span>{fetchState.message}</span>
              </div>
              {fetchState.warnings.length > 0 && (
                <div className="pl-4 space-y-0.5">
                  {fetchState.warnings.slice(0, 5).map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400/80">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span className="font-mono break-all">{w}</span>
                    </div>
                  ))}
                  {fetchState.warnings.length > 5 && (
                    <p className="text-xs text-muted-foreground pl-4.5">
                      +{fetchState.warnings.length - 5} more warnings
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {fetchState.state === "error" && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="w-3 h-3 flex-shrink-0" />
              <span>{fetchState.message}</span>
            </div>
          )}

          {/* DAT list */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-muted/40 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : dats.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-2">
              No DAT files imported yet. Upload a Logiqx XML or ClrMamePro DAT to get started.
            </p>
          ) : (
            <div className="space-y-1.5">
              {dats.map((dat) => (
                <div
                  key={dat.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                    "bg-muted/30 hover:bg-muted/50 transition-colors"
                  )}
                >
                  {/* DAT info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {dat.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {dat.version && (
                        <span className="text-xs text-muted-foreground font-mono">
                          v{dat.version}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {dat.entry_count.toLocaleString()} entries
                      </span>
                      <span className="text-xs text-muted-foreground/50">
                        {formatDate(dat.imported_at)}
                      </span>
                      {dat.skipper_ref && (
                        <span
                          className="text-xs text-blue-400/70 font-mono"
                          title={`Skipper: ${dat.skipper_ref}`}
                        >
                          header-strip
                        </span>
                      )}
                    </div>
                    <DatDiffTimeline datId={dat.id} />
                  </div>

                  {/* System link dropdown */}
                  {systems.length > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link2 className="w-3 h-3 text-muted-foreground/40" />
                      <select
                        value={dat.system_id ?? ""}
                        disabled={linkingId === dat.id}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleLinkSystem(dat.id, val === "" ? null : parseInt(val, 10));
                        }}
                        className="h-6 rounded border border-border bg-background px-1.5 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        aria-label={`Link ${dat.name} to system`}
                        title="Link to system"
                      >
                        <option value="">— unlinked —</option>
                        {systems.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Delete */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deletingId === dat.id}
                    onClick={() => handleDelete(dat.id)}
                    className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-red-400 hover:bg-transparent flex-shrink-0"
                    aria-label={`Delete ${dat.name}`}
                  >
                    {deletingId === dat.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
