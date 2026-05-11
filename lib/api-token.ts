/**
 * Client-side API token management.
 *
 * RomVault uses a static shared token (ROMVAULT_API_TOKEN) to authenticate
 * all mutation requests. The browser fetches the token once from GET /api/config
 * on first use and caches it in sessionStorage for the lifetime of the tab.
 *
 * The token is NOT stored in NEXT_PUBLIC_ env vars (that would embed it in the
 * JS bundle). Instead, /api/config serves it at runtime -- acceptable for a
 * single-user homelab tool on a private LAN.
 *
 * Usage:
 *   import { mutationHeaders } from "@/lib/api-token";
 *
 *   const res = await fetch("/api/some-mutation", {
 *     method: "POST",
 *     headers: { ...(await mutationHeaders()), "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 *
 * mutationHeaders() returns { "X-Api-Token": "<token>" }.
 * If the token cannot be fetched, it returns an empty object -- the request
 * will reach the server with no token and receive a 401. This keeps the
 * fail-closed guarantee from requireMutationAuth().
 */

const SESSION_KEY = "romvault_api_token";

let fetchPromise: Promise<string> | null = null;

/**
 * Returns the API token, fetching from /api/config on first call per tab.
 * Subsequent calls within the same tab use the sessionStorage cache.
 * A single in-flight fetch is shared to prevent stampede on page load.
 */
async function getApiToken(): Promise<string> {
  // Return cached token from sessionStorage if available
  if (typeof sessionStorage !== "undefined") {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached !== null) return cached;
  }

  // Coalesce concurrent calls into one fetch
  if (!fetchPromise) {
    fetchPromise = fetch("/api/config")
      .then((r) => r.json())
      .then((data: { apiToken?: string }) => {
        const token = data.apiToken ?? "";
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(SESSION_KEY, token);
        }
        fetchPromise = null;
        return token;
      })
      .catch(() => {
        fetchPromise = null;
        return "";
      });
  }

  return fetchPromise;
}

/**
 * Returns headers for mutation requests (POST/PATCH/PUT/DELETE).
 * Always returns an object with "X-Api-Token" set.
 * On fetch error, returns an empty-token header -- the server returns 401.
 */
export async function mutationHeaders(): Promise<{ "X-Api-Token": string }> {
  const token = await getApiToken();
  return { "X-Api-Token": token };
}
