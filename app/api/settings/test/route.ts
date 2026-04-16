import { NextResponse } from "next/server";
import { getSetting } from "@/lib/services/config";

interface ServiceStatus {
  configured: boolean;
  ok: boolean | null;
  error: string | null;
}

async function testScreenScraper(): Promise<ServiceStatus> {
  const username = await getSetting("screenscraper_username");
  const password = await getSetting("screenscraper_password");

  if (!username || !password) {
    return { configured: false, ok: null, error: null };
  }

  try {
    const params = new URLSearchParams({
      devid: "Guijar",
      devpassword: "BHwOpPqhgFO",
      ssid: username,
      sspassword: password,
      softname: "romvault",
      output: "json",
    });

    const res = await fetch(
      `https://api.screenscraper.fr/api2/ssuserInfos.php?${params.toString()}`,
      {
        signal: AbortSignal.timeout(10_000),
        // Prevent redirect-based SSRF: a MITM or compromised DNS response could
        // return a 302 pointing to an internal service. The target URL is not
        // user-influenced here, but redirect:"manual" is still belt-and-suspenders.
        redirect: "manual",
      }
    );

    // Treat any redirect as a failure — the ScreenScraper API endpoint does not
    // redirect under normal operation.
    if (res.status >= 300 && res.status < 400) {
      return { configured: true, ok: false, error: `Unexpected redirect (HTTP ${res.status})` };
    }

    if (res.ok || res.status === 404) {
      // 404 means the endpoint exists but no specific user data — creds were accepted
      return { configured: true, ok: true, error: null };
    }

    if (res.status === 401 || res.status === 403) {
      return { configured: true, ok: false, error: "Invalid credentials" };
    }

    const text = await res.text().catch(() => "");
    return { configured: true, ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

async function testIGDB(): Promise<ServiceStatus> {
  const clientId = await getSetting("twitch_client_id");
  const clientSecret = await getSetting("twitch_client_secret");

  if (!clientId || !clientSecret) {
    return { configured: false, ok: null, error: null };
  }

  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(10_000),
      // Belt-and-suspenders: same redirect guard as igdb.ts getAccessToken().
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      return { configured: true, ok: false, error: `Unexpected redirect (HTTP ${res.status})` };
    }

    if (res.ok) {
      return { configured: true, ok: true, error: null };
    }

    if (res.status === 400 || res.status === 401) {
      return { configured: true, ok: false, error: "Invalid client credentials" };
    }

    return { configured: true, ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export async function GET() {
  const [screenscraper, igdb] = await Promise.all([
    testScreenScraper(),
    testIGDB(),
  ]);

  return NextResponse.json({ screenscraper, igdb });
}
