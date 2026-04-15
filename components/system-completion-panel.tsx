"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CompletionPill, type CompletionData } from "@/components/completion-pill";
import { SearchBar } from "@/components/search-bar";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Ban, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportEntry {
  entry_id: number;
  name: string;
  size: number | null;
  crc32: string | null;
  sha1: string | null;
  dat_status: "good" | "baddump" | "nodump";
  region: string | null;
  cloneof: string | null;
  match_type: "have" | "have_baddump" | "nodump" | null;
  matched_by: string | null;
  game_id: number | null;
  entry_status: "have" | "have_baddump" | "nodump" | "missing";
}

type TabKey = "have" | "missing" | "have_baddump" | "nodump";

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  countKey: keyof CompletionData;
  emptyLabel: string;
}

const TABS: TabConfig[] = [
  {
    key: "have",
    label: "Have",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    countKey: "have",
    emptyLabel: "No matched entries yet",
  },
  {
    key: "missing",
    label: "Missing",
    icon: <XCircle className="w-3.5 h-3.5" />,
    countKey: "missing",
    emptyLabel: "No missing entries — collection complete!",
  },
  {
    key: "have_baddump",
    label: "Bad dump",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    countKey: "have_baddump",
    emptyLabel: "No bad dumps found",
  },
  {
    key: "nodump",
    label: "Unobtainable",
    icon: <Ban className="w-3.5 h-3.5" />,
    countKey: "nodump",
    emptyLabel: "No unobtainable entries in this DAT",
  },
];

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const barColor =
    clamped >= 90
      ? "bg-emerald-500"
      : clamped >= 50
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div
      className="h-2 w-full rounded-full bg-muted overflow-hidden"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Completion: ${Math.round(clamped)}%`}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", barColor)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry row
// ---------------------------------------------------------------------------

function EntryRow({
  entry,
  tab,
}: {
  entry: ReportEntry;
  tab: TabKey;
}) {
  const canNavigate = tab === "have" && entry.game_id != null;

  const inner = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        canNavigate
          ? "hover:bg-accent/50 cursor-pointer group"
          : "cursor-default"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn(
          "truncate text-sm font-medium leading-tight",
          canNavigate ? "text-foreground group-hover:text-blue-500" : "text-foreground/70"
        )}>
          {entry.name}
        </p>
        {entry.region && (
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{entry.region}</p>
        )}
      </div>
      {canNavigate && (
        <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-blue-400 flex-shrink-0" />
      )}
    </div>
  );

  if (canNavigate && entry.game_id != null) {
    return <Link href={`/games/${entry.game_id}`}>{inner}</Link>;
  }

  return inner;
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface SystemCompletionPanelProps {
  completion: CompletionData;
  entries: ReportEntry[];
}

export function SystemCompletionPanel({
  completion,
  entries,
}: SystemCompletionPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("have");
  const [search, setSearch] = useState("");

  // Defense-in-depth: a 100%-nodump DAT has completion_pct = NULL in the view.
  // The caller (systems/[slug]/page.tsx) gates on this before mounting us, but
  // we refuse to render rather than silently coerce to 0% (which would paint a
  // misleading red progress bar).
  if (completion.completion_pct === null) return null;
  const denominator = completion.total - completion.nodump;
  if (denominator <= 0) return null;

  const pct = completion.completion_pct;

  const filteredEntries = useMemo(() => {
    const forTab = entries.filter((e) => e.entry_status === activeTab);
    if (!search.trim()) return forTab;
    const lower = search.toLowerCase();
    return forTab.filter((e) => e.name.toLowerCase().includes(lower));
  }, [entries, activeTab, search]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Set Completion</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs" title={completion.dat_name}>
              {completion.dat_name}
            </p>
          </div>
          <CompletionPill data={completion} size="md" />
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <ProgressBar pct={pct} />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-muted-foreground font-mono">
              {completion.have.toLocaleString()} of {denominator.toLocaleString()} obtainable matched
            </p>
            {completion.missing > 0 && (
              <p className="text-[11px] text-muted-foreground/60 font-mono">
                {completion.missing.toLocaleString()} missing
              </p>
            )}
          </div>
        </div>

        {/* Status counts row */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <StatChip
            icon={<CheckCircle2 className="w-3 h-3 text-emerald-500" />}
            label="Have"
            count={completion.have}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <StatChip
            icon={<XCircle className="w-3 h-3 text-red-500" />}
            label="Missing"
            count={completion.missing}
            color="text-red-600 dark:text-red-400"
          />
          {completion.have_baddump > 0 && (
            <StatChip
              icon={<AlertTriangle className="w-3 h-3 text-yellow-500" />}
              label="Bad dump"
              count={completion.have_baddump}
              color="text-yellow-600 dark:text-yellow-400"
            />
          )}
          {completion.nodump > 0 && (
            <StatChip
              icon={<Ban className="w-3 h-3 text-muted-foreground" />}
              label="Unobtainable"
              count={completion.nodump}
              color="text-muted-foreground"
            />
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => {
          const count = completion[tab.countKey] as number;
          if (count === 0 && tab.key !== "have" && tab.key !== "missing") return null;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(""); }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.key
                  ? "border-blue-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
              aria-selected={activeTab === tab.key}
            >
              {tab.icon}
              {tab.label}
              <span className={cn(
                "ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-mono font-semibold",
                activeTab === tab.key
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + entry list */}
      <div className="p-4">
        {(completion[activeTab === "have_baddump" ? "have_baddump" : activeTab === "nodump" ? "nodump" : activeTab] as number) > 8 && (
          <div className="mb-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={`Filter ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase() ?? ""} entries…`}
              className="w-full"
            />
          </div>
        )}

        {filteredEntries.length === 0 ? (
          <div className="py-8 text-center">
            <HelpCircle className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {search
                ? `No entries matching "${search}"`
                : TABS.find((t) => t.key === activeTab)?.emptyLabel}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 max-h-72 overflow-y-auto">
            {filteredEntries.map((entry) => (
              <EntryRow key={entry.entry_id} entry={entry} tab={activeTab} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span className={cn("text-xs font-mono font-semibold tabular-nums", color)}>
        {count.toLocaleString()}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
