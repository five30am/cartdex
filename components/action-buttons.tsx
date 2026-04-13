"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ScanStatus {
  state: "idle" | "running" | "done" | "error";
  progress?: { current: number; total: number };
  result?: { scanned: number; added: number; skipped: number; errors: string[] };
  error?: string;
}

interface ActionResult {
  ok?: boolean;
  error?: string;
  processed?: number;
  updated?: number;
}

export function ActionButtons() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>({ state: "idle" });
  const [scrapeState, setScrapeState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [scrapeResult, setScrapeResult] = useState<ActionResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll scan status while running
  useEffect(() => {
    if (scanStatus.state === "running" && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/scan");
          const data: ScanStatus = await res.json();
          setScanStatus(data);
          if (data.state !== "running") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
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
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [scanStatus.state]);

  async function handleScan() {
    setScanStatus({ state: "running" });
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) {
        setScanStatus({ state: "error", error: data.error });
      }
      // Polling will pick up the actual status
    } catch {
      setScanStatus({ state: "error", error: "Failed to start scan" });
    }
  }

  async function handleScrape() {
    setScrapeState("loading");
    setScrapeResult(null);
    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const data = await res.json();
      setScrapeResult(data);
      setScrapeState(data.ok ? "done" : "error");
      if (data.ok) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setScrapeResult({ error: "Request failed" });
      setScrapeState("error");
    }
  }

  const isbusy = scanStatus.state === "running" || scrapeState === "loading";
  const progress = scanStatus.progress;

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={isbusy}
          className="border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500"
        >
          {scanStatus.state === "running" ? "Scanning..." : "Scan ROMs"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleScrape}
          disabled={isbusy}
          className="border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500"
        >
          {scrapeState === "loading" ? "Scraping..." : "Scrape Metadata"}
        </Button>
      </div>

      {scanStatus.state === "running" && progress && (
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-blue-400">
            Scanning: {progress.current.toLocaleString()} / {progress.total.toLocaleString()} files
          </p>
          <div className="w-48 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {scanStatus.state === "done" && scanStatus.result && (
        <p className="text-xs text-green-400">
          Scan done — {scanStatus.result.added} added, {scanStatus.result.skipped} skipped
        </p>
      )}
      {scanStatus.state === "error" && (
        <p className="text-xs text-red-400">
          Scan failed: {scanStatus.error ?? "unknown error"}
        </p>
      )}

      {scrapeState === "done" && scrapeResult?.ok && (
        <p className="text-xs text-green-400">
          Scrape done — {scrapeResult.updated} updated of {scrapeResult.processed} games
        </p>
      )}
      {scrapeState === "error" && (
        <p className="text-xs text-red-400">
          Scrape failed: {scrapeResult?.error ?? "unknown error"}
        </p>
      )}
    </div>
  );
}
