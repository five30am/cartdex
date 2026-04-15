"use client";

/**
 * SystemCompareToggle — toggle button that switches between single-DAT
 * completion panel and multi-DAT compare view via the `?compare=1` search param.
 *
 * Rendered only when the system has 2+ DATs linked.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { GitCompare, BarChart2 } from "lucide-react";

interface SystemCompareToggleProps {
  showCompare: boolean;
  slug: string;
  showHidden: boolean;
  datCount: number;
}

function buildHref(
  slug: string,
  showHidden: boolean,
  compare: boolean
): string {
  const params = new URLSearchParams();
  if (showHidden) params.set("show_hidden", "true");
  if (compare) params.set("compare", "1");
  const qs = params.toString();
  return `/systems/${slug}${qs ? `?${qs}` : ""}`;
}

export function SystemCompareToggle({
  showCompare,
  slug,
  showHidden,
  datCount,
}: SystemCompareToggleProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Single-DAT view button */}
      <Link
        href={buildHref(slug, showHidden, false)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
          !showCompare
            ? "bg-card border-border text-foreground shadow-sm"
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        )}
        aria-pressed={!showCompare}
        aria-label="Show single-DAT completion panel"
      >
        <BarChart2 className="w-3.5 h-3.5" />
        Set Completion
      </Link>

      {/* Compare view button */}
      <Link
        href={buildHref(slug, showHidden, true)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
          showCompare
            ? "bg-card border-border text-foreground shadow-sm"
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        )}
        aria-pressed={showCompare}
        aria-label="Show multi-DAT compare view"
      >
        <GitCompare className="w-3.5 h-3.5" />
        Compare DATs
        <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0 text-[10px] font-mono font-semibold text-muted-foreground">
          {datCount}
        </span>
      </Link>
    </div>
  );
}
