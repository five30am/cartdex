import { Metadata } from "next";
import { DuplicateBrowser } from "./duplicate-browser";

export const metadata: Metadata = { title: "Duplicates — RomVault" };

export default function DuplicatesPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-100">Duplicate Browser</h1>
        <p className="text-sm text-neutral-500 mt-1">
          ROMs grouped by canonical title. The highlighted file is the recommended keep.
        </p>
      </div>
      <DuplicateBrowser />
    </div>
  );
}
