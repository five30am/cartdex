import fs from "fs";
import path from "path";
import { getSetting } from "./config";

export interface ScreenScraperGame {
  title: string | null;
  description: string | null;
  year: string | null;
  genre: string | null;
  famille: string | null;
  box_art_url: string | null;
  // v1.2.1 — region metadata for metadata-first dedup scoring
  region: string | null;
  languages: string[];
  is_primary_release: boolean;
  // v1.3 — publisher and series
  publisher: string | null;
  series: string | null;
}

// ScreenScraper system ID mapping by our slug
export const SCREENSCRAPER_SYSTEM_IDS: Record<string, number> = {
  nes: 3,
  snes: 4,
  n64: 14,
  gb: 9,
  gbc: 10,
  gba: 12,
  genesis: 1,
  psx: 57,
  psp: 61,
};

// Simple rate limiter — max 1 request per second
let lastRequestAt = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastRequestAt = Date.now();
}

type AnyRecord = Record<string, unknown>;

function pickByRegion(
  items: AnyRecord[],
  preferredRegions = ["us", "wor", "eu"]
): AnyRecord | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  for (const region of preferredRegions) {
    const match = items.find((i) => i["region"] === region);
    if (match) return match;
  }
  return items[0];
}

function pickByLanguage(
  items: AnyRecord[],
  preferredLang = "en"
): AnyRecord | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const match = items.find((i) => i["langue"] === preferredLang);
  return match ?? items[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGameData(data: any): ScreenScraperGame {
  const jeu = data?.response?.jeu;
  if (!jeu) return { title: null, description: null, year: null, genre: null, famille: null, box_art_url: null, region: null, languages: [], is_primary_release: false, publisher: null, series: null };

  // Title — noms array
  const noms: AnyRecord[] = Array.isArray(jeu.noms) ? jeu.noms : jeu.noms ? [jeu.noms] : [];
  const nomPicked = pickByRegion(noms);
  const title = (nomPicked?.["text"] as string) ?? null;

  // Description — synopsis array
  const synopses: AnyRecord[] = Array.isArray(jeu.synopsis) ? jeu.synopsis : jeu.synopsis ? [jeu.synopsis] : [];
  const synopsisPicked = pickByLanguage(synopses);
  const description = (synopsisPicked?.["text"] as string) ?? null;

  // Release date — dates array
  const dates: AnyRecord[] = Array.isArray(jeu.dates) ? jeu.dates : jeu.dates ? [jeu.dates] : [];
  const datePicked = pickByRegion(dates);
  const rawDate = datePicked?.["text"];
  const year = rawDate ? String(rawDate).substring(0, 4) : null;

  // Genre — genres array
  const genresList: AnyRecord[] = Array.isArray(jeu.genres) ? jeu.genres : jeu.genres ? [jeu.genres] : [];
  let genre: string | null = null;
  if (genresList.length > 0) {
    const firstGenre = genresList[0];
    const genreNames: AnyRecord[] = Array.isArray(firstGenre?.["noms"])
      ? (firstGenre["noms"] as AnyRecord[])
      : firstGenre?.["noms"]
      ? [firstGenre["noms"] as AnyRecord]
      : [];
    const genreName = pickByLanguage(genreNames);
    genre = (genreName?.["text"] as string) ?? null;
  }

  // Franchise / famille
  const familleRaw = jeu.famille;
  const famille: string | null =
    familleRaw && typeof familleRaw === "object"
      ? ((familleRaw as AnyRecord)["text"] as string) ?? null
      : typeof familleRaw === "string"
      ? familleRaw
      : null;

  // Box art — medias array, prefer box-2D region=us
  const medias: AnyRecord[] = Array.isArray(jeu.medias) ? jeu.medias : jeu.medias ? [jeu.medias] : [];
  const boxArtMedias = medias.filter((m) => m["type"] === "box-2D");
  const boxArtPicked = pickByRegion(boxArtMedias);
  const box_art_url = (boxArtPicked?.["url"] as string) ?? null;

  // Region — first published region from dates array (most authoritative)
  const region = (datePicked?.["region"] as string) ?? null;

  // Languages — romLanguages array (e.g. [{langue: "en"}, {langue: "fr"}])
  const romLangs: AnyRecord[] = Array.isArray(jeu.romLanguages)
    ? jeu.romLanguages
    : jeu.romLanguages
    ? [jeu.romLanguages]
    : [];
  const languages: string[] = romLangs
    .map((l) => l["langue"] as string)
    .filter(Boolean);

  // Primary release flag — ScreenScraper marks the canonical entry with topjeu=1 or similar;
  // treat us/wor region release as primary when no explicit marker is present
  const is_primary_release =
    jeu.topjeu === 1 || region === "us" || region === "wor";

  // Publisher — editeur field
  const editeurRaw = jeu.editeur;
  const publisher: string | null =
    editeurRaw && typeof editeurRaw === "object"
      ? ((editeurRaw as AnyRecord)["text"] as string) ?? null
      : typeof editeurRaw === "string"
      ? editeurRaw
      : null;

  // Series — famille field (same as franchise; named "series" in our schema)
  const series: string | null = famille;

  return { title, description, year, genre, famille, box_art_url, region, languages, is_primary_release, publisher, series };
}

// One-time startup warning flag
let _credWarningLogged = false;

async function fetchFromScreenScraper(params: URLSearchParams): Promise<ScreenScraperGame | null> {
  const username = await getSetting("screenscraper_username");
  const password = await getSetting("screenscraper_password");

  if (!username || !password) {
    if (!_credWarningLogged) {
      console.warn("[screenscraper] screenscraper_username / screenscraper_password not configured — metadata-first dedup scoring inactive; falling back to filename-based scoring. Register at screenscraper.fr and add credentials in Settings or via Portainer env vars.");
      _credWarningLogged = true;
    }
    return null;
  }

  // Dev credentials: prefer configured values, fall back to bundled defaults
  const devId = (await getSetting("screenscraper_dev_id")) ?? "Guijar";
  const devPassword = (await getSetting("screenscraper_dev_password")) ?? "BHwOpPqhgFO";

  params.set("devid", devId);
  params.set("devpassword", devPassword);
  params.set("ssid", username);
  params.set("sspassword", password);
  params.set("softname", "romvault");
  params.set("output", "json");

  await rateLimit();

  const url = `https://api.screenscraper.fr/api2/jeuInfos.php?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (res.status === 404 || res.status === 430) {
      // 430 = not found on their side
      return null;
    }

    if (!res.ok) {
      console.warn(`[screenscraper] HTTP ${res.status} for params ${params.toString()}`);
      return null;
    }

    const data = await res.json();
    return parseGameData(data);
  } catch (err) {
    console.warn("[screenscraper] fetch error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function lookupByHash(
  crc32: string,
  md5: string,
  sha1: string,
  systemSlug: string
): Promise<ScreenScraperGame | null> {
  const systemId = SCREENSCRAPER_SYSTEM_IDS[systemSlug];
  const params = new URLSearchParams({
    crc: crc32,
    md5,
    sha1,
    ...(systemId ? { systemeid: String(systemId) } : {}),
  });
  return fetchFromScreenScraper(params);
}

export async function lookupByFilename(
  filename: string,
  systemSlug: string
): Promise<ScreenScraperGame | null> {
  const systemId = SCREENSCRAPER_SYSTEM_IDS[systemSlug];
  const params = new URLSearchParams({
    romnom: filename,
    ...(systemId ? { systemeid: String(systemId) } : {}),
  });
  return fetchFromScreenScraper(params);
}

/**
 * Download box art from a URL and save it to public/artwork/{systemSlug}/{gameSlug}.jpg.
 * Returns the public path on success, null on failure.
 */
export async function downloadBoxArt(
  url: string,
  systemSlug: string,
  gameSlug: string
): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.warn(`[screenscraper] box art download failed: HTTP ${res.status}`);
      return null;
    }

    const dir = path.join(process.cwd(), "public", "artwork", systemSlug);
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${gameSlug}.jpg`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return `/api/artwork/${systemSlug}/${gameSlug}.jpg`;
  } catch (err) {
    console.warn("[screenscraper] box art download error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
