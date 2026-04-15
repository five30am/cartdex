"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Database,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
}

interface UploadState {
  state: "idle" | "uploading" | "done" | "error";
  message: string | null;
  warnings: string[];
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
  const [upload, setUpload] = useState<UploadState>({
    state: "idle",
    message: null,
    warnings: [],
  });

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

  useEffect(() => {
    fetchDats();
  }, []);

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

          {/* Import button */}
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
              disabled={upload.state === "uploading"}
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
