"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, PlusCircle, Layers, HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SystemBadge } from "@/components/system-badge";
import { mutationHeaders } from "@/lib/api-token";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CollectionItem {
  id: number;
  name: string;
  description?: string | null;
  game_count: number;
  total_size: number;
  total_size_formatted: string;
  systems: { slug: string; name: string }[];
}

interface Props {
  initialCollections: CollectionItem[];
}

export function CollectionsClient({ initialCollections }: Props) {
  const router = useRouter();
  const [collections, setCollections] = useState(initialCollections);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function createCollection() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { ...(await mutationHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || null }),
      });
      if (res.ok) {
        const newCol = await res.json();
        setCollections((prev) => [
          ...prev,
          { ...newCol, game_count: 0, total_size: 0, total_size_formatted: "0 B", systems: [] },
        ]);
        setShowNewModal(false);
        setNewName("");
        setNewDescription("");
        toast.success(`Collection "${newCol.name}" created`);
        router.push(`/collections/${newCol.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to create collection");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
            <FolderOpen className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium mb-1">No collections yet</p>
          <p className="text-sm text-muted-foreground/60 mb-6 max-w-xs">
            Create a collection to group games across systems and export them to your device.
          </p>
          <Button
            onClick={() => setShowNewModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            New Collection
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {collections.map((col) => (
              <Link
                key={col.id}
                href={`/collections/${col.id}`}
                className="group block border border-border hover:border-border/60 rounded-xl p-5 bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-900/40 border border-indigo-800/50 flex items-center justify-center shrink-0">
                    <FolderOpen className="h-4.5 w-4.5 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors truncate">
                      {col.name}
                    </h3>
                    {col.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {col.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    {col.game_count} {col.game_count === 1 ? "game" : "games"}
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3.5 w-3.5" />
                    {col.total_size_formatted}
                  </span>
                </div>

                {col.systems.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {col.systems.slice(0, 5).map((sys) => (
                      <SystemBadge key={sys.slug} slug={sys.slug} name={sys.slug.toUpperCase()} />
                    ))}
                    {col.systems.length > 5 && (
                      <span className="text-xs text-muted-foreground/60 self-center">
                        +{col.systems.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}

            {/* New collection card */}
            <button
              onClick={() => setShowNewModal(true)}
              className="border border-dashed border-border hover:border-border/60 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground/70 transition-colors min-h-[140px]"
            >
              <PlusCircle className="h-6 w-6" />
              <span className="text-sm">New Collection</span>
            </button>
          </div>
        </>
      )}

      {/* New Collection Modal */}
      <Dialog open={showNewModal} onOpenChange={(v) => !v && setShowNewModal(false)}>
        <DialogContent className="bg-popover border-border text-popover-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Name</label>
              <Input
                placeholder="e.g. Steam Deck Essentials"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCollection()}
                autoFocus
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Description (optional)</label>
              <Input
                placeholder="What's this collection for?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={createCollection}
                disabled={!newName.trim() || creating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Collection"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowNewModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
