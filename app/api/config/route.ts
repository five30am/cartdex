/**
 * GET /api/config
 *
 * Returns runtime configuration values that the browser UI needs but that
 * must NOT be exposed as NEXT_PUBLIC_ env vars (which are inlined into the
 * client bundle at build time and visible in any downloaded JS file).
 *
 * Currently returns:
 *   { apiToken: string }  -- the CARTDEX_API_TOKEN value, so the UI can
 *                            store it in sessionStorage and send it as
 *                            X-Api-Token on all mutation (POST/PATCH/PUT/DELETE)
 *                            requests.
 *
 * Security model:
 *   CartDex is a single-user homelab tool with no session system. This
 *   endpoint does NOT require authentication -- the browser must be able to
 *   fetch the token before it has a token to authenticate with.
 *
 *   This is acceptable because:
 *   - The app runs on a private LAN and is not exposed to the internet.
 *   - The token is already stored in the server environment; serving it via
 *     this endpoint does not widen the attack surface for any user who already
 *     has network access to the UI port.
 *   - The alternative (NEXT_PUBLIC_CARTDEX_API_TOKEN) would embed the token
 *     in every visitor's downloaded JavaScript bundle, which is strictly worse.
 *
 *   If CARTDEX_API_TOKEN is not set, returns an empty string. The UI will
 *     send an empty header, which requireMutationAuth() rejects (fail-closed).
 */

import { NextResponse } from "next/server";

export async function GET() {
  const apiToken = process.env.CARTDEX_API_TOKEN ?? "";
  return NextResponse.json({ apiToken });
}
