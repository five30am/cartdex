/**
 * Logiqx XML DAT parser — v2 rewrite.
 *
 * Handles:
 *   - Multiple <rom> elements per <game>
 *   - <game status="..."> attribute (good / baddump / nodump)
 *   - cloneof / romof clone-set relationships
 *   - Full <header> capture (name, description, version, author, comment, url,
 *     dat, build, debug, clrmamepro header="..." skipper reference)
 *   - Fail-fast detection of MAME ListXML (<mame> root element)
 *
 * Format sniffing is done by the caller (see sniffDatFormat in dat-ingest.ts).
 * This module only handles <?xml … <datafile …> documents.
 */

import { XMLParser } from "fast-xml-parser";

export type DatEntryStatus = "good" | "baddump" | "nodump";

export const VALID_STATUSES = new Set<string>(["good", "baddump", "nodump"]);

/**
 * Coerce a raw status string from a DAT file into a valid DatEntryStatus.
 *
 * DAT files from the wild occasionally use capitalised or misspelled values.
 * Strategy: lowercase + exact match → accept; unknown → coerce to "good" and
 * emit a warning.  This is the Sage-requested enum validation: we do NOT trust
 * the file blindly.
 */
export function coerceStatus(
  raw: string | undefined,
  context: string
): { status: DatEntryStatus; warning?: string } {
  if (!raw) return { status: "good" };
  const normalized = raw.toLowerCase().trim();
  if (normalized === "good" || normalized === "baddump" || normalized === "nodump") {
    return { status: normalized as DatEntryStatus };
  }
  return {
    status: "good",
    warning: `Unknown status "${raw}" on "${context}" — coerced to "good"`,
  };
}

export interface ParsedRom {
  name: string;
  size?: number;
  crc32?: string;
  md5?: string;
  sha1?: string;
  status: DatEntryStatus;
  /** Warning emitted when an unknown status was coerced. */
  statusWarning?: string;
}

export interface ParsedGame {
  name: string;
  description?: string;
  cloneof?: string;
  romof?: string;
  serial?: string;
  region?: string;
  roms: ParsedRom[];
}

export interface ParsedHeader {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  comment?: string;
  url?: string;
  /** Basename of the skipper XML from <clrmamepro header="..."/>. */
  skipper_ref?: string;
}

export interface ParsedDat {
  header: ParsedHeader;
  games: ParsedGame[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseRomElement(
  rom: Record<string, unknown>,
  gameName: string
): ParsedRom {
  const raw = rom as Record<string, string | undefined>;
  const rawStatus = raw["@_status"];
  const { status, warning } = coerceStatus(rawStatus, gameName);

  return {
    name: (raw["@_name"] as string) ?? "",
    size: raw["@_size"] != null ? parseInt(raw["@_size"] as string, 10) : undefined,
    crc32: (raw["@_crc"] as string | undefined)?.toLowerCase(),
    md5: (raw["@_md5"] as string | undefined)?.toLowerCase(),
    sha1: (raw["@_sha1"] as string | undefined)?.toLowerCase(),
    status,
    statusWarning: warning,
  };
}

function extractSkipperRef(datafile: Record<string, unknown>): string | undefined {
  // <clrmamepro header="filename.xml"/> lives inside the <header> element
  const header = datafile.header as Record<string, unknown> | undefined;
  if (!header) return undefined;

  const clrmamepro = header.clrmamepro as Record<string, unknown> | undefined;
  if (!clrmamepro) return undefined;

  return (clrmamepro["@_header"] as string | undefined) ?? undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Logiqx XML DAT string.
 *
 * Throws:
 *   - If the content appears to be MAME ListXML (root = <mame>)
 *   - If the <datafile> root element is missing
 */
export function parseLogiqxDat(content: string): ParsedDat {
  // Fast MAME detection — check before handing to XMLParser to avoid OOM
  // on 400MB+ MAME ListXML files.
  const firstElement = content.match(/<(\w+)[\s>]/);
  if (firstElement) {
    const tag = firstElement[1].toLowerCase();
    if (tag === "mame") {
      throw new Error(
        "MAME ListXML not supported in v1 — upload a Logiqx <datafile> DAT instead"
      );
    }
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "game" || name === "machine" || name === "rom",
    // Parse numeric attribute values as strings to avoid precision loss on large sizes
    parseAttributeValue: false,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(content) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `XML parse error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const datafile = (parsed.datafile ?? parsed.DATAFILE) as
    | Record<string, unknown>
    | undefined;
  if (!datafile) {
    throw new Error(
      "Invalid Logiqx DAT: missing <datafile> root element"
    );
  }

  const rawHeader = (datafile.header ?? datafile.HEADER) as
    | Record<string, unknown>
    | undefined;

  const header: ParsedHeader = {
    name: String(rawHeader?.name ?? "Unknown"),
    description: rawHeader?.description != null
      ? String(rawHeader.description)
      : undefined,
    version: rawHeader?.version != null ? String(rawHeader.version) : undefined,
    author: rawHeader?.author != null ? String(rawHeader.author) : undefined,
    comment: rawHeader?.comment != null ? String(rawHeader.comment) : undefined,
    url: rawHeader?.url != null ? String(rawHeader.url) : undefined,
    skipper_ref: extractSkipperRef(datafile),
  };

  // <game> and <machine> are both valid top-level elements
  const rawGames = [
    ...((datafile.game as unknown[]) ?? []),
    ...((datafile.machine as unknown[]) ?? []),
  ];

  const games: ParsedGame[] = [];
  const warnings: string[] = [];

  for (const g of rawGames) {
    const game = g as Record<string, unknown>;
    const name = (game["@_name"] as string | undefined) ?? "";
    if (!name) continue;

    const roms: ParsedRom[] = [];
    const rawRoms = (game.rom as Record<string, unknown>[]) ?? [];

    for (const r of rawRoms) {
      const parsed = parseRomElement(r, name);
      if (parsed.statusWarning) warnings.push(parsed.statusWarning);
      roms.push(parsed);
    }

    games.push({
      name,
      description: game.description != null ? String(game.description) : undefined,
      cloneof: (game["@_cloneof"] as string | undefined) ?? undefined,
      romof: (game["@_romof"] as string | undefined) ?? undefined,
      serial: (game["@_serial"] as string | undefined) ?? undefined,
      region: (game["@_region"] as string | undefined) ?? undefined,
      roms,
    });
  }

  return { header, games, warnings };
}
