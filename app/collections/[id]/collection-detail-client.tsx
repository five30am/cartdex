"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
  HardDrive,
  ChevronDown,
  Loader2,
  PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SystemBadge } from "@/components/system-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Game {
  id: number;
  title: string;
  year?: string | null;
  box_art_path?: string | null;
  file_size?: number | null;
  verified: boolean;
  system_id: number;
  system_name: string;
  system_slug: string;
}

interface Collection {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

interface ExportProfile {
  id: number;
  name: string;
  base_path: string;
}

interface Props {
  collection: Collection;
  initialGames: Game[];
  totalSize: number;
  totalSizeFormatted: string;
  exportProfiles: ExportProfile[];
}

export function CollectionDetailClient({
  collection,
  initialGames,
  totalSize,
  totalSizeFormatted,
  exportProfiles,
}: Props) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [tempName, setTempName] = useState(name);
  const [tempDesc, setTempDesc] = useState(description);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingGame, setRemovingGame] = useState<number | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<number | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);

  // Group games by system
  const gamesBySystem = games.reduce<Record<string, { system: { slug: string; name: string }; games: Game[] }>>(
    (acc, game) => {
      if (!acc[game.system_slug]) {
        acc[game.system_slug] = { system: { slug: game.system_slug, name: game.system_name }, games: [] };
      }
      acc[game.system_slug].games.push(game);
      return acc;
    },
    {}
  );

  const systemGroups = Object.values(gamesBySystem);
  systemGroups.sort((a, b) => a.system.name.localeCompare(b.system.name));

  async function saveName() {
    if (!tempName.trim() || tempName.trim() === name) {
      setEditingName(false);
      setTempName(name);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tempName.trim(), description: description || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setName(updated.name);
        setTempName(updated.name);
        setEditingName(false);
        toast.success("Collection renamed");
      } else {
        toast.error("Failed to save name");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveDescription() {
    setSaving(true);
    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: tempDesc.trim() || null }),
      });
      if (res.ok) {
        setDescription(tempDesc.trim());
        setEditingDesc(false);
        toast.success("Description updated");
      } else {
        toast.error("Failed to save description");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCollection() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/collections/${collection.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Collection deleted");
        router.push("/collections");
        router.refresh();
      } else {
        toast.error("Failed to delete collection");
        setDeleting(false);
      }
    } catch {
      toast.error("Request failed");
      setDeleting(false);
    }
  }

  async function removeGame(gameId: number) {
    setRemovingGame(gameId);
    try {
      const res = await fetch(`/api/collections/${collection.id}/games/${gameId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setGames((prev) => prev.filter((g) => g.id !== gameId));
        setShowRemoveConfirm(null);
        toast.success("Game removed from collection");
      } else {
        toast.error("Failed to remove game");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setRemovingGame(null);
    }
  }

  function triggerExport(profileId: number) {
    setExporting(profileId);
    setShowExportDropdown(false);

    const a = document.createElement("a");
    a.href = `/api/collections/${collection.id}/export?profileId=${profileId}`;
    a.click();

    // Reset exporting state after a short delay
    setTimeout(() => setExporting(null), 3000);
    toast.success("Download started");
  }

  const currentTotalSize = games.reduce((acc, g) => acc + (g.file_size ?? 0), 0);
  const displaySize = formatBytes(currentTotalSize);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-8">
        <div className="flex-1 min-w-0">
          {/* Name */}
          {editingName ? (
            <div className="flex items-center gap-2 mb-1">
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") { setEditingName(false); setTempName(name); }
                }}
                autoFocus
                className="text-xl font-bold bg-neutral-800 border-neutral-700 text-white h-10 max-w-md"
              />
              <button onClick={saveName} disabled={saving} className="text-green-400 hover:text-green-300 disabled:opacity-50">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              </button>
              <button onClick={() => { setEditingName(false); setTempName(name); }} className="text-neutral-500 hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1 group/name">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <button
                onClick={() => { setEditingName(true); setTempName(name); }}
                className="opacity-0 group-hover/name:opacity-100 transition-opacity text-neutral-600 hover:text-neutral-400"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Description */}
          {editingDesc ? (
            <div className="flex items-center gap-2">
              <Input
                value={tempDesc}
                onChange={(e) => setTempDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveDescription();
                  if (e.key === "Escape") { setEditingDesc(false); setTempDesc(description); }
                }}
                placeholder="Add a description..."
                autoFocus
                className="bg-neutral-800 border-neutral-700 text-neutral-300 h-8 text-sm max-w-sm"
              />
              <button onClick={saveDescription} disabled={saving} className="text-green-400 hover:text-green-300 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button onClick={() => { setEditingDesc(false); setTempDesc(description); }} className="text-neutral-500 hover:text-neutral-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group/desc">
              {description ? (
                <p className="text-sm text-neutral-400">{description}</p>
              ) : (
                <p className="text-sm text-neutral-600 italic">No description</p>
              )}
              <button
                onClick={() => { setEditingDesc(true); setTempDesc(description); }}
                className="opacity-0 group-hover/desc:opacity-100 transition-opacity text-neutral-600 hover:text-neutral-400"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-neutral-500 mt-3">
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              {games.length} {games.length === 1 ? "game" : "games"}
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="h-4 w-4" />
              {displaySize}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {exportProfiles.length > 0 && games.length > 0 && (
            <div className="relative">
              <Button
                onClick={() => exportProfiles.length === 1 ? triggerExport(exportProfiles[0].id) : setShowExportDropdown(!showExportDropdown)}
                disabled={exporting !== null}
                className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2"
              >
                {exporting !== null ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export
                {exportProfiles.length > 1 && <ChevronDown className="h-3.5 w-3.5" />}
              </Button>

              {showExportDropdown && exportProfiles.length > 1 && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-10">
                  {exportProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => triggerExport(profile.id)}
                      className="w-full text-left px-3 py-2.5 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{profile.base_path}/</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Games by System */}
      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-800 rounded-xl">
          <PackageOpen className="h-10 w-10 text-neutral-700 mb-3" />
          <p className="text-neutral-500 font-medium mb-1">Collection is empty</p>
          <p className="text-sm text-neutral-600 max-w-xs">
            Browse your library and use the &ldquo;Add to Collection&rdquo; button on any game.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {systemGroups.map(({ system, games: systemGames }) => (
            <div key={system.slug}>
              <div className="flex items-center gap-2.5 mb-4">
                <SystemBadge slug={system.slug} name={system.slug.toUpperCase()} />
                <h2 className="text-sm font-medium text-neutral-400">{system.name}</h2>
                <span className="text-xs text-neutral-600">
                  {systemGames.length} {systemGames.length === 1 ? "game" : "games"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {systemGames.map((game) => (
                  <div key={game.id} className="relative group">
                    <Link href={`/games/${game.id}`} className="block">
                      <div className="relative aspect-[3/4] w-full bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 group-hover:border-neutral-600 transition-colors">
                        {game.box_art_path ? (
                          <Image
                            src={game.box_art_path}
                            alt={`${game.title} box art`}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                            <div className="text-3xl mb-2 opacity-30">🎮</div>
                            <p className="text-xs text-neutral-600 leading-tight font-medium line-clamp-3">
                              {game.title}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium text-neutral-200 group-hover:text-white transition-colors truncate leading-tight mt-2 px-0.5">
                        {game.title}
                      </p>
                    </Link>

                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.preventDefault(); setShowRemoveConfirm(game.id); }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-neutral-950/80 border border-neutral-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80 hover:border-red-700 z-10"
                      title="Remove from collection"
                    >
                      <X className="h-3 w-3 text-neutral-400 hover:text-red-300" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Remove Game Confirmation */}
      <Dialog open={showRemoveConfirm !== null} onOpenChange={(v) => !v && setShowRemoveConfirm(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-neutral-100">Remove Game?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400 mt-1">
            Remove{" "}
            <span className="text-neutral-200 font-medium">
              {games.find((g) => g.id === showRemoveConfirm)?.title}
            </span>{" "}
            from this collection?
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => showRemoveConfirm && removeGame(showRemoveConfirm)}
              disabled={removingGame !== null}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white"
            >
              {removingGame !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowRemoveConfirm(null)}
              className="text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Collection Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={(v) => !v && setShowDeleteConfirm(false)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-neutral-100">Delete Collection?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400 mt-1">
            Delete <span className="text-neutral-200 font-medium">{name}</span>? This cannot be undone.
            The games themselves will not be deleted.
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={deleteCollection}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Collection"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
