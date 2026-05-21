/**
 * lib/services/skipper.ts
 *
 * Headered-ROM skipper engine for CartDex.
 *
 * Some retro ROM formats prepend a copier/emulator-specific header that is NOT
 * part of the canonical ROM data.  DAT files (No-Intro, Redump, etc.) hash the
 * headerless ROM.  To match our ingested files against a DAT we must:
 *
 *   1. Detect whether a header is present.
 *   2. Strip it and compute SHA-1 + CRC-32 of the remainder.
 *
 * Supported systems and header sizes:
 *   NES/iNES   — 16 bytes  (magic: "NES\x1a")
 *   FDS/fwNES  — 16 bytes  (magic: "FDS\x1a")
 *   Atari 7800 — 128 bytes (byte 0 == 0x01, bytes 1–3 == "ATA")
 *   Atari Lynx — 64 bytes  (magic: "LYNX")
 *   SNES/SMC   — 512 bytes (size-conditional + fingerprint check)
 *
 * Design decisions:
 *   - If detection is ambiguous, we prefer NO strip and return null.  Better to
 *     miss a stripped-hash match than to hash a wrongly-stripped file.
 *   - SMC is inherently ambiguous (no magic bytes).  We require BOTH the size
 *     condition AND the fingerprint before stripping.
 *   - NES 2.0 and iNES 1.0 share an identical 16-byte header size, so both are
 *     handled by the same rule.
 *   - The skipper registry is keyed by system slug, matching the `systems.slug`
 *     column in the DB.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as crc32Module from "buffer-crc32";
// buffer-crc32 has a default export at runtime but types say otherwise
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const crc32 = (crc32Module as any).default ?? crc32Module;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkipperRule {
  /** Human-readable name for this skipper (e.g. "NES/iNES Header Skipper"). */
  name: string;
  /** Number of bytes to skip from the start of the file. */
  stripBytes: number;
  /**
   * Magic bytes that must appear at `magicOffset` for this header to be detected.
   * Expressed as a Buffer for efficient comparison.
   * NULL means no magic-byte check (SNES SMC uses size+fingerprint logic instead).
   */
  magic: Buffer | null;
  /** Byte offset at which to look for the magic value. Default 0. */
  magicOffset: number;
  /**
   * Extra validation function called after magic check.
   * Return false to reject the detection (prefer NO strip).
   */
  extraValidation?: (buf: Buffer, fileSize: number) => boolean;
}

export interface SkipperMatch {
  /** The matched rule. */
  rule: SkipperRule;
  /** Byte offset at which ROM data begins (i.e. how many bytes to skip). */
  stripBytes: number;
}

export interface StrippedHashes {
  sha1: string;
  crc32: string;
  /** Size of the stripped content in bytes. */
  size: number;
}

// ---------------------------------------------------------------------------
// Skipper registry
// ---------------------------------------------------------------------------

/**
 * SNES SMC extra validation.
 *
 * The 512-byte SMC header is only present when:
 *   (a) file_size % 1024 === 512   (the "leftover" 512-byte chunk)
 *   (b) bytes 8–9 of the header are 0xAA 0xBB (SMC copier marker)
 *         OR 0x00 0x00 (bare copier dump)
 *
 * If condition (a) fails we must not strip — the file is a raw (headerless)
 * dump that just happens to have a non-aligned size.
 */
function snesExtraValidation(buf: Buffer, fileSize: number): boolean {
  // Condition (a): size-modulo check
  if (fileSize % 1024 !== 512) return false;

  // Condition (b): fingerprint at bytes 8–9
  if (buf.length < 10) return false;
  const b8 = buf[8];
  const b9 = buf[9];
  const isSMCMarker = b8 === 0xaa && b9 === 0xbb;
  const isBareMarker = b8 === 0x00 && b9 === 0x00;

  return isSMCMarker || isBareMarker;
}

/**
 * All built-in skipper rules, keyed by system slug.
 *
 * A single system slug may have multiple candidate rules (e.g. if a future
 * format adds a variant).  `detectHeader` tries them in order and returns the
 * first match.
 *
 * System slugs must match `systems.slug` values in the DB exactly.
 */
