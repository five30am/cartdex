import { Metadata } from "next";
import { DuplicateBrowser } from "./duplicate-browser";

export const metadata: Metadata = { title: "Duplicates — CartDex" };

export default function DuplicatesPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Duplicate Browser</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ROMs grouped by canonical title within each platform. The highlighted file is the recommended keep.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Duplicates are detected within a single platform only — a SNES ROM and a Genesis ROM with the same title are not matched.
        </p>
      </div>
      <DuplicateBrowser />
    </div>
  );
}
