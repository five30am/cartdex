/**
 * Mutation auth guard for CartDex API routes.
 *
 * CartDex is a single-user homelab tool — no user sessions or per-user
 * permissions exist. Auth is a shared static token: set CARTDEX_API_TOKEN
 * in the container environment (or .env). Requests must supply the token
 * in the `X-Api-Token` header on all POST / PATCH / PUT / DELETE routes.
 *
 * If CARTDEX_API_TOKEN is not set in the environment the guard logs a warning
 * and REJECTS all mutation requests — fail-closed, not fail-open. This prevents
 * accidentally deploying with an open API after an env misconfiguration.
 *
 * Usage (at the top of any mutation handler):
 *   const authFailure = requireMutationAuth(req);
 *   if (authFailure) return authFailure;
 *
 * Browser UI: the frontend must send the token as `X-Api-Token: <value>`.
 * Token storage client-side: sessionStorage or a runtime config endpoint
 * (GET /api/settings does NOT expose the token).
 */

import { NextRequest } from "next/server";
import { apiError, ApiErrorCode } from "@/lib/api-error";

/**
 * Returns a 401 NextResponse if the request is missing or presents an invalid
 * API token. Returns null if auth passes and the handler should continue.
 *
 * Constant-time comparison is used to prevent timing-based token enumeration.
 */
export function requireMutationAuth(req: NextRequest): ReturnType<typeof apiError> | null {
  const expected = process.env.CARTDEX_API_TOKEN;

  if (!expected || expected.trim() === "") {
    // Fail-closed: no token configured means no mutations allowed.
    console.warn(
      "[auth] CARTDEX_API_TOKEN is not set — mutation endpoints are locked. " +
        "Set CARTDEX_API_TOKEN in the container environment to enable writes."
    );
    return apiError(ApiErrorCode.UNAUTHORIZED);
  }

  const supplied = req.headers.get("x-api-token") ?? "";

  if (!timingSafeEqual(supplied, expected)) {
    return apiError(ApiErrorCode.UNAUTHORIZED);
  }

  return null;
}

/**
 * Constant-time string comparison to prevent token enumeration via timing oracle.
 * JavaScript's === short-circuits on the first differing character, which leaks
 * token length and prefix information over many requests.
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Length mismatch is fine to expose — an attacker already knows valid token
  // length from the env var comment in .env.example. What matters is that
  // comparing two equal-length strings doesn't leak which prefix matched.
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    // XOR accumulates differences without short-circuiting
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
