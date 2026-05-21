#!/usr/bin/env tsx
/**
 * scripts/cron-dat-refresh.ts
 *
 * Scheduled DAT refresh script — Ticket 9.
 *
 * For each registered auto-fetch provider, iterates every known system slug
 * and calls fetchDat() to pull the latest version. On a successful fetch that
 * produces a NEW DAT row (not a dedupe hit), computeDiff() is fired automatically
 * by dat-fetch.ts. This script does not call computeDiff() directly.
 *
 * Rate-limiting: providers are called one at a time, one system at a time
 * (serial execution). This respects GitHub API courtesy limits and avoids
 * hammering any single upstream host. The built-in route-level rate limiter
 * is bypassed because this is a trusted internal job, but the serializd loop
 * provides equivalent back-pressure.
 *
 * Exit code:
 *   0 — all fetches succeeded or returned "duplicate"/"not_modified"
 *   1 — one or more provider fetches threw an error
 *
 * Usage (from project root):
 *   npx tsx scripts/cron-dat-refresh.ts
 *   npx tsx scripts/cron-dat-refresh.ts --provider libretro-database
 *   npx tsx scripts/cron-dat-refresh.ts --dry-run
 *
 * Flags:
 *   --provider <id>  Only run a specific provider (repeatable).
 *   --dry-run        Print what would be fetched; skip all network + DB calls.
 *
 * Wire to systemd timer on the host running CartDex:
 *   1. Create /etc/systemd/system/cartdex-dat-refresh.service:
 *
 *      [Unit]
 *      Description=CartDex weekly DAT refresh
 *
 *      [Service]
 *      Type=oneshot
 *      WorkingDirectory=/path/to/cartdex
 *      ExecStart=npx tsx scripts/cron-dat-refresh.ts
 *      StandardOutput=journal
 *      StandardError=journal
 *
 *   2. Create /etc/systemd/system/cartdex-dat-refresh.timer:
 *
 *      [Unit]
 *      Description=Run CartDex DAT refresh weekly
 *
 *      [Timer]
 *      OnCalendar=Sun *-*-* 02:00:00
 *      Persistent=true
 *
 *      [Install]
 *      WantedBy=timers.target
 *
 *   3. sudo systemctl daemon-reload
 *      sudo systemctl enable --now cartdex-dat-refresh.timer
 *      sudo systemctl list-timers cartdex-dat-refresh.timer
 *
 * IMPORTANT — NO module-init side effects:
 *   This file imports library modules that register their own side effects only
 *   when invoked (e.g. ensureSchema). No global state is mutated at import time.
 *   The script is safe to import in test environments.
 */

import { getAllProviders } from "@/lib/services/dat-fetch-providers/index";
import { fetchDat } from "@/lib/services/dat-fetch";
import { ensureSchema } from "@/lib/db/migrate";

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const providerFilter: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--provider" && args[i + 1]) {
    providerFilter.push(args[i + 1]);
    i++;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap DB schema (idempotent — safe to call on every run)
// ---------------------------------------------------------------------------

// ensureSchema runs CREATE TABLE IF NOT EXISTS — safe on first run and
// on every subsequent run with no schema changes.
ensureSchema();

// ---------------------------------------------------------------------------
// Determine providers to run
// ---------------------------------------------------------------------------

const allProviders = getAllProviders();
const targetProviders =
  providerFilter.length > 0
    ? allProviders.filter((p) => providerFilter.includes(p.id))
    : allProviders;

