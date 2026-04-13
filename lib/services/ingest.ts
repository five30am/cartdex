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
  discovered: number;
  newFiles: number;
  hashed: number;
  skipped: number;
  errors: string[];
}

export interface JobStatus {
  state: "idle" | "running" | "done" | "error";
  phase?: "discovering" | "hashing";
  progress?: { current: number; total: number };
  result?: IngestResult;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

// Global job state — single-user app, one scan at a time
let scanJob: JobStatus = { state: "idle" };

export function getScanStatus(): JobStatus {
  return { ...scanJob };
}

export function startScanInBackground(romRoot: string): void {
  if (scanJob.state === "running") return;
  scanJob = { state: "running", startedAt: new Date().toISOString() };
  ingestDirectory(romRoot)
    .then((result) => {
      scanJob = { state: "done", result, startedAt: scanJob.startedAt, finishedAt: new Date().toISOString() };
    })
    .catch((err) => {
      scanJob = { state: "error", error: err instanceof Error ? err.message : String(err), startedAt: scanJob.startedAt, finishedAt: new Date().toISOString() };
    });
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleFromFilename(filename: string): string {
  const name = filename.replace(/(\.[a-z0-9]+)+$/i, "");
  return name.replace(/[_\.]+/g, " ").trim();
}

async function computeHashes(filePath: string): Promise<{
  crc32: string;
  md5: string;
  sha1: string;
}> {
  return new Promise((resolve, reject) => {
    const md5 = crypto.createHash("md5");
    const sha1 = crypto.createHash("sha1");
    // null seed avoids buffer-crc32 bounds error when reading 4 bytes from an empty Buffer
    let crc32Val: Buffer | null = null;

    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      md5.update(buf);
      sha1.update(buf);
      crc32Val = crc32(buf, crc32Val ?? undefined);
    });
    stream.on("end", () => {
      resolve({
        crc32: (crc32Val ?? Buffer.alloc(4)).toString("hex").padStart(8, "0"),
        md5: md5.digest("hex"),
        sha1: sha1.digest("hex"),
      });
    });
    stream.on("error", reject);
  });
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
  const result: IngestResult = { discovered: 0, newFiles: 0, hashed: 0, skipped: 0, errors: [] };

  // Load all systems and build extension → system map
  const allSystems = db.select().from(systems).all();
  type SystemRow = (typeof allSystems)[number];

  const extToSystem = new Map<string, SystemRow>();
  for (const system of allSystems) {
    const exts = system.extensions as string[];
    for (const ext of exts) {
      if (!extToSystem.has(ext)) {
        extToSystem.set(ext, system);
      }
    }
  }
  const knownExtensions = new Set(extToSystem.keys());

  // --- Phase 1: Discover ---
  // Fast filesystem walk. Insert new file paths with hashed=false. No file reads.
  scanJob.phase = "discovering";

  const files = walkDirectory(romRoot);
  result.discovered = files.length;
  scanJob.progress = { current: 0, total: files.length };

  // Build a set of known file paths from the DB for fast lookup
  const knownPaths = new Set(
    db.select({ file_path: games.file_path }).from(games).all().map((r) => r.file_path)
  );

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    scanJob.progress = { current: i + 1, total: files.length };

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

    // Already tracked — skip entirely
    if (knownPaths.has(filePath)) {
      result.skipped++;
      continue;
    }

    try {
      const stat = fs.statSync(filePath);
      const filename = path.basename(filePath);
      const title = titleFromFilename(filename);
      const slug = slugify(title);

      db.insert(games)
        .values({
          system_id: system.id,
          title,
          slug,
          file_path: filePath,
          file_size: stat.size,
          hashed: false,
          verified: false,
        })
        .run();

      result.newFiles++;
    } catch (err) {
      result.errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Phase 2: Hash ---
  // Only process games where hashed = false
  scanJob.phase = "hashing";

  const unhashed = db
    .select({ id: games.id, file_path: games.file_path })
    .from(games)
    .where(eq(games.hashed, false))
    .all();

  scanJob.progress = { current: 0, total: unhashed.length };

  for (let i = 0; i < unhashed.length; i++) {
    const game = unhashed[i];
    scanJob.progress = { current: i + 1, total: unhashed.length };

    try {
      const hashes = await computeHashes(game.file_path);

      db.update(games)
        .set({
          hash_crc32: hashes.crc32,
          hash_md5: hashes.md5,
          hash_sha1: hashes.sha1,
          hashed: true,
        })
        .where(eq(games.id, game.id))
        .run();

      result.hashed++;
    } catch (err) {
      result.errors.push(`${game.file_path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
