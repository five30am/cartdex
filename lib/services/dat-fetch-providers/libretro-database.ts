/**
 * libretro-database provider — MIT licensed.
 *
 * Source: https://github.com/libretro/libretro-database
 * License: MIT (https://github.com/libretro/libretro-database/blob/master/LICENSE)
 *
 * DAT files are stored under `metadat/no-intro/` in Logiqx XML format.
 * Each file corresponds to one system and uses the No-Intro naming convention,
 * but the *redistribution* of these particular DAT files is covered by the MIT
 * license under which libretro-database is published. This is distinct from
 * No-Intro's own ToS — we fetch from libretro's copy, not No-Intro directly.
 *
 * The `systemSlug` parameter maps to a filename in the metadat directory.
 * If omitted, we return the full directory listing DAT (a synthetic Logiqx file
 * built from the README index). In practice callers always pass a systemSlug.
 *
 * Security constraints (mirrored in dat-fetch.ts):
 *   - Only raw.githubusercontent.com is an allowed host.
 *   - 30-second fetch timeout.
 *   - Content-Length validated against MAX_UPLOAD_BYTES before buffering.
 *
 * The mapping from our internal system slugs to libretro DAT filenames is
 * intentionally incomplete in v1. Unknown slugs return a DatFetchProviderError
 * rather than fetching a wrong file. Extend SLUG_TO_DAT_FILE as new systems
 * are confirmed.
 */

import type { DatProvider } from "./index";
import {
  DatFetchNetworkError,
  DatFetchProviderError,
  MAX_DAT_BYTES,
  ALLOWED_HOSTS,
  FETCH_TIMEOUT_MS,
} from "../dat-fetch-constants";

/**
 * Map from our system slugs to libretro-database `metadat/no-intro/` filenames.
 *
 * These filenames are stable — libretro-database uses the No-Intro standard
 * naming scheme (system manufacturer + system name).
 *
 * To add a system: find the `.dat` filename in
 * https://github.com/libretro/libretro-database/tree/master/metadat/no-intro
 * and add the mapping here.
 */
const SLUG_TO_DAT_FILE: Record<string, string> = {
  // Nintendo
  "nes": "Nintendo - Nintendo Entertainment System.dat",
  "snes": "Nintendo - Super Nintendo Entertainment System.dat",
  "gb": "Nintendo - Game Boy.dat",
  "gbc": "Nintendo - Game Boy Color.dat",
  "gba": "Nintendo - Game Boy Advance.dat",
  "n64": "Nintendo - Nintendo 64.dat",
  "nds": "Nintendo - Nintendo DS.dat",
  "gamecube": "Nintendo - GameCube.dat",
  "virtualboy": "Nintendo - Virtual Boy.dat",

  // Sega
  "genesis": "Sega - Mega Drive - Genesis.dat",
  "sms": "Sega - Master System - Mark III.dat",
  "gamegear": "Sega - Game Gear.dat",
  "scd": "Sega - Mega-CD - Sega CD.dat",
  "32x": "Sega - 32X.dat",
  "saturn": "Sega - Saturn.dat",
  "dreamcast": "Sega - Dreamcast.dat",

  // Sony
  "ps1": "Sony - PlayStation.dat",
  "ps2": "Sony - PlayStation 2.dat",
  "psp": "Sony - PlayStation Portable.dat",

  // Atari
  "atari2600": "Atari - 2600.dat",
  "atari5200": "Atari - 5200.dat",
  "atari7800": "Atari - 7800.dat",
  "a7800": "Atari - 7800.dat",
  "atarilynx": "Atari - Lynx.dat",
  "lynx": "Atari - Lynx.dat",
  "jaguarcd": "Atari - Jaguar.dat",

  // NEC
  "pce": "NEC - PC Engine - TurboGrafx 16.dat",
  "pcecd": "NEC - PC Engine CD - TurboGrafx-CD.dat",

  // SNK
  "ngp": "SNK - Neo Geo Pocket.dat",
  "ngpc": "SNK - Neo Geo Pocket Color.dat",

  // Bandai
  "wonderswan": "Bandai - WonderSwan.dat",
  "wonderswancolor": "Bandai - WonderSwan Color.dat",
};

