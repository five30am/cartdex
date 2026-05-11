"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine, Download, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { mutationHeaders } from "@/lib/api-token";

interface ScanStatus {
  state: "idle" | "running" | "done" | "error";
  phase?: "discovering" | "hashing";
  progress?: { current: number; total: number };
  result?: { discovered: number; newFiles: number; hashed: number; skipped: number; errors: string[] };
  error?: string;
}

interface ScrapeStatus {
  state: "idle" | "running" | "done" | "error";
  progress?: { current: number; total: number };
  result?: { processed: number; updated: number; skipped: number; errors: string[] };
  error?: string;
}

export function ActionButtons() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>({ state: "idle" });
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>({ state: "idle" });
  const scanPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrapePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll scan status while running
  useEffect(() => {
    if (scanStatus.state === "running" && !scanPollRef.current) {
      scanPollRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/scan");
          const data: ScanStatus = await res.json();
          setScanStatus(data);
          if (data.state !== "running") {
            if (scanPollRef.current) clearInterval(scanPollRef.current);
            scanPollRef.current = null;
            if (data.state === "done") {
              setTimeout(() => window.location.reload(), 1000);
            }
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
    }
    return () => {
      if (scanPollRef.current) {
        clearInterval(scanPollRef.current);
        scanPollRef.current = null;
      }
    };
  }, [scanStatus.state]);

  // Poll scrape status while running
  useEffect(() => {
    if (scrapeStatus.state === "running" && !scrapePollRef.current) {
      scrapePollRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/scrape");
          const data: ScrapeStatus = await res.json();
          setScrapeStatus(data);
          if (data.state !== "running") {
            if (scrapePollRef.current) clearInterval(scrapePollRef.current);
            scrapePollRef.current = null;
            if (data.state === "done") {
              setTimeout(() => window.location.reload(), 1500);
            }
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
    }
    return () => {
      if (scrapePollRef.current) {
        clearInterval(scrapePollRef.current);
        scrapePollRef.current = null;
      }
    };
  }, [scrapeStatus.state]);

  async function handleScan() {
    setScanStatus({ state: "running" });
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { ...(await mutationHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) {
        setScanStatus({ state: "error", error: data.error });
      }
    } catch {
      setScanStatus({ state: "error", error: "Failed to start scan" });
    }
  }

  async function handleScrape() {
    setScrapeStatus({ state: "running" });
    try {
      const res = await fetch("/api/scrape", { method: "POST", headers: await mutationHeaders() });
      const data = await res.json();
      if (!data.ok) {
        setScrapeStatus({ state: "error", error: data.error });
      }
    } catch {
      setScrapeStatus({ state: "error", error: "Failed to start scrape" });
    }
  }

  const isbusy = scanStatus.state === "running" || scrapeStatus.state === "running";
  const scanProgress = scanStatus.progress;
  const scrapeProgress = scrapeStatus.progress;

  const scanPct = scanProgress && scanProgress.total > 0
    ? Math.round((scanProgress.current / scanProgress.total) * 100)
    : 0;
  const scrapePct = scrapeProgress && scrapeProgress.total > 0
    ? Math.round((scrapeProgress.current / scrapeProgress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-2 items-end">
      {/* Buttons row */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleScan}
          disabled={isbusy}
          className={cn(
            "h-8 px-3 text-xs font-medium gap-1.5 transition-all",
            scanStatus.state === "running"
              ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20"
              : scanStatus.state === "done"
              ? "text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20"
              : scanStatus.state === "error"
              ? "text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20"
              : "text-muted-foreground border border-border hover:text-foreground hover:bg-accent"
          )}
        >
          {scanStatus.state === "running" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : scanStatus.state === "done" ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : scanStatus.state === "error" ? (
            <XCircle className="w-3.5 h-3.5" />
          ) : (
            <ScanLine className="w-3.5 h-3.5" />
          )}
          {scanStatus.state === "running"
            ? scanStatus.phase === "hashing" ? "Hashing..." : "Scanning..."
            : scanStatus.state === "done"
            ? "Scan done"
            : scanStatus.state === "error"
            ? "Scan failed"
            : "Scan ROMs"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleScrape}
          disabled={isbusy}
          className={cn(
            "h-8 px-3 text-xs font-medium gap-1.5 transition-all",
            scrapeStatus.state === "running"
              ? "text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20"
              : scrapeStatus.state === "done"
              ? "text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20"
              : scrapeStatus.state === "error"
              ? "text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20"
              : "text-muted-foreground border border-border hover:text-foreground hover:bg-accent"
          )}
        >
          {scrapeStatus.state === "running" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : scrapeStatus.state === "done" ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : scrapeStatus.state === "error" ? (
            <XCircle className="w-3.5 h-3.5" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          {scrapeStatus.state === "running"
            ? "Scraping..."
            : scrapeStatus.state === "done"
            ? "Scrape done"
            : scrapeStatus.state === "error"
            ? "Scrape failed"
            : "Scrape Metadata"}
        </Button>
      </div>

      {/* Scan progress bar */}
      {scanStatus.state === "running" && scanProgress && (
        <div className="flex flex-col items-end gap-1 w-52">
          <div className="flex items-center justify-between w-full">
            <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 font-mono">
              {scanStatus.phase === "hashing" ? "hashing" : "discovering"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
              {scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()}
            </p>
          </div>
          <div className="w-full h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(59,130,246,0.6)]"
              style={{ width: `${scanPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/60 font-mono">{scanPct}%</p>
        </div>
      )}

      {/* Scrape progress bar */}
      {scrapeStatus.state === "running" && scrapeProgress && (
        <div className="flex flex-col items-end gap-1 w-52">
          <div className="flex items-center justify-between w-full">
            <p className="text-[11px] text-violet-600/80 dark:text-violet-400/80 font-mono">
              scraping metadata
            </p>
            <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
              {scrapeProgress.current.toLocaleString()} / {scrapeProgress.total.toLocaleString()}
            </p>
          </div>
          <div className="w-full h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(139,92,246,0.6)]"
              style={{ width: `${scrapePct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/60 font-mono">{scrapePct}%</p>
        </div>
      )}

      {/* Result summaries */}
      {scanStatus.state === "done" && scanStatus.result && (
        <p className="text-[11px] text-muted-foreground font-mono">
          <span className="text-green-500 dark:text-green-400">{scanStatus.result.newFiles}</span> new &middot; <span className="text-foreground/70">{scanStatus.result.hashed}</span> hashed &middot; <span className="text-muted-foreground">{scanStatus.result.skipped}</span> skipped
        </p>
      )}
      {scanStatus.state === "error" && (
        <p className="text-[11px] text-red-400/80 font-mono">
          {scanStatus.error ?? "unknown error"}
        </p>
      )}
      {scrapeStatus.state === "done" && scrapeStatus.result && (
        <p className="text-[11px] text-muted-foreground font-mono">
          <span className="text-green-500 dark:text-green-400">{scrapeStatus.result.updated}</span> updated of <span className="text-foreground/70">{scrapeStatus.result.processed}</span> games
        </p>
      )}
      {scrapeStatus.state === "error" && (
        <p className="text-[11px] text-red-400/80 font-mono">
          {scrapeStatus.error ?? "unknown error"}
        </p>
      )}
    </div>
  );
}
