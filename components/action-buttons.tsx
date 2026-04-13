"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ActionState = "idle" | "loading" | "done" | "error";

interface ActionResult {
  ok?: boolean;
  error?: string;
  added?: number;
  scanned?: number;
  skipped?: number;
  processed?: number;
  updated?: number;
}

export function ActionButtons() {
  const [scanState, setScanState] = useState<ActionState>("idle");
  const [scrapeState, setScrapeState] = useState<ActionState>("idle");
  const [scanResult, setScanResult] = useState<ActionResult | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ActionResult | null>(null);

  async function handleScan() {
    setScanState("loading");
    setScanResult(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setScanResult(data);
      setScanState(data.ok ? "done" : "error");
      if (data.ok) {
        // Refresh page to show updated counts
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      setScanResult({ error: "Request failed" });
      setScanState("error");
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

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={scanState === "loading" || scrapeState === "loading"}
          className="border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500"
        >
          {scanState === "loading" ? "Scanning..." : "Scan ROMs"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleScrape}
          disabled={scanState === "loading" || scrapeState === "loading"}
          className="border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500"
        >
          {scrapeState === "loading" ? "Scraping..." : "Scrape Metadata"}
        </Button>
      </div>

      {scanState === "done" && scanResult?.ok && (
        <p className="text-xs text-green-400">
          Scan done — {scanResult.added} added, {scanResult.skipped} skipped
        </p>
      )}
      {scanState === "error" && (
        <p className="text-xs text-red-400">
          Scan failed: {scanResult?.error ?? "unknown error"}
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
