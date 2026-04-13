import fs from "fs";
import { XMLParser } from "fast-xml-parser";
import { db } from "@/lib/db";
import { games, systems } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

export interface DatGame {
  name: string;
  crc32?: string;
  md5?: string;
  sha1?: string;
}

export interface DatHeader {
  name: string;
  description?: string;
  version?: string;
}

export interface ParsedDat {
  header: DatHeader;
  games: DatGame[];
}

export interface MatchResult {
  matched: number;
  unmatched: number;
}

/**
 * Parse a No-Intro XML DAT file and return the header + game list.
 * No-Intro DAT format: <datafile><header>...</header><game name="..."><rom name="..." crc="..." md5="..." sha1="..."/></game></datafile>
 */
export function parseDatFile(filePath: string): ParsedDat {
  const xml = fs.readFileSync(filePath, "utf-8");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "game" || name === "rom",
  });

  const parsed = parser.parse(xml);
  const datafile = parsed.datafile;

  if (!datafile) {
    throw new Error("Invalid DAT file: missing <datafile> root element");
  }

  const header: DatHeader = {
    name: datafile.header?.name ?? "Unknown",
    description: datafile.header?.description,
    version: datafile.header?.version,
  };

  const rawGames: unknown[] = Array.isArray(datafile.game)
    ? datafile.game
    : datafile.game
    ? [datafile.game]
    : [];

  const datGames: DatGame[] = [];

  for (const g of rawGames) {
    const game = g as Record<string, unknown>;
    const name = game["@_name"] as string;
    if (!name) continue;

    // A game entry may have multiple <rom> children — grab the first one for hashes
    const roms = Array.isArray(game.rom) ? game.rom : game.rom ? [game.rom] : [];
    const rom = (roms[0] as Record<string, string>) ?? {};

    datGames.push({
      name,
      crc32: rom["@_crc"]?.toLowerCase(),
      md5: rom["@_md5"]?.toLowerCase(),
      sha1: rom["@_sha1"]?.toLowerCase(),
    });
  }

  return { header, games: datGames };
}

/**
 * Build a lookup map from hash → DatGame for fast matching.
 */
export function buildHashIndex(datGames: DatGame[]): {
  byCrc32: Map<string, DatGame>;
  byMd5: Map<string, DatGame>;
  bySha1: Map<string, DatGame>;
} {
  const byCrc32 = new Map<string, DatGame>();
  const byMd5 = new Map<string, DatGame>();
  const bySha1 = new Map<string, DatGame>();

  for (const game of datGames) {
    if (game.crc32) byCrc32.set(game.crc32, game);
    if (game.md5) byMd5.set(game.md5, game);
    if (game.sha1) bySha1.set(game.sha1, game);
  }

  return { byCrc32, byMd5, bySha1 };
}

/**
 * Match ingested ROMs in the DB against a parsed DAT file by hash.
 * Updates matched games: sets verified=true and corrects the title to the No-Intro canonical name.
 * Returns counts of matched vs unmatched games for the given system slug.
 */
export function matchRomsAgainstDat(
  datGames: DatGame[],
  systemSlug: string
): MatchResult {
  const system = db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.slug, systemSlug))
    .get();

  if (!system) {
    throw new Error(`System not found: ${systemSlug}`);
  }

  const index = buildHashIndex(datGames);

  const allGames = db
    .select()
    .from(games)
    .where(eq(games.system_id, system.id))
    .all();

  let matched = 0;
  let unmatched = 0;

  for (const game of allGames) {
    let datGame: DatGame | undefined;

    if (game.hash_crc32) datGame = index.byCrc32.get(game.hash_crc32);
    if (!datGame && game.hash_md5) datGame = index.byMd5.get(game.hash_md5);
    if (!datGame && game.hash_sha1) datGame = index.bySha1.get(game.hash_sha1);

    if (datGame) {
      db.update(games)
        .set({ title: datGame.name, verified: true })
        .where(eq(games.id, game.id))
        .run();
      matched++;
    } else {
      unmatched++;
    }
  }

  return { matched, unmatched };
}
