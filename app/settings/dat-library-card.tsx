"use client";

import { useEffect, useRef, useState } from "react";
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
  Info,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch("/api/dats", { method: "POST", body: form });
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
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`/api/dats/${id}`, { method: "DELETE" });
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