const SKIPPER_REGISTRY: Record<string, SkipperRule[]> = {
  nes: [
    {
      name: "NES/iNES Header Skipper",
      stripBytes: 16,
      // Magic: "NES\x1a" = 4E 45 53 1A
      magic: Buffer.from([0x4e, 0x45, 0x53, 0x1a]),
      magicOffset: 0,
    },
  ],

  fds: [
    {
      name: "FDS/fwNES Header Skipper",
      stripBytes: 16,
      // Magic: "FDS\x1a" = 46 44 53 1A
      magic: Buffer.from([0x46, 0x44, 0x53, 0x1a]),
      magicOffset: 0,
    },
  ],

  // Atari 7800 — slug may be "a7800" or "atari7800" depending on DB seed.
  // We register both to be slug-agnostic.
  a7800: [
    {
      name: "Atari 7800 Header Skipper",
      stripBytes: 128,
      // Byte 0 == 0x01, bytes 1–3 == "ATA"
      magic: Buffer.from([0x01, 0x41, 0x54, 0x41]),
      magicOffset: 0,
    },
  ],
  atari7800: [
    {
      name: "Atari 7800 Header Skipper",
      stripBytes: 128,
      magic: Buffer.from([0x01, 0x41, 0x54, 0x41]),
      magicOffset: 0,
    },
  ],

  // Atari Lynx — slug may be "lynx" or "atarilynx"
  lynx: [
    {
      name: "Atari Lynx Header Skipper",
      stripBytes: 64,
      // Magic: "LYNX" = 4C 59 4E 58
      magic: Buffer.from([0x4c, 0x59, 0x4e, 0x58]),
      magicOffset: 0,
    },
  ],
  atarilynx: [
    {
      name: "Atari Lynx Header Skipper",
      stripBytes: 64,
      magic: Buffer.from([0x4c, 0x59, 0x4e, 0x58]),
      magicOffset: 0,
    },
  ],

  snes: [
    {
      name: "SNES/SMC Header Skipper",
      stripBytes: 512,
      // No reliable magic bytes — size + fingerprint check is handled in extraValidation
      magic: null,
      magicOffset: 0,
      extraValidation: snesExtraValidation,
    },
  ],
  // Super Famicom slug alias
  superfamicom: [
    {
      name: "SNES/SMC Header Skipper",
      stripBytes: 512,
      magic: null,
      magicOffset: 0,
      extraValidation: snesExtraValidation,
    },
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if `systemSlug` is a system we have a skipper registered for.
 * Use this as a cheap pre-filter before reading file bytes.
 */
export function hasSkipper(systemSlug: string): boolean {
  return systemSlug in SKIPPER_REGISTRY;
}

/**
 * Returns the list of all system slugs that have registered skippers.
 */
export function skipperSystemSlugs(): string[] {
  return Object.keys(SKIPPER_REGISTRY);
}

/**
 * Detect whether a ROM file has a recognised copier/emulator header.
 *
 * @param buf       - A Buffer containing at least the first N bytes of the file.
 *                    Must be large enough to cover the largest possible header
 *                    (512 bytes for SNES; 128 bytes for A7800).
 *                    Passing the full file buffer is safe.
 * @param fileSize  - The total file size in bytes (needed for SMC size check).
 * @param systemSlug - Optional system slug to narrow the search.  If omitted,
 *                    all registered skippers are tried in an unspecified order.
 *                    Providing the slug is strongly recommended for accuracy.
 *
 * @returns A SkipperMatch if a header was detected, or null if none matched.
 *          On ambiguity, always returns null (prefer raw hash).
 */
export function detectHeader(
  buf: Buffer,
  fileSize: number,
  systemSlug?: string
): SkipperMatch | null {
  const candidates: SkipperRule[] = systemSlug
    ? (SKIPPER_REGISTRY[systemSlug] ?? [])
    : Object.values(SKIPPER_REGISTRY).flat();

  for (const rule of candidates) {
    // --- Magic byte check ---
    if (rule.magic !== null) {
      const end = rule.magicOffset + rule.magic.length;
      if (buf.length < end) continue; // buffer too short to contain this magic

      const slice = buf.subarray(rule.magicOffset, end);
      if (!slice.equals(rule.magic)) continue; // magic mismatch
    }

    // --- Extra validation (e.g. SNES size-modulo + fingerprint) ---
    if (rule.extraValidation && !rule.extraValidation(buf, fileSize)) {
      continue; // extra check failed — prefer no strip
    }

    // All checks passed — header detected
    return { rule, stripBytes: rule.stripBytes };
  }

  return null; // no header detected
}

/**
 * Compute SHA-1 and CRC-32 hashes of a ROM file after stripping `stripBytes`
 * from the front.
 *
 * Streams the file to avoid loading large ROMs into memory.
 *
 * @param filePath   - Absolute path to the ROM file.
 * @param stripBytes - Number of bytes to skip at the start of the file.
 *
 * @returns Hashes of the stripped content.
 */
export async function computeStrippedHashes(
  filePath: string,
  stripBytes: number
): Promise<StrippedHashes> {
  return new Promise((resolve, reject) => {
    const sha1Hash = crypto.createHash("sha1");
    let crc32Val: Buffer | null = null;
    let bytesSkipped = 0;
    let strippedSize = 0;

    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk: Buffer | string) => {
      const raw = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

      let data: Buffer;

      if (bytesSkipped < stripBytes) {
        const remaining = stripBytes - bytesSkipped;
        if (raw.length <= remaining) {
          // This entire chunk is header — skip it all
          bytesSkipped += raw.length;
          return;
        }
        // Part of this chunk is header, rest is data
        data = raw.subarray(remaining);
        bytesSkipped += remaining;
      } else {
        data = raw;
      }

      sha1Hash.update(data);
      crc32Val = crc32(data, crc32Val ?? undefined);
      strippedSize += data.length;
    });

    stream.on("end", () => {
      resolve({
        sha1: sha1Hash.digest("hex"),
        crc32: (crc32Val ?? Buffer.alloc(4)).toString("hex").padStart(8, "0"),
        size: strippedSize,
      });
    });

    stream.on("error", reject);
  });
}

/**
 * High-level helper: read the first 512 bytes of a file, run detectHeader,
 * and if a header is found, compute stripped hashes.
 *
 * Returns null if no header is detected (caller should use raw hashes only).
 *
 * @param filePath   - Absolute path to the ROM file.
 * @param systemSlug - System slug for targeted detection.
 */
export async function computeStrippedHashesIfHeadered(
  filePath: string,
  systemSlug: string
): Promise<StrippedHashes | null> {
  if (!hasSkipper(systemSlug)) return null;

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  // Read enough bytes for the largest possible header (512 bytes for SNES)
  const PROBE_BYTES = 512;
  const fd = fs.openSync(filePath, "r");
  const probeBuf = Buffer.allocUnsafe(Math.min(PROBE_BYTES, fileSize));
  fs.readSync(fd, probeBuf, 0, probeBuf.length, 0);
  fs.closeSync(fd);

  const match = detectHeader(probeBuf, fileSize, systemSlug);
  if (!match) return null;

  return computeStrippedHashes(filePath, match.stripBytes);
}
