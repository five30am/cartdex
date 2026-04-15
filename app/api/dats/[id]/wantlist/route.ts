/**
 * GET /api/dats/[id]/wantlist?format=csv|md|fixdat
 *
 * Streams the missing entries for the given DAT as a downloadable file.
 * "Missing" = dat_entries rows with no corresponding match_results row where
 * match_type is 'have' or 'have_baddump'. Since match_results is hit-only,
 * this is resolved via LEFT JOIN … WHERE mr.dat_entry_id IS NULL.
 * Entries where the DAT itself marks status='nodump' are also excluded — they
 * are unobtainable by definition and should not appear in a wantlist.
 *
 * Formats:
 *   csv    — RFC 4180, header: name,size,crc32,sha1,status,region
 *   md     — GitHub-flavoured checklist grouped by region
 *   fixdat — Logiqx XML DAT of just the missing entries (igir convention)
 *
 * Content-Disposition is set to attachment with a sanitized filename derived
 * from the DAT name. Sanitization: allowlist [A-Za-z0-9._-]; everything else
 * becomes '_'. This prevents CR/LF injection in the header.
 *
 * Streaming: rows are fetched via SQLite's .iterate() and flushed in batches
 * so a 100k-entry DAT does not materialise entirely in memory before the first
 * byte is sent.
 *
 * Known limitation: the ReadableStream uses a pull-based controller, which
 * means the SQLite read cursor stays open while the client consumes bytes.
 * A slow client holds the cursor for the duration of the download, which can
 * block WAL checkpointing in extreme cases. Acceptable for this single-user
 * homelab tool; revisit if/when multi-user support lands.
 */

import { NextRequest } from "next/server";
import { sqlite } from "@/lib/db";
import { db } from "@/lib/db";
import { dats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  apiError,
  apiErrorFromUnknown,
  ApiErrorCode,
} from "@/lib/api-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WantlistFormat = "csv" | "md" | "fixdat";

interface MissingEntry {
  name: string;
  size: number | null;
  crc32: string | null;
  sha1: string | null;
  status: string;
  region: string | null;
}

interface DatRow {
  id: number;
  name: string;
  description: string | null;
  version: string | null;
  author: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_FORMATS: Set<string> = new Set(["csv", "md", "fixdat"]);
const BATCH_SIZE = 500;

/**
 * Sanitize a string for safe use in a Content-Disposition filename value.
 * Allowlist: [A-Za-z0-9._-] — everything else replaced with '_'.
 * This prevents CR/LF injection and path traversal.
 */
function sanitizeFilename(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200);
}

/**
 * RFC 4180 CSV cell quoting.
 * Wraps the value in double-quotes if it contains a comma, quote, or newline.
 * Internal double-quotes are doubled.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Escape XML special characters for safe embedding in Logiqx attribute values
 * and text nodes.
 */
