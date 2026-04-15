/**
 * Shared constants and error types for the DAT auto-fetch pipeline.
 *
 * Extracted into their own module to avoid a circular dependency between
 * dat-fetch.ts (orchestrator) and dat-fetch-providers/ (implementations),
 * both of which need these values.
 */

/** 50 MB — mirrors the manual upload cap in /api/dats. */
export const MAX_DAT_BYTES = 50 * 1024 * 1024;

/** Hard timeout for any outbound DAT fetch request. */
export const FETCH_TIMEOUT_MS = 30_000;

/**
 * Allowlist of hosts that provider implementations may fetch from.
 * The orchestrator validates the URL before calling provider.fetch(),
 * but individual providers may also call this directly for defence-in-depth.
 *
 * Only GitHub raw content and the GitHub API are permitted. No other hosts.
 * Rationale: libretro-database and HTGDB are both GitHub-hosted. If a future
 * provider needs a different host, add it here with an explicit comment
 * explaining why it is trusted and what its license situation is.
 */
export const ALLOWED_HOSTS = new Set<string>([
  "raw.githubusercontent.com",
  "api.github.com",
]);

/**
 * Thrown when the outbound network request itself fails (timeout, DNS, TCP).
 * The route handler maps this to a 502 response.
 */
export class DatFetchNetworkError extends Error {
  readonly code = "DAT_FETCH_NETWORK_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "DatFetchNetworkError";
  }
}

/**
 * Thrown when a provider can't satisfy the request for a non-network reason:
 * unknown system slug, size limit exceeded, disallowed redirect host, etc.
 * The route handler maps this to a 400/422 response.
 */
export class DatFetchProviderError extends Error {
  readonly code = "DAT_FETCH_PROVIDER_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "DatFetchProviderError";
  }
}
