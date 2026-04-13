import { NextResponse } from "next/server";
import { getSetting } from "@/lib/services/config";

interface ServiceStatus {
  configured: boolean;
  ok: boolean | null;
  error: string | null;
}

async function testScreenScraper(): Promise<ServiceStatus> {
  const devId = await getSetting("screenscraper_dev_id");
  const devPassword = await getSetting("screenscraper_dev_password");

  if (!devId || !devPassword) {
    return { configured: false, ok: null, error: null };
  }

  try {
    const params = new URLSearchParams({
      devid: devId,
      devpassword: devPassword,
      softname: "romvault",
      output: "json",
    });

    const res = await fetch(
      `https://api.screenscraper.fr/api2/ssuserInfos.php?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) }
    );

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
    });

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
