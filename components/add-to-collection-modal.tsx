"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, FolderOpen, Check, Loader2 } from "lucide-react";

interface Collection {
  id: number;
  name: string;
  game_count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  gameIds: number[];
  onSuccess?: (collectionId: number, collectionName: string) => void;
}

export function AddToCollectionModal({ open, onClose, gameIds, onSuccess }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<number | "new" | null>(null);
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/collections")
      .then((r) => r.json())
      .then((data) => {
        setCollections(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [open]);

  async function addToCollection(collectionId: number, name: string) {
    setSubmitting(collectionId);
    setError("");
    try {
      const res = await fetch(`/api/collections/${collectionId}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds }),
      });
      if (res.ok) {
        onSuccess?.(collectionId, name);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to add games");
      }
    } catch {
      setError("Request failed");
    } finally {
      setSubmitting(null);
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    setSubmitting("new");
    setError("");
    try {
      const createRes = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!createRes.ok) {
        const data = await createRes.json();
        setError(data.error ?? "Failed to create collection");
        setSubmitting(null);
        return;
      }
      const newCol = await createRes.json();
      await addToCollection(newCol.id, newCol.name);
    } catch {
      setError("Request failed");
      setSubmitting(null);
    }
  }

  function handleClose() {
    setShowNewForm(false);
    setNewName("");
    setError("");
    onClose();
  }

  const label = gameIds.length === 1 ? "1 game" : `${gameIds.length} games`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-neutral-100">
            Add {label} to Collection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {collections.length === 0 && !showNewForm && (
                <p className="text-sm text-neutral-500 py-2">
                  No collections yet. Create one below.
                </p>
              )}

              {collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => addToCollection(col.id, col.name)}
                  disabled={submitting !== null}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 hover:border-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderOpen className="h-4 w-4 text-neutral-400 shrink-0" />
                    <span className="text-sm text-neutral-200 truncate">{col.name}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-xs text-neutral-500">{col.game_count} games</span>
                    {submitting === col.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                    )}
                  </div>
                </button>
              ))}

              {!showNewForm ? (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-dashed border-neutral-700 hover:border-neutral-500 text-neutral-500 hover:text-neutral-300 transition-colors text-sm"
                >
                  <PlusCircle className="h-4 w-4" />
                  New collection
                </button>
              ) : (
                <div className="border border-neutral-700 rounded-lg p-3 space-y-2">
                  <Input
                    placeholder="Collection name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                    autoFocus
                    className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-600 h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={createAndAdd}
                      disabled={!newName.trim() || submitting !== null}
                      className="flex-1 h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {submitting === "new" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Create & Add
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowNewForm(false); setNewName(""); }}
                      className="h-7 text-xs text-neutral-400 hover:text-neutral-200"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-xs text-red-400 pt-1">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
