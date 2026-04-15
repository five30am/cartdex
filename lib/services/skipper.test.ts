/**
 * lib/services/skipper.test.ts
 *
 * Unit tests for the headered-ROM skipper engine.
 *
 * Uses Node.js built-in test runner (node:test) — no external test framework.
 * Run with:
 *   node --import tsx/esm --test lib/services/skipper.test.ts
 *   # or via the package.json "test:skipper" script if added
 *
 * Fixture ROMs are tiny synthetic buffers — nothing copyrighted.
 * Structure: [header bytes] + [32-byte payload]
 * The payload is always 32 bytes of 0xAA for easy CRC/SHA verification.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import {
  detectHeader,
  computeStrippedHashes,
  computeStrippedHashesIfHeadered,
  hasSkipper,
  skipperSystemSlugs,
} from "./skipper.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a Buffer to a temp file and return its path. */
function tmpFile(buf: Buffer): string {
  const p = path.join(os.tmpdir(), `skipper-test-${crypto.randomBytes(6).toString("hex")}.rom`);
  fs.writeFileSync(p, buf);
  return p;
}

/** 32 bytes of 0xAA — our standard fake ROM payload. */
const PAYLOAD = Buffer.alloc(32, 0xaa);

/** Pre-compute the expected SHA-1 and CRC-32 of PAYLOAD for assertions. */
function payloadSha1(): string {
  return crypto.createHash("sha1").update(PAYLOAD).digest("hex");
}

// CRC-32 of PAYLOAD — computed inline to avoid importing buffer-crc32 in tests
// We trust computeStrippedHashes for actual hash values; we just assert self-consistency.

// ---------------------------------------------------------------------------
// Registry / hasSkipper
// ---------------------------------------------------------------------------

describe("hasSkipper", () => {
  it("returns true for all known systems", () => {
    const known = ["nes", "fds", "a7800", "atari7800", "lynx", "atarilynx", "snes", "superfamicom"];
    for (const slug of known) {
      assert.equal(hasSkipper(slug), true, `hasSkipper("${slug}") should be true`);
    }
  });

  it("returns false for unknown systems", () => {
    assert.equal(hasSkipper("psx"), false);
    assert.equal(hasSkipper("n64"), false);
    assert.equal(hasSkipper("gba"), false);
    assert.equal(hasSkipper(""), false);
  });

  it("skipperSystemSlugs returns all registered slugs", () => {
    const slugs = skipperSystemSlugs();
    assert.ok(slugs.includes("nes"));
    assert.ok(slugs.includes("snes"));
    assert.ok(slugs.includes("fds"));
    assert.ok(slugs.length >= 6);
  });
});

// ---------------------------------------------------------------------------
// NES / iNES
// ---------------------------------------------------------------------------

