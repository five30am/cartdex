import { Badge } from "@/components/ui/badge";

const SYSTEM_COLORS: Record<string, string> = {
  nes: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800",
  snes: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800",
  n64: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800",
  gb: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800",
  gbc: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-800",
  gba: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800",
  genesis: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-700",
  psx: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700",
  psp: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-800",
};

export function SystemBadge({ slug, name }: { slug: string; name: string }) {
  const colorClass =
    SYSTEM_COLORS[slug] ?? "bg-muted text-muted-foreground border-border";

  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium border ${colorClass}`}
    >
      {name}
    </Badge>
  );
}
