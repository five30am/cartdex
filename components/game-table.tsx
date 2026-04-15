import Link from "next/link";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Hash, ShieldCheck, Star } from "lucide-react";

interface Game {
  id: number;
  title: string;
  year?: string | null;
  publisher?: string | null;
  file_size?: number | null;
  hashed?: boolean | null;
  verified?: boolean | null;
  user_rating?: number | null;
  /** True when this game has a matching 'have' row in match_results for a linked DAT */
  dat_verified?: boolean | null;
}

interface GameTableProps {
  games: Game[];
  emptyMessage?: string;
}

/** Format bytes into a human-readable string (KB / MB / GB). */
function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

/** Derive a human-readable hash state label from the game's hashed/verified/dat_verified flags. */
function hashStateLabel(
  hashed: boolean | null | undefined,
  verified: boolean | null | undefined,
  dat_verified: boolean | null | undefined
): { label: string; state: "dat-verified" | "verified" | "hashed" | "unhashed" } {
  if (dat_verified) return { label: "DAT-verified", state: "dat-verified" };
  if (verified) return { label: "Verified", state: "verified" };
  if (hashed) return { label: "Hashed", state: "hashed" };
  return { label: "Unhashed", state: "unhashed" };
}

export function GameTable({
  games,
  emptyMessage = "No games found",
}: GameTableProps) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4 opacity-30">🎮</div>
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider w-full">
              Title
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">
              Year
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
              Publisher
            </th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">
              Size
            </th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">
              Hash
            </th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">
              Rating
            </th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, i) => {
            const { label, state } = hashStateLabel(game.hashed, game.verified, game.dat_verified);
            return (
              <tr
                key={game.id}
                className={cn(
                  "border-b border-border last:border-0 transition-colors",
                  i % 2 === 0
                    ? "bg-background hover:bg-muted/30"
                    : "bg-muted/10 hover:bg-muted/30"
                )}
              >
                {/* Title — always visible */}
                <td className="px-4 py-2.5">
                  <Link
                    href={`/games/${game.id}`}
                    className="font-medium text-foreground hover:text-blue-500 transition-colors truncate block max-w-xs lg:max-w-sm"
                  >
                    {game.title}
                  </Link>
                </td>

                {/* Year */}
                <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs whitespace-nowrap hidden sm:table-cell">
                  {game.year?.slice(0, 4) ?? "—"}
                </td>

                {/* Publisher */}
                <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">
                  <span className="truncate block max-w-[160px]">
                    {game.publisher ?? "—"}
                  </span>
                </td>

                {/* File size */}
                <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs whitespace-nowrap hidden lg:table-cell">
                  {formatBytes(game.file_size)}
                </td>

                {/* Hash state — 4 states: DAT-verified / Verified / Hashed / Unhashed */}
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5",
                      state === "dat-verified"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : state === "verified"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : state === "hashed"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-muted text-muted-foreground"
                    )}
                    title={label}
                    aria-label={`Hash state: ${label}`}
                  >
                    {state === "dat-verified" ? (
                      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                    ) : state === "verified" ? (
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    ) : state === "hashed" ? (
                      <Hash className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <Circle className="w-3 h-3" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">{label}</span>
                  </span>
                </td>

                {/* Rating */}
                <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                  {game.user_rating != null ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                      <span className="text-xs font-mono text-amber-500">
                        {game.user_rating}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
