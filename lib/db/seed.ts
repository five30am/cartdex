import { db } from "./index";
import { systems, export_profiles } from "./schema";
import { eq } from "drizzle-orm";

const SYSTEMS = [
  {
    name: "Nintendo Entertainment System",
    slug: "nes",
    extensions: [".nes", ".zip"],
    dat_source: "No-Intro",
  },
  {
    name: "Super Nintendo",
    slug: "snes",
    extensions: [".sfc", ".smc", ".zip"],
    dat_source: "No-Intro",
  },
  {
    name: "Nintendo 64",
    slug: "n64",
    extensions: [".z64", ".n64", ".zip"],
    dat_source: "No-Intro",
  },
  {
    name: "Game Boy",
    slug: "gb",
    extensions: [".gb", ".zip"],
    dat_source: "No-Intro",
  },
  {
    name: "Game Boy Color",
    slug: "gbc",
    extensions: [".gbc", ".gb", ".zip"],
    dat_source: "No-Intro",
  },
  {
    name: "Game Boy Advance",
    slug: "gba",
    extensions: [".gba", ".zip"],
    dat_source: "No-Intro",
  },
  {
    name: "Sega Genesis",
    slug: "genesis",
    extensions: [".gen", ".md", ".zip"],
    dat_source: "No-Intro",
  },
  {
    name: "PlayStation",
    slug: "psx",
    extensions: [".bin", ".cue", ".iso", ".chd", ".m3u"],
    dat_source: "Redump",
  },
  {
    name: "PlayStation Portable",
    slug: "psp",
    extensions: [".iso", ".cso"],
    dat_source: "Redump",
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
      console.log(`  ~ ${system.name} (already exists)`);
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
