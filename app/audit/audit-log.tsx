"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: number;
  game_id: number | null;
  game_title: string | null;
  operation: string;
  actor: string;
  timestamp: string;
  file_path_before: string | null;
  file_path_after: string | null;
  hash_sha1: string | null;
  notes: string | null;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pages: number;
}

const OPERATION_COLORS: Record<string, string> = {
  hidden: "text-blue-400 bg-blue-950/30 border-blue-800/50",
  unhidden: "text-green-400 bg-green-950/30 border-green-800/50",
  trashed: "text-amber-400 bg-amber-950/30 border-amber-800/50",
  restored: "text-teal-400 bg-teal-950/30 border-teal-800/50",
  purged: "text-red-400 bg-red-950/30 border-red-800/50",
  path_updated: "text-neutral-400 bg-neutral-800/30 border-neutral-700/50",
};

function OperationBadge({ op }: { op: string }) {
  const cls = OPERATION_COLORS[op] ?? "text-neutral-400 bg-neutral-800/30 border-neutral-700/50";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", cls)}>
      {op}
    </span>
  );
}

const OPERATIONS = ["", "hidden", "unhidden", "trashed", "restored", "purged", "path_updated"];

export function AuditLog() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [operationFilter, setOperationFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "100" });
      if (operationFilter) params.set("operation", operationFilter);
      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [page, operationFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={operationFilter}
          onChange={(e) => { setPage(1); setOperationFilter(e.target.value); }}
          className="h-8 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-300 text-sm px-2 pr-6"
        >
          {OPERATIONS.map((op) => (
            <option key={op} value={op}>
              {op || "All operations"}
            </option>
          ))}
        </select>
        {data && !loading && (
          <span className="text-xs text-neutral-600 ml-2">
            {data.total} event{data.total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Table */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {error && <div className="py-8 text-center text-sm text-red-400">{error}</div>}

      {!loading && !error && data?.entries.length === 0 && (
        <div className="py-12 text-center text-neutral-500 text-sm">No audit records yet.</div>
      )}

      {!loading && !error && data && data.entries.length > 0 && (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60">
                <th className="text-left px-4 py-2.5 text-xs text-neutral-500 font-medium w-36">Timestamp</th>
                <th className="text-left px-4 py-2.5 text-xs text-neutral-500 font-medium w-28">Operation</th>
                <th className="text-left px-4 py-2.5 text-xs text-neutral-500 font-medium">Game</th>
                <th className="text-left px-4 py-2.5 text-xs text-neutral-500 font-medium hidden lg:table-cell">Path</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-b border-neutral-800/50 last:border-0",
                    i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/20"
                  )}
                >
                  <td className="px-4 py-2.5 text-xs text-neutral-500 font-mono whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="px-4 py-2.5">
                    <OperationBadge op={entry.operation} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-neutral-300 text-xs">
                      {entry.game_title ?? (entry.game_id ? `#${entry.game_id}` : "—")}
                    </span>
                    {entry.notes && (
                      <span className="text-neutral-600 text-[10px] ml-1.5">{entry.notes}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">
                    <div className="text-[10px] text-neutral-600 font-mono space-y-0.5">
                      {entry.file_path_before && (
                        <div className="truncate max-w-xs" title={entry.file_path_before}>
                          {entry.file_path_before}
                        </div>
                      )}
                      {entry.file_path_after && entry.file_path_after !== entry.file_path_before && (
                        <div className="truncate max-w-xs text-neutral-500" title={entry.file_path_after}>
                          → {entry.file_path_after}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
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
    </div>
  );
}
