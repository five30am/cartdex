import { Metadata } from "next";
import { SettingsForm } from "./settings-form";
import { SystemsToggleCard } from "./systems-toggle-card";
import { db } from "@/lib/db";
import { systems } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Settings — RomVault",
};

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const allSystems = db
    .select({
      id: systems.id,
      name: systems.name,
      slug: systems.slug,
      kind: systems.kind,
      enabled: systems.enabled,
    })
    .from(systems)
    .all()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Configure API credentials and ROM path. Settings saved here take priority over environment variables.
          </p>
        </div>
        <div className="space-y-4">
          <SettingsForm />
          <SystemsToggleCard systems={allSystems} />
        </div>
      </div>
    </div>
  );
}
