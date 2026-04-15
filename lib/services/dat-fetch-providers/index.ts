/**
 * DAT fetch provider registry — Ticket 8.
 *
 * PROVIDER POLICY (enforced here, enforced in PR review):
 * =========================================================
 * v1 only accepts providers whose DAT files carry an explicit redistribution
 * license: MIT, BSD, CC-BY, or public domain.
 *
 * The following sources MUST remain manual-upload only — do NOT add providers
 * for them here:
 *   - No-Intro    (redistribution prohibited by ToS)
 *   - Redump      (redistribution prohibited by ToS)
 *   - TOSEC       (redistribution prohibited)
 *
 * Any PR adding a restricted provider will be rejected at code review.
 * =========================================================
 *
 * To add a new permissive provider:
 *   1. Create `<id>.ts` in this directory implementing the `DatProvider` interface.
 *   2. Import and register it below.
 *   3. The `fetch(systemSlug?)` method should throw `DatFetchNetworkError` on
 *      network failure and return a Buffer of the raw DAT file bytes.
 */

export interface DatProvider {
  /** Stable identifier — used in API requests, settings keys, and UI. */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** SPDX license identifier or short description. */
  license: string;
  /** URL of the upstream source, shown in the UI disclaimer. */
  sourceUrl: string;
  /**
   * Fetch one DAT file.
   *
   * @param systemSlug  Optional system identifier (provider-specific semantics).
   *                    Omit to fetch a default or index DAT.
   * @returns           Raw DAT file bytes.
   */
  fetch(systemSlug?: string): Promise<Buffer>;
}

import { libretroDatabaseProvider } from "./libretro-database";

/**
 * Registered providers — order determines UI display order.
 * Only providers with explicit redistribution licenses may appear here.
 */
const PROVIDERS: DatProvider[] = [libretroDatabaseProvider];

/** Look up a provider by ID. Returns undefined if not registered. */
export function getProvider(id: string): DatProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** All registered providers — used to populate the UI dropdown. */
export function getAllProviders(): DatProvider[] {
  return [...PROVIDERS];
}
