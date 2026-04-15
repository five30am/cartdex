# RomVault — Project Context for Claude

Self-hosted ROM library. Next.js 16 App Router + SQLite (better-sqlite3 + Drizzle). Repo: `five30am/romvault`.

## Where things run (IMPORTANT — don't guess)

- **Container host:** `10.10.5.252` (Portainer) — NOT the Claude VM you're running on
- **Container name:** `romvault`
- **Image:** `ghcr.io/five30am/romvault:latest`
- **Build runner:** self-hosted GH Actions runner on the **Claude VM** (`runs-on: self-hosted` in `.github/workflows/deploy.yml`)
- **Portainer stack ID:** 43 — pulls image via webhook from GH Action after push
- **URL:** Cloudflare tunnel; internal 10.10.5.252:3500 → container :3000
- **Volumes:** `romvault_data` (DB + migrations) · `romvault_artwork` (box art) · bind `/mnt/roms:/roms:rw` (Unraid CIFS)

## Who to delegate to (stop doing this ad-hoc)

- **Infra questions** (container state, volumes, stack config, Portainer): delegate to **Holt**. He has Portainer UI creds in Bitwarden and Portainer env ID 3 memorized.
- **Build/deploy/code/DB schema changes**: delegate to **Kit**.
- **Portainer API from the Claude VM directly:** `PORTAINER_URL` + `PORTAINER_KEY` are in `~/projects/content-ops/.env.local`. Use the API first. Do not `ssh root@10.10.5.252` as a first resort.

Example (Portainer API):
```bash
source ~/projects/content-ops/.env.local
curl -sk "$PORTAINER_URL/api/stacks/43" -H "X-API-Key: $PORTAINER_KEY" | jq .
```

## Inspecting the live DB

Container has no `sqlite3` CLI. From the Portainer host:
```bash
ssh root@10.10.5.252 "docker exec romvault node -e 'const db=require(\"better-sqlite3\")(\"/data/romvault.db\"); console.log(JSON.stringify(db.prepare(\"<SQL>\").all()));'"
```

Or delegate the query to Holt and let him run it. DB path inside container: `/data/romvault.db`.

## `games` table columns (verified 2026-04-14)

- **Core:** `id, system_id, title, slug, file_path, file_size, file_created_at, hash_crc32, hash_md5, hash_sha1, hashed, verified, created_at`
- **Hidden/trash:** `hidden, hidden_at, hidden_reason` — reasons: `trashed` (user delete, 30-day retention), `missing-on-disk` (Phase 3 reconcile)
- **Scraper v1** (description path, ~7384/7598 rows): `description, year, genre, box_art_path, scraped_at`
- **Scraper v2** (region/dedup path, ticket #330): `scraper_region, scraper_languages (JSON), scraper_is_primary_release, scraper_source, scraper_fetched_at` — populated lazily on dupes-page visit, 1 req/sec, 30-day TTL

**Known gap:** v1 scrape discarded region/language from the API response, so v2 re-hits Screenscraper for data we already had. Unifying is a future ticket.

## Key code

- `lib/db/schema.ts` · `lib/db/migrate.ts` — `ensureSchema()` idempotent, runs on startup via `instrumentation.ts`
- `lib/services/ingest.ts` — 3-phase scan: Discover → Hash → Reconcile (Phase 3 marks missing files `hidden=1, reason=missing-on-disk`)
- `lib/services/screenscraper.ts` — API client, 1 req/sec rate limit
- `lib/services/dedup-metadata.ts` — cache layer for v2 scraper fields
- `lib/services/config.ts` — `getSetting()` reads DB first, env fallback
- `lib/utils/dedup.ts` — dedup scoring (metadata 1000–1850, filename 0–100)
- `app/api/duplicates/route.ts` — dupes API, filename fast path + background enrichment
- `app/duplicates/duplicate-browser.tsx` — client, polls 10s while `enrichment_pending`

## Credentials

Screenscraper + Twitch live in DB `settings` table (set via `/settings` UI). Env fallbacks: `SCREENSCRAPER_DEV_ID/DEV_PASSWORD`, `SCREENSCRAPER_USERNAME/PASSWORD`, `TWITCH_CLIENT_ID/CLIENT_SECRET`. DB > env always.

## Deploy

1. Push to main
2. Self-hosted GH Actions runner (on the Claude VM) builds the image and pushes to `ghcr.io/five30am/romvault:latest`
3. Portainer stack 43 receives a webhook → pulls new image → recreates container (volumes preserved)
4. Migrations run on startup via `ensureSchema()` — safe to add columns freely

**Note:** `.github/workflows/deploy.yml` currently ends with an echo claiming "Portainer polls every 5m" — that comment is stale/inaccurate; the actual deploy trigger is the webhook on the Portainer stack side. If redeploys stop working, check the webhook URL in Portainer stack 43 settings.

Pre-GitOps backup at `/opt/romvault.pre-gitops-2026-04-14` on 10.10.5.252 — delete after 2026-04-21 if stable.

## Delegation

Development work goes to **Kit**. All edits must push to main to deploy — local test builds verify compile but don't deploy.
