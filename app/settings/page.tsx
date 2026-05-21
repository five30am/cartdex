import { Metadata } from "next";
import { SettingsForm } from "./settings-form";
import { SystemsToggleCard } from "./systems-toggle-card";
import { DatLibraryCard } from "./dat-library-card";
import { AppearanceCard } from "./appearance-card";
import { db } from "@/lib/db";
import { systems } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Settings — CartDex",
};

export const dynamic = "force-dynamic";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--cd-font-mono, 'Share Tech Mono', monospace)",
        fontSize: "0.625rem",
        fontWeight: 600,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: "var(--cd-text-faint, var(--muted-foreground))",
        marginBottom: "0.75rem",
        paddingBottom: "0.5rem",
        borderBottom: "1px solid var(--cd-border, var(--border))",
      }}
    >
      {children}
    </p>
  );
}

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
            Appearance, API connections, and library configuration.
          </p>
        </div>

        <div className="space-y-8">
          {/* APPEARANCE */}
          <section>
            <SectionLabel>Appearance</SectionLabel>
            <AppearanceCard />
          </section>

          {/* CONNECTIONS */}
          <section>
            <SectionLabel>Connections</SectionLabel>
            <SettingsForm />
          </section>

          {/* LIBRARY */}
          <section>
            <SectionLabel>Library</SectionLabel>
            <div className="space-y-4">
              <DatLibraryCard />
              <SystemsToggleCard systems={allSystems} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
