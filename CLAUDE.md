# RomVault

Self-hosted ROM library manager. Scans a filesystem ROM collection, hashes files, matches against No-Intro/Redump DAT files for canonical titles, and provides a web UI + API for browsing.

## Stack

- Next.js 16 App Router (TypeScript)
- SQLite + Drizzle ORM (better-sqlite3)
- Tailwind CSS + shadcn/ui
- fast-xml-parser (No-Intro DAT parsing)
- buffer-crc32 + crypto (file hashing)

## Project Layout

```
app/
  page.tsx              # System grid landing page (SSR)
  layout.tsx
  api/
    scan/route.ts       # POST /api/scan — trigger ROM ingest
    systems/route.ts    # GET /api/systems — list all systems + game counts
    systems/[slug]/     # GET /api/systems/:slug — games for a system
    games/[id]/         # GET /api/games/:id — game detail
lib/
  db/
    index.ts            # Drizzle client (better-sqlite3)
    schema.ts           # Table definitions
    migrate.ts          # ensureSchema() — creates tables idempotently
    seed.ts             # seed() — inserts 9 systems + EmuDeck export profile
  services/
    ingest.ts           # File scanner + hash computer
    dat-parser.ts       # No-Intro XML DAT parser + ROM matcher
  startup.ts            # Called via instrumentation.ts on server boot
instrumentation.ts      # Next.js instrumentation hook — runs ensureSchema + seed
drizzle.config.ts
```

## Data Flow

1. On first boot: instrumentation.ts runs ensureSchema() to create tables, then seed() inserts systems + EmuDeck profile
2. POST /api/scan { path: "/data/roms" } walks directory, hashes files, upserts to games table
3. DAT matching: parse a No-Intro XML DAT, call matchRomsAgainstDat(datGames, systemSlug) — updates titles + sets verified=true on hash matches

## Schema

- systems — known platforms (9 seeded: NES, SNES, N64, GB, GBC, GBA, Genesis, PSX, PSP)
- games — ingested ROM files with CRC32/MD5/SHA1 hashes, file path, verification status
- franchises + game_franchises — franchise groupings (Phase 2)
- collections + collection_games — user-created lists (Phase 2)
- export_profiles — path mapping configs (EmuDeck profile seeded)

## Environment Variables

| Var | Default | Purpose |
|-----|---------|---------|
| DB_PATH | ./data/romvault.db | SQLite file path |
| ROM_ROOT | /data/roms | Default ROM root for scan endpoint |

## Docker

ROMs stay on the filesystem — never copied into the app.

```yaml
services:
  romvault:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - romvault-data:/data
      - /path/to/your/roms:/roms
    environment:
      ROM_ROOT: /roms

volumes:
  romvault-data:
```

## Development

```bash
npm run dev          # Start dev server at localhost:3000
npm run db:generate  # Generate Drizzle migrations from schema changes
npm run db:studio    # Open Drizzle Studio (DB browser)
```

Schema + seed run automatically on npm run dev via the instrumentation hook.

## Phase 2 Targets

- System detail page (/systems/[slug]) with game list, search, filters
- Scraping: ScreenScraper/IGDB box art + metadata fetch
- Export: copy/symlink verified ROMs to EmuDeck folder structure
- Collection management UI
- Franchise grouping
- DAT import UI (drag-and-drop XML)
