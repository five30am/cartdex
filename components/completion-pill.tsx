import { cn } from "@/lib/utils";

export interface CompletionData {
  linked: true;
  dat_id: number;
  dat_name: string;
  total: number;
  have: number;
  have_baddump: number;
  missing: number;
  nodump: number;
  completion_pct: number | null;
}

type CompletionResult = CompletionData | { linked: false };

interface CompletionPillProps {
  data: CompletionResult | null | undefined;
  /** When true, renders a slightly larger pill suited for detail page headers */
  size?: "sm" | "md";
}

/** Color ramp: red <50%, yellow 50–89%, green 90+% */
function completionColor(pct: number): string {
  if (pct >= 90)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/30";
  if (pct >= 50)
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25 dark:border-yellow-500/30";
  return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25 dark:border-red-500/30";
}

/**
 * Renders a completion pill like "97% • 1,234 / 1,278".
 * Returns null when no DAT is linked or data is absent — never shows "0%" or "NaN%".
 */
export function CompletionPill({ data, size = "sm" }: CompletionPillProps) {
  if (!data || !data.linked) return null;

  const { total, have, nodump, completion_pct } = data;

  // denominator excludes nodump (unobtainable) entries
  const denominator = total - nodump;
  if (denominator <= 0 || completion_pct === null) return null;

  const pct = Math.round(completion_pct);
  const colorClass = completionColor(pct);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-mono font-medium tabular-nums",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        colorClass
      )}
      title={`DAT: ${data.dat_name} — ${have.toLocaleString()} of ${denominator.toLocaleString()} obtainable entries matched`}
      aria-label={`DAT completion: ${pct}%`}
    >
      <span className="font-semibold">{pct}%</span>
      <span className="opacity-50">•</span>
      <span>
        {have.toLocaleString()}&thinsp;/&thinsp;{denominator.toLocaleString()}
      </span>
    </span>
  );
}
