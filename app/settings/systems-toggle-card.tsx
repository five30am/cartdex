"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Monitor } from "lucide-react";

interface SystemRow {
  id: number;
  name: string;
  slug: string;
  kind: "console" | "handheld";
  enabled: boolean;
}

interface Props {
  systems: SystemRow[];
}

export function SystemsToggleCard({ systems: initialSystems }: Props) {
  const [systems, setSystems] = useState(initialSystems);
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function handleToggle(slug: string, enabled: boolean) {
    if (pending.has(slug)) return;
    setPending((prev) => new Set(prev).add(slug));

    // Optimistic update
    setSystems((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, enabled } : s))
    );

    try {
      const res = await fetch(`/api/systems/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        // Revert on failure
        setSystems((prev) =>
          prev.map((s) => (s.slug === slug ? { ...s, enabled: !enabled } : s))
        );
      }
    } catch {
      // Revert on failure
      setSystems((prev) =>
        prev.map((s) => (s.slug === slug ? { ...s, enabled: !enabled } : s))
      );
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  }

  const consoles = systems.filter((s) => s.kind !== "handheld");
  const handhelds = systems.filter((s) => s.kind === "handheld");

  return (
    <Card className="bg-card border-border shadow-none rounded-xl overflow-hidden">
      <CardHeader className="px-5 pt-4 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="text-muted-foreground">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Systems</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Disabled systems are hidden from browse views — games are preserved
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5">
        <div className="border-t border-border pt-4 space-y-5">
          {consoles.length > 0 && (
            <SystemGroup label="Consoles" systems={consoles} pending={pending} onToggle={handleToggle} />
          )}
          {handhelds.length > 0 && (
            <SystemGroup label="Handhelds" systems={handhelds} pending={pending} onToggle={handleToggle} />
          )}
          {systems.length === 0 && (
            <p className="text-xs text-muted-foreground">No systems registered yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SystemGroup({
  label,
  systems,
  pending,
  onToggle,
}: {
  label: string;
  systems: SystemRow[];
  pending: Set<string>;
  onToggle: (slug: string, enabled: boolean) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="space-y-1">
        {systems.map((system) => (
          <div
            key={system.slug}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-medium transition-colors ${
                  system.enabled ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {system.name}
              </span>
              <span className="text-xs text-muted-foreground/50 font-mono">
                {system.slug}
              </span>
            </div>
            <Switch
              checked={system.enabled}
              disabled={pending.has(system.slug)}
              onCheckedChange={(checked) => onToggle(system.slug, checked)}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
