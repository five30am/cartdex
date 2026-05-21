# CartDex

CartDex is a self-hosted ROM library manager. It scans your ROM collection,
matches files against No-Intro DAT databases, scrapes metadata and box art from
ScreenScraper.fr and IGDB/Twitch, and gives you a clean web UI to browse, audit,
and manage your library. Runs entirely in Docker -- no cloud account required.

Landing page: [cartdex.app](https://cartdex.app)

---

## Features

- **ROM scanning** -- recursive directory scan with CRC32, MD5, and SHA1 hashing
- **No-Intro DAT matching** -- import DAT files and verify your ROMs against them; match report + wantlist export
- **Duplicate detection** -- finds multiple regional releases of the same ROM with dedup scoring; flag or hide non-primary copies
- **Metadata scraping** -- title, description, release year, genre, box art via ScreenScraper.fr; franchise data via IGDB
- **DAT auto-fetch** -- scheduled pulls from registered DAT providers (Libretro database) with diff timeline showing what changed between versions
- **Trash + audit** -- soft-delete ROMs to a 30-day retention trash; full audit log of every action
- **Collections** -- create named collections and export them as lists
- **System management** -- enable/disable systems from the browse view; per-system completion stats
- **Publisher and series browsing** -- browse games grouped by publisher or series
- **Ratings and favorites** -- rate games and mark favorites
- **Static API token auth** -- all mutation endpoints (POST/PATCH/PUT/DELETE) are gated behind a configurable API token; fail-closed if unset
- **Light and dark mode**

---

## Screenshots

See [cartdex.app](https://cartdex.app) for screenshots of the current UI.

---

## Quick start

### Prerequisites

- Docker and Docker Compose
- A directory of ROM files accessible to the Docker host

### 1. Create a compose file

```yaml
services:
  cartdex:
    image: ghcr.io/five30am/cartdex:latest
    container_name: cartdex
    restart: unless-stopped
    ports:
      - "3500:3000"
    environment:
      - NODE_ENV=production
      - DB_PATH=/data/cartdex.db
      - ROM_ROOT=/roms
      - CARTDEX_API_TOKEN=your-token-here
      # Optional -- set via the Settings UI instead
      - SCREENSCRAPER_DEV_ID=
      - SCREENSCRAPER_DEV_PASSWORD=
      - TWITCH_CLIENT_ID=
      - TWITCH_CLIENT_SECRET=
    volumes:
      - cartdex_data:/data
      - cartdex_artwork:/app/public/artwork
      - /path/to/your/roms:/roms:rw

volumes:
  cartdex_data:
  cartdex_artwork:
```

### 2. Start the container

```bash
docker compose up -d
```

CartDex runs at `http://localhost:3500`. The database schema is created
automatically on first boot.

### 3. Scan your library

Open the app, click "Scan ROMs", point it at `/roms` (the container path). Then
optionally click "Scrape Metadata" to pull titles, descriptions, and box art.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DB_PATH` | No | Path to SQLite database file. Default: `./data/cartdex.db` |
| `ROM_ROOT` | No | Default ROM root directory used by the scan endpoint. Default: `/data/roms` |
| `CARTDEX_API_TOKEN` | Yes (for writes) | Static API token required on all mutation endpoints. Generate with `openssl rand -hex 32`. If unset, all mutations return 401. |
| `SCREENSCRAPER_DEV_ID` | No | ScreenScraper.fr developer ID. Can be set via Settings UI instead. |
| `SCREENSCRAPER_DEV_PASSWORD` | No | ScreenScraper.fr developer password. Can be set via Settings UI instead. |
| `SCREENSCRAPER_USERNAME` | No | Your ScreenScraper.fr account username (improves API quota). |
| `SCREENSCRAPER_PASSWORD` | No | Your ScreenScraper.fr account password. |
| `TWITCH_CLIENT_ID` | No | Twitch app client ID (used for IGDB franchise metadata). |
| `TWITCH_CLIENT_SECRET` | No | Twitch app client secret. |

Credentials stored in the Settings UI override environment variables.

---

## Development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your local paths
npm run dev
```

The app runs at `http://localhost:3000`. Database migrations run automatically
on startup via the Next.js instrumentation hook (`instrumentation.ts`).

**Stack:** Next.js 16 App Router, TypeScript, SQLite via better-sqlite3 + Drizzle ORM, Tailwind CSS + shadcn/ui.

---

## Acknowledgments

- [ScreenScraper.fr](https://www.screenscraper.fr/) for ROM metadata and box art
- [IGDB](https://www.igdb.com/) via Twitch API for franchise metadata
- [No-Intro](https://www.no-intro.org/) DAT format for ROM verification
- [Libretro](https://github.com/libretro) for publicly available DAT databases
- [shadcn/ui](https://ui.shadcn.com/) for the component library

---

## License

CartDex is licensed under the [GNU General Public License v3.0](./LICENSE).