describe("NES/iNES header detection", () => {
  it("detects iNES 1.0 header (magic NES\\x1a)", () => {
    const header = Buffer.from([0x4e, 0x45, 0x53, 0x1a, 0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const rom = Buffer.concat([header, PAYLOAD]);
    const match = detectHeader(rom, rom.length, "nes");
    assert.notEqual(match, null, "should detect NES header");
    assert.equal(match!.stripBytes, 16);
  });

  it("detects NES 2.0 header (same magic, different flags byte 7)", () => {
    // NES 2.0: bits 2-3 of byte 7 == 0b10 (0x08)
    const header = Buffer.from([0x4e, 0x45, 0x53, 0x1a, 0x02, 0x01, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const rom = Buffer.concat([header, PAYLOAD]);
    const match = detectHeader(rom, rom.length, "nes");
    assert.notEqual(match, null, "should detect NES 2.0 header (same 16-byte magic)");
    assert.equal(match!.stripBytes, 16);
  });

  it("returns null for NES file without magic bytes", () => {
    // Random data — no NES magic
    const rom = Buffer.alloc(48, 0x00);
    const match = detectHeader(rom, rom.length, "nes");
    assert.equal(match, null, "should not detect header without magic");
  });

  it("returns null when buffer is too short to contain magic", () => {
    const short = Buffer.from([0x4e, 0x45]); // only 2 bytes
    const match = detectHeader(short, short.length, "nes");
    assert.equal(match, null, "too-short buffer should not match");
  });

  it("does not confuse FDS magic with NES magic", () => {
    const fdsHeader = Buffer.from([0x46, 0x44, 0x53, 0x1a, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const rom = Buffer.concat([fdsHeader, PAYLOAD]);
    const match = detectHeader(rom, rom.length, "nes");
    assert.equal(match, null, "FDS header should not match NES skipper");
  });
});

// ---------------------------------------------------------------------------
// FDS
// ---------------------------------------------------------------------------

describe("FDS/fwNES header detection", () => {
  it("detects fwNES header (magic FDS\\x1a)", () => {
    const header = Buffer.from([0x46, 0x44, 0x53, 0x1a, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const rom = Buffer.concat([header, PAYLOAD]);
    const match = detectHeader(rom, rom.length, "fds");
    assert.notEqual(match, null);
    assert.equal(match!.stripBytes, 16);
  });

  it("returns null for FDS without correct magic", () => {
    const rom = Buffer.concat([Buffer.alloc(16, 0x00), PAYLOAD]);
    assert.equal(detectHeader(rom, rom.length, "fds"), null);
  });
});

// ---------------------------------------------------------------------------
// Atari 7800
// ---------------------------------------------------------------------------

describe("Atari 7800 header detection", () => {
  it("detects A78 header (byte 0 = 0x01, bytes 1-3 = ATA)", () => {
    const header = Buffer.alloc(128, 0x00);
    header[0] = 0x01;
    header[1] = 0x41; // A
    header[2] = 0x54; // T
    header[3] = 0x41; // A
    const rom = Buffer.concat([header, PAYLOAD]);
    const match = detectHeader(rom, rom.length, "a7800");
    assert.notEqual(match, null);
    assert.equal(match!.stripBytes, 128);
  });

  it("works with atari7800 slug alias", () => {
    const header = Buffer.alloc(128, 0x00);
    header[0] = 0x01;
    header[1] = 0x41;
    header[2] = 0x54;
    header[3] = 0x41;
    const rom = Buffer.concat([header, PAYLOAD]);
    const match = detectHeader(rom, rom.length, "atari7800");
    assert.notEqual(match, null);
    assert.equal(match!.stripBytes, 128);
  });

  it("returns null when byte 0 is not 0x01", () => {
    const header = Buffer.alloc(128, 0x00);
    // Missing the 0x01 sentinel
    header[1] = 0x41;
    header[2] = 0x54;
    header[3] = 0x41;
    const rom = Buffer.concat([header, PAYLOAD]);
    assert.equal(detectHeader(rom, rom.length, "a7800"), null);
  });
});

// ---------------------------------------------------------------------------
// Atari Lynx
// ---------------------------------------------------------------------------

describe("Atari Lynx header detection", () => {
  it("detects LNX header (magic LYNX)", () => {
    const header = Buffer.alloc(64, 0x00);
    header[0] = 0x4c; // L
    header[1] = 0x59; // Y
    header[2] = 0x4e; // N
    header[3] = 0x58; // X
    const rom = Buffer.concat([header, PAYLOAD]);
    const match = detectHeader(rom, rom.length, "lynx");
    assert.notEqual(match, null);
    assert.equal(match!.stripBytes, 64);
  });

  it("works with atarilynx slug alias", () => {
    const header = Buffer.alloc(64, 0x00);
    header.write("LYNX", 0, "ascii");
    const rom = Buffer.concat([header, PAYLOAD]);
    assert.notEqual(detectHeader(rom, rom.length, "atarilynx"), null);
  });

  it("returns null for unknown magic", () => {
    const rom = Buffer.concat([Buffer.alloc(64, 0x00), PAYLOAD]);
    assert.equal(detectHeader(rom, rom.length, "lynx"), null);
  });
});

// ---------------------------------------------------------------------------
// SNES / SMC — the tricky one
// ---------------------------------------------------------------------------

describe("SNES/SMC header detection", () => {
  /**
   * Valid SMC file: size % 1024 === 512, header bytes 8-9 = AA BB.
   * Total size: 512 (header) + 512 (payload padded to 512) = 1024.
   * 1024 % 1024 === 0 — that's NOT the right size check.
   *
   * We need size % 1024 === 512.
   * So: header(512) + romData(N * 1024 + 0) -> total = 512 + N*1024.
   * For N=0: total = 512. 512 % 1024 = 512. ✓
   */
  function makeSMCRom(b8: number, b9: number, romSize: number = 0): Buffer {
    const header = Buffer.alloc(512, 0x00);
    header[8] = b8;
    header[9] = b9;
    const romData = Buffer.alloc(romSize, 0xbb);
    return Buffer.concat([header, romData]);
  }

  it("detects SMC header with AA BB fingerprint (size % 1024 === 512)", () => {
    // Total = 512 bytes; 512 % 1024 === 512 ✓
    const rom = makeSMCRom(0xaa, 0xbb, 0);
    const match = detectHeader(rom, rom.length, "snes");
    assert.notEqual(match, null, "should detect SMC header with AA BB");
    assert.equal(match!.stripBytes, 512);
  });

  it("detects SMC header with 00 00 fingerprint (bare dump pattern)", () => {
    const rom = makeSMCRom(0x00, 0x00, 0);
    const match = detectHeader(rom, rom.length, "snes");
    assert.notEqual(match, null, "should detect SMC header with 00 00");
    assert.equal(match!.stripBytes, 512);
  });

  it("rejects when size % 1024 !== 512 (raw ROM, no header)", () => {
    // Pure 1024-byte ROM with no header — size % 1024 === 0
    const rom = Buffer.alloc(1024, 0xcc);
    // Set bytes 8-9 to AA BB to ensure it's only the size check rejecting it
    rom[8] = 0xaa;
    rom[9] = 0xbb;
    const match = detectHeader(rom, rom.length, "snes");
    assert.equal(match, null, "raw ROM without size quirk should not be stripped");
  });

  it("rejects when fingerprint is not AA BB or 00 00", () => {
    // Unknown fingerprint — prefer no strip
    const rom = makeSMCRom(0x12, 0x34, 0);
    const match = detectHeader(rom, rom.length, "snes");
    assert.equal(match, null, "ambiguous fingerprint should not be stripped");
  });

  it("rejects when buffer is too short to read fingerprint at offset 8", () => {
    const short = Buffer.alloc(7, 0x00); // shorter than 10 bytes needed
    const match = detectHeader(short, 512, "snes"); // pass fileSize that would pass size check
    assert.equal(match, null, "too-short buffer should not match");
  });

  it("works with superfamicom slug alias", () => {
    const rom = makeSMCRom(0xaa, 0xbb, 0);
    const match = detectHeader(rom, rom.length, "superfamicom");
    assert.notEqual(match, null);
  });
});

// ---------------------------------------------------------------------------
// computeStrippedHashes — streaming correctness
// ---------------------------------------------------------------------------

describe("computeStrippedHashes", () => {
  it("computes correct hashes with no skip (stripBytes=0)", async () => {
    const filePath = tmpFile(PAYLOAD);
    try {
      const result = await computeStrippedHashes(filePath, 0);
      const expectedSha1 = payloadSha1();
      assert.equal(result.sha1, expectedSha1, "sha1 should match full payload");
      assert.equal(result.size, PAYLOAD.length);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it("produces same sha1 for stripped content as hashing the payload alone", async () => {
    const header = Buffer.alloc(16, 0xff);
    const combined = Buffer.concat([header, PAYLOAD]);
    const filePath = tmpFile(combined);
    try {
      const result = await computeStrippedHashes(filePath, 16);
      assert.equal(result.sha1, payloadSha1(), "stripped sha1 should match raw payload sha1");
      assert.equal(result.size, PAYLOAD.length, "stripped size should be payload size only");
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it("handles stripBytes larger than file gracefully (produces empty-hash result)", async () => {
    const filePath = tmpFile(Buffer.alloc(10, 0x00));
    try {
      const result = await computeStrippedHashes(filePath, 512);
      // Stripped everything — sha1 of empty string
      assert.equal(result.sha1, "da39a3ee5e6b4b0d3255bfef95601890afd80709");
      assert.equal(result.size, 0);
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});

// ---------------------------------------------------------------------------
// computeStrippedHashesIfHeadered — integration
// ---------------------------------------------------------------------------

describe("computeStrippedHashesIfHeadered", () => {
  it("returns null for system with no skipper", async () => {
    const filePath = tmpFile(PAYLOAD);
    try {
      const result = await computeStrippedHashesIfHeadered(filePath, "psx");
      assert.equal(result, null);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it("returns null for NES file without header magic", async () => {
    // Raw NES ROM with no iNES header
    const filePath = tmpFile(PAYLOAD);
    try {
      const result = await computeStrippedHashesIfHeadered(filePath, "nes");
      assert.equal(result, null, "no header detected → null");
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it("returns stripped hashes for valid NES ROM with iNES header", async () => {
    const header = Buffer.from([0x4e, 0x45, 0x53, 0x1a, 0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const rom = Buffer.concat([header, PAYLOAD]);
    const filePath = tmpFile(rom);
    try {
      const result = await computeStrippedHashesIfHeadered(filePath, "nes");
      assert.notEqual(result, null, "should return stripped hashes for headered NES ROM");
      assert.equal(result!.sha1, payloadSha1(), "stripped sha1 should match payload sha1");
      assert.equal(result!.size, PAYLOAD.length);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it("returns stripped hashes for valid Atari Lynx ROM", async () => {
    const header = Buffer.alloc(64, 0x00);
    header.write("LYNX", 0, "ascii");
    const rom = Buffer.concat([header, PAYLOAD]);
    const filePath = tmpFile(rom);
    try {
      const result = await computeStrippedHashesIfHeadered(filePath, "lynx");
      assert.notEqual(result, null);
      assert.equal(result!.sha1, payloadSha1());
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge case: unrecognised system slug (no skipper registered)
// ---------------------------------------------------------------------------

describe("detectHeader with no system slug", () => {
  it("tries all skippers when systemSlug is omitted", () => {
    // NES header — should be matched by global scan
    const header = Buffer.from([0x4e, 0x45, 0x53, 0x1a, 0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const rom = Buffer.concat([header, PAYLOAD]);
    const match = detectHeader(rom, rom.length); // no systemSlug
    assert.notEqual(match, null, "NES header should be found even without slug hint");
    assert.equal(match!.stripBytes, 16);
  });

  it("returns null when no skipper matches", () => {
    const rom = Buffer.alloc(200, 0x00); // no recognisable headers
    const match = detectHeader(rom, rom.length);
    // SNES rules might fire on 00 00 at offset 8 IF size % 1024 === 512,
    // but 200 % 1024 !== 512, so it should still be null
    assert.equal(match, null);
  });
});
