/**
 * ROM deduplication utilities — region normalization and duplicate grouping.
 * v1.2.1: Metadata-first scoring using Screenscraper region data with filename fallback.
 */

import type { ScraperRegionData } from "@/lib/services/dedup-metadata";

export type RegionLabel =
  | "USA"
  | "USA_EQUIV"
  | "World"
  | "Europe"
  | "Japan"
  | "Unknown";

/** Map a ROM filename to a region label. */
export function detectRegion(title: string): RegionLabel {
  const t = title.toLowerCase();

  if (
    t.includes("(usa)") ||
    t.includes("(u)") ||
    t.includes("(usa, europe)")
  ) {
    return "USA";
  }
  if (
    t.includes("(usa, australia)") ||
    t.includes("(usa, brazil)") ||
    t.includes("(americas)")
  ) {
    return "USA_EQUIV";
  }
  if (t.includes("(world)")) return "World";
  if (
    t.includes("(europe)") ||
    t.includes("(e)") ||
    t.includes("(eur)")
  ) {
    return "Europe";
  }
  if (
    t.includes("(japan)") ||
    t.includes("(j)") ||
    t.includes("(jpn)")
  ) {
    return "Japan";
  }
  return "Unknown";
}

const REGION_PRIORITY: RegionLabel[] = [
  "USA",
  "USA_EQUIV",
  "World",
  "Europe",
  "Japan",
  "Unknown",
];

/** Lower index = higher priority. */
export function regionPriority(region: RegionLabel): number {
  return REGION_PRIORITY.indexOf(region);
}

/**
 * Strip region tags, revision tags, and common noise tokens from a title
 * to produce a canonical grouping key.
 *
 * Examples:
 *   "Super Mario Bros. (U) [!]"          → "super mario bros"
 *   "Super Mario Bros. (USA) (Rev 1)"    → "super mario bros"
 *   "Kirby's Adventure (U) (PRG1) [!]"  → "kirbys adventure"
 */
export function canonicalTitle(title: string): string {
  return title
    // Remove everything inside square brackets e.g. [!], [b1]
    .replace(/\[[^\]]*\]/g, "")
    // Remove parenthesised tokens (region, revision, alt, etc.)
    .replace(/\([^)]*\)/g, "")
    // Remove apostrophes so "Kirby's" and "Kirbys" group together
    .replace(/'/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface GameRow {
  id: number;
  title: string;
  file_path: string;
  file_size: number | null;
  file_created_at: string | null;
  hash_sha1: string | null;
  hashed: boolean;
  system_id: number;
  system_name: string;
  system_slug: string;
}

/**
 * Source for the recommend decision, surfaced in the UI tooltip.
 * "screenscraper" = region from Screenscraper API
 * "filename"      = filename-based region tags only (fallback)
 */
export type RecommendSource = "screenscraper" | "filename";

export interface DuplicateEntry {
  id: number;
  title: string;
  file_path: string;
  file_size: number | null;
  file_created_at: string | null;
  region: RegionLabel;
  hash_sha1: string | null;
  hashed: boolean;
  // v1.2.1 — scraper-backed fields (null when metadata unavailable)
  scraper_region: string | null;
  scraper_languages: string[];
  scraper_is_primary_release: boolean;
  scraper_source: "screenscraper" | "igdb" | null;
}

export interface DuplicateGroup {
  canonical_title: string;
  system_id: number;
  system_name: string;
  system_slug: string;
  /** All files in the group — no pre-split into keep/duplicates. */
  all_files: DuplicateEntry[];
  /** ID of the file the algorithm recommends keeping. */
  recommended_keep_id: number;
  /** How the recommendation was determined — for tooltip display. */
  recommended_source: RecommendSource;
  /** Human-readable reason string shown in the UI tooltip. */
  recommended_reason: string;
}

/** Screenscraper region code → our RegionLabel */
function scraperRegionToLabel(scraperRegion: string | null): RegionLabel | null {
  if (!scraperRegion) return null;
  const r = scraperRegion.toLowerCase();
  if (r === "us") return "USA";
  if (r === "wor") return "World";
  if (r === "eu") return "Europe";
  if (r === "jp") return "Japan";
  return null;
}

/**
 * Compute a numeric score for a candidate file. Higher = better.
 *
 * Scoring tiers (metadata path):
 *   +1000  scraper_region matches preferred region (default "USA")
 *   +500   scraper_languages contains "en"
 *   +250   scraper_is_primary_release
 *   +100   scraper_region maps to a known region label
 *
 * Fallback tier (filename):
 *   100 - regionPriority(filenamRegion) × 20
 *   (USA = 100, USA_EQUIV = 80, World = 60, Europe = 40, Japan = 20, Unknown = 0)
 *
 * The metadata path always scores above the filename-only max (100) so
 * metadata-backed entries beat filename-only entries when mixed in a group.
 */
