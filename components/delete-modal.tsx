"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EyeOff, Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface GameRef {
  id: number;
  title: string;
  system_slug?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  games: GameRef[];
  onHideSuccess?: (ids: number[]) => void;
  onTrashSuccess?: (ids: number[]) => void;
}

type Step = "choose" | "confirm_trash";

export function DeleteModal({ open, onClose, games, onHideSuccess, onTrashSuccess }: Props) {
  const [step, setStep] = useState<Step>("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const label = games.length === 1 ? "1 file" : `${games.length} files`;

  function handleClose() {
    if (loading) return;
    setStep("choose");
    setError("");
    onClose();
  }

  async function handleHide() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/games/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: games.map((g) => g.id), action: "hide" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hide failed");
        return;
      }
      if (data.errors?.length > 0) {
        setError(`${data.processed} hidden, ${data.errors.length} failed`);
        return;
      }
      onHideSuccess?.(games.map((g) => g.id));
      handleClose();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTrash() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/games/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: games.map((g) => g.id), action: "trash" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Trash failed");
        return;
      }
      if (data.errors?.length > 0) {
        setError(`${data.processed} moved, ${data.errors.length} failed: ${data.errors[0]?.message}`);
        return;
      }
      onTrashSuccess?.(games.map((g) => g.id));
      handleClose();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-neutral-100">
            {step === "choose" ? `Delete ${label}?` : "Are you sure?"}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-neutral-400">Choose how to remove these files:</p>

            <div className="grid grid-cols-2 gap-3">
              {/* Hide path */}
              <div className="border border-neutral-700 rounded-lg p-4 space-y-3 flex flex-col">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
                    <EyeOff className="w-4 h-4 text-blue-400" />
                    Hide from Library
                  </div>
                  <ul className="text-xs text-neutral-500 space-y-0.5 mt-2 list-none">
                    <li>Files stay on disk.</li>
                    <li>Row flagged hidden.</li>
                    <li>Rescan respects hash.</li>
                    <li>Reversible anytime.</li>
                  </ul>
                </div>
                <Button
                  size="sm"
                  onClick={handleHide}
                  disabled={loading}
                  className="mt-auto w-full bg-blue-700 hover:bg-blue-600 text-white text-xs h-8"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Hide Files"}
                </Button>
              </div>

              {/* Trash path */}
              <div className="border border-neutral-700 rounded-lg p-4 space-y-3 flex flex-col">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
                    <Trash2 className="w-4 h-4 text-amber-400" />
                    Move to Trash
                  </div>
                  <ul className="text-xs text-neutral-500 space-y-0.5 mt-2 list-none">
                    <li>Files move to .trash/.</li>
                    <li>30-day hold.</li>
                    <li>Reversible from Trash.</li>
                    <li>&nbsp;</li>
                  </ul>
                </div>
                <Button
                  size="sm"
                  onClick={() => setStep("confirm_trash")}
                  disabled={loading}
                  className="mt-auto w-full bg-amber-700 hover:bg-amber-600 text-white text-xs h-8"
                >
                  Move to Trash
                </Button>
              </div>
            </div>

            {/* File list */}
            <div className="space-y-1">
              <p className="text-xs text-neutral-500">These files will be affected:</p>
              <ul className="text-xs text-neutral-400 space-y-0.5 max-h-32 overflow-y-auto">
                {games.map((g) => (
                  <li key={g.id} className="truncate">
                    &middot; {g.title}
                    {g.system_slug && (
                      <span className="text-neutral-600 ml-1">— {g.system_slug.toUpperCase()}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClose}
                disabled={loading}
                className="text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "confirm_trash" && (
          <div className="space-y-4 mt-1">
            <div className="flex items-start gap-3 p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-neutral-300">
                This will move{" "}
                <span className="text-neutral-100 font-medium">{label}</span> to{" "}
                <code className="text-amber-400 text-xs">/roms/.trash/</code>. They can be
                restored within 30 days from the Trash Viewer.
              </p>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setStep("choose"); setError(""); }}
                disabled={loading}
                className="text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleTrash}
                disabled={loading}
                className="bg-red-700 hover:bg-red-600 text-white"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="w-3 h-3 mr-1.5" />
                )}
                Yes, Move to Trash
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
