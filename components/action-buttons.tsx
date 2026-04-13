"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

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
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch("/api/scrape", { method: "POST" });
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
          {scrapeStatus.state === "running" ? "Scraping..." : "Scrape Metadata"}
        </Button>
      </div>

      {scanStatus.state === "running" && scanProgress && (
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-blue-400">
            {scanStatus.phase === "hashing" ? "Hashing" : "Discovering"}: {scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()} files
          </p>
          <div className="w-48 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {scrapeStatus.state === "running" && scrapeProgress && (
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-purple-400">
            Scraping: {scrapeProgress.current.toLocaleString()} / {scrapeProgress.total.toLocaleString()} games
          </p>
          <div className="w-48 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${scrapeProgress.total > 0 ? (scrapeProgress.current / scrapeProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {scanStatus.state === "done" && scanStatus.result && (
        <p className="text-xs text-green-400">
          Scan done — {scanStatus.result.newFiles} new, {scanStatus.result.hashed} hashed, {scanStatus.result.skipped} skipped
        </p>
      )}
      {scanStatus.state === "error" && (
        <p className="text-xs text-red-400">
          Scan failed: {scanStatus.error ?? "unknown error"}
        </p>
      )}

      {scrapeStatus.state === "done" && scrapeStatus.result && (
        <p className="text-xs text-green-400">
          Scrape done — {scrapeStatus.result.updated} updated of {scrapeStatus.result.processed} games
        </p>
      )}
      {scrapeStatus.state === "error" && (
        <p className="text-xs text-red-400">
          Scrape failed: {scrapeStatus.error ?? "unknown error"}
        </p>
      )}
    </div>
  );
}
