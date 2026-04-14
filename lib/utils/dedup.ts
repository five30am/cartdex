/**
 * ROM deduplication utilities — region normalization and duplicate grouping.
 * Ported from Paige's analysis doc; extracted here for unit-testability.
 */

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

export interface DuplicateEntry {
  id: number;
  title: string;
  file_path: string;
  file_size: number | null;
  file_created_at: string | null;
  region: RegionLabel;
  hash_sha1: string | null;
  hashed: boolean;
}

export interface DuplicateGroup {
  canonical_title: string;
  system_id: number;
  system_name: string;
  system_slug: string;
  keep: DuplicateEntry;
  duplicates: DuplicateEntry[];
}

/**
 * Group non-hidden games into duplicate sets.
 * A "group" is 2+ rows with the same canonical title on the same system.
 * Within each group the best-region file is KEEP; the rest are duplicates.
 */
export function buildDuplicateGroups(rows: GameRow[]): DuplicateGroup[] {
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

    const entries: DuplicateEntry[] = bucket.map((r) => ({
      id: r.id,
      title: r.title,
      file_path: r.file_path,
      file_size: r.file_size,
      file_created_at: r.file_created_at,
      region: detectRegion(r.title),
      hash_sha1: r.hash_sha1,
      hashed: r.hashed,
    }));

    // Sort by region priority (best first), then by title alphabetically
    entries.sort((a, b) => {
      const pd = regionPriority(a.region) - regionPriority(b.region);
      if (pd !== 0) return pd;
      return a.title.localeCompare(b.title);
    });

    const [keep, ...duplicates] = entries;

    groups.push({
      canonical_title: canonical,
      system_id: bucket[0].system_id,
      system_name: bucket[0].system_name,
      system_slug: bucket[0].system_slug,
      keep,
      duplicates,
    });
  }

  // Sort groups alphabetically by canonical title then system
  groups.sort((a, b) =>
    a.canonical_title.localeCompare(b.canonical_title) ||
    a.system_name.localeCompare(b.system_name)
  );

  return groups;
}
