/**
 * DAT ingest pipeline — Ticket 2.
 *
 * Responsibilities:
 *   1. Format sniffing: Logiqx XML vs ClrMamePro textual vs unsupported
 *   2. Parse via the appropriate parser
 *   3. Write `dats` + `dat_entries` in a single SQLite transaction
 *
 * The route handler (`POST /api/dats`) owns:
 *   - Reading the multipart body and extracting the file buffer
 *   - Computing the SHA-256 file hash (used as dedupe key)
 *   - Rate limiting
 *   - Calling `ingestDat` with the buffer + hash
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { dats, dat_entries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseLogiqxDat, coerceStatus } from "./dat-parser";
import { parseClrmaneDat } from "./dat-parser-clrmame";

export type DatFormat = "logiqx" | "clrmame" | "unknown";

// ---------------------------------------------------------------------------
// Format sniffing
// ---------------------------------------------------------------------------

/**
 * Sniff the DAT format from the first few hundred bytes of content.
 *
 * - Logiqx:   starts with <?xml or has a <datafile element
 * - ClrMame:  has `clrmamepro (` near the start (after whitespace/comments)
 * - MAME:     <mame root element — detected later in the Logiqx parser
 * - Unknown:  anything else
 */
export function sniffDatFormat(content: string): DatFormat {
  const head = content.slice(0, 2048).trimStart();

  if (head.startsWith("<?xml") || /^<datafile[\s>]/i.test(head)) {
    return "logiqx";
  }

  // ClrMamePro files typically open with the clrmamepro header block,
  // possibly preceded by comments (#…) or blank lines.
  const strippedComments = head.replace(/#[^\n]*/g, "").trimStart();
  if (/^clrmamepro\s*\(/i.test(strippedComments)) {
    return "clrmame";
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// SHA-256 helper
// ---------------------------------------------------------------------------

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ---------------------------------------------------------------------------
// Canonical entry shape used by the ingest transaction
// ---------------------------------------------------------------------------

interface EntryCandidate {
  name: string;
  size?: number;
  crc32?: string;
  md5?: string;
  sha1?: string;
  status: "good" | "baddump" | "nodump";
  cloneof?: string;
  romof?: string;
  serial?: string;
  region?: string;
}

// ---------------------------------------------------------------------------
// Ingest result
// ---------------------------------------------------------------------------

export interface IngestResult {
  dat_id: number;
  name: string;
  version: string | undefined;
  entry_count: number;
  warnings: string[];
  format: DatFormat;
}

// ---------------------------------------------------------------------------
// Main ingest function
// ---------------------------------------------------------------------------

/**
 * Parse and persist a DAT file buffer.
 *
 * @param buffer  Raw file bytes (already read from the multipart upload)
 * @param fileHash  SHA-256 hex of the buffer — used as dedupe key
 *
 * Throws with `err.code` set to one of:
 *   - "DAT_DUPLICATE"          — file hash already in `dats`
 *   - "DAT_FORMAT_UNSUPPORTED" — unrecognised format
 *   - Any string (parse error) — re-thrown as-is; caller wraps in DAT_PARSE_ERROR
 */
export function ingestDat(buffer: Buffer, fileHash: string): IngestResult {
  // --- Duplicate check ---
  const existing = db
    .select({ id: dats.id })
    .from(dats)
    .where(eq(dats.file_hash, fileHash))
    .get();

  if (existing) {
    const err = new Error("This DAT file has already been imported (duplicate file hash)");
    (err as Error & { code: string }).code = "DAT_DUPLICATE";
    throw err;
  }

  const content = buffer.toString("utf-8");
  const format = sniffDatFormat(content);

  if (format === "unknown") {
    const err = new Error(
      "Unrecognised DAT format — expected Logiqx XML (<datafile>) or ClrMamePro textual (clrmamepro ( ... ))"
    );
    (err as Error & { code: string }).code = "DAT_FORMAT_UNSUPPORTED";
    throw err;
  }

  // --- Parse ---
  let parsedHeader: {
    name: string;
    description?: string;
    version?: string;
    author?: string;
    skipper_ref?: string;
  };

  const entries: EntryCandidate[] = [];
  const warnings: string[] = [];

  if (format === "logiqx") {
    // MAME detection is inside parseLogiqxDat — throws with clear message
    const parsed = parseLogiqxDat(content);
    parsedHeader = parsed.header;
    warnings.push(...parsed.warnings);

    for (const game of parsed.games) {
      for (const rom of game.roms) {
        entries.push({
          name: game.name,
          size: rom.size,
          crc32: rom.crc32,
          md5: rom.md5,
          sha1: rom.sha1,
          status: rom.status,
          cloneof: game.cloneof,
          romof: game.romof,
          serial: game.serial,
          region: game.region,
        });
      }
    }
  } else {
    // ClrMamePro
    const parsed = parseClrmaneDat(content);
    parsedHeader = {
      name: parsed.header.name,
      description: parsed.header.description,
      version: parsed.header.version,
      author: parsed.header.author,
      skipper_ref: parsed.header.skipper_ref,
    };

    for (const game of parsed.games) {
      for (const rom of game.roms) {
        // Validate/coerce status using the same logic as the Logiqx parser
        const { status, warning } = coerceStatus(rom.status, game.name);
        if (warning) warnings.push(warning);

        entries.push({
          name: game.name,
          size: rom.size,
          crc32: rom.crc32,
          md5: rom.md5,
          sha1: rom.sha1,
          status,
          cloneof: game.cloneof,
          romof: game.romof,
          serial: game.serial,
          region: game.region,
        });
      }
    }
  }

  // --- Persist in a single transaction ---
  const result = db.transaction(() => {
    const inserted = db
      .insert(dats)
      .values({
        name: parsedHeader.name,
        description: parsedHeader.description ?? null,
        version: parsedHeader.version ?? null,
        author: parsedHeader.author ?? null,
        source_kind: "upload",
        file_hash: fileHash,
        skipper_ref: parsedHeader.skipper_ref ?? null,
      })
      .returning({ dat_id: dats.id })
      .get();

    const dat_id = inserted.dat_id;

    // Insert entries in batches of 500 to stay well under SQLite's
    // SQLITE_MAX_VARIABLE_NUMBER limit (32766 by default, ~65 columns × 500 rows = 32500)
    const BATCH_SIZE = 500;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      db.insert(dat_entries)
        .values(
          batch.map((e) => ({
            dat_id,
            name: e.name,
            size: e.size ?? null,
            crc32: e.crc32 ?? null,
            md5: e.md5 ?? null,
            sha1: e.sha1 ?? null,
            status: e.status,
            cloneof: e.cloneof ?? null,
            romof: e.romof ?? null,
            serial: e.serial ?? null,
            region: e.region ?? null,
          }))
        )
        .run();
    }

    return { dat_id };
  });

  return {
    dat_id: result.dat_id,
    name: parsedHeader.name,
    version: parsedHeader.version,
    entry_count: entries.length,
    warnings,
    format,
  };
}
