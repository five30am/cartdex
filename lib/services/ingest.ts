import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as crc32Module from "buffer-crc32";
// buffer-crc32 has a default export at runtime but types say otherwise
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const crc32 = (crc32Module as any).default ?? crc32Module;
import { db } from "@/lib/db";
import { systems, games, file_operations } from "@/lib/db/schema";
import { eq, and, or, isNull, ne } from "drizzle-orm";

export interface IngestResult {
  discovered: number;
  newFiles: number;
  hashed: number;
  skipped: number;
  reconciled: number;
  errors: string[];
}

export interface JobStatus {
  state: "idle" | "running" | "done" | "error";
  phase?: "discovering" | "hashing" | "reconciling";
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

/**
 * Reconcile phase: iterate ALL game rows (including hashed ones) and check whether
 * each file still exists on disk. Rows that are already hidden for 'trashed' or
 * 'missing-on-disk' reasons are skipped (idempotent). Any other row whose file is
 * absent gets hidden with hidden_reason='missing-on-disk' and an audit entry.
 *
 * Missing-on-disk rows still participate in the Phase 1 hash-first rename-detection
 * mechanic because they remain in the DB — only the hidden flag changes.
 *
 * Returns the count of rows newly marked missing.
 */
export async function reconcileMissingFiles(
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  // Fetch all game rows that are NOT already hidden for the two skip reasons
  const candidates = db
    .select({ id: games.id, file_path: games.file_path, hash_sha1: games.hash_sha1 })
    .from(games)
    .where(
      or(
        eq(games.hidden, false),
        // hidden=true but for a reason other than trashed/missing-on-disk (edge case)
        and(
          eq(games.hidden, true),
          isNull(games.hidden_reason)
        ),
        and(
          eq(games.hidden, true),
          ne(games.hidden_reason, "trashed"),
          ne(games.hidden_reason, "missing-on-disk")
        )
      )
    )
    .all();

  const total = candidates.length;
  let reconciled = 0;

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    onProgress?.(i + 1, total);

    if (fs.existsSync(row.file_path)) continue;

    const now = new Date().toISOString();
    db.insert(file_operations)
      .values({
        game_id: row.id,
        operation: "auto_hidden_missing",
        actor: "scanner",
        timestamp: now,
        file_path_before: row.file_path,
        hash_sha1: row.hash_sha1,
        notes: "file not found on disk during reconciliation pass",
      })
      .run();

    db.update(games)
      .set({ hidden: true, hidden_at: now, hidden_reason: "missing-on-disk" })
      .where(eq(games.id, row.id))
      .run();

    reconciled++;
  }

  return reconciled;
}

