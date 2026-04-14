import { Metadata } from "next";
import { AuditLog } from "./audit-log";

export const metadata: Metadata = { title: "Audit Log — RomVault" };

export default function AuditPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-100">Audit Log</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Full history of file operations — hide, trash, restore, purge.
        </p>
      </div>
      <AuditLog />
    </div>
  );
}
