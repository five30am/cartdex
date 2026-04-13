import { Badge } from "@/components/ui/badge";

const SYSTEM_COLORS: Record<string, string> = {
  nes: "bg-red-900/50 text-red-300 border-red-800",
  snes: "bg-purple-900/50 text-purple-300 border-purple-800",
  n64: "bg-blue-900/50 text-blue-300 border-blue-800",
  gb: "bg-green-900/50 text-green-300 border-green-800",
  gbc: "bg-teal-900/50 text-teal-300 border-teal-800",
  gba: "bg-indigo-900/50 text-indigo-300 border-indigo-800",
  genesis: "bg-zinc-800/80 text-zinc-300 border-zinc-700",
  psx: "bg-slate-800/80 text-slate-300 border-slate-700",
  psp: "bg-sky-900/50 text-sky-300 border-sky-800",
};

export function SystemBadge({ slug, name }: { slug: string; name: string }) {
  const colorClass =
    SYSTEM_COLORS[slug] ?? "bg-neutral-800 text-neutral-300 border-neutral-700";

  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium border ${colorClass}`}
    >
      {name}
    </Badge>
  );
}
