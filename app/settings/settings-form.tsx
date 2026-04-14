"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FolderOpen, Wifi, Key, CheckCircle2, XCircle, Minus, Loader2, Save, Zap, RefreshCw, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
    label: "Username",
    type: "text",
    placeholder: "your_username",
    description: "Your screenscraper.fr account username",
  },
  {
    key: "screenscraper_password",
    label: "Password",
    type: "password",
    description: "Stored locally only — never transmitted to third parties",
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
    description: "Stored locally only — never transmitted to third parties",
  },
];

function ConnectionBadge({ status }: { status: ServiceStatus }) {
  if (!status.configured) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
        <Minus className="w-3 h-3" />
        Not configured
      </span>
    );
  }
  if (status.ok === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Testing...
      </span>
    );
  }
  if (status.ok) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
        <CheckCircle2 className="w-3 h-3" />
        Connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-400" title={status.error ?? undefined}>
      <XCircle className="w-3 h-3" />
      {status.error ?? "Failed"}
    </span>
  );
}

interface BackfillStatus {
  state: "idle" | "running" | "done" | "error";
  progress?: { current: number; total: number };
  updated: number;
  skipped: number;
  errors: number;
}

export function SettingsForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [backfill, setBackfill] = useState<BackfillStatus>({ state: "idle", updated: 0, skipped: 0, errors: 0 });
  const [backfillPolling, setBackfillPolling] = useState(false);

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

    const payload: Record<string, string> = {};
    for (const field of FIELDS) {
      const val = values[field.key];
      if (!val) continue;
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
      // ignore
    } finally {
      setTesting(false);
    }
  }

  async function startBackfill() {
    if (backfill.state === "running") return;
    setBackfillPolling(true);
    try {
      await fetch("/api/backfill/publisher-series", { method: "POST" });
      pollBackfill();
    } catch {
      setBackfillPolling(false);
    }
  }

  function pollBackfill() {
    const interval = setInterval(async () => {
      try {
        const data: BackfillStatus = await fetch("/api/backfill/publisher-series").then((r) => r.json());
        setBackfill(data);
        if (data.state === "done" || data.state === "error") {
          clearInterval(interval);
          setBackfillPolling(false);
        }
      } catch {
        clearInterval(interval);
        setBackfillPolling(false);
      }
    }, 2000);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[140px] bg-[#111111] border border-white/[0.05] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave} className="space-y-4">
        {/* ROM Library */}
        <SettingsCard
          icon={<FolderOpen className="w-4 h-4" />}
          title="ROM Library"
          subtitle="Where your ROM files live on disk"
        >
          <FieldRow
            field={FIELDS[0]}
            value={values["rom_path"] ?? ""}
            onChange={(v) => setValues((prev) => ({ ...prev, rom_path: v }))}
          />
        </SettingsCard>

        {/* ScreenScraper */}
        <SettingsCard
          icon={<Wifi className="w-4 h-4" />}
          title="ScreenScraper"
          subtitle="Box art and metadata from screenscraper.fr"
          badge={testResults ? <ConnectionBadge status={testResults.screenscraper} /> : null}
        >
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
        </SettingsCard>

        {/* IGDB */}
        <SettingsCard
          icon={<Key className="w-4 h-4" />}
          title="IGDB / Twitch"
          subtitle="Game metadata via IGDB API (requires Twitch dev account)"
          badge={testResults ? <ConnectionBadge status={testResults.igdb} /> : null}
        >
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
        </SettingsCard>

        {/* Backfill Publisher + Series */}
        <SettingsCard
          icon={<Building2 className="w-4 h-4" />}
          title="Publisher + Series Backfill"
          subtitle="Re-fetch publisher and series data for previously scraped games"
        >
          <div className="space-y-3">
            <p className="text-xs text-neutral-600 leading-relaxed">
              Runs in the background at 1 request/second against ScreenScraper.
              Only targets games that have been scraped but are missing publisher or series data.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                type="button"
                variant="ghost"
                onClick={startBackfill}
                disabled={backfill.state === "running" || backfillPolling}
                className="h-9 px-4 text-sm gap-2 text-neutral-400 border border-white/[0.06] hover:text-white hover:bg-white/[0.06] hover:border-white/10"
              >
                {backfill.state === "running" || backfillPolling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {backfill.state === "running" ? "Backfilling..." : "Run Backfill"}
              </Button>
              {backfill.state === "running" && backfill.progress && (
                <span className="text-xs text-neutral-500 font-mono">
                  {backfill.progress.current} / {backfill.progress.total}
                </span>
              )}
              {backfill.state === "done" && (
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Done — {backfill.updated} updated, {backfill.skipped} skipped
                  {backfill.errors > 0 && `, ${backfill.errors} errors`}
                </span>
              )}
              {backfill.state === "error" && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <XCircle className="w-3 h-3" />
                  Backfill failed
                </span>
              )}
            </div>
          </div>
        </SettingsCard>

        {/* Action row */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-9 px-4 text-sm font-medium shadow-none"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "Saving..." : "Save Settings"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleTest}
            disabled={testing || saving}
            className="h-9 px-4 text-sm gap-2 text-neutral-400 border border-white/[0.06] hover:text-white hover:bg-white/[0.06] hover:border-white/10"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {testing ? "Testing..." : "Test Connections"}
          </Button>

          {saveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1.5 text-sm text-red-400">
              <XCircle className="w-3.5 h-3.5" />
              {saveError}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function SettingsCard({
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-[#111111] border-white/[0.06] shadow-none rounded-xl overflow-hidden">
      <CardHeader className="px-5 pt-4 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="text-neutral-500">{icon}</div>
            <div>
              <p className="text-sm font-semibold text-neutral-200">{title}</p>
              <p className="text-xs text-neutral-600 mt-0.5">{subtitle}</p>
            </div>
          </div>
          {badge && <div>{badge}</div>}
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5 space-y-4">
        <div className="border-t border-white/[0.04] pt-4 space-y-4">
          {children}
        </div>
      </CardContent>
    </Card>
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
      <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
        {field.label}
      </label>
      <Input
        type={field.type}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "bg-[#0d0d0d] border-white/[0.08] text-neutral-100 placeholder:text-neutral-700",
          "focus-visible:border-blue-500/50 focus-visible:ring-0 focus-visible:ring-offset-0",
          "h-9 text-sm font-mono"
        )}
        autoComplete="off"
        data-1p-ignore
      />
      {field.description && (
        <p className="text-xs text-neutral-700 leading-relaxed">{field.description}</p>
      )}
    </div>
  );
}