function scoreEntry(entry: DuplicateEntry, preferredRegion: string): number {
  const hasMetadata =
    entry.scraper_source !== null &&
    (entry.scraper_region !== null || entry.scraper_languages.length > 0);

  if (hasMetadata) {
    let score = 0;
    const scraperRegionNorm = (entry.scraper_region ?? "").toLowerCase();
    const preferredNorm = preferredRegion.toLowerCase();

    // Region match against preferred — map our label to SS region code
    const preferredSsCode =
      preferredNorm === "usa"
        ? "us"
        : preferredNorm === "world"
        ? "wor"
        : preferredNorm === "europe"
        ? "eu"
        : preferredNorm === "japan"
        ? "jp"
        : preferredNorm;

    if (scraperRegionNorm === preferredSsCode) score += 1000;
    else if (scraperRegionNorm === "wor") score += 600; // World is universal
    if (entry.scraper_languages.map((l) => l.toLowerCase()).includes("en")) score += 500;
    if (entry.scraper_is_primary_release) score += 250;
    if (scraperRegionNorm) score += 100; // any known region beats Unknown

    return score;
  }

  // Filename fallback
  const pri = regionPriority(entry.region);
  return 100 - pri * 20;
}

/**
 * Build a human-readable reason string for the recommended badge tooltip.
 */
function buildRecommendReason(entry: DuplicateEntry, preferredRegion: string): string {
  if (entry.scraper_source === "screenscraper") {
    const parts: string[] = ["Screenscraper"];
    if (entry.scraper_region) parts.push(entry.scraper_region.toUpperCase());
    if (entry.scraper_languages.length > 0) parts.push(entry.scraper_languages.join("/"));
    if (entry.scraper_is_primary_release) parts.push("primary release");
    return parts.join(", ");
  }
  if (entry.scraper_source === "igdb") {
    return `IGDB metadata`;
  }
  return `Filename only: ${entry.region} tag`;
}

/**
 * Group non-hidden games into duplicate sets.
 * A "group" is 2+ rows with the same canonical title on the same system.
 *
 * scraperData: optional map of game ID → scraper region data. When provided,
 * metadata-first scoring activates. When absent (creds not configured), falls
 * back to filename-based scoring for all entries.
 */
export function buildDuplicateGroups(
  rows: GameRow[],
  scraperData?: Map<number, ScraperRegionData>,
  preferredRegion = "USA"
): DuplicateGroup[] {
  // Map: `${systemId}::${canonical}` → rows
  const map = new Map<string, GameRow[]>();

  for (const row of rows) {
    const key = `${row.system_id}::${canonicalTitle(row.title)}`;
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }

  const groups: DuplicateGroup[] = [];

  for (const [key, bucket] of map) {
    if (bucket.length < 2) continue;

    const canonical = key.split("::").slice(1).join("::");

    const entries: DuplicateEntry[] = bucket.map((r) => {
      const meta = scraperData?.get(r.id);
      return {
        id: r.id,
        title: r.title,
        file_path: r.file_path,
        file_size: r.file_size,
        file_created_at: r.file_created_at,
        region: detectRegion(r.title),
        hash_sha1: r.hash_sha1,
        hashed: r.hashed,
        scraper_region: meta?.scraper_region ?? null,
        scraper_languages: meta?.scraper_languages ?? [],
        scraper_is_primary_release: meta?.scraper_is_primary_release ?? false,
        scraper_source: meta?.scraper_source ?? null,
      };
    });

    // Score each entry; sort descending (highest = best)
    entries.sort((a, b) => {
      const scoreDiff =
        scoreEntry(b, preferredRegion) - scoreEntry(a, preferredRegion);
      if (scoreDiff !== 0) return scoreDiff;
      // Tiebreak: alphabetical by title
      return a.title.localeCompare(b.title);
    });

    const winner = entries[0];
    const recommended_keep_id = winner.id;

    const hasAnyMetadata = entries.some((e) => e.scraper_source !== null);
    const winnerHasMetadata = winner.scraper_source !== null;

    const recommended_source: RecommendSource =
      winnerHasMetadata ? "screenscraper" : "filename";

    const recommended_reason = buildRecommendReason(winner, preferredRegion);

    groups.push({
      canonical_title: canonical,
      system_id: bucket[0].system_id,
      system_name: bucket[0].system_name,
      system_slug: bucket[0].system_slug,
      all_files: entries,
      recommended_keep_id,
      recommended_source,
      recommended_reason,
    });
  }

  // Sort groups alphabetically by canonical title then system
  groups.sort((a, b) =>
    a.canonical_title.localeCompare(b.canonical_title) ||
    a.system_name.localeCompare(b.system_name)
  );

  return groups;
}
