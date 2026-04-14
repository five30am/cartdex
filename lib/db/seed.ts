import { db } from "./index";
import { systems, export_profiles } from "./schema";
import { eq } from "drizzle-orm";

const SYSTEMS = [
  {
    name: "Nintendo Entertainment System",
    slug: "nes",
    extensions: [".nes"],
    dat_source: "No-Intro",
    kind: "console" as const,
  },
  {
    name: "Super Nintendo",
    slug: "snes",
    extensions: [".sfc", ".smc"],
    dat_source: "No-Intro",
    kind: "console" as const,
  },
  {
    name: "Nintendo 64",
    slug: "n64",
    extensions: [".z64", ".n64"],
    dat_source: "No-Intro",
    kind: "console" as const,
  },
  {
    name: "Game Boy",
    slug: "gb",
    extensions: [".gb"],
    dat_source: "No-Intro",
    kind: "handheld" as const,
  },
  {
    name: "Game Boy Color",
    slug: "gbc",
    extensions: [".gbc"],
    dat_source: "No-Intro",
    kind: "handheld" as const,
  },
  {
    name: "Game Boy Advance",
    slug: "gba",
    extensions: [".gba"],
    dat_source: "No-Intro",
    kind: "handheld" as const,
  },
  {
    name: "Sega Genesis",
    slug: "genesis",
    extensions: [".gen", ".md"],
    dat_source: "No-Intro",
    kind: "console" as const,
  },
  {
    name: "Sega Master System",
    slug: "mastersystem",
    extensions: [".sms"],
    dat_source: "No-Intro",
    kind: "console" as const,
  },
  {
    name: "Arcade",
    slug: "arcade",
    extensions: [".zip", ".chd"],
    dat_source: "MAME",
    kind: "console" as const,
  },
  {
    name: "PlayStation",
    slug: "psx",
    // .chd removed — CHD under /roms/arcade/ was being misassigned to psx.
    // PSX CHDs should live under /roms/psx/; arcade CHDs live under /roms/arcade/.
    // The ingest is directory-aware so extension alone is no longer the sole discriminator.
    extensions: [".bin", ".cue", ".iso", ".chd", ".m3u"],
    dat_source: "Redump",
    kind: "console" as const,
  },
  {
    name: "PlayStation Portable",
    slug: "psp",
    extensions: [".iso", ".cso"],
    dat_source: "Redump",
    kind: "handheld" as const,
  },
];

const EMUDECK_PROFILE = {
  name: "EmuDeck (Steam Deck)",
  base_path: "Emulation/roms",
  system_mappings: {
    nes: { folder: "nes" },
    snes: { folder: "snes" },
    n64: { folder: "n64" },
    gb: { folder: "gb" },
    gbc: { folder: "gbc" },
    gba: { folder: "gba" },
    genesis: { folder: "genesis" },
    mastersystem: { folder: "mastersystem" },
    arcade: { folder: "arcade" },
    psx: { folder: "psx" },
    psp: { folder: "psp" },
  },
};

export function seed() {
  console.log("Seeding systems...");

  for (const system of SYSTEMS) {
    const existing = db
      .select({ id: systems.id })
      .from(systems)
      .where(eq(systems.slug, system.slug))
      .get();

    if (!existing) {
      db.insert(systems).values(system).run();
      console.log(`  + ${system.name}`);
    } else {
      // Update extensions and kind in case they changed
      db.update(systems)
        .set({ extensions: system.extensions, kind: system.kind })
        .where(eq(systems.slug, system.slug))
        .run();
      console.log(`  ~ ${system.name} (updated)`);
    }
  }

  console.log("Seeding export profiles...");

  const existingProfiles = db.select({ id: export_profiles.id }).from(export_profiles).all();

  if (existingProfiles.length === 0) {
    db.insert(export_profiles).values(EMUDECK_PROFILE).run();
    console.log(`  + ${EMUDECK_PROFILE.name}`);
  } else {
    console.log(`  ~ Export profiles already seeded`);
  }

  console.log("Seed complete.");
}