/**
 * Pinned commit SHA for libretro-database.
 *
 * Fetching from `master` HEAD exposes a supply-chain attack surface: a
 * compromised or force-pushed commit could swap DAT content without any
 * change in CartDex code. Pinning to a known-good SHA removes that vector.
 *
 * To update: verify the new commit in the upstream repo, then replace the
 * SHA below. Recommended cadence: quarterly, or after a CartDex DAT-schema
 * change review.
 *
 * Pinned: 2026-05-26 (Vera audit L-3)
 * Upstream: https://github.com/libretro/libretro-database/commit/8180568611548d67377e1f634ebb314ec369a295
 */
const LIBRETRO_DB_COMMIT = "8180568611548d67377e1f634ebb314ec369a295";

const BASE_RAW_URL =
  `https://raw.githubusercontent.com/libretro/libretro-database/${LIBRETRO_DB_COMMIT}/metadat/no-intro/`;

export const libretroDatabaseProvider: DatProvider = {
  id: "libretro-database",
  name: "libretro-database",
  license: "MIT",
  sourceUrl: "https://github.com/libretro/libretro-database",

  async fetch(systemSlug?: string): Promise<Buffer> {
    if (!systemSlug) {
      throw new DatFetchProviderError(
        "libretro-database provider requires a system slug. " +
          "Pass one of: " +
          Object.keys(SLUG_TO_DAT_FILE).join(", ")
      );
    }

    const datFile = SLUG_TO_DAT_FILE[systemSlug];
    if (!datFile) {
      throw new DatFetchProviderError(
        `No libretro-database DAT mapping for system slug "${systemSlug}". ` +
          "If this system exists in the libretro-database repository, add the " +
          "mapping to SLUG_TO_DAT_FILE in libretro-database.ts."
      );
    }

    const url = BASE_RAW_URL + encodeURIComponent(datFile);
    return fetchFromGitHub(url);
  },
};

/**
 * Fetch a DAT file from a GitHub raw URL with all security constraints applied.
 * Shared helper — callers pass a pre-constructed URL they have validated.
 */
export async function fetchFromGitHub(url: string): Promise<Buffer> {
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new DatFetchProviderError(
      `Blocked fetch to disallowed host "${parsed.hostname}". ` +
        `Only ${[...ALLOWED_HOSTS].join(", ")} are permitted for auto-fetch.`
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
    });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    throw new DatFetchNetworkError(`Network error fetching ${url}: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  // With redirect: "manual", any 3xx is surfaced — refuse rather than
  // follow to a host that may not be on ALLOWED_HOSTS.
  if (response.status >= 300 && response.status < 400) {
    throw new DatFetchProviderError(
      `Refusing to follow redirect (HTTP ${response.status}) from ${url}. ` +
        `Auto-fetch only accepts direct responses from allowlisted hosts.`
    );
  }

  if (!response.ok) {
    throw new DatFetchNetworkError(
      `HTTP ${response.status} fetching ${url}`
    );
  }

  // Validate Content-Length before buffering to avoid OOM on a mis-sized response.
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const bytes = parseInt(contentLength, 10);
    if (!isNaN(bytes) && bytes > MAX_DAT_BYTES) {
      throw new DatFetchProviderError(
        `Remote file claims Content-Length of ${bytes} bytes, which exceeds the ` +
          `${MAX_DAT_BYTES}-byte limit. Refusing to buffer.`
      );
    }
  }

  // Stream the body, counting bytes as they arrive. A malicious upstream
  // can return Content-Length: 100 and then stream 10 GB of body; the
  // pre-buffer check above catches declared oversize but not lying bodies,
  // and response.arrayBuffer() will happily buffer until OOM. Here we cap
  // the stream before the full buffer is assembled.
  if (!response.body) {
    throw new DatFetchNetworkError(`Response has no body for ${url}`);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_DAT_BYTES) {
        await reader.cancel();
        throw new DatFetchProviderError(
          `Stream exceeded ${MAX_DAT_BYTES}-byte limit at ${received} bytes — aborting.`
        );
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released/cancelled — ignore.
    }
  }

  return Buffer.concat(chunks, received);
}

/** Exported for tests. */
export { SLUG_TO_DAT_FILE };