export async function ingestDirectory(romRoot: string): Promise<IngestResult> {
  const result: IngestResult = { discovered: 0, newFiles: 0, hashed: 0, skipped: 0, reconciled: 0, errors: [] };

  // Load all systems and build lookup structures
  const allSystems = db.select().from(systems).all();
  type SystemRow = (typeof allSystems)[number];

  // slug → system (for directory-name matching — highest priority)
  const slugToSystem = new Map<string, SystemRow>();
  for (const system of allSystems) {
    slugToSystem.set(system.slug, system);
  }

  // extension → system (fallback when directory name doesn't match any slug)
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

  /**
   * Resolve which system a file belongs to.
   * Priority: directory slug match > extension match.
   * A file at /roms/arcade/roms/foo.chd → slug "arcade" wins over ext ".chd" → psx.
   */
  function resolveSystem(filePath: string): SystemRow | undefined {
    // Walk up directories looking for one that matches a known system slug.
    // Typically files are at <romRoot>/<slug>/roms/<file> or <romRoot>/<slug>/<file>.
    const relative = path.relative(romRoot, filePath);
    const parts = relative.split(path.sep);
    // parts[0] is the immediate child of romRoot — that's the platform folder name
    if (parts.length > 0) {
      const dirSlug = parts[0].toLowerCase();
      const bySlug = slugToSystem.get(dirSlug);
      if (bySlug) return bySlug;
    }
    // Fallback: match by extension
    const ext = path.extname(filePath).toLowerCase();
    return extToSystem.get(ext);
  }

  // --- Phase 1: Discover ---
  // Fast filesystem walk. Insert new file paths with hashed=false. No file reads.
  scanJob.phase = "discovering";

  const files = walkDirectory(romRoot);
  result.discovered = files.length;
  scanJob.progress = { current: 0, total: files.length };

  // Build a set of known file paths from the DB for fast lookup.
  // Include hidden rows — their paths are still "known" so we don't re-insert them.
  const knownPaths = new Set(
    db.select({ file_path: games.file_path }).from(games).all().map((r) => r.file_path)
  );

  // Pre-build a hash→game index for hidden rows.
  // Used for hash-first matching when a hidden file has been moved externally.
  type HiddenRow = { id: number; file_path: string; hash_sha1: string | null };
  const hiddenByHash = new Map<string, HiddenRow>();
  db.select({ id: games.id, file_path: games.file_path, hash_sha1: games.hash_sha1 })
    .from(games)
    .where(eq(games.hidden, true))
    .all()
    .forEach((r) => {
      if (r.hash_sha1) hiddenByHash.set(r.hash_sha1, r);
    });

  // Build a set of ALL known extensions across all systems for quick pre-filtering
  const allKnownExtensions = new Set<string>();
  for (const system of allSystems) {
    const exts = system.extensions as string[];
    for (const ext of exts) {
      allKnownExtensions.add(ext);
    }
  }

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    scanJob.progress = { current: i + 1, total: files.length };

    // Pre-filter: skip files with no known ROM extension (e.g. .txt, .xml, .dat)
    const ext = path.extname(filePath).toLowerCase();
    if (!allKnownExtensions.has(ext)) {
      result.skipped++;
      continue;
    }

    // Resolve system — directory slug takes priority over extension
    const system = resolveSystem(filePath);
    if (!system) {
      result.skipped++;
      continue;
    }

    // Already tracked by path — skip entirely
    if (knownPaths.has(filePath)) {
      result.skipped++;
      continue;
    }

    try {
      const stat = fs.statSync(filePath);
      // Capture filesystem creation time. Node's stat returns birthtimeMs on most
      // filesystems; fall back to ctimeMs (metadata change) if birth is unavailable
      // (birthtime returns Unix epoch 0 on some Linux filesystems).
      const birthMs = stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.ctimeMs;
      const fileCreatedAt = new Date(birthMs).toISOString();

      const filename = path.basename(filePath);
      const title = titleFromFilename(filename);
      const slug = slugify(title);

      // Hash-first matching: if this file's SHA-1 matches a hidden row, the
      // file was moved externally — update its path and preserve the hidden flag.
      // We must hash the file first to check (Phase 2 hasn't run yet).
      let resolvedAsHidden = false;
      try {
        const hashes = await computeHashes(filePath);
        const hiddenMatch = hiddenByHash.get(hashes.sha1);
        if (hiddenMatch && hiddenMatch.file_path !== filePath) {
          // File was moved; update path, keep hidden flag, write audit record
          const now = new Date().toISOString();
          db.insert(file_operations)
            .values({
              game_id: hiddenMatch.id,
              operation: "path_updated",
              actor: "scanner",
              timestamp: now,
              file_path_before: hiddenMatch.file_path,
              file_path_after: filePath,
              hash_sha1: hashes.sha1,
              notes: "file moved externally; hidden flag preserved",
            })
            .run();
          db.update(games)
            .set({ file_path: filePath, hash_sha1: hashes.sha1, hashed: true })
            .where(eq(games.id, hiddenMatch.id))
            .run();
          // Update knownPaths so future iterations in this scan see the new path
          knownPaths.delete(hiddenMatch.file_path);
          knownPaths.add(filePath);
          resolvedAsHidden = true;
          result.skipped++;
        }
      } catch {
        // Hash failed — fall through to normal insert; the file will be hashed in Phase 2
      }

      if (resolvedAsHidden) continue;

      db.insert(games)
        .values({
          system_id: system.id,
          title,
          slug,
          file_path: filePath,
          file_size: stat.size,
          file_created_at: fileCreatedAt,
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
      // If the file is gone, skip cleanly — Phase 3 reconcile will handle marking it hidden
      if (!fs.existsSync(game.file_path)) {
        result.skipped++;
        continue;
      }

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

  // --- Phase 3: Reconcile ---
  // Walk ALL game rows (hashed and unhashed) and mark any whose file is missing
  // on disk as hidden with reason='missing-on-disk'. Skips rows already trashed
  // or already marked missing. This catches files deleted externally via CLI.
  scanJob.phase = "reconciling";

  result.reconciled = await reconcileMissingFiles((current, total) => {
    scanJob.progress = { current, total };
  });

  return result;
}
