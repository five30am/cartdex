import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as crc32Module from "buffer-crc32";
// buffer-crc32 has a default export at runtime but types say otherwise
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const crc32 = (crc32Module as any).default ?? crc32Module;
import { db } from "@/lib/db";
import { systems, games } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface IngestResult {
  scanned: number;
  added: number;
  skipped: number;
  errors: string[];
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleFromFilename(filename: string): string {
  // Strip extension(s) — handles multi-part like .bin.gz
  const name = filename.replace(/(\.[a-z0-9]+)+$/i, "");
  // Replace underscores and dots with spaces, trim
  return name.replace(/[_\.]+/g, " ").trim();
}

function computeHashes(filePath: string): {
  crc32: string;
  md5: string;
  sha1: string;
} {
  const data = fs.readFileSync(filePath);

  const crc32Hash = crc32(data).toString("hex").padStart(8, "0");
  const md5Hash = crypto.createHash("md5").update(data).digest("hex");
  const sha1Hash = crypto.createHash("sha1").update(data).digest("hex");

  return { crc32: crc32Hash, md5: md5Hash, sha1: sha1Hash };
}

function walkDirectory(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDirectory(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

export async function ingestDirectory(romRoot: string): Promise<IngestResult> {
  const result: IngestResult = { scanned: 0, added: 0, skipped: 0, errors: [] };

  // Load all systems and build an extension → system map
  const allSystems = db.select().from(systems).all();

  type SystemRow = (typeof allSystems)[number];

  const extToSystem = new Map<string, SystemRow>();
  for (const system of allSystems) {
    const exts = system.extensions as string[];
    for (const ext of exts) {
      // Only set if not already mapped (avoids .zip collision — first-come wins)
      // .zip files will be assigned to whichever system's extension list has it first
      if (!extToSystem.has(ext)) {
        extToSystem.set(ext, system);
      }
    }
  }

  // Build a set of known extensions for quick lookup
  const knownExtensions = new Set(extToSystem.keys());

  const files = walkDirectory(romRoot);
  result.scanned = files.length;

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!knownExtensions.has(ext)) {
      result.skipped++;
      continue;
    }

    const system = extToSystem.get(ext);
    if (!system) {
      result.skipped++;
      continue;
    }

    // Skip if this exact file path is already in the DB
    const existing = db
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.file_path, filePath), eq(games.system_id, system.id)))
      .get();

    if (existing) {
      result.skipped++;
      continue;
    }

    try {
      const stat = fs.statSync(filePath);
      const filename = path.basename(filePath);
      const title = titleFromFilename(filename);
      const slug = slugify(title);

      const hashes = computeHashes(filePath);

      db.insert(games)
        .values({
          system_id: system.id,
          title,
          slug,
          file_path: filePath,
          file_size: stat.size,
          hash_crc32: hashes.crc32,
          hash_md5: hashes.md5,
          hash_sha1: hashes.sha1,
          verified: false,
        })
        .run();

      result.added++;
    } catch (err) {
      result.errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
