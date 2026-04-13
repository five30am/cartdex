import { getSetting } from "./config";

export interface IGDBGame {
  franchises: string[];
  summary: string | null;
  cover_url: string | null;
  genre: string | null;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = await getSetting("twitch_client_id");
  const clientSecret = await getSetting("twitch_client_secret");

  if (!clientId || !clientSecret) {
    console.warn("[igdb] twitch_client_id / twitch_client_secret not set — skipping");
    return null;
  }

  // Return cached token if still valid (with 5 min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.token;
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

    if (!res.ok) {
      console.warn(`[igdb] token fetch failed: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return tokenCache.token;
  } catch (err) {
    console.warn("[igdb] token error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Rate limiter — 4 requests/sec
let igdbRequestCount = 0;
let igdbWindowStart = Date.now();

async function rateLimit(): Promise<void> {
  const now = Date.now();
  if (now - igdbWindowStart >= 1000) {
    igdbRequestCount = 0;
    igdbWindowStart = now;
  }

  igdbRequestCount++;
  if (igdbRequestCount > 4) {
    const waitMs = 1000 - (now - igdbWindowStart);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    igdbRequestCount = 1;
    igdbWindowStart = Date.now();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCoverUrl(cover: any): string | null {
  if (!cover?.url) return null;
  // Prefix with https: and use high-res cover variant
  return `https:${cover.url}`.replace("t_thumb", "t_cover_big");
}

export async function searchIGDB(gameTitle: string): Promise<IGDBGame | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const clientId = (await getSetting("twitch_client_id"))!;

  await rateLimit();

  const query = `search "${gameTitle.replace(/"/g, "")}"; fields name,summary,first_release_date,genres.name,franchises.name,cover.url; limit 1;`;

  try {
    const res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Client-ID": clientId,
        "Content-Type": "text/plain",
      },
      body: query,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[igdb] search failed: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const game = data[0];

    const franchises: string[] = Array.isArray(game.franchises)
      ? game.franchises.map((f: { name?: string }) => f.name).filter(Boolean)
      : [];

    const genres: string[] = Array.isArray(game.genres)
      ? game.genres.map((g: { name?: string }) => g.name).filter(Boolean)
      : [];

    return {
      franchises,
      summary: game.summary ?? null,
      cover_url: parseCoverUrl(game.cover),
      genre: genres[0] ?? null,
    };
  } catch (err) {
    console.warn("[igdb] search error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