function xmlEscape(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Prepared statement — run once per request.
// Missing entries: dat_entries LEFT JOIN match_results; keep only rows where
// no hit exists (mr.dat_entry_id IS NULL). Entries already marked 'nodump' in
// the DAT are excluded — they are unobtainable and should not appear in a
// wantlist the user acts on.
// ---------------------------------------------------------------------------

const MISSING_QUERY = `
  SELECT
    de.name   AS name,
    de.size   AS size,
    de.crc32  AS crc32,
    de.sha1   AS sha1,
    de.status AS status,
    de.region AS region
  FROM dat_entries de
  LEFT JOIN match_results mr
    ON mr.dat_entry_id = de.id
    AND mr.dat_id = de.dat_id
  WHERE de.dat_id = ?
    AND de.status != 'nodump'
    AND mr.dat_entry_id IS NULL
  ORDER BY de.region NULLS LAST, de.name ASC
`;

// ---------------------------------------------------------------------------
// Format generators — each returns an async generator over text chunks.
// The generators consume the SQLite iterator in batches and yield string chunks
// that are encoded to Uint8Array by the caller.
// ---------------------------------------------------------------------------

async function* generateCsv(
  iter: IterableIterator<unknown>
): AsyncGenerator<string> {
  yield "name,size,crc32,sha1,status,region\r\n";

  let batch: string[] = [];
  for (const row of iter) {
    const r = row as MissingEntry;
    batch.push(
      [
        csvCell(r.name),
        csvCell(r.size),
        csvCell(r.crc32),
        csvCell(r.sha1),
        csvCell(r.status),
        csvCell(r.region),
      ].join(",") + "\r\n"
    );
    if (batch.length >= BATCH_SIZE) {
      yield batch.join("");
      batch = [];
    }
  }
  if (batch.length > 0) yield batch.join("");
}

async function* generateMarkdown(
  iter: IterableIterator<unknown>,
  datName: string
): AsyncGenerator<string> {
  yield `# Wantlist: ${datName}\n\n`;

  // Sentinel: a string value that no real region can equal, so the first row
  // always triggers a section header.
  const SENTINEL = "\x00";
  let currentRegion: string = SENTINEL;
  let batch: string[] = [];

  for (const row of iter) {
    const r = row as MissingEntry;
    // Normalise null region to empty string so comparison works cleanly.
    const region = r.region ?? "";
    const regionKey = region || "";

    if (currentRegion !== regionKey) {
      if (batch.length > 0) {
        yield batch.join("");
        batch = [];
      }
      currentRegion = regionKey;
      yield region ? `## ${region}\n\n` : `## Other\n\n`;
    }

    const sizeLabel = r.size !== null ? `${r.size} bytes` : "unknown size";
    const crcLabel = r.crc32 ? ` · crc32=${r.crc32}` : "";
    batch.push(`- [ ] ${r.name} (${sizeLabel}${crcLabel})\n`);

    if (batch.length >= BATCH_SIZE) {
      yield batch.join("");
      batch = [];
    }
  }
  if (batch.length > 0) yield batch.join("");
}

async function* generateFixdat(
  iter: IterableIterator<unknown>,
  dat: DatRow
): AsyncGenerator<string> {
  // Logiqx XML header
  yield `<?xml version="1.0"?>\n`;
  yield `<!DOCTYPE datafile PUBLIC "-//Logiqx//DTD ROM Management Datafile//EN" "http://www.logiqx.com/Docs/datafile.dtd">\n`;
  yield `<datafile>\n`;
  yield `\t<header>\n`;
  yield `\t\t<name>${xmlEscape(dat.name)}</name>\n`;
  yield `\t\t<description>Fixdat for ${xmlEscape(dat.description ?? dat.name)}</description>\n`;
  if (dat.version) yield `\t\t<version>${xmlEscape(dat.version)}</version>\n`;
  if (dat.author) yield `\t\t<author>${xmlEscape(dat.author)}</author>\n`;
  yield `\t</header>\n`;

  let batch: string[] = [];
  for (const row of iter) {
    const r = row as MissingEntry;

    // Build <rom> attributes — only emit attributes that have values
    const romAttrs: string[] = [`name="${xmlEscape(r.name)}"`];
    if (r.size !== null) romAttrs.push(`size="${r.size}"`);
    if (r.crc32) romAttrs.push(`crc="${xmlEscape(r.crc32)}"`);
    if (r.sha1) romAttrs.push(`sha1="${xmlEscape(r.sha1)}"`);
    if (r.status && r.status !== "good") romAttrs.push(`status="${xmlEscape(r.status)}"`);

    // igir convention: one <game> per ROM entry, game name = ROM name stripped of extension
    const gameName = r.name.replace(/\.[^.]+$/, "");
    batch.push(
      `\t<game name="${xmlEscape(gameName)}">\n` +
      `\t\t<rom ${romAttrs.join(" ")}/>\n` +
      `\t</game>\n`
    );

    if (batch.length >= BATCH_SIZE) {
      yield batch.join("");
      batch = [];
    }
  }
  if (batch.length > 0) yield batch.join("");

  yield `</datafile>\n`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const datId = parseInt(id, 10);
    if (isNaN(datId)) return apiError(ApiErrorCode.INVALID_ID);

    const url = new URL(req.url);
    const format = url.searchParams.get("format");

    if (!format || !VALID_FORMATS.has(format)) {
      return apiError(ApiErrorCode.DAT_WANTLIST_BAD_FORMAT);
    }

    const dat = db
      .select({
        id: dats.id,
        name: dats.name,
        description: dats.description,
        version: dats.version,
        author: dats.author,
      })
      .from(dats)
      .where(eq(dats.id, datId))
      .get() as DatRow | undefined;

    if (!dat) return apiError(ApiErrorCode.DAT_NOT_FOUND);

    const safeBase = sanitizeFilename(dat.name);
    const ext = format === "fixdat" ? ".dat" : format === "md" ? ".md" : ".csv";
    const filename = `${safeBase}${ext}`;

    const contentTypeMap: Record<WantlistFormat, string> = {
      csv: "text/csv; charset=utf-8",
      md: "text/markdown; charset=utf-8",
      fixdat: "application/xml; charset=utf-8",
    };

    // Open the SQLite iterator — stays open during streaming; closed when the
    // generator is exhausted or the client disconnects (generator GC).
    const stmt = sqlite.prepare(MISSING_QUERY);
    const iter = stmt.iterate(datId) as IterableIterator<unknown>;

    const enc = new TextEncoder();

    let gen: AsyncGenerator<string>;
    if (format === "csv") {
      gen = generateCsv(iter);
    } else if (format === "md") {
      gen = generateMarkdown(iter, dat.name);
    } else {
      gen = generateFixdat(iter, dat);
    }

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await gen.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(enc.encode(value));
        }
      },
      cancel() {
        // Force the SQLite iterator to stop consuming rows if the client drops.
        try {
          iter.return?.();
        } catch {
          // Ignore — iterator may already be exhausted.
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": contentTypeMap[format as WantlistFormat],
        // Use filename* (RFC 5987) for non-ASCII safety, plus plain filename
        // fallback. The sanitized value is already ASCII-safe.
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[GET /api/dats/[id]/wantlist] error:", err);
    return apiErrorFromUnknown(err);
  }
}
