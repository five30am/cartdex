import archiver from "archiver";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { collections, collection_games, games, systems, export_profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PassThrough } from "stream";

export interface ExportResult {
  stream: PassThrough;
  filename: string;
}

export interface ExportWarning {
  game_id: number;
  title: string;
  reason: string;
}

export async function exportCollection(
  collectionId: number,
  profileId: number
): Promise<ExportResult> {
  const col = db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .get();

  if (!col) {
    throw new Error("Collection not found");
  }

  const profile = db
    .select()
    .from(export_profiles)
    .where(eq(export_profiles.id, profileId))
    .get();

  if (!profile) {
    throw new Error("Export profile not found");
  }

  const collectionGames = db
    .select({
      id: games.id,
      title: games.title,
      file_path: games.file_path,
      system_slug: systems.slug,
    })
    .from(collection_games)
    .innerJoin(games, eq(collection_games.game_id, games.id))
    .innerJoin(systems, eq(games.system_id, systems.id))
    .where(eq(collection_games.collection_id, collectionId))
    .all();

  if (collectionGames.length === 0) {
    throw new Error("Collection is empty — nothing to export");
  }

  const safeName = col.name.replace(/[^a-z0-9\-_ ]/gi, "_").replace(/\s+/g, "-");
  const safeProfileName = profile.name.replace(/[^a-z0-9\-_ ]/gi, "_").replace(/\s+/g, "-");
  const filename = `${safeName}-${safeProfileName}.zip`;

  const passThrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 0 } }); // level 0 = store only, ROMs don't compress

  archive.on("error", (err) => {
    passThrough.destroy(err);
  });

  archive.pipe(passThrough);

  // Process games async to allow stream to flow
  setImmediate(() => {
    for (const game of collectionGames) {
      const mapping = profile.system_mappings[game.system_slug];
      if (!mapping) {
        console.warn(`[export] No mapping for system ${game.system_slug}, skipping "${game.title}"`);
        continue;
      }

      const absolutePath = game.file_path.startsWith("/")
        ? game.file_path
        : path.join(process.cwd(), game.file_path);

      if (!fs.existsSync(absolutePath)) {
        console.warn(`[export] File not found on disk: ${absolutePath}, skipping "${game.title}"`);
        continue;
      }

      const filename = path.basename(absolutePath);
      const zipPath = `${profile.base_path}/${mapping.folder}/${filename}`;

      archive.file(absolutePath, { name: zipPath });

      // Handle .m3u multi-disc: add all referenced .bin/.cue files
      if (absolutePath.endsWith(".m3u")) {
        try {
          const m3uContent = fs.readFileSync(absolutePath, "utf-8");
          const dir = path.dirname(absolutePath);
          const referencedFiles = m3uContent
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#"));

          for (const ref of referencedFiles) {
            const refPath = path.isAbsolute(ref) ? ref : path.join(dir, ref);
            if (fs.existsSync(refPath)) {
              const refFilename = path.basename(refPath);
              archive.file(refPath, { name: `${profile.base_path}/${mapping.folder}/${refFilename}` });
            } else {
              console.warn(`[export] .m3u reference not found: ${refPath}`);
            }
          }
        } catch (e) {
          console.warn(`[export] Failed to parse .m3u for "${game.title}":`, e);
        }
      }
    }

    archive.finalize();
  });

  return { stream: passThrough, filename };
}
