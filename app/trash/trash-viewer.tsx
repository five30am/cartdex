"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RotateCcw, Trash2, Clock, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TrashEntry {
  operation_id: number;
  game_id: number | null;
  file_path_current: string;
  file_path_original: string;
  trashed_at: string;
  days_remaining: number;
  hash_sha1: string | null;
  game_title: string | null;
  system_slug: string | null;
}

interface TrashResponse {
  entries: TrashEntry[];
}

export function TrashViewer() {
  const [data, setData] = useState<TrashResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trash");
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleRestore(entry: TrashEntry) {
    if (!entry.game_id) return;
    setActionId(entry.operation_id);
    try {
      const res = await fetch(`/api/games/${entry.game_id}/restore`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Restore failed");
        return;
      }
      toast.success(`Restored: ${entry.game_title ?? entry.file_path_original}`);
      fetchData();
    } catch {
      toast.error("Request failed");
    } finally {
      setActionId(null);
    }
  }

  async function handlePurgeConfirm() {
    if (!purgeTarget?.game_id) return;
    const target = purgeTarget;
    setPurgeTarget(null);
    setActionId(target.operation_id);
    try {
      const res = await fetch(`/api/games/${target.game_id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Purge failed");
        return;
      }
      toast.success(`Purged: ${target.game_title ?? target.file_path_original}`);
      fetchData();
    } catch {
      toast.error("Request failed");
    } finally {
      setActionId(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="py-8 text-center text-sm text-red-400">{error}</div>;
  }

  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <Trash2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">Trash is empty</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          Files moved to trash from the Duplicate Browser will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-muted-foreground mb-4">
        {entries.length} file{entries.length === 1 ? "" : "s"} &middot; 30-day retention &middot; auto-purge daily
      </p>

      <div className="space-y-2">
        {entries.map((entry) => {
          const isExpiringSoon = entry.days_remaining <= 3;
          const isExpired = entry.days_remaining === 0;
          const busy = actionId === entry.operation_id;

          return (
            <div
              key={entry.operation_id}
              className={cn(
                "border rounded-lg px-4 py-3 flex items-start gap-4",
                isExpired
                  ? "border-red-400/40 dark:border-red-800/60 bg-red-50 dark:bg-red-950/10"
                  : isExpiringSoon
                  ? "border-amber-400/40 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/10"
                  : "border-border bg-card"
              )}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {entry.game_title ?? entry.file_path_original.split("/").pop()}
                  </span>
                  {entry.system_slug && (
                    <span className="text-xs text-muted-foreground shrink-0 uppercase font-mono">
                      {entry.system_slug}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>Trashed {formatDate(entry.trashed_at)}</span>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span
                    className={cn(
                      isExpired
                        ? "text-red-400 font-medium"
                        : isExpiringSoon
                        ? "text-amber-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {isExpired ? "Expired" : `${entry.days_remaining} days remaining`}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground/50 truncate font-mono">
                  {entry.file_path_original}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {entry.game_id ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRestore(entry)}
                      disabled={busy}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Restore
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPurgeTarget(entry)}
                      disabled={busy}
                      className="h-7 text-xs text-red-500 hover:text-red-300 hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Purge Now
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">game row deleted</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Single-confirm Purge dialog */}
      <Dialog open={!!purgeTarget} onOpenChange={(v) => !v && setPurgeTarget(null)}>
        <DialogContent className="bg-popover border-border text-popover-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Permanently delete?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            This will permanently delete{" "}
            <span className="font-medium text-foreground">
              {purgeTarget?.game_title ?? purgeTarget?.file_path_original.split("/").pop()}
            </span>{" "}
            from disk. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPurgeTarget(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePurgeConfirm}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              <Trash2 className="w-3 h-3 mr-1.5" />
              Delete Forever
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