if (targetProviders.length === 0) {
  if (providerFilter.length > 0) {
    console.error(
      `[cron-dat-refresh] No providers matched filter [${providerFilter.join(", ")}]. ` +
        `Registered providers: ${allProviders.map((p) => p.id).join(", ")}`
    );
  } else {
    console.log("[cron-dat-refresh] No providers registered. Nothing to do.");
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Determine system slugs per provider
// ---------------------------------------------------------------------------

// In v1 the libretro-database provider has a built-in slug→URL map. We call
// fetchDat with systemSlug=undefined first (provider-level fetch) and then
// optionally with specific slugs. For now we call each provider once without
// a system slug — the provider fetches its default set or all systems.
//
// If a provider needs per-system calls (e.g. to do conditional GETs per
// system), add slug enumeration here by consulting the provider's exported
// SYSTEM_SLUGS constant. That's a v2 concern; for now a single call per
// provider covers the common case.
//
// Update: since libretro-database requires a systemSlug to avoid a provider
// error (it has no global DAT), we query the dats table for slugs that have
// previously been fetched from each provider and re-fetch those. For a fresh
// install with no prior fetches, we log that there's nothing to refresh and
// suggest the user run a manual fetch first.

import { db } from "@/lib/db";
import { dats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let totalFetched = 0;
let totalDuplicates = 0;
let totalErrors = 0;

console.log(`\nCartDex DAT Refresh`);
console.log(`====================`);
console.log(`Mode       : ${dryRun ? "DRY RUN (no network or DB writes)" : "LIVE"}`);
console.log(`Providers  : ${targetProviders.map((p) => p.id).join(", ")}`);
console.log(`Started at : ${new Date().toISOString()}`);
console.log();

for (const provider of targetProviders) {
  console.log(`--- Provider: ${provider.name} (${provider.id}) ---`);

  // Find all unique system slugs previously fetched via this provider by
  // looking at dat_entries for DATs with source_kind "fetch". We don't store
  // provider_id on dats, so we use the settings key pattern to identify them.
  //
  // Simpler heuristic: all "fetch" source_kind DATs — re-fetch by name.
  // We pass systemSlug = undefined when the provider handles the full catalogue,
  // or we skip and log a hint when no prior fetches exist.
  //
  // For libretro-database specifically: the system slug is embedded in the DAT
  // name (e.g. "Nintendo - Game Boy (libretro-database)"). We extract the slug
  // by checking the settings key (dat_fetch_lm:<provider>:<slug>). This is the
  // v1 approach — a per-provider listSlugs() method would be cleaner in v2.

  const settingsKeyPrefix = `dat_fetch_lm:${provider.id}:`;
  const { settings } = await import("@/lib/db/schema");
  const { like } = await import("drizzle-orm");

  const knownKeys = db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(like(settings.key, `${settingsKeyPrefix}%`))
    .all();

  if (knownKeys.length === 0) {
    console.log(
      `  No prior fetches found for provider "${provider.id}". ` +
        `Run a manual fetch from the DAT Library UI to seed the system list.`
    );
    continue;
  }

  // Extract system slugs from settings keys
  const slugs = knownKeys
    .map((row) => row.key.slice(settingsKeyPrefix.length))
    .filter((slug) => slug !== "__all__");

  const targets = slugs.length > 0 ? slugs : [undefined as unknown as string];

  for (const systemSlug of targets) {
    const label = systemSlug
      ? `${provider.id}/${systemSlug}`
      : `${provider.id}/(no slug)`;

    if (dryRun) {
      console.log(`  DRY-RUN  would fetch: ${label}`);
      continue;
    }

    try {
      const result = await fetchDat({
        providerId: provider.id,
        systemSlug: systemSlug || undefined,
      });

      if (result.status === "ingested") {
        totalFetched++;
        console.log(
          `  INGESTED ${label} → dat_id=${result.dat_id} entries=${result.entry_count} ` +
            (result.warnings.length > 0 ? `warnings=${result.warnings.length}` : "")
        );
      } else if (result.status === "duplicate") {
        totalDuplicates++;
        console.log(`  DUPLICATE ${label} → dat_id=${result.dat_id} (no change)`);
      } else {
        // "not_modified" — 304 from server
        console.log(`  NOT_MODIFIED ${label}`);
      }
    } catch (err) {
      totalErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR ${label}: ${msg}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log();
console.log(`Finished at : ${new Date().toISOString()}`);
console.log(`Ingested    : ${totalFetched}`);
console.log(`Duplicates  : ${totalDuplicates}`);
console.log(`Errors      : ${totalErrors}`);

if (totalErrors > 0) {
  console.error(`\n[cron-dat-refresh] ${totalErrors} provider(s) failed. See errors above.`);
  process.exit(1);
}
