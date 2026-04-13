import { Metadata } from "next";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings — RomVault",
};

export default function SettingsPage() {
  return (
    <div className="px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">
            Configure API credentials and ROM path. Settings saved here take priority over environment variables.
          </p>
        </div>
        <SettingsForm />
      </div>
    </div>
  );
}
