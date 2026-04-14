import { Metadata } from "next";
import { TrashViewer } from "./trash-viewer";

export const metadata: Metadata = { title: "Trash — RomVault" };

export default function TrashPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-100">Trash</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Files moved to trash. Restore within 30 days or purge permanently.
          Auto-purge runs daily.
        </p>
      </div>
      <TrashViewer />
    </div>
  );
}
