"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceStatus {
  configured: boolean;
  ok: boolean | null;
  error: string | null;
}

interface TestResults {
  screenscraper: ServiceStatus;
  igdb: ServiceStatus;
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  description?: string;
}

const FIELDS: FieldDef[] = [
  {
    key: "rom_path",
    label: "ROM Path",
    type: "text",
    placeholder: "/roms",
    description: "Filesystem path to your ROM directory",
  },
  {
    key: "screenscraper_username",
    label: "ScreenScraper Username",
    type: "text",
    placeholder: "your_username",
    description: "Your screenscraper.fr account username",
  },
  {
    key: "screenscraper_password",
    label: "ScreenScraper Password",
    type: "password",
    description: "Stored as-is in local DB only",
  },
  {
    key: "twitch_client_id",
    label: "Twitch Client ID",
    type: "text",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxx",
    description: "From dev.twitch.tv — required for IGDB",
  },
  {
    key: "twitch_client_secret",
    label: "Twitch Client Secret",
    type: "password",
    description: "Stored as-is in local DB only",
  },
];

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (!status.configured) {
    return (
      <span className="text-xs text-neutral-500 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-neutral-600 inline-block" />
        Not configured
      </span>
    );
  }
  if (status.ok === null) {
    return (
      <span className="text-xs text-neutral-400 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-neutral-500 inline-block" />
        Testing...
      </span>
    );
  }
  if (status.ok) {
    return (
      <span className="text-xs text-green-400 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        Connected
      </span>
    );
  }
  return (
    <span className="text-xs text-red-400 flex items-center gap-1" title={status.error ?? undefined}>
      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
      {status.error ?? "Failed"}
    </span>
  );
}

export function SettingsForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setValues(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveStatus("idle");
    setSaveError(null);

    // Only send non-empty values and non-masked values
    const payload: Record<string, string> = {};
    for (const field of FIELDS) {
      const val = values[field.key];
      if (!val) continue;
      // Don't send back a masked value (****xxxx) — it means it wasn't changed
      if (val.startsWith("****") && val.length <= 8) continue;
      payload[field.key] = val;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveStatus("saved");
        // Refresh displayed values (they'll be masked appropriately)
        const refreshed = await fetch("/api/settings").then((r) => r.json());
        setValues(refreshed);
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setSaveError(data.error ?? "Save failed");
      }
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResults(null);
    try {
      const data = await fetch("/api/settings/test").then((r) => r.json());
      setTestResults(data);
    } catch {
      // ignore — leave results null
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-neutral-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        {/* ROM Config */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-200">
              ROM Library
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow
              field={FIELDS[0]}
              value={values["rom_path"] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, rom_path: v }))}
            />
          </CardContent>
        </Card>

        {/* ScreenScraper */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-neutral-200">
                ScreenScraper
              </CardTitle>
              {testResults && (
                <StatusBadge status={testResults.screenscraper} />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.slice(1, 3).map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                value={values[field.key] ?? ""}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, [field.key]: v }))
                }
              />
            ))}
          </CardContent>
        </Card>

        {/* IGDB */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-neutral-200">
                IGDB / Twitch
              </CardTitle>
              {testResults && (
                <StatusBadge status={testResults.igdb} />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.slice(3).map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                value={values[field.key] ?? ""}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, [field.key]: v }))
                }
              />
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="bg-white text-neutral-950 hover:bg-neutral-200"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={testing || saving}
            className="border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500"
          >
            {testing ? "Testing..." : "Test Connections"}
          </Button>

          {saveStatus === "saved" && (
            <span className="text-sm text-green-400">Settings saved</span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-red-400">{saveError}</span>
          )}
        </div>
      </form>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-neutral-300 font-medium">
        {field.label}
      </label>
      <Input
        type={field.type}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-600"
        autoComplete="off"
        data-1p-ignore
      />
      {field.description && (
        <p className="text-xs text-neutral-600">{field.description}</p>
      )}
    </div>
  );
}
