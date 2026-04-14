import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPublishers(): { publisher: string; slug: string; count: number }[] {
  const rows = db
    .select({ publisher: games.publisher })
    .from(games)
    .innerJoin(systems, eq(games.system_id, systems.id))
    .where(and(isNotNull(games.publisher), eq(games.hidden, false), eq(systems.enabled, true)))
    .all();

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.publisher) {
      counts.set(row.publisher, (counts.get(row.publisher) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([publisher, count]) => ({ publisher, slug: slugify(publisher), count }))
    .sort((a, b) => b.count - a.count || a.publisher.localeCompare(b.publisher));
}

export default function PublishersPage() {
  const publishers = getPublishers();

  return (
    <div className="px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Building2 className="h-5 w-5 text-neutral-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Publishers</h1>
          </div>
          <p className="text-sm text-neutral-500">
            <span className="text-neutral-300 font-medium">{publishers.length}</span>{" "}
            {publishers.length === 1 ? "publisher" : "publishers"}
          </p>
        </div>

        {publishers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {publishers.map(({ publisher, slug, count }) => (
              <Link
                key={slug}
                href={`/publishers/${slug}`}
                className="group flex items-center justify-between gap-3 px-4 py-3 bg-[#111111] border border-white/[0.06] rounded-lg hover:border-blue-500/30 hover:bg-[#141414] transition-all duration-200"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-200 group-hover:text-white truncate transition-colors">
                    {publisher}
                  </p>
                  <p className="text-xs text-neutral-600 mt-0.5 font-mono">
                    {count.toLocaleString()} {count === 1 ? "game" : "games"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-700 group-hover:text-blue-400 shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-white/[0.06] flex items-center justify-center mb-5">
        <Building2 className="w-7 h-7 text-neutral-700" />
      </div>
      <h3 className="text-base font-semibold text-neutral-200 mb-2">No publisher data yet</h3>
      <p className="text-sm text-neutral-500 max-w-sm leading-relaxed mb-6">
        Publisher information is pulled from ScreenScraper during metadata scraping.
        Run the backfill from Settings to populate existing games.
      </p>
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
      >
        Open Settings
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
